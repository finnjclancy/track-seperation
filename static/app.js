async function onGo() {
    let url = document.getElementById('url').value;
    let res = await fetch('/api/process', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({url})
    });
    let data = await res.json();
    let div = document.getElementById('player');
    div.innerHTML = `<h2>${data.title}</h2>`;
    const audios = {};
    const stems = data.stems;
    for (let stem in stems) {
      let src = stems[stem];
      let container = document.createElement('div');
      container.innerHTML = `
        <label>${stem}</label>
        <input type="range" min="0" max="1" step="0.01" value="1" id="vol-${stem}" />
        <audio id="audio-${stem}" src="${src}"></audio>
      `;
      div.appendChild(container);
      audios[stem] = document.getElementById(`audio-${stem}`);
      document.getElementById(`vol-${stem}`).oninput = e => audios[stem].volume = e.target.value;
    }
    // Sync play/pause
    let playAll = () => Object.values(audios).forEach(a=>a.play());
    let pauseAll = () => Object.values(audios).forEach(a=>a.pause());
    div.insertAdjacentHTML('beforeend', `
      <button id="play">Play</button>
      <button id="pause">Pause</button>
    `);
    document.getElementById('play').onclick = playAll;
    document.getElementById('pause').onclick = pauseAll;
  }
  document.getElementById('go').onclick = onGo;