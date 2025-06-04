from flask import Flask, render_template, request, Response, jsonify, send_file
import subprocess, os, re, tempfile
from pydub import AudioSegment

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

@app.route('/merge-stems', methods=['POST'])
def merge_stems():
    data = request.json
    folder = data['folder']
    stem_files = data['stems']
    
    # Create a temporary directory for processing
    with tempfile.TemporaryDirectory() as temp_dir:
        # Load and mix all selected stems
        combined = None
        stem_names = []
        for stem in stem_files:
            file_path = os.path.join(sanitize(folder), 'stems', stem)
            audio = AudioSegment.from_file(file_path)
            # Extract stem name without extension and add to list
            stem_name = os.path.splitext(os.path.basename(stem))[0]
            stem_names.append(stem_name)
            if combined is None:
                combined = audio
            else:
                combined = combined.overlay(audio)
        
        if combined is None:
            return jsonify({'error': 'No stems selected'}), 400
        
        # Create filename: "{youtube_title} {stem1} {stem2}.mp3"
        youtube_title = folder  # folder name is the sanitized YouTube title
        filename = f"{youtube_title} {' '.join(stem_names)}.mp3"
        
        # Export as MP3
        output_path = os.path.join(temp_dir, 'combined.mp3')
        combined.export(output_path, format='mp3')
        
        return send_file(
            output_path,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name=filename
        )

if __name__=='__main__':
    app.run(debug=True)