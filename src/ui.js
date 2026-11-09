// RYŪ · live scrub / player UI (owner: engine). Used by index.html (dev) and the single-file player.
// Keys: space play/pause · ←/→ one frame · shift+←/→ one second · [ / ] previous / next shot · H hide the bar · F fullscreen
export function liveUI(mc, q = new URLSearchParams(location.search), { audio = null, title = 'RYŪ · 龍', autoplay = false } = {}) {
  const { SHOTS, FPS, DURATION, FRAMES } = mc;
  const css = document.createElement('style');
  css.textContent = `html,body{margin:0;height:100%;background:#0b0d14;overflow:hidden;font:13px/1.3 system-ui,sans-serif;color:#e8ecf4}
  #mc-stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
  #mc-stage canvas{max-width:100vw;max-height:100vh;width:100vw;height:56.25vw;object-fit:contain;background:#000}
  #mc-bar{position:fixed;left:0;right:0;bottom:0;padding:8px 14px 10px;background:linear-gradient(transparent,rgba(5,7,12,.85) 35%);transition:opacity .3s}
  #mc-bar.hide{opacity:0} #mc-bar:hover{opacity:1}
  #mc-row{display:flex;gap:10px;align-items:center} #mc-row button{background:#1d2333;color:#e8ecf4;border:1px solid #39415a;border-radius:6px;padding:4px 10px;cursor:pointer}
  #mc-time{font-variant-numeric:tabular-nums;min-width:150px} #mc-info{opacity:.8;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #mc-track{position:relative;height:22px;margin-top:6px;cursor:pointer} #mc-track .sh{position:absolute;top:6px;height:10px;border-left:1px solid rgba(255,255,255,.35);font-size:9px;opacity:.7;padding-left:2px;box-sizing:border-box;overflow:hidden}
  #mc-track .sh.cur{background:rgba(120,170,255,.25)} #mc-head{position:absolute;top:0;width:2px;height:22px;background:#ffb070}`;
  document.head.appendChild(css);
  const stage = document.createElement('div'); stage.id = 'mc-stage'; stage.appendChild(mc.canvas); document.body.appendChild(stage);
  const bar = document.createElement('div'); bar.id = 'mc-bar';
  bar.innerHTML = `<div id="mc-row"><button id="mc-play">▶</button><span id="mc-time"></span><span id="mc-info"></span><span id="mc-fps"></span></div><div id="mc-track"><div id="mc-head"></div></div>`;
  document.body.appendChild(bar);
  const $ = (id) => document.getElementById(id), track = $('mc-track');
  for (const s of SHOTS) { const e = document.createElement('div'); e.className = 'sh'; e.dataset.id = s.id; e.style.left = (s.t0 / DURATION * 100) + '%'; e.style.width = ((s.t1 - s.t0) / DURATION * 100) + '%'; e.textContent = s.id.slice(1); e.title = `${s.id} ${s.owner}: ${s.what}`; track.appendChild(e); }
  document.title = title;
  let t = 0, playing = false, wall = 0, tw = 0, drawn = -1, fpsN = 0, fpsT = performance.now();
  if (q.has('f')) t = +q.get('f') / FPS; else if (q.has('t')) t = +q.get('t');
  else if (q.has('shot')) { const [id, k] = q.get('shot').split('@'); const s = SHOTS.find(x => x.id === id); if (s) t = (s.f0 + Math.round((k != null ? +k : 0.5) * (s.f1 - 1 - s.f0))) / FPS; }
  const setT = (x) => { t = Math.min(Math.max(x, 0), (FRAMES - 1) / FPS); if (audio) audio.currentTime = t; if (playing) { wall = performance.now(); tw = t; } };
  const play = (on) => { playing = on; $('mc-play').textContent = on ? '❚❚' : '▶'; wall = performance.now(); tw = t; if (audio) { if (on) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause(); } };
  $('mc-play').onclick = () => play(!playing);
  track.onpointerdown = (e) => { const r = track.getBoundingClientRect(); const mv = (ev) => setT((ev.clientX - r.left) / r.width * DURATION); mv(e);
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', mv), { once: true }); };
  window.addEventListener('keydown', (e) => {
    const cur = SHOTS.findIndex(s => t >= s.t0 && t < s.t1);
    if (e.code === 'Space') { play(!playing); e.preventDefault(); }
    else if (e.code === 'ArrowRight') setT(t + (e.shiftKey ? 1 : 1 / FPS)); else if (e.code === 'ArrowLeft') setT(t - (e.shiftKey ? 1 : 1 / FPS));
    else if (e.code === 'BracketRight') setT(SHOTS[Math.min(SHOTS.length - 1, cur + 1)].t0); else if (e.code === 'BracketLeft') setT(SHOTS[Math.max(0, cur - (t - SHOTS[cur].t0 < 0.3 ? 1 : 0))].t0);
    else if (e.code === 'KeyH') bar.classList.toggle('hide'); else if (e.code === 'KeyF') (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  });
  function loop() {
    if (playing) { t = audio && !audio.paused ? audio.currentTime : tw + (performance.now() - wall) / 1000; if (t >= DURATION - 1 / FPS) { t = DURATION - 1 / FPS; play(false); } }
    const f = Math.min(FRAMES - 1, Math.round(t * FPS));
    if (f !== drawn) { mc.render(f / FPS); drawn = f; fpsN++; const s = SHOTS.find(x => f >= x.f0 && f < x.f1) || SHOTS[SHOTS.length - 1];
      $('mc-time').textContent = `${(f / FPS).toFixed(2)} s · f${f}`; $('mc-info').textContent = `${s.id} · ${s.set} · ${s.owner} — ${s.what}`;
      $('mc-head').style.left = (f / FRAMES * 100) + '%'; for (const e of track.children) if (e.dataset.id) e.classList.toggle('cur', e.dataset.id === s.id); }
    const now = performance.now(); if (now - fpsT > 1000) { $('mc-fps').textContent = playing ? `${fpsN} fps` : ''; fpsN = 0; fpsT = now; }
    requestAnimationFrame(loop);
  }
  if (autoplay || q.get('play') === '1') play(true);
  requestAnimationFrame(loop);
  return { setT, play, get t() { return t; } };
}
