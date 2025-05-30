const goBtn = document.getElementById('goBtn');
const playAllBtn = document.getElementById('playAllBtn');
const pauseAllBtn = document.getElementById('pauseAllBtn');
const bpmSlider = document.getElementById('bpmSlider');
const bpmValue = document.getElementById('bpmValue');
const urlInput = document.getElementById('urlInput');
const logArea = document.getElementById('logArea');
const controls = document.getElementById('controls');
const tracksDiv = document.getElementById('tracks');

let waves = [];

// Load and separate on click
goBtn.onclick = () => {
  const url = urlInput.value.trim();
  if (!url) return;
  logArea.textContent = '';
  tracksDiv.innerHTML = '';
  controls.classList.add('hidden');

  const evt = new EventSource(`/download?url=${encodeURIComponent(url)}`);
  evt.onmessage = e => {
    // Append newline
    logArea.textContent += e.data + '\n';
    logArea.scrollTop = logArea.scrollHeight;
    const m = e.data.match(/Done! Folder created: '(.+)'/);
    if (m) {
      evt.close();
      loadStems(m[1]);
    }
  };
  evt.onerror = () => {
    logArea.textContent += 'Error\n';
    evt.close();
  };
};

function loadStems(folder) {
  fetch(`/stems/${encodeURIComponent(folder)}`)
    .then(res => res.json())
    .then(files => buildUI(folder, files));
}

function buildUI(folder, files) {
  waves = [];
  files.forEach(file => {
    const url = `/stems/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
    const name = file.split('/').pop().replace(/\.(wav|mp3)/i, '');

    // Card container
    const card = document.createElement('div');
    card.className = 'track-card';

    // Header with name and controls
    const header = document.createElement('div');
    header.className = 'track-header';
    const title = document.createElement('div');
    title.className = 'track-name';
    title.textContent = name;
    const ctrlBox = document.createElement('div');
    ctrlBox.className = 'track-controls';
    const muteBtn = document.createElement('button');
    muteBtn.textContent = 'Mute';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0; slider.max = 1; slider.step = 0.01; slider.value = 1;
    let prevVol = 1;
    let isMuted = false;
    const dlBtn = document.createElement('a');
    dlBtn.href = url;
    dlBtn.download = `${name}.wav`;
    dlBtn.textContent = '⬇'; // down arrow icon
    dlBtn.title = 'Download';

    ctrlBox.append(muteBtn, slider, dlBtn);
    header.append(title, ctrlBox);
    card.append(header);

    // Waveform
    const wfDiv = document.createElement('div');
    wfDiv.className = 'waveform';
    card.append(wfDiv);
    tracksDiv.append(card);

    // WaveSurfer setup
    const ws = WaveSurfer.create({
      container: wfDiv,
      waveColor: '#e5e7eb',
      progressColor: 'var(--accent)',
      cursorColor: 'var(--accent)',
      height: 80,
      responsive: true
    });
    ws.load(url);
    waves.push(ws);

    // Sync scrubbing (click and drag)
    let isDown = false;
    wfDiv.addEventListener('mousedown', () => isDown = true);
    wfDiv.addEventListener('mouseup', () => isDown = false);
    wfDiv.addEventListener('mouseleave', () => isDown = false);
    wfDiv.addEventListener('mousemove', e => {
      if (!isDown) return;
      const rect = wfDiv.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      waves.forEach(w => w.seekTo(pos));
    });
    wfDiv.addEventListener('click', e => {
      const rect = wfDiv.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      waves.forEach(w => w.seekTo(pos));
    });

    // Mute & volume controls
    muteBtn.onclick = () => {
      isMuted = !isMuted;
      if (isMuted) {
        prevVol = Number(slider.value);
        slider.value = 0;
        ws.setVolume(0);
        muteBtn.textContent = 'Unmute';
      } else {
        slider.value = prevVol;
        ws.setVolume(prevVol);
        muteBtn.textContent = 'Mute';
      }
    };
    slider.oninput = () => {
      const vol = Number(slider.value);
      ws.setVolume(vol);
      isMuted = vol === 0;
      muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
    };
  });

  // BPM control listener
  bpmSlider.oninput = () => {
    const rate = bpmSlider.value / 100;
    bpmValue.textContent = `${bpmSlider.value}%`;
    waves.forEach(w => w.setPlaybackRate(rate));
  };

  controls.classList.remove('hidden');
}

// Global play/pause
playAllBtn.onclick = () => waves.forEach(w => w.play());
pauseAllBtn.onclick = () => waves.forEach(w => w.pause());