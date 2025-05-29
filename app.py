import os
import re
import uuid
import subprocess
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from yt_dlp import YoutubeDL

app = Flask(__name__)
CORS(app)

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
        'cookiefile': 'www.youtube.com_cookies.txt',
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url)
        vid = info['id']
        title = info['title']
    mp3_src = os.path.join(job_dir, f"{vid}.mp3")
    mp3_dst = os.path.join(job_dir, sanitize(title) + '.mp3')
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
    os.makedirs(job_dir, exist_ok=True)

    mp3_path, title = download_youtube(url, job_dir)
    stems_dir = os.path.join(job_dir, 'stems')
    separate_stems(mp3_path, stems_dir)

    stems = {
        stem: f"/jobs/{job_id}/stems/{stem}.wav"
        for stem in ['vocals', 'drums', 'bass', 'other']
    }
    return jsonify({'job': job_id, 'title': title, 'stems': stems})

@app.route('/jobs/<job_id>/stems/<filename>')
def serve_stem(job_id, filename):
    return send_from_directory(
        os.path.join(WORK_DIR, job_id, 'stems'),
        filename
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
