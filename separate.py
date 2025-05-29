import os
import re
import subprocess
from yt_dlp import YoutubeDL

def sanitize(title):
    """Turn a title into a safe folder/file name."""
    return re.sub(r'[\\/:"*?<>|]+', '_', title)


def download_youtube(url, download_dir='downloads'):
    """
    Download audio from a YouTube URL and convert to MP3.
    Returns (mp3_path, title).
    """
    os.makedirs(download_dir, exist_ok=True)
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(download_dir, '%(id)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': False,
        'no_warnings': True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        video_id = info.get('id')
        title = info.get('title')
        mp3_path = os.path.join(download_dir, f"{video_id}.mp3")
    return mp3_path, title


def separate(input_path, output_dir):
    """
    Separate audio into stems using Demucs CLI.
    """
    subprocess.run(['demucs', input_path, '-o', output_dir], check=True)


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Download YouTube link or local MP3, then separate into stems.'
    )
    # Accept either URL or input file as a single positional argument
    parser.add_argument('source', help='YouTube URL or path to local MP3')
    args = parser.parse_args()

    src = args.source
    # Check if source looks like a URL
    if src.startswith(('http://', 'https://')):
        print(f"Downloading from {src}...")
        mp3_path, title = download_youtube(src)
        safe = sanitize(title)
        base_dir = safe
        os.makedirs(base_dir, exist_ok=True)
        original = os.path.join(base_dir, f"{safe}.mp3")
        os.replace(mp3_path, original)
        print(f"Saved original audio: {original}")
    else:
        original = src
        name = os.path.splitext(os.path.basename(original))[0]
        safe = sanitize(name)
        base_dir = safe
        os.makedirs(base_dir, exist_ok=True)
        dest = os.path.join(base_dir, os.path.basename(original))
        if original != dest:
            os.replace(original, dest)
        original = dest
        print(f"Using local file: {original}")

    stems_dir = os.path.join(base_dir, 'stems')
    os.makedirs(stems_dir, exist_ok=True)
    print(f"Separating into stems folder: {stems_dir}")
    separate(original, stems_dir)
    print(f"Done! Folder created: '{base_dir}'")

if __name__ == '__main__':
    main()