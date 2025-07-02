from flask import Flask, render_template, request, Response, jsonify, send_file
import subprocess, os, re, tempfile
from pydub import AudioSegment

app = Flask(__name__)

def sanitize(folder):
    return re.sub(r'[\\/:"*?<>|]+', '_', folder)

def parse_progress(line):
    """Parse progress output and return clean messages"""
    line = line.strip()
    
    # Download progress
    download_match = re.match(r'\[download\]\s+(\d+\.?\d*)%', line)
    if download_match:
        percent = float(download_match.group(1))
        if percent == 100:
            return "Download complete! Now processing audio..."
        return f"Downloading audio from YouTube... {percent:.1f}%"
    
    # Demucs progress bar
    if '|' in line and '%|' in line:
        # Extract percentage from progress bar
        percent_match = re.search(r'(\d+)%\|', line)
        if percent_match:
            percent = int(percent_match.group(1))
            if percent == 100:
                return "Processing complete!"
            return f"Processing audio with AI... {percent}%"
    
    # Model selection message
    if 'htdemucs' in line and 'model' in line:
        return "Loading AI model for audio separation..."
    
    # Track separation start
    if 'Separating track' in line:
        return "Starting AI audio separation..."
    
    # Storage location message
    if 'Separated tracks will be stored' in line:
        return "Preparing output directory..."
    
    # Success message
    if "Done! Folder created:" in line:
        folder_match = re.search(r"Done! Folder created: '(.+)'", line)
        if folder_match:
            folder_name = folder_match.group(1)
            return f"Success! Audio separated into stems. Folder: {folder_name}"
        return "Success! Audio separated into stems."
    
    # Skip other technical output
    if any(skip in line for skip in [
        'Selected model is a bag',
        'Important: the default model',
        '[download]',
        'ETA',
        'MiB/s',
        'seconds/s'
    ]):
        return None
    
    return None

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
            clean_message = parse_progress(line)
            if clean_message:
                yield f"data: {clean_message}\n\n"
    
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