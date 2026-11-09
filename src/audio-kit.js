// RYŪ · 龍 — sound kit (owner: sound). The synth building blocks used by src/audio-score.js (music) and
// src/audio-sfx.js (sound design), on a Web Audio OfflineAudioContext. Everything is synthesized (no samples) and
// deterministic (seeded generators only, never Math.random / Date). Conventions:
//   * times are film seconds; `dst` is the AudioNode a voice plays into (usually a bus from src/audio.js);
//   * every voice starts at gain 0 and ends at gain 0 with piecewise-linear envelopes (attack >= 2 ms): no clicks;
//   * noise buffers are periodic (built in the frequency domain), so a looping noise source never has a seam click;
//   * dense granular textures (rain, sparkle, crackle, bubbles) are rendered sample by sample into AudioBuffers;
//   * voices are built just in time (K.deferred + K.flush, see the end of createKit).

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, k) => a + (b - a) * k;

// mulberry32: small, fast, seedable PRNG in [0, 1)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// in-place radix-2 complex FFT (forward)
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const h = len >> 1, ang = -2 * Math.PI / len;
    for (let k = 0; k < h; k++) {
      const cr = Math.cos(ang * k), ci = Math.sin(ang * k);
      for (let i = k; i < n; i += len) { const b = i + h, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[i] - xr; im[b] = im[i] - xi; re[i] += xr; im[i] += xi; }
    }
  }
}

// periodic coloured noise: |X(f)| ~ f^(-slope/2) between lo and hi (soft edges), random phase; RMS normalised to 0.25
function periodicNoise(n, sr, slope, lo, hi, r) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let k = 1; k < n / 2; k++) {
    const f = k * sr / n, edge = 1 / (1 + Math.pow(lo / f, 4)) / (1 + Math.pow(f / hi, 4)), a = Math.pow(f, -slope / 2) * edge, ph = r() * 2 * Math.PI;
    re[k] = a * Math.cos(ph); im[k] = a * Math.sin(ph); re[n - k] = re[k]; im[n - k] = -im[k];
  }
  fft(re, im);
  let e = 0; for (let i = 0; i < n; i++) e += re[i] * re[i];
  const g = 0.25 / Math.sqrt(e / n), out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = re[i] * g;
  return out;
}

