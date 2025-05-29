import os
import re
import uuid
import subprocess
from flask import Blueprint, request, jsonify, send_from_directory
from yt_dlp import YoutubeDL

app = Blueprint('api', __name__)
BASE = os.path.abspath(os.path.dirname(__file__))
WORK_DIR = os.path.join(BASE, 'jobs')
os.makedirs(WORK_DIR, exist_ok=True)

def sanitize(title):
    return re.sub(r'[\\/:"*?<>|]+', '_', title)


def download_youtube(url, job_dir):
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(job_dir, '%(id)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url)
        vid = info['id']
        title = info['title']
    mp3_src = os.path.join(job_dir, f"{vid}.mp3")
    rename = sanitize(title) + '.mp3'
    mp3_dst = os.path.join(job_dir, rename)
    os.replace(mp3_src, mp3_dst)
    return mp3_dst, sanitize(title)


def separate_stems(mp3_path, stems_dir):
    os.makedirs(stems_dir, exist_ok=True)
    subprocess.run(['demucs', mp3_path, '-o', stems_dir], check=True)


@app.route('/process', methods=['POST'])
def process():
    data = request.json
    url = data.get('url')
    if not url:
        return jsonify({'error': 'URL missing'}), 400
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(WORK_DIR, job_id)
    os.makedirs(job_dir)
    # Download
    mp3_path, title = download_youtube(url, job_dir)
    # Separate
    stems_dir = os.path.join(job_dir, 'stems')
    separate_stems(mp3_path, stems_dir)
    # List stems
    stems = {}
    for stem in ['vocals', 'drums', 'bass', 'other']:
        fname = f"{stem}.wav"
        stems[stem] = f"/api/jobs/{job_id}/stems/{fname}"
    return jsonify({'job': job_id, 'title': title, 'stems': stems})

@app.route('/jobs/<job_id>/stems/<filename>')
def serve_stem(job_id, filename):
    return send_from_directory(os.path.join(WORK_DIR, job_id, 'stems'), filename)