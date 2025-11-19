import yt_dlp
import os
import re
from services.storage import supabase

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name)

def download_audio(url: str, output_dir: str = "temp_downloads", project_id: str = None):
    """
    Downloads audio from YouTube and returns the path and title.
    Updates Supabase with progress if project_id is provided.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    def progress_hook(d):
        if d['status'] == 'downloading' and project_id:
            try:
                # Calculate percentage
                p = d.get('_percent_str', '0%').replace('%','')
                percent = float(p)
                
                # Map download progress (0-100) to overall progress (0-30)
                overall_progress = int(percent * 0.3)
                
                supabase.table("projects").update({
                    "progress": overall_progress,
                    "status_message": f"Downloading... {percent:.1f}%"
                }).eq("id", project_id).execute()
            except:
                pass

    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': f'{output_dir}/%(id)s.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'progress_hooks': [progress_hook]
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        video_id = info['id']
        title = info['title']
        # yt-dlp with ffmpeg extract audio creates .mp3
        file_path = os.path.join(output_dir, f"{video_id}.mp3")
        
        return {
            "path": file_path,
            "title": sanitize_filename(title),
            "id": video_id
        }
