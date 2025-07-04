const goBtn = document.getElementById('goBtn');
const playAllBtn = document.getElementById('playAllBtn');
const pauseAllBtn = document.getElementById('pauseAllBtn');
const bpmSlider = document.getElementById('bpmSlider');
const bpmInput = document.getElementById('bpmInput');
const urlInput = document.getElementById('urlInput');
const logArea = document.getElementById('logArea');
const controls = document.getElementById('controls');
const tracksDiv = document.getElementById('tracks');
const progressBar = document.querySelector('.progress-bar');
const progressBarInner = document.querySelector('.progress-bar-inner');
const progressBarProgress = document.querySelector('.progress-bar-progress');
const progressBarHandle = document.querySelector('.progress-bar-handle');
const currentTimeSpan = document.getElementById('currentTime');
const durationSpan = document.getElementById('duration');

// New progress elements
const progressSection = document.getElementById('progressSection');
const statusMessage = document.getElementById('statusMessage');
const progressBarFill = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const downloadPhase = document.getElementById('downloadPhase');
const processingPhase = document.getElementById('processingPhase');
const processingProgress = document.getElementById('processingProgress');
const playbackProgress = document.getElementById('playbackProgress');

let waves = [];
let soloedTracks = new Set();
let previousVolumes = new Map();
let isProgressSeeking = false;
let maxDuration = 0;

