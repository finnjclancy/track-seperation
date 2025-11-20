from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
import uuid
import traceback
from services.downloader import download_audio, get_video_metadata
from services.separator import separate_audio
from services.storage import upload_file, supabase
import soundfile as sf

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class YoutubeRequest(BaseModel):
    url: str
    user_id: str # Pass the user ID to associate the project

def process_audio_task(url: str, user_id: str, project_id: str):
    temp_dir = f"temp_{project_id}"
    try:
        metadata = get_video_metadata(url)
        video_id = metadata["id"]
        base_title = metadata["title"]

        def mark_completed(stems_map, message):
            supabase.table("projects").update({
                "status": "completed",
                "progress": 100,
                "status_message": message,
                "title": base_title,
                "stems": stems_map
            }).eq("id", project_id).execute()

        existing = supabase.table("stems").select("id, stem_type, url, duration, user_id, video_id").eq("video_id", video_id).execute()
        existing_rows = existing.data or []
        if existing_rows:
            user_rows = [row for row in existing_rows if row.get("user_id") == user_id]
            stems_source = user_rows if user_rows else existing_rows
            stems_map = {row["stem_type"]: row["url"] for row in stems_source}

            link_rows = [{
                "project_id": project_id,
                "stem_id": row["id"],
                "user_id": user_id
            } for row in existing_rows]
            if link_rows:
                supabase.table("project_stems").upsert(
                    link_rows,
                    on_conflict="project_id,stem_id"
                ).execute()

            status_note = "Stems already in your library" if user_rows else "Stems ready (reused existing processing)"
            mark_completed(stems_map, status_note)
            return

        # 1. Download
        print(f"Downloading {url}...")
        download_info = download_audio(url, output_dir=temp_dir, project_id=project_id)
        audio_path = download_info["path"]
        title = download_info["title"]
        video_id = download_info["id"]
        
        # 2. Separate
        print(f"Separating {title}...")
        supabase.table("projects").update({
            "status": "separating",
            "title": title,
            "progress": 30,
            "status_message": "AI separating tracks (this takes about 60s)..."
        }).eq("id", project_id).execute()

        stems = separate_audio(audio_path, output_dir=temp_dir, project_id=project_id)
        
        # 3. Upload Stems
        supabase.table("projects").update({
            "status": "uploading",
            "progress": 80,
            "status_message": "Uploading stems to cloud..."
        }).eq("id", project_id).execute()

        stem_urls = {}
        stem_records = []
        total_stems = len(stems)
        for idx, (stem_name, stem_path) in enumerate(stems.items(), start=1):
            # Destination: user_id/project_id/stem_name.wav
            dest_path = f"{user_id}/{project_id}/{stem_name}.wav"
            public_url = upload_file(stem_path, "stems", dest_path)
            stem_urls[stem_name] = public_url
            # Capture metadata
            duration = None
            try:
                info = sf.info(stem_path)
                duration = float(info.duration)
            except Exception as metadata_err:
                print(f"Warning: failed to read duration for {stem_name}: {metadata_err}")
            stem_records.append({
                "project_id": project_id,
                "user_id": user_id,
                "name": f"{title} - {stem_name}",
                "stem_type": stem_name,
                "url": public_url,
                "duration": duration,
                "video_id": video_id
            })

            supabase.table("projects").update({
                "progress": 80 + int((idx / total_stems) * 20),
                "status_message": f"Uploading {stem_name} ({idx}/{total_stems})"
            }).eq("id", project_id).execute()

        project_links = []
        if stem_records:
            upserted = supabase.table("stems").upsert(
                stem_records,
                on_conflict="video_id,stem_type",
                returning="representation"
            ).execute()
            inserted_rows = upserted.data or []
            for row in inserted_rows:
                project_links.append({
                    "project_id": project_id,
                    "stem_id": row["id"],
                    "user_id": user_id
                })

        if project_links:
            supabase.table("project_stems").upsert(
                project_links,
                on_conflict="project_id,stem_id"
            ).execute()

        # 4. Save Final Result
        supabase.table("projects").update({
            "status": "completed",
            "progress": 100,
            "status_message": "Ready to mix!",
            "stems": stem_urls
        }).eq("id", project_id).execute()
        
        print(f"Project {project_id} completed.")

    except Exception as e:
        print(f"Error processing project {project_id}: {e}")
        traceback.print_exc()
        supabase.table("projects").update({
            "status": "failed", 
            "error": str(e),
            "status_message": "Process failed."
        }).eq("id", project_id).execute()
    
    finally:
        # Cleanup
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@app.get("/")
def read_root():
    return {"status": "online", "service": "AI Music Studio Backend"}

@app.post("/process-youtube")
async def process_youtube(request: YoutubeRequest, background_tasks: BackgroundTasks):
    # Create a new project entry in Supabase first
    project_id = str(uuid.uuid4())
    
    # Initialize project in DB
    try:
        print(f"Creating project {project_id} for user {request.user_id}")
        supabase.table("projects").insert({
            "id": project_id,
            "user_id": request.user_id,
            "status": "pending",
            "progress": 0,
            "status_message": "Initializing...",
            "original_url": request.url
        }).execute()
    except Exception as e:
        print(f"Failed to create project: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create project: {e}")

    background_tasks.add_task(process_audio_task, request.url, request.user_id, project_id)
    
    return {"status": "processing_started", "project_id": project_id}
