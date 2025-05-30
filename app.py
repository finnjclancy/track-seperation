from flask import Flask, render_template, request, Response, jsonify, send_file
import subprocess, os, re

app = Flask(__name__)

def sanitize(folder):
    return re.sub(r'[\\/:"*?<>|]+', '_', folder)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/download')
def download():
    url = request.args.get('url')
    cmd = ['python3', 'separate.py', url]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    def stream():
        for line in proc.stdout:
            yield f"data: {line}\n\n"
    return Response(stream(), mimetype='text/event-stream')

@app.route('/stems/<folder>')
def list_stems(folder):
    root = os.path.join(sanitize(folder), 'stems')
    rel_files = []
    for dirpath, _, filenames in os.walk(root):
        for fname in filenames:
            rel_files.append(os.path.relpath(os.path.join(dirpath, fname), root))
    return jsonify(sorted(rel_files))

@app.route('/stems/<folder>/<path:fname>')
def serve_stem(folder, fname):
    file_path = os.path.join(sanitize(folder), 'stems', fname)
    ext = os.path.splitext(fname)[1].lower()
    mime = 'audio/mpeg' if ext == '.mp3' else 'audio/wav'
    return send_file(file_path, mimetype=mime)

if __name__=='__main__':
    app.run(debug=True)