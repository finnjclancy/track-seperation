import subprocess
import os
import shutil
import time
from services.storage import supabase

def separate_audio(input_path: str, output_dir: str = "temp_stems", project_id: str = None):
    """
    Separates audio using Demucs.
    Returns a dictionary of stem paths.
    """
    # Ensure output directory exists
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Run Demucs
    # -n htdemucs: Use the Hybrid Transformer model (fast and good quality)
    # --out: Output directory
    cmd = ["demucs", "-n", "htdemucs", "--out", output_dir, input_path]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        progress_points = [35, 40, 45, 50, 55, 60, 65, 70]
        next_update = 0
        last_update = 0.0

        while True:
            line = process.stdout.readline()
            if line:
                print(line.strip())
            if process.poll() is not None:
                break
            if project_id and next_update < len(progress_points):
                now = time.time()
                if now - last_update > 5:  # update every ~5 seconds
                    supabase.table("projects").update({
                        "progress": progress_points[next_update],
                        "status_message": f"Separating... (~{progress_points[next_update]}%)"
                    }).eq("id", project_id).execute()
                    next_update += 1
                    last_update = now

        stderr = process.communicate()[1]
        if process.returncode != 0:
            print(f"Demucs Error: {stderr}")
            raise Exception("Audio separation failed")
    except subprocess.CalledProcessError as e:
        print(f"Demucs Error: {e.stderr}")
        raise Exception("Audio separation failed")

    # Demucs creates a subfolder with the filename (minus extension)
    track_name = os.path.splitext(os.path.basename(input_path))[0]
    stem_folder = os.path.join(output_dir, "htdemucs", track_name)
    
    if not os.path.exists(stem_folder):
        raise Exception(f"Stems not found at {stem_folder}")

    # Collect stems
    stems = {}
    for stem in ["vocals", "drums", "bass", "other"]:
        stem_path = os.path.join(stem_folder, f"{stem}.wav")
        if os.path.exists(stem_path):
            stems[stem] = stem_path
            
    return stems
