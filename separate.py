import os, re, shutil, subprocess
from yt_dlp import YoutubeDL

def sanitize(name):
    return re.sub(r'[\/:\"*?<>|]+', '_', name).strip()[:100]

def download_youtube(url, tmp='downloads'):
    os.makedirs(tmp, exist_ok=True)
    opts = {
        'format': 'bestaudio',
        'outtmpl': os.path.join(tmp, '%(id)s.%(ext)s'),
        'postprocessors': [
            {'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3'}
        ],
        'quiet': True
    }
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
    return os.path.join(tmp, f"{info['id']}.mp3"), info['title']

def separate(src, out):
    # Use a simpler approach - run demucs with a clean output directory
    # First, clean up any existing stems directory
    if os.path.exists(out):
        shutil.rmtree(out)
    
    # Run demucs with explicit output format
    subprocess.run(['demucs', '--out', out, src], check=True)

if __name__ == '__main__':
    import sys
    src = sys.argv[1]
    if src.startswith('http'):
        path, title = download_youtube(src)
        base = sanitize(title)
        os.makedirs(base, exist_ok=True)
        final = os.path.join(base, f"{base}.mp3")
        os.replace(path, final)
        shutil.rmtree('downloads', ignore_errors=True)
    else:
        base = sanitize(os.path.splitext(os.path.basename(src))[0])
        os.makedirs(base, exist_ok=True)
        final = os.path.join(base, os.path.basename(src))
        os.replace(src, final)
    
    # Create stems directory
    stems = os.path.join(base, 'stems')
    os.makedirs(stems, exist_ok=True)
    
    # Separate the audio
    separate(final, stems)
    print(f"Done! Folder created: '{base}'")