// Format time in seconds to MM:SS
function formatTime(seconds) {
  seconds = Math.floor(seconds);
  const minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Update progress bar and time displays
function updateProgress() {
  if (!waves.length || isProgressSeeking) return;
  
  const currentTime = waves[0].getCurrentTime();
  const progress = (currentTime / maxDuration) * 100;
  
  progressBarProgress.style.width = `${progress}%`;
  progressBarHandle.style.left = `${progress}%`;
  currentTimeSpan.textContent = formatTime(currentTime);
}

// Handle progress bar interaction
progressBar.addEventListener('mousedown', (e) => {
  isProgressSeeking = true;
  progressBar.classList.add('seeking');
  updateProgressFromMouse(e);
});

document.addEventListener('mousemove', (e) => {
  if (!isProgressSeeking) return;
  updateProgressFromMouse(e);
});

document.addEventListener('mouseup', () => {
  if (!isProgressSeeking) return;
  isProgressSeeking = false;
  progressBar.classList.remove('seeking');
});

function updateProgressFromMouse(e) {
  const rect = progressBarInner.getBoundingClientRect();
  let progress = (e.clientX - rect.left) / rect.width;
  progress = Math.max(0, Math.min(1, progress));
  
  const time = progress * maxDuration;
  waves.forEach(w => w.seekTo(progress));
  
  progressBarProgress.style.width = `${progress * 100}%`;
  progressBarHandle.style.left = `${progress * 100}%`;
  currentTimeSpan.textContent = formatTime(time);
}

// Update progress display
function updateProgressDisplay(message, percent = null) {
  statusMessage.textContent = message;
  if (percent !== null) {
    progressBarFill.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}%`;
  }
}

// Update phase indicators
function updatePhaseIndicators(phase, status) {
  if (phase === 'download') {
    if (status === 'active') {
      downloadPhase.classList.add('active');
      downloadPhase.classList.remove('complete');
    } else if (status === 'complete') {
      downloadPhase.classList.remove('active');
      downloadPhase.classList.add('complete');
    }
  } else if (phase === 'processing') {
    if (status === 'active') {
      processingPhase.classList.add('active');
      processingPhase.classList.remove('complete');
      processingProgress.classList.remove('hidden');
    } else if (status === 'complete') {
      processingPhase.classList.remove('active');
      processingPhase.classList.add('complete');
      processingProgress.classList.add('hidden');
    }
  }
}

// Load and separate on click
goBtn.onclick = () => {
  const url = urlInput.value.trim();
  if (!url) return;
  
  // Show progress section and hide other elements
  progressSection.classList.remove('hidden');
  logArea.classList.add('hidden');
  tracksDiv.innerHTML = '';
  controls.classList.add('hidden');
  playbackProgress.classList.add('hidden');
  
  // Reset phases
  downloadPhase.classList.remove('active', 'complete');
  processingPhase.classList.remove('active', 'complete');
  processingProgress.classList.add('hidden');
  
  // Start download phase
  updatePhaseIndicators('download', 'active');
  updateProgressDisplay('Starting download...');

  let completedSuccessfully = false;

  const evt = new EventSource(`/download?url=${encodeURIComponent(url)}`);
  evt.onmessage = e => {
    const message = e.data;
    
    // Parse progress from message
    if (message.includes('Downloading audio from YouTube...')) {
      const percentMatch = message.match(/(\d+\.?\d*)%/);
      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        updateProgressDisplay(`Downloading... ${percent.toFixed(1)}%`);
      }
    } else if (message.includes('Download complete! Now processing audio...')) {
      // Complete download phase, start processing phase
      updatePhaseIndicators('download', 'complete');
      updatePhaseIndicators('processing', 'active');
      updateProgressDisplay('Download complete! Starting AI processing...');
    } else if (message.includes('Processing audio with AI...')) {
      const percentMatch = message.match(/(\d+)%/);
      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        updateProgressDisplay(`Processing with AI... ${percent}%`, percent);
      }
    } else if (message.includes('Processing complete!')) {
      updatePhaseIndicators('processing', 'complete');
      updateProgressDisplay('Processing complete!', 100);
    } else if (message.includes('Success!')) {
      completedSuccessfully = true;
      updateProgressDisplay(message, 100);
      setTimeout(() => {
        progressSection.classList.add('hidden');
        evt.close();
        const folderMatch = message.match(/Folder: (.+)/);
        if (folderMatch) {
          loadStems(folderMatch[1]);
        }
      }, 1000);
    } else {
      // For other messages, just update the text without changing progress
      updateProgressDisplay(message);
    }
  };
  
  evt.onerror = () => {
    // Only show error if we haven't successfully completed
    if (!completedSuccessfully) {
      updateProgressDisplay('Error occurred during processing');
    }
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
  const selectedStems = new Set();
  maxDuration = 0;
  
  // Add download combined button to controls
  const downloadCombinedBtn = document.createElement('button');
  downloadCombinedBtn.textContent = 'Download Selected';
  downloadCombinedBtn.className = 'download-combined-btn';
  downloadCombinedBtn.disabled = true;
  controls.insertBefore(downloadCombinedBtn, bpmSlider.parentElement);
  
  downloadCombinedBtn.onclick = async () => {
    if (selectedStems.size === 0) return;
    
    try {
      const response = await fetch('/merge-stems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folder: folder,
          stems: Array.from(selectedStems)
        })
      });
      
      if (!response.ok) throw new Error('Failed to merge stems');
      
      // Create filename: "{youtube_title} - {stem1}, {stem2}.mp3"
      const selectedStemNames = Array.from(selectedStems).map(stem => {
        return stem.split('/').pop().replace(/\.(wav|mp3)/i, '');
      });
      
      let filename;
      if (selectedStemNames.length === 1) {
        filename = `${folder} - ${selectedStemNames[0]}.mp3`;
      } else {
        filename = `${folder} - ${selectedStemNames.join(', ')}.mp3`;
      }
      
      // Create a temporary link to download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading combined stems:', error);
      alert('Failed to download combined stems');
    }
  };

  files.forEach((file, index) => {
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
    
    const selectBtn = document.createElement('button');
    selectBtn.textContent = 'Select';
    selectBtn.className = 'select-btn';
    
    selectBtn.onclick = () => {
      const isSelected = selectedStems.has(file);
      if (isSelected) {
        selectedStems.delete(file);
        selectBtn.classList.remove('active');
      } else {
        selectedStems.add(file);
        selectBtn.classList.add('active');
      }
      downloadCombinedBtn.disabled = selectedStems.size === 0;
    };

    const muteBtn = document.createElement('button');
    muteBtn.textContent = 'Mute';
    muteBtn.className = 'mute-btn unmuted';
    
    const soloBtn = document.createElement('button');
    soloBtn.textContent = 'Solo';
    soloBtn.className = 'solo-btn';
    
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

    ctrlBox.append(selectBtn, muteBtn, soloBtn, slider, dlBtn);
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
    
    ws.on('ready', () => {
      maxDuration = Math.max(maxDuration, ws.getDuration());
      durationSpan.textContent = formatTime(maxDuration);
    });
    
    ws.on('audioprocess', updateProgress);
    
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

    // Solo functionality
    soloBtn.onclick = () => {
      if (soloedTracks.has(index)) {
        // Unsolo this track
        soloedTracks.delete(index);
        soloBtn.classList.remove('active');
        
        if (soloedTracks.size === 0) {
          // If no tracks are soloed, restore all tracks to their previous state
          waves.forEach((w, i) => {
            const prevVol = previousVolumes.get(i) || 1;
            w.setVolume(prevVol);
            const trackMuteBtn = tracksDiv.children[i].querySelector('.mute-btn');
            if (prevVol > 0) {
              trackMuteBtn.classList.remove('muted');
              trackMuteBtn.classList.add('unmuted');
              trackMuteBtn.textContent = 'Mute';
            }
          });
        } else {
          // Some tracks are still soloed, mute this track
          ws.setVolume(0);
          muteBtn.classList.remove('unmuted');
          muteBtn.classList.add('muted');
          muteBtn.textContent = 'Unmute';
        }
      } else {
        // Solo this track
        if (soloedTracks.size === 0) {
          // First track being soloed, save current volumes
          waves.forEach((w, i) => {
            previousVolumes.set(i, w.getVolume());
          });
        }
        soloedTracks.add(index);
        soloBtn.classList.add('active');
        
        // Unmute this track and mute all non-soloed tracks
        waves.forEach((w, i) => {
          const isSoloed = soloedTracks.has(i);
          w.setVolume(isSoloed ? (previousVolumes.get(i) || 1) : 0);
          const trackMuteBtn = tracksDiv.children[i].querySelector('.mute-btn');
          if (isSoloed) {
            trackMuteBtn.classList.remove('muted');
            trackMuteBtn.classList.add('unmuted');
            trackMuteBtn.textContent = 'Mute';
          } else {
            trackMuteBtn.classList.remove('unmuted');
            trackMuteBtn.classList.add('muted');
            trackMuteBtn.textContent = 'Unmute';
          }
        });
      }
    };

    // Mute & volume controls
    muteBtn.onclick = () => {
      isMuted = !isMuted;
      if (isMuted) {
        prevVol = Number(slider.value);
        slider.value = 0;
        ws.setVolume(0);
        muteBtn.textContent = 'Unmute';
        muteBtn.classList.remove('unmuted');
        muteBtn.classList.add('muted');
      } else {
        slider.value = prevVol;
        ws.setVolume(prevVol);
        muteBtn.textContent = 'Mute';
        muteBtn.classList.remove('muted');
        muteBtn.classList.add('unmuted');
      }
    };
    
    slider.oninput = () => {
      const vol = Number(slider.value);
      ws.setVolume(vol);
      isMuted = vol === 0;
      muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('muted', isMuted);
      muteBtn.classList.toggle('unmuted', !isMuted);
    };
  });

  // BPM control listener
  function updateSpeed(value) {
    value = Math.max(0, Math.min(200, value));
    const rate = value / 100;
    bpmSlider.value = value;
    bpmInput.value = value;
    waves.forEach(w => w.setPlaybackRate(rate));
  }

  bpmSlider.oninput = () => {
    updateSpeed(bpmSlider.value);
  };

  bpmInput.oninput = () => {
    let value = parseInt(bpmInput.value);
    if (isNaN(value)) return;
    value = Math.max(0, Math.min(200, value));
    updateSpeed(value);
  };

  controls.classList.remove('hidden');
  playbackProgress.classList.remove('hidden');
}

// Global play/pause
playAllBtn.onclick = () => waves.forEach(w => w.play());
pauseAllBtn.onclick = () => waves.forEach(w => w.pause());