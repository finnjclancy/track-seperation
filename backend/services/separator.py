import subprocess
import os
import shutil

def separate_audio(input_path: str, output_dir: str = "temp_stems"):
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
        subprocess.run(cmd, check=True, capture_output=True, text=True)
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