export function createKit(ctx, { seed = 3232 } = {}) {
  // one random stream for build-time code; every deferred voice gets its own stream (seeded from its start time, see
  // K.flush), so editing one cue never reshuffles the phases (and the peaks) of another
  const sr = ctx.sampleRate, RS = { f: rng(seed) }, r = () => RS.f();
  const K = { ctx, sr, r };
  K.rnd = (a = 0, b = 1) => a + (b - a) * r();
  K.pick = (arr) => arr[Math.floor(r() * arr.length) % arr.length];

  // ---------- nodes ----------
  K.gain = (v = 1, dst) => { const g = ctx.createGain(); g.gain.value = v; if (dst) g.connect(dst); return g; };
  K.filter = (type, f, q = 0.707, dst, gainDb = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gainDb; if (dst) b.connect(dst); return b; };
  // explicit stereo: a node whose inputs switch between mono and stereo changes its processing (StereoPanner pan law,
  // filter / convolver state) the moment a connection ends - an audible click. Panners, convolvers and buses stay 2 ch.
  K.stereo = (n) => { n.channelCountMode = 'explicit'; n.channelCount = 2; n.channelInterpretation = 'speakers'; return n; };
  K.pan = (x, dst) => { const p = K.stereo(ctx.createStereoPanner()); p.pan.value = clamp(x, -1, 1); if (dst) p.connect(dst); return p; };
  // phase (0..1): start that fraction of a period early, so voices of a chord do not all begin in phase (a coherent
  // attack is a needless crest-factor spike); the voice's envelope still opens at t0
  K.osc = (type, f, t0, t1, dst, { det = 0, wave = null, phase = 0 } = {}) => {
    const o = ctx.createOscillator(); if (wave) o.setPeriodicWave(wave); else o.type = type; o.frequency.value = f; o.detune.value = det;
    o.connect(dst); o.start(Math.max(0, t0 - phase / Math.max(f, 1))); o.stop(t1); return o;
  };
  K.wave = (amps) => { const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1); amps.forEach((a, i) => { im[i + 1] = a; }); return ctx.createPeriodicWave(re, im, { disableNormalization: false }); };
  // soft clipper with unity small-signal gain: tames the crest of summed low-end hits (booms) without boosting them
  K.shaper = (drive = 1.5, dst) => { const w = ctx.createWaveShaper(), n = 2049, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / drive; } w.curve = c; w.oversample = '4x'; if (dst) w.connect(dst); return w; };
  // parallel saturation ("grit"): returns an input node; a copy is driven hard into tanh and only the band where its
  // harmonics land (lo..hi, 4th-order edges) reaches dst. Gives a sub boom a 120-450 Hz body that small speakers play.
  K.grit = (dst, { drive = 8, lo = 120, hi = 450, v = 1 } = {}) => {
    const g = K.gain(v, dst), lp = K.filter('lowpass', hi, 0.54, K.filter('lowpass', hi, 1.31, g)), hp = K.filter('highpass', lo, 0.54, K.filter('highpass', lo, 1.31, lp));
    return K.shaper(drive, hp);
  };
  // soft-knee peak clipper (4x oversampled): linear below `knee`, then bends smoothly toward `max` (linear units);
  // returns { input, output } nodes. Used on the hits bus: explosion noise hides the clipping, the crest factor drops.
  K.softClip = (knee, max, dst, range = 2) => {
    const pre = K.stereo(K.gain(1 / range)), w = K.stereo(ctx.createWaveShaper()), post = K.stereo(K.gain(range, dst)), n = 4097, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * range, a = Math.abs(x); c[i] = (a <= knee ? a : knee + (max - knee) * Math.tanh((a - knee) / (max - knee))) * Math.sign(x) / range; }
    w.curve = c; w.oversample = '4x'; pre.connect(w); w.connect(post); return { input: pre, output: post };
  };

  // ---------- envelopes (piecewise linear, absolute times) ----------
  K.env = (param, pts) => { param.value = pts[0][1]; param.setValueAtTime(pts[0][1], Math.max(0, pts[0][0])); for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], Math.max(0, pts[i][0])); };
  // attack a, then value(x) for x = seconds after the attack, sampled densely early; ends at exactly 0 at t0 + len
  K.shapePts = (t0, len, a, fn, n = 18) => {
    const p = [[t0, 0], [t0 + a, fn(0)]], body = Math.max(len - a, 0.002);
    for (let k = 1; k < n; k++) { const x = body * Math.pow(k / n, 1.7); p.push([t0 + a + x, fn(x) * (1 - Math.pow(k / n, 6))]); }
    p.push([t0 + len, 0]); return p;
  };
  // percussive: attack a to peak, exponential decay tau (two-stage when lvl > 0: fast tau down to lvl, then tau2)
  K.perc = (t0, len, a, peak, tau, lvl = 0, tau2 = 1) => K.shapePts(t0, len, a, (x) => peak * ((1 - lvl) * Math.exp(-x / tau) + lvl * Math.exp(-x / tau2)));
  // sustained: attack a (linear), hold to t1, release rel; optional mid level (peak -> sus over dec)
  K.sus = (t0, t1, a, peak, rel, sus = null, dec = 0.2) => {
    const p = [[t0, 0], [t0 + a, peak]]; if (sus != null && t1 > t0 + a + dec) p.push([t0 + a + dec, sus]);
    p.push([Math.max(t1, t0 + a + (sus != null ? dec : 0) + 0.001), sus != null ? sus : peak], [Math.max(t1, t0 + a) + rel, 0]); return p;
  };
  // sample any function of time into a value curve on [t0, t1] (continuous layers, crossfades, sweeps)
  K.curve = (param, t0, t1, fn, rate = 120) => {
    const n = Math.max(2, Math.ceil((t1 - t0) * rate) + 1), a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = fn(t0 + (t1 - t0) * i / (n - 1));
    param.value = a[0]; param.setValueCurveAtTime(a, Math.max(0, t0), t1 - t0); return a;
  };

  // ---------- noise ----------
  const NN = 1 << 18;   // 5.46 s @ 48 kHz, periodic
  const mkNoise = (slope, lo, hi) => { const b = ctx.createBuffer(2, NN, sr); for (let c = 0; c < 2; c++) b.copyToChannel(periodicNoise(NN, sr, slope, lo, hi, r), c); return b; };
  K.noise = { white: mkNoise(0, 20, 16000), pink: mkNoise(1, 20, 14000), brown: mkNoise(2, 24, 6000) };
  K.noiseSrc = (t0, t1, dst, color = 'pink', rate = 1) => {
    const s = ctx.createBufferSource(); s.buffer = K.noise[color]; s.loop = true; s.playbackRate.value = rate; s.connect(dst);
    s.start(Math.max(0, t0), r() * 5); s.stop(t1); return s;
  };
  // a looping filtered noise layer for [t0, t1]: returns { g (gain, starts 0), f (filter) } for automation
  K.layer = (t0, t1, { color = 'pink', type = 'lowpass', f = 1000, q = 0.707, dst, pan = 0, f2 = null, q2 = 0.707, type2 = 'lowpass' }) => {
    const out = K.pan(pan, dst), g = K.gain(0, out); let head = g, f2n = null;
    if (f2) { f2n = K.filter(type2, f2, q2, g); head = f2n; }
    const fl = K.filter(type, f, q, head); K.noiseSrc(t0, t1, fl, color); return { g, f: fl, f2: f2n, out };
  };
  // one filtered noise burst with an envelope: { a, tau | hold, len, f, f1 (sweep), q } or explicit envelope points
  K.burst = (t, len, { color = 'white', type = 'bandpass', f = 1000, f1 = null, q = 0.7, a = 0.005, v = 0.1, tau = null, lvl = 0, tau2 = 1, pan = 0, dst, pts = null, rate = 1 }) => {
    const out = K.pan(pan, dst), g = K.gain(0, out), fl = K.filter(type, f, q, g);
    if (f1) { fl.frequency.setValueAtTime(f, Math.max(0, t)); fl.frequency.exponentialRampToValueAtTime(f1, t + len); }
    K.env(g.gain, pts || (tau ? K.perc(t, len, a, v, tau, lvl, tau2) : K.sus(t, t + len - Math.min(len * 0.4, 0.3), a, v, Math.min(len * 0.4, 0.3))));
    K.noiseSrc(t - 0.001, t + len + 0.02, fl, color, rate); return { g, f: fl };
  };
  // pitched sweep: oscillator f0 -> f1 (exponential, reached after `glide`) with a percussive or explicit envelope
  K.sweep = (t, len, { type = 'sine', f0, f1 = null, glide = null, v = 0.1, a = 0.004, tau = 0.2, lvl = 0, tau2 = 1, pan = 0, dst, det = 0, wave = null, curve = 'exp', pts = null }) => {
    const out = K.pan(pan, dst), g = K.gain(0, out), o = K.osc(type, f0, t, t + len + 0.02, g, { det, wave }), tg = t + (glide || len);
    if (f1) { o.frequency.setValueAtTime(f0, Math.max(0, t)); if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(f1, tg); else o.frequency.linearRampToValueAtTime(f1, tg); }
    K.env(g.gain, pts || K.perc(t, len, a, v, tau, lvl, tau2)); return { o, g };
  };

  // ---------- reverbs: synthetic impulse responses (decaying, darkening stereo noise + early reflections) ----------
  K.ir = (sec, { rt60 = 2.5, pre = 0.012, bright = 0.85, dark = 0.12, er = 6, erSpread = 0.06, seed: s = 7 } = {}) => {
    const rr = rng(s), n = Math.round(sec * sr), b = ctx.createBuffer(2, n, sr), p0 = Math.round(pre * sr);
    for (let c = 0; c < 2; c++) {
      const d = new Float32Array(n); let y = 0, e = 0;
      for (let i = p0; i < n; i++) {
        const t = (i - p0) / sr, cf = dark + (bright - dark) * Math.exp(-t / (rt60 * 0.25));
        y += cf * ((rr() * 2 - 1) - y); d[i] = y * Math.exp(-6.9 * t / rt60) * Math.min(1, t / 0.004 + 0.02);
      }
      for (let k = 0; k < er; k++) { const i = p0 + Math.round((0.004 + rr() * erSpread) * sr); if (i < n - 2) { const v = (rr() < 0.5 ? -1 : 1) * (0.5 + 0.5 * rr()) * 0.6; d[i] += v; d[i + 1] += v * 0.5; } }
      for (let i = 0; i < n; i++) e += d[i] * d[i];
      const g = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) d[i] *= g;
      const fo = Math.round(0.05 * sr); for (let i = 0; i < fo; i++) d[n - 1 - i] *= i / fo;
      b.copyToChannel(d, c);
    }
    return b;
  };
  K.reverb = (buf, dst, wet = 1) => { const cv = K.stereo(ctx.createConvolver()); cv.normalize = false; cv.buffer = buf; const g = K.gain(wet, dst); cv.connect(g); return cv; };

  // ---------- granular buffers rendered in JS (sample accurate, cheap for thousands of grains) ----------
  // grains: [{ t (s, buffer-relative), pan, len (s), fn(i) -> sample }]
  K.grainBuffer = (dur, grains) => {
    const n = Math.max(1, Math.round(dur * sr)), L = new Float32Array(n), R = new Float32Array(n);
    for (const gr of grains) {
      const i0 = Math.round(gr.t * sr), m = Math.round(gr.len * sr), pl = Math.cos((clamp(gr.pan, -1, 1) + 1) * Math.PI / 4), pr = Math.sin((clamp(gr.pan, -1, 1) + 1) * Math.PI / 4);
      for (let i = 0; i < m && i0 + i < n; i++) { if (i0 + i < 0) continue; const v = gr.fn(i); L[i0 + i] += v * pl; R[i0 + i] += v * pr; }
    }
    const b = ctx.createBuffer(2, n, sr); b.copyToChannel(L, 0); b.copyToChannel(R, 1); return b;
  };
  K.play = (buf, t, dst, { v = 1, rate = 1, pts = null } = {}) => { const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; const g = K.gain(v, dst); if (pts) K.env(g.gain, pts); s.connect(g); s.start(Math.max(0, t)); return { s, g }; };
  // grain shapes (i = sample index): smooth attack (>= 0.5 ms), exponential decay
  K.gEnv = (i, att, tau) => { const t = i / sr; return (t < att ? 0.5 - 0.5 * Math.cos(Math.PI * t / att) : 1) * Math.exp(-Math.max(0, t - att) / tau); };
  // a damped sine chirp (drop, bubble)
  K.gChirp = (f0, f1, len, att, tau, amp) => { let ph = 0; const k = Math.log(f1 / f0) / len; return (i) => { const t = i / sr, f = f0 * Math.exp(k * Math.min(t, len)); ph += 2 * Math.PI * f / sr; return amp * Math.sin(ph) * K.gEnv(i, att, tau) * (t > len * 0.85 ? Math.max(0, 1 - (t - len * 0.85) / (len * 0.15)) : 1); }; };
  // bell partials summed (inharmonic list [[ratio, amp, tau]])
  K.gBell = (f, parts, att, amp, len) => { const ph = parts.map(() => 0); return (i) => { const t = i / sr; let s = 0; for (let p = 0; p < parts.length; p++) { ph[p] += 2 * Math.PI * f * parts[p][0] / sr; s += parts[p][1] * Math.sin(ph[p]) * Math.exp(-t / parts[p][2]); } const fin = t > len * 0.8 ? Math.max(0, 1 - (t - len * 0.8) / (len * 0.2)) : 1; return amp * s * (t < att ? 0.5 - 0.5 * Math.cos(Math.PI * t / att) : 1) * fin; }; };
  // a short noise grain (crackle, grit), one-pole coloured
  K.gNoise = (att, tau, amp, color = 0.5, seedN = 1) => { const rr = rng(seedN); let y = 0; return (i) => { y += color * ((rr() * 2 - 1) - y); return amp * y * K.gEnv(i, att, tau); }; };

  // ---------- instruments ----------
  const PIANO = K.wave([1, 0.5, 0.28, 0.17, 0.1, 0.07, 0.045, 0.03, 0.02]);
  const MELLOW = K.wave([1, 0.32, 0.12, 0.05, 0.02]);
  K.waves = { PIANO, MELLOW };

  // soft felt piano: harmonic body through a closing lowpass + a second detuned string + hammer thump
  K.piano = (t, m, v, dst, pan = 0, len = 3) => {
    const f = mtof(m), out = K.pan(pan, dst), lp = K.filter('lowpass', 2000, 0.5, out), lowK = m < 45 ? 0.7 : m < 52 ? 0.85 : 1;
    lp.frequency.setValueAtTime(Math.min(9000, f * (3 + 7 * v)), t); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 260), t + len);
    const tau = 0.35 + 1.4 * clamp((90 - m) / 40, 0.15, 1);
    const g = K.gain(0, lp); K.env(g.gain, K.perc(t, len, 0.004, 0.11 * v * lowK, 0.22, 0.45, tau));
    K.osc(null, f, t, t + len + 0.02, g, { wave: PIANO }); K.osc('sine', f, t, t + len + 0.02, g, { det: 2.2 });
    K.burst(t, 0.06, { color: 'pink', type: 'bandpass', f: Math.min(3000, f * 2.5), q: 0.8, a: 0.002, v: 0.05 * v, tau: 0.012, dst: out });
  };

  // bowed string section: sustained chord from t0 to t1; saw ensemble -> body EQ -> lowpass; optional tremolo; `dyn` (fn of t, 0..1.5) scales gain + brightness
  K.strings = (t0, t1, notes, { v = 0.05, a = 0.8, rel = 1.0, cut = 2200, q = 0.6, pan = 0, width = 0.45, vib = 7, trem = 0, tremHz = 11, det = 8, dst, dyn = null, type = 'sawtooth', bright = 0 } = {}) => {
    const out = K.gain(1, dst), env = K.gain(0, out); K.env(env.gain, K.sus(t0, t1, a, 1, rel));
    let head = env;
    if (trem) { const tg = K.gain(1 - trem / 2, env); K.osc('sine', tremHz, t0, t1 + rel + 0.05, K.gain(trem / 2, tg.gain)); head = tg; }
    if (dyn) { const dg = K.gain(1, head); K.curve(dg.gain, t0, t1 + rel, (t) => dyn(t)); head = dg; }
    const body = K.filter('peaking', 900, 0.8, head, 3), lp = K.filter('lowpass', cut, q, body);
    if (dyn && bright) K.curve(lp.frequency, t0, t1 + rel, (t) => cut * (1 + bright * clamp(dyn(t), 0, 1.5)));
    const vibG = K.gain(0); K.env(vibG.gain, [[t0, 0], [t0 + 0.6, 0], [t0 + 1.4, vib], [t1 + rel, vib]]); K.osc('sine', 5.2, t0, t1 + rel + 0.05, vibG);
    const pl = K.pan(pan - width, lp), pr = K.pan(pan + width, lp), each = v / Math.sqrt(notes.length * 2.2);
    notes.forEach((m) => [-det, det * 0.8, 0].forEach((d, k) => {
      const g = K.gain(each * (k === 2 ? 0.6 : 1), k === 0 ? pl : k === 1 ? pr : lp), o = K.osc(type, mtof(m), t0, t1 + rel + 0.05, g, { det: d + (r() - 0.5) * 3, phase: r() });
      vibG.connect(o.detune);
    }));
    return { env, out };
  };
  // short bowed notes (runs, ostinati): [[t, midi, len, vel]]
  K.stringNotes = (notes, { v = 0.05, cut = 2600, pan = 0, dst, a = 0.025, rel = 0.12, det = 7 } = {}) => {
    const out = K.pan(pan, dst), lp = K.filter('lowpass', cut, 0.7, K.filter('peaking', 900, 0.8, out, 3));
    for (const [t, m, len, vel = 1] of notes) {
      const g = K.gain(0, lp); K.env(g.gain, K.sus(t, t + len, a, v * vel, rel, v * vel * 0.8, 0.08));
      for (const d of [-det, det]) K.osc('sawtooth', mtof(m), t, t + len + rel + 0.03, g, { det: d, phase: r() });
    }
  };

  // brass: saw unison with a "blat" filter envelope, pitch scoop, delayed vibrato; `swell` = slow crescendo over the note
  K.brass = (t, len, notes, { v = 0.06, dst, pan = 0, width = 0.25, bright = 1, a = 0.06, rel = 0.3, scoop = 25, swell = false, mellow = false, vib = 9 } = {}) => {
    const out = K.gain(1, dst);
    notes.forEach((m, i) => {
      const f = mtof(m), p = K.pan(pan + (notes.length > 1 ? (i / (notes.length - 1) - 0.5) * 2 * width : 0), out), g = K.gain(0, p);
      const lp = K.filter('lowpass', f * 1.5, mellow ? 0.7 : 1.4, g), top = Math.min(f * (mellow ? 3.2 : 4 + 4 * bright), 7500), mid = Math.min(f * (mellow ? 2.4 : 2.6 + 2.6 * bright), 6000);
      const pv = v / Math.sqrt(notes.length);
      if (swell) {
        K.env(g.gain, [[t, 0], [t + len * 0.92, pv], [t + len, pv * 0.9], [t + len + rel, 0]]);
        lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.linearRampToValueAtTime(top, t + len * 0.95); lp.frequency.linearRampToValueAtTime(mid, t + len + rel);
      } else {
        K.env(g.gain, [[t, 0], [t + a, pv], [t + a + 0.15, pv * 0.78], [t + Math.max(len, a + 0.16), pv * 0.72], [t + Math.max(len, a + 0.16) + rel, 0]]);
        lp.frequency.setValueAtTime(f * 1.3, t); lp.frequency.linearRampToValueAtTime(top, t + a + 0.03); lp.frequency.linearRampToValueAtTime(mid, t + a + 0.35);
      }
      const vg = K.gain(0); K.env(vg.gain, [[t, 0], [t + 0.35, 0], [t + 0.9, vib], [t + len + rel, vib]]); K.osc('sine', 5.0 + r() * 0.6, t, t + len + rel + 0.05, vg);
      for (const d of [-5, 0, 6]) { const o = K.osc('sawtooth', f, t, t + len + rel + 0.05, lp, { det: d, phase: r() }); o.detune.setValueAtTime(d - scoop, t); o.detune.linearRampToValueAtTime(d, t + 0.07); vg.connect(o.detune); }
    });
    return out;
  };

  // choir: saw ensemble through parallel vowel formants + breath; sustained chord with an optional dynamics curve
  const VOWELS = { a: [[800, 1, 7], [1150, 0.55, 8], [2900, 0.12, 10]], o: [[480, 1, 6], [820, 0.45, 8], [2830, 0.07, 10]], u: [[330, 1, 5], [720, 0.22, 7], [2500, 0.04, 9]], e: [[530, 1, 6], [1850, 0.4, 9], [2500, 0.12, 10]] };
  K.choir = (t0, t1, notes, { v = 0.05, a = 1.2, rel = 1.2, vowel = 'a', dst, pan = 0, width = 0.5, vib = 14, dyn = null, breath = 0.25 } = {}) => {
    const out = K.gain(1, dst), env = K.gain(0, out); K.env(env.gain, K.sus(t0, t1, a, 1, rel)); let head = env;
    if (dyn) { const dg = K.gain(1, head); K.curve(dg.gain, t0, t1 + rel, (t) => dyn(t)); head = dg; }
    const lp = K.filter('lowpass', 4200, 0.6, head), sum = K.gain(1);
    const forms = VOWELS[vowel].map(([f, g, q]) => { const gg = K.gain(g * 3.2, lp); const bp = K.filter('bandpass', f, q, gg); sum.connect(bp); return bp; });
    const vg = K.gain(vib); K.osc('sine', 5.1, t0, t1 + rel + 0.05, vg);
    const each = v / Math.sqrt(notes.length * 3);
    const pl = K.pan(pan - width, sum), pr = K.pan(pan + width, sum);
    notes.forEach((m) => [-11, 0, 10].forEach((d, k) => { const o = K.osc('sawtooth', mtof(m), t0, t1 + rel + 0.05, K.gain(each, k === 0 ? pl : k === 1 ? sum : pr), { det: d + (r() - 0.5) * 6, phase: r() }); vg.connect(o.detune); }));
    if (breath) { const nb = K.gain(v * breath, lp); K.noiseSrc(t0, t1 + rel + 0.05, K.filter('bandpass', VOWELS[vowel][1][0], 2, nb), 'pink'); }
    return { env, forms };
  };

  // timpani: tuned membrane modes + mallet; roll = fast alternating strokes with a velocity ramp
  K.timp = (t, m, v, dst, pan = 0, len = 2.2) => {
    const f = mtof(m), out = K.pan(pan, dst);
    [[1, 1, 0.75], [1.5, 0.45, 0.45], [1.98, 0.25, 0.32], [2.44, 0.12, 0.22]].forEach(([k, g, tau]) => K.sweep(t, len, { f0: f * k * 1.03, f1: f * k, glide: 0.12, v: v * g * 0.22, a: 0.003, tau, dst: out }));
    K.burst(t, 0.07, { color: 'pink', type: 'lowpass', f: 900, a: 0.002, v: v * 0.14, tau: 0.018, dst: out });
  };
  K.timpRoll = (t0, t1, m, v0, v1, dst, { rate = 15, pan = 0 } = {}) => {
    for (let t = t0, i = 0; t < t1; i++, t += 1 / rate * (0.9 + 0.2 * r())) { const k = (t - t0) / (t1 - t0); K.timp(t, m, lerp(v0, v1, k * k) * (0.85 + 0.15 * r()), dst, pan + (i % 2 ? 0.08 : -0.08), 0.6); }
  };
  // big drum (taiko / orchestral bass drum)
  K.drum = (t, v, dst, { f = 52, len = 1.4, pan = 0, skin = 0.25 } = {}) => {
    const out = K.pan(pan, dst);
    K.sweep(t, len, { f0: f * 2.4, f1: f, glide: 0.07, v: v * 0.38, a: 0.003, tau: len * 0.35, dst: out });
    K.burst(t, 0.12, { color: 'pink', type: 'lowpass', f: 700, a: 0.002, v: v * skin, tau: 0.03, dst: out });
  };
  // orchestral snare (single stroke) and cymbal (crash or swell)
  K.snare = (t, v, dst, pan = 0) => { const out = K.pan(pan, dst); K.burst(t, 0.18, { color: 'white', type: 'bandpass', f: 2600, q: 0.6, a: 0.002, v: v * 0.6, tau: 0.05, dst: out }); K.sweep(t, 0.12, { f0: 210, f1: 170, v: v * 0.3, a: 0.002, tau: 0.04, dst: out }); };
  K.cymbal = (t, len, v, dst, { swell = false, pan = 0, f = 5200 } = {}) => {
    const out = K.pan(pan, dst), lp = K.filter('lowpass', 9500, 0.6, out), g = K.gain(0, lp), hp = K.filter('highpass', 2400, 0.6, g);
    const bp = K.filter('bandpass', f, 0.9, hp);
    K.env(g.gain, swell ? [[t, 0], [t + len * 0.7, v * 0.35], [t + len, v], [t + len + 0.05, 0]] : K.perc(t, len, 0.004, v, len * 0.3, 0.3, len * 0.5));
    K.noiseSrc(t, t + len + 0.1, bp, 'white');
  };

  // tuned percussion: [[ratio, amp, tau]] partials (music box, celesta, glock, glass, furin)
  K.PARTS = {
    musicBox: [[1, 1, 1.1], [2, 0.1, 0.35], [4.95, 0.045, 0.12]],
    celesta: [[1, 1, 0.9], [2, 0.3, 0.35], [3, 0.06, 0.18]],
    glock: [[1, 1, 1.4], [2.76, 0.3, 0.45], [5.4, 0.12, 0.18]],
    glass: [[1, 1, 0.45], [2.32, 0.4, 0.22], [3.73, 0.2, 0.12], [5.1, 0.08, 0.07]],
    furin: [[1, 1, 1.5], [1.0042, 0.7, 1.3], [2.31, 0.22, 0.55], [3.45, 0.09, 0.3], [4.83, 0.035, 0.18]],
    chime: [[1, 1, 2.2], [2.0, 0.25, 1.0], [2.76, 0.18, 0.7], [5.4, 0.05, 0.25]],
  };
  K.bell = (t, f, v, dst, { parts = K.PARTS.glock, pan = 0, a = 0.002, len = null, tick = 0.06 } = {}) => {
    const out = K.pan(pan, dst), L = len || Math.max(...parts.map(p => p[2])) * 4.5;
    for (const [k, g, tau] of parts) { if (f * k > 15000) continue; K.sweep(t, Math.min(L, tau * 7), { f0: f * k, v: v * g, a: a * (k > 2 ? 0.6 : 1), tau, dst: out }); }
    if (tick) K.burst(t, 0.03, { color: 'white', type: 'bandpass', f: Math.min(7000, f * 2.2), q: 1.2, a: 0.0015, v: v * tick, tau: 0.006, dst: out });
  };

  // harp / pizzicato: Karplus-Strong strings rendered once per pitch
  const ksCache = new Map();
  K.ksBuffer = (m, { dur = 2.4, damp = 0.996, soft = 0.5 } = {}) => {
    const key = `${m}|${dur}|${damp}|${soft}`; if (ksCache.has(key)) return ksCache.get(key);
    const f = mtof(m), P = sr / f, n = Math.round(dur * sr), y = new Float32Array(n), rr = rng(1000 + m * 7), N = Math.floor(P);
    let lp = 0; for (let i = 0; i < N + 2; i++) { lp += soft * ((rr() * 2 - 1) - lp); y[i] = lp * Math.sin(Math.PI * i / (N + 2)); }
    const fr = P - N;
    for (let i = N + 2; i < n; i++) { const a = y[i - N], b = y[i - N - 1], c = y[i - N - 2], d1 = a + (b - a) * fr, d2 = b + (c - b) * fr; y[i] = damp * 0.5 * (d1 + d2); }
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(y[i]));
    const fo = Math.round(0.08 * sr); for (let i = 0; i < n; i++) { y[i] /= pk || 1; if (i < 24) y[i] *= i / 24; if (i > n - fo) y[i] *= (n - i) / fo; }
    const b = ctx.createBuffer(1, n, sr); b.copyToChannel(y, 0); ksCache.set(key, b); return b;
  };
  K.harp = (t, m, v, dst, pan = 0, opts = {}) => { const p = K.pan(pan, dst), lp = K.filter('lowpass', Math.min(8000, mtof(m) * 6), 0.5, p); K.play(K.ksBuffer(m, opts), t, lp, { v: v * 0.35 }); };

  // bamboo flute: soft harmonic tone, delayed vibrato, breath chiff; bend = semitones of scoop into the note (+/-)
  const FLUTE = K.wave([1, 0.32, 0.16, 0.05, 0.025]);
  K.flute = (t, len, m, v, dst, pan = 0, { vib = 14, breath = 0.16, a = 0.035, rel = 0.09, bend = 0, slide = 0 } = {}) => {
    const f = mtof(m), end = t + len + rel + 0.05, out = K.pan(pan, dst), g = K.gain(0, out), lp = K.filter('lowpass', Math.min(f * 5.5, 9500), 0.6, g);
    K.env(g.gain, [[t, 0], [t + a, v * 1.1], [t + a + 0.07, v * 0.88], [t + len, v * 0.82], [t + len + rel, 0]]);
    const vg = K.gain(0); K.env(vg.gain, [[t, 0], [t + 0.14, 0], [t + 0.4, vib], [t + len + rel, vib]]); K.osc('sine', 5.5 + r() * 0.7, t, end, vg);
    for (const d of [-3, 3]) { const o = K.osc(null, f, t, end, lp, { wave: FLUTE, det: d, phase: r() }); vg.connect(o.detune);
      if (bend) { o.detune.setValueAtTime(d + bend * 100, t); o.detune.linearRampToValueAtTime(d, t + 0.09); }
      if (slide) { o.detune.setValueAtTime(d, t + len * 0.25); o.detune.linearRampToValueAtTime(d + slide * 100, t + len + rel); } }
    const ng = K.gain(0, lp); K.env(ng.gain, [[t, 0], [t + 0.012, v * breath * 3], [t + 0.09, v * breath], [t + len, v * breath * 0.8], [t + len + rel, 0]]);
    K.noiseSrc(t, end, K.filter('bandpass', Math.min(f * 2.5, 7000), 1.6, ng), 'pink');
  };
  // koto: Karplus-Strong string, nail attack, wood body; bend = semitones pressed into the note (oshide)
  K.koto = (t, m, v, dst, pan = 0, { bend = 0, damp = 0.9968, soft = 0.72, dur = 2.4 } = {}) => {
    const out = K.pan(pan, dst), lp = K.filter('lowpass', Math.min(9000, mtof(m) * 7), 0.5, K.filter('peaking', 420, 0.9, out, 3.5));
    const s = ctx.createBufferSource(); s.buffer = K.ksBuffer(m, { dur, damp, soft }); const g = K.gain(v * 0.35, lp); s.connect(g); s.start(Math.max(0, t));
    if (bend) { s.detune.setValueAtTime(bend * 100, t); s.detune.linearRampToValueAtTime(0, t + 0.16); }
    K.burst(t, 0.022, { color: 'white', type: 'bandpass', f: Math.min(5200, mtof(m) * 4.2), q: 1.4, a: 0.001, v: v * 0.09, tau: 0.005, pan, dst });
  };
  // taiko: pitched membrane (drop to f), a 150-260 Hz body small speakers can play, stick slap; rim = the "ka" on the rim
  K.taiko = (t, v, dst, { f = 60, len = 1.1, pan = 0, rim = false } = {}) => {
    const out = K.pan(pan, dst);
    if (rim) { K.burst(t, 0.05, { color: 'white', type: 'bandpass', f: 1500, q: 2.5, a: 0.001, v: v * 0.45, tau: 0.012, dst: out }); return; }
    K.sweep(t, len, { f0: f * 2.3, f1: f, glide: 0.06, v: v * 0.42, a: 0.003, tau: len * 0.3, dst: out });
    K.sweep(t, len * 0.5, { f0: f * 4.4, f1: f * 2.6, glide: 0.09, v: v * 0.22, a: 0.002, tau: 0.08, dst: out });
    K.burst(t, 0.12, { color: 'pink', type: 'lowpass', f: 1500, q: 0.6, a: 0.0015, v: v * 0.26, tau: 0.026, dst: out });
  };
  // bonsho: great bronze bell. Inharmonic, slowly beating modes, wooden log strike.
  K.bonsho = (t, f, v, dst, { pan = 0, log = 1, len = 34 } = {}) => {
    const parts = [[1, 0.62, 7.5], [1.0058, 0.46, 6.4], [1.72, 0.5, 4.6], [2.38, 0.85, 3.6], [2.392, 0.5, 3.1], [3.04, 0.68, 2.6], [4.16, 0.55, 1.7], [5.38, 0.42, 1.1], [6.87, 0.26, 0.65], [8.6, 0.16, 0.4], [11.2, 0.09, 0.25]];
    K.bell(t, f, v, dst, { parts, pan, a: 0.003, len, tick: 0 });
    if (!log) return;
    K.sweep(t, 0.5, { f0: 150, f1: 62, glide: 0.1, v: v * 0.9, a: 0.003, tau: 0.13, pan, dst });
    K.burst(t, 0.1, { color: 'pink', type: 'bandpass', f: 520, q: 0.7, a: 0.002, v: v * 0.55, tau: 0.03, pan, dst });
    K.burst(t, 0.05, { color: 'white', type: 'bandpass', f: 2600, q: 0.8, a: 0.0015, v: v * 0.2, tau: 0.012, pan, dst });
  };

  // ---------- deferred voices ----------
  // An OfflineAudioContext processes every connected node from t = 0, so a graph of thousands of future notes costs
  // minutes. With K.deferred = true every voice is queued and built just before it sounds: the caller suspends the
  // context at checkpoints and calls K.flush(horizon), which builds (in time order) every voice starting before it.
  let queue = [], horizon = -Infinity, seq = 0;
  K.deferred = false;
  K.at = (t, fn) => { if (K.deferred && t >= horizon) queue.push({ t, fn, i: seq++ }); else fn(); };
  const sameT = new Map();   // voices already built at exactly this start time (their order in the code is stable)
  K.flush = (h) => {
    horizon = h; const now = queue.filter(v => v.t < h).sort((a, b) => a.t - b.t || a.i - b.i); queue = queue.filter(v => v.t >= h);
    for (const v of now) {
      const key = Math.round(v.t * sr), k = sameT.get(key) || 0; sameT.set(key, k + 1);
      RS.f = rng(Math.imul(key ^ 0x5bd1e995, 2654435761) + k * 7919 + seed); v.fn();
    }
    return now.length;
  };
  K.pending = () => queue.length;
  for (const name of ['piano', 'strings', 'brass', 'choir', 'timp', 'drum', 'snare', 'cymbal', 'bell', 'harp', 'burst', 'sweep', 'flute', 'koto', 'taiko', 'bonsho']) { const f = K[name]; K[name] = (...a) => K.at(a[0], () => f(...a)); }
  { const f = K.play; K.play = (buf, t, ...rest) => K.at(t, () => f(buf, t, ...rest)); }
  { const f = K.stringNotes; K.stringNotes = (notes, o) => { for (const nt of notes) K.at(nt[0], () => f([nt], o)); }; }

  return K;
}
