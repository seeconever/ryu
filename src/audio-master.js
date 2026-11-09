// RYŪ · 龍 — mastering + analysis (owner: sound). Pure JS on Float32Array PCM (runs in the browser and in Node):
//   master(L, R, sr, opts)   fades, loudness to `target` LUFS (ITU-R BS.1770-4 / EBU R128 gating), lookahead
//                            true-peak limiter (4x oversampled detection) to `ceiling` dBTP; iterates to the target
//   analyze(L, R, sr, {...}) what we "listen" with: integrated loudness, true peak, LRA, momentary / short-term curves,
//                            per-shot loudness, the impact's margin over every other moment, a phone-speaker check
//                            (mono, 350 Hz high-pass), band gains (lo / mid / hi) at every hit and foley mark, spectrum
//                            per section, cue onsets vs CUES, soft clip + limiter gain reduction, click scan, harsh-top
//                            scan (> 9 kHz in 10 ms windows, <= -35 dBFS)
// Nothing here is random; the output is a pure function of the input PCM.
import { fft } from './audio-kit.js';

const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const lufs = (ms) => -0.691 + 10 * Math.log10(Math.max(ms, 1e-20));

// ---------- K-weighting (BS.1770 pre-filter + RLB high-pass), any sample rate ----------
function kCoefs(sr) {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196, K = Math.tan(Math.PI * f0 / sr);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416), a0 = 1 + K / Q + K * K;
  const s1 = { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / sr);
  const d = 1 + K / Q + K * K, s2 = { b: [1, -2, 1], a: [2 * (K * K - 1) / d, (1 - K / Q + K * K) / d] };
  return [s1, s2];
}
function biquad(x, { b, a }) {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
// K-weighted power in 100 ms chunks (sum of both channels' mean square)
function chunkPower(L, R, sr) {
  const [s1, s2] = kCoefs(sr), kl = biquad(biquad(L, s1), s2), kr = biquad(biquad(R, s1), s2), h = Math.round(sr * 0.1), n = Math.floor(L.length / h), p = new Float64Array(n);
  for (let c = 0; c < n; c++) { let e = 0; for (let i = c * h; i < (c + 1) * h; i++) e += kl[i] * kl[i] + kr[i] * kr[i]; p[c] = e / h; }
  return p;
}
// loudness: integrated (gated), momentary (400 ms) and short-term (3 s) curves on a 100 ms grid (value at the window end), LRA
export function loudness(L, R, sr) {
  const p = chunkPower(L, R, sr), n = p.length, win = (w) => { const o = new Float64Array(n); let s = 0; for (let i = 0; i < n; i++) { s += p[i]; if (i >= w) s -= p[i - w]; o[i] = s / Math.min(i + 1, w); } return o; };
  const m = win(4), st = win(30);
  const blocks = []; for (let i = 3; i < n; i++) blocks.push(m[i]);
  const abs = blocks.filter(z => lufs(z) > -70), rel = lufs(abs.reduce((a, b) => a + b, 0) / Math.max(abs.length, 1)) - 10;
  const gated = abs.filter(z => lufs(z) > rel), I = lufs(gated.reduce((a, b) => a + b, 0) / Math.max(gated.length, 1));
  const sv = []; for (let i = 29; i < n; i++) if (lufs(st[i]) > -70) sv.push(st[i]);
  const sAbs = sv.reduce((a, b) => a + b, 0) / Math.max(sv.length, 1), sg = sv.filter(z => lufs(z) > lufs(sAbs) - 20).map(lufs).sort((a, b) => a - b);
  const LRA = sg.length ? sg[Math.floor(0.95 * (sg.length - 1))] - sg[Math.floor(0.1 * (sg.length - 1))] : 0;
  return { I, LRA, M: Array.from(m, lufs), S: Array.from(st, lufs), power: p };
}

// ---------- true peak: 4x polyphase windowed-sinc interpolation ----------
const OS = 4, TAPS = 8, TP_KER = (() => { const k = []; for (let ph = 1; ph < OS; ph++) { const row = new Float64Array(2 * TAPS); for (let j = -TAPS + 1; j <= TAPS; j++) { const x = j - ph / OS, w = 0.5 + 0.5 * Math.cos(Math.PI * x / (TAPS + 0.5)); row[j + TAPS - 1] = (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; } k.push(row); } return k; })();
// per-sample peak envelope: max |x| over the sample and the 3 interpolated points after it, both channels
export function truePeakEnv(L, R) {
  const n = L.length, pk = new Float32Array(n);
  for (const X of [L, R]) for (let i = 0; i < n; i++) {
    let m = Math.abs(X[i]);
    if (i >= TAPS - 1 && i + TAPS < n) for (const row of TP_KER) { let s = 0; const o = i - TAPS + 1; for (let j = 0; j < row.length; j++) s += X[o + j] * row[j]; const a = Math.abs(s); if (a > m) m = a; }
    if (m > pk[i]) pk[i] = m;
  }
  return pk;
}
export function truePeak(L, R) { const e = truePeakEnv(L, R); let m = 0; for (let i = 0; i < e.length; i++) if (e[i] > m) m = e[i]; return m; }

// ---------- lookahead limiter: sliding-min of the needed gain, exponential release, box-smoothed attack ----------
export function limit(L, R, sr, ceilDb, { look = 0.008, release = 0.15 } = {}) {
  const n = L.length, c = Math.pow(10, ceilDb / 20), W = Math.max(2, Math.round(look * sr)), pk = truePeakEnv(L, R);
  const need = new Float32Array(n); for (let i = 0; i < n; i++) need[i] = pk[i] > c ? c / pk[i] : 1;
  const mn = new Float32Array(n), dq = new Int32Array(n + W); let h = 0, t = 0;   // sliding minimum over need[i .. i+W-1]
  for (let j = 0; j < n + W - 1; j++) {
    if (j < n) { while (t > h && need[dq[t - 1]] >= need[j]) t--; dq[t++] = j; }
    const i = j - W + 1; if (i < 0) continue; while (dq[h] < i) h++; mn[i] = need[dq[h]];
  }
  const rc = 1 - Math.exp(-1 / (release * sr)), g = new Float32Array(n); let rg = 1, acc = 0; const rr = new Float32Array(n);
  for (let i = 0; i < n; i++) { rg = Math.min(mn[i], rg + (1 - rg) * rc); rr[i] = rg; acc += rg; if (i >= W) acc -= rr[i - W]; g[i] = acc / Math.min(i + 1, W); }
  const Lo = new Float32Array(n), Ro = new Float32Array(n); let maxGR = 0;
  for (let i = 0; i < n; i++) { Lo[i] = L[i] * g[i]; Ro[i] = R[i] * g[i]; if (g[i] < 1) maxGR = Math.max(maxGR, -db(g[i])); }
  return { L: Lo, R: Ro, gain: g, maxGR };
}

// ---------- oversampled soft clipper (transient peaks only) ----------
// The clip residual (curve(y) - y, non-zero only above the knee) is computed on the 4x-interpolated signal, band-limited
// by a 20 kHz windowed-sinc lowpass and added back at 1x: exactly identity away from peaks, no aliasing from the knee.
const DEC_H = 48, DEC = (() => { const fc = 20000 / 192000, h = new Float64Array(2 * DEC_H + 1); let s = 0;
  for (let k = -DEC_H; k <= DEC_H; k++) { const x = 2 * fc * k, w = 0.42 + 0.5 * Math.cos(Math.PI * k / (DEC_H + 1)) + 0.08 * Math.cos(2 * Math.PI * k / (DEC_H + 1)); h[k + DEC_H] = (k === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; s += h[k + DEC_H]; }
  for (let k = 0; k < h.length; k++) h[k] /= s; return h; })();
export function softClip(L, R, knee, max) {
  const n = L.length, curve = (a) => knee + (max - knee) * Math.tanh((a - knee) / (max - knee)), red = new Float32Array(Math.ceil(n / 4800)); let maxRed = 0, overs = 0;
  const out = [L, R].map((X) => {
    const res = new Map(), touched = new Set();
    for (let i = TAPS - 1; i < n - TAPS; i++) {
      if (Math.abs(X[i]) < knee * 0.7 && Math.abs(X[i + 1]) < knee * 0.7) continue;   // inter-sample peaks stay within ~3 dB
      const ys = [X[i]]; for (const row of TP_KER) { let s = 0; const o = i - TAPS + 1; for (let j = 0; j < row.length; j++) s += X[o + j] * row[j]; ys.push(s); }
      for (let p = 0; p < 4; p++) { const a = Math.abs(ys[p]); if (a > knee) { const c = curve(a); res.set(4 * i + p, (c - a) * Math.sign(ys[p])); const d = db(a) - db(c); maxRed = Math.max(maxRed, d); red[Math.floor(i / 4800)] = Math.max(red[Math.floor(i / 4800)], d); overs++; for (let q = i - 13; q <= i + 13; q++) touched.add(q); } }
    }
    const Y = Float32Array.from(X);
    for (const i of touched) { if (i < 0 || i >= n) continue; let s = 0; for (let k = -DEC_H; k <= DEC_H; k++) { const v = res.get(4 * i + k); if (v) s += v * DEC[k + DEC_H]; } Y[i] = X[i] + s; }
    return Y;
  });
  return { L: out[0], R: out[1], maxRed, overs, red };   // red = max reduction (dB) per 100 ms
}

// ---------- master: fades, gain to target loudness, soft clip, limiter; iterate until within 0.05 LU ----------
// clip: knee / max in dB relative to the ceiling (transient crest control before the limiter), null = off
export function master(L0, R0, sr, { target = -14, ceiling = -1.5, fadeIn = 0.25, fadeOut = 1.0, iters = 6, clip = [-4.5, 0.3] } = {}) {
  const n = L0.length, L = Float32Array.from(L0), R = Float32Array.from(R0), fi = Math.round(fadeIn * sr), fo = Math.round(fadeOut * sr);
  for (let i = 0; i < fi; i++) { const k = 0.5 - 0.5 * Math.cos(Math.PI * i / fi); L[i] *= k; R[i] *= k; }
  for (let i = 0; i < fo; i++) { const k = 0.5 - 0.5 * Math.cos(Math.PI * i / fo); L[n - 1 - i] *= k; R[n - 1 - i] *= k; }
  const raw = loudness(L, R, sr), c0 = Math.pow(10, ceiling / 20); let gainDb = target - raw.I, out = null, I = 0, ceil = ceiling, tp = 0, cl = { maxRed: 0, overs: 0, red: null };
  for (let it = 0; it < iters; it++) {
    const k = Math.pow(10, gainDb / 20); let x = L.map(v => v * k), y = R.map(v => v * k);
    if (clip) { cl = softClip(x, y, c0 * Math.pow(10, clip[0] / 20), c0 * Math.pow(10, clip[1] / 20)); x = cl.L; y = cl.R; }
    out = limit(x, y, sr, ceil); I = loudness(out.L, out.R, sr).I; tp = db(truePeak(out.L, out.R));
    if (tp > ceiling + 0.02) { ceil -= tp - ceiling + 0.02; continue; }
    if (Math.abs(I - target) < 0.05) break; gainDb += target - I;
  }
  return { L: out.L, R: out.R, gain: out.gain, gainDb, rawI: raw.I, I, tp, maxGR: out.maxGR, clipDb: cl.maxRed, clipOvers: cl.overs, clipRed: cl.red, ceiling, ceilUsed: ceil };
}

// ---------- analysis ----------
const BANDS = [['sub', 20, 60], ['low', 60, 250], ['lowmid', 250, 1000], ['mid', 1000, 4000], ['pres', 4000, 8000], ['air', 8000, 20000]];
export function spectrum(L, R, sr, t0, t1, N = 4096) {
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)), acc = new Float64Array(BANDS.length); let frames = 0;
  for (let s = Math.round(t0 * sr); s + N <= Math.min(t1 * sr, L.length); s += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = 0.5 * (L[s + i] + R[s + i]) * win[i]; fft(re, im);
    for (let k = 1; k < N / 2; k++) { const f = k * sr / N, p = re[k] * re[k] + im[k] * im[k]; for (let b = 0; b < BANDS.length; b++) if (f >= BANDS[b][1] && f < BANDS[b][2]) { acc[b] += p; break; } }
    frames++;
  }
  const dbs = Array.from(acc, v => 10 * Math.log10(v / Math.max(frames, 1) + 1e-20)), top = Math.max(...dbs);
  return Object.fromEntries(BANDS.map(([name], b) => [name, +(dbs[b] - top).toFixed(1)]));
}
// single-sample transients: a sample far off the line through its neighbours, against the local second-difference level
export function clicks(L, R, sr, { k = 8, floor = 0.02 } = {}) {
  const hits = [], w = Math.round(0.002 * sr);
  for (const [ch, X] of [['L', L], ['R', R]]) {
    const n = X.length, e = new Float32Array(n); for (let i = 1; i < n - 1; i++) e[i] = X[i] - 0.5 * (X[i - 1] + X[i + 1]);
    let acc = 0; for (let i = 0; i < Math.min(n, 2 * w + 1); i++) acc += e[i] * e[i];
    for (let i = w + 1; i < n - w - 1; i++) {
      acc += e[i + w] * e[i + w] - e[i - w - 1] * e[i - w - 1];
      const a = Math.abs(e[i]); if (a < floor) continue;
      const rms = Math.sqrt(Math.max(acc - a * a - e[i - 1] * e[i - 1] - e[i + 1] * e[i + 1], 0) / (2 * w - 2));
      if (a > k * rms) { hits.push({ t: +(i / sr).toFixed(4), ch, dev: +a.toFixed(3), ratio: +(a / Math.max(rms, 1e-9)).toFixed(1) }); i += w; }
    }
  }
  return hits.sort((a, b) => a.t - b.t);
}
// attack nearest to each cue: 2.5 ms energy hops, rise = level now minus the quietest of the previous 20 ms; the attack
// is the first hop of the nearest run rising >= 6 dB (else the steepest rise) within [-150, +250] ms of the cue
export function onsets(L, R, sr, cues) {
  const hop = Math.round(0.0025 * sr), out = {};
  for (const [name, t] of Object.entries(cues)) {
    const a = Math.max(0, Math.round((t - 0.17) * sr)), b = Math.min(L.length - hop, Math.round((t + 0.25) * sr)), env = [];
    for (let s = a; s < b; s += hop) { let e = 0; for (let i = s; i < s + hop; i++) e += L[i] * L[i] + R[i] * R[i]; env.push(10 * Math.log10(e / hop + 1e-12)); }
    const rise = env.map((v, i) => (i < 8 ? 0 : v - Math.min(...env.slice(i - 8, i))));
    let best = -1, bi = 8, near = -1, nd = Infinity;
    for (let i = 8; i < env.length; i++) {
      if (rise[i] > best) { best = rise[i]; bi = i; }
      if (rise[i] >= 6 && rise[i - 1] < 6) { const ti = (a + i * hop) / sr, d = Math.abs(ti - t); if (d < nd) { nd = d; near = i; } }
    }
    const i = near >= 0 ? near : bi, tOn = (a + i * hop) / sr;
    out[name] = { cue: t, onset: +tOn.toFixed(4), dms: Math.round((tOn - t) * 1000), riseDb: +Math.max(...rise.slice(i, i + 8)).toFixed(1) };
  }
  return out;
}
// ---------- RBJ biquads + band-split helpers (phone check, cue band gains) ----------
function rbj(type, f, q, sr) {
  const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b = type === 'lowpass' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  return { b: b.map(v => v / a0), a: [-2 * c / a0, (1 - al) / a0] };
}
const BW4 = [0.5411961, 1.3065630];   // 4th-order Butterworth = two biquads with these Q
const filt4 = (x, type, f, sr) => BW4.reduce((y, q) => biquad(y, rbj(type, f, q, sr)), x);
const mono = (L, R) => { const m = new Float32Array(L.length); for (let i = 0; i < L.length; i++) m[i] = 0.5 * (L[i] + R[i]); return m; };
// prefix sums of x^2 (double), for O(1) window power
const sq = (x) => { const p = new Float64Array(x.length + 1); for (let i = 0; i < x.length; i++) p[i + 1] = p[i] + x[i] * x[i]; return p; };
const winDb = (p, sr, t0, t1) => { const a = Math.max(0, Math.round(t0 * sr)), b = Math.min(p.length - 1, Math.round(t1 * sr)); return b > a ? 10 * Math.log10((p[b] - p[a]) / (b - a) + 1e-20) : -200; };

// phone speaker: mono, 4th-order high-pass at 350 Hz; max RMS (dBFS) of a 400 ms window lying inside each shot
export function phone(L, R, sr, shots, { fc = 350, win = 0.4, hop = 0.025 } = {}) {
  const p = sq(filt4(mono(L, R), 'highpass', fc, sr)), out = {}, curve = [];
  for (let t = win / 2; t < L.length / sr - win / 2; t += hop) curve.push([t, winDb(p, sr, t - win / 2, t + win / 2)]);
  for (const s of shots) { let m = -200, mt = s.t0; for (const [t, v] of curve) if (t - win / 2 >= s.t0 - 1e-6 && t + win / 2 <= s.t1 + 1e-6 && v > m) { m = v; mt = t; } out[s.id] = { db: +m.toFixed(1), t: +mt.toFixed(2) }; }
  return { shots: out, curve: curve.filter((_, i) => i % 4 === 0).map(([t, v]) => [+t.toFixed(2), +v.toFixed(1)]) };
}
// harsh top ("no harsh hiss"): energy above 9 kHz (4th-order high-pass, each channel) in 10 ms windows (5 ms hop). Crunches,
// splashes and cracks belong at 2-6 kHz; a dense noise burst up here reads as hiss and slips past the click scan. Per shot:
// the loudest window (dBFS) and the largest sample step |x[i] - x[i-1]|; `over` = shots above `limit`.
export function hiss(L, R, sr, shots, { fc = 9000, win = 0.01, hop = 0.005, limit = -35 } = {}) {
  const P = [L, R].map(x => sq(filt4(x, 'highpass', fc, sr))), curve = [];
  for (let t = 0; t + win <= L.length / sr; t += hop) curve.push([t + win / 2, Math.max(winDb(P[0], sr, t, t + win), winDb(P[1], sr, t, t + win))]);
  const out = {};
  for (const s of shots) {
    let m = -200, mt = s.t0; for (const [t, v] of curve) if (t >= s.t0 && t < s.t1 && v > m) { m = v; mt = t; }
    let dx = 0; for (const X of [L, R]) for (let i = Math.max(1, Math.round(s.t0 * sr)); i < Math.min(X.length, Math.round(s.t1 * sr)); i++) { const d = Math.abs(X[i] - X[i - 1]); if (d > dx) dx = d; }
    out[s.id] = { db: +m.toFixed(1), t: +mt.toFixed(3), dx: +dx.toFixed(3) };
  }
  const top = []; for (const [t, v] of [...curve].sort((a, b) => b[1] - a[1])) { if (top.length >= 5) break; if (top.every(p => Math.abs(p.t - t) > 0.5)) top.push({ t: +t.toFixed(3), db: +v.toFixed(1) }); }
  return { limit, top, shots: out, over: Object.keys(out).filter(k => out[k].db > limit) };
}
// band gains at events: lo < 250 Hz, mid 250-2000 Hz, hi > 2 kHz (4th-order splits). pre = the 60 ms before (t-70 .. t-10 ms),
// post = the loudest 60 ms window starting within t-10 .. t+100 ms. gain = post - pre (dB). A hit should rise >= 3 dB in
// every band it needs (`need`, default all three); `weak` lists the bands that do not.
export function cueBands(L, R, sr, events) {
  const m = mono(L, R), P = { lo: sq(filt4(m, 'lowpass', 250, sr)), mid: sq(filt4(filt4(m, 'highpass', 250, sr), 'lowpass', 2000, sr)), hi: sq(filt4(m, 'highpass', 2000, sr)) };
  return events.map(({ name, t, need = ['lo', 'mid', 'hi'] }) => {
    const g = {};
    for (const [b, p] of Object.entries(P)) { const pre = winDb(p, sr, t - 0.07, t - 0.01); let post = -200; for (let s = t - 0.01; s <= t + 0.1; s += 0.0025) post = Math.max(post, winDb(p, sr, s, s + 0.06)); g[b] = +(post - pre).toFixed(1); }
    return { name, t: +t.toFixed(3), ...g, need, weak: need.filter(b => g[b] < 3) };
  });
}

export const SECTIONS = [['summer', 0.3, 9.4], ['leaf+trip', 9.4, 13.15], ['bell', 13.2, 20.45], ['eye', 20.5, 23.45], ['rise', 23.5, 32.9], ['takeoff', 33.0, 36.0], ['paddies', 36.0, 39.0], ['town', 39.0, 44.0], ['sea', 44.0, 47.0], ['storm', 47.0, 51.9], ['strike', 52.0, 53.5], ['near-silence', 54.6, 56.3], ['soften', 56.3, 57.84], ['breakout', 58.0, 61.0], ['peak', 61.0, 63.5], ['dusk', 63.5, 70.0], ['last', 70.0, 73.0], ['card', 73.0, 75.3]];
export const HIT_CUES = ['leaf', 'trip', 'bell', 'birds', 'eye', 'rise', 'takeoff', 'paddies', 'town', 'sea', 'storm', 'strike', 'breakout', 'peak', 'close', 'lastleaf'];
// bands each cue must rise in (>= 3 dB); soft events are not checked or only in their band. Default: lo + mid + hi.
const CUE_NEED = { leaf: ['hi'], lastleaf: ['hi'], trip: ['mid'], birds: ['hi'], paddies: [], town: [], sea: [], peak: [], close: [], eye: ['lo', 'mid'], storm: ['lo', 'mid'] };

export function analyze(L, R, sr, { shots = [], cues = {}, gain = null, clipRed = null, marks = [] } = {}) {
  const ld = loudness(L, R, sr), tpEnv = truePeakEnv(L, R), S = ld.S, M = ld.M, at = (arr, t) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(t * 10) - 1))];
  let tp = 0, tpT = 0; for (let i = 0; i < tpEnv.length; i++) if (tpEnv[i] > tp) { tp = tpEnv[i]; tpT = i / sr; }
  const maxIn = (arr, t0, t1) => { let m = -Infinity, mt = t0; for (let i = Math.max(0, Math.ceil(t0 * 10)); i < Math.min(arr.length, Math.floor(t1 * 10)); i++) if (arr[i] > m) { m = arr[i]; mt = (i + 1) / 10; } return [m, mt]; };
  const shotRows = shots.map(s => {
    let e = 0, c = 0; for (let i = Math.round(s.t0 * 10); i < Math.round(s.t1 * 10) && i < ld.power.length; i++) { e += ld.power[i]; c++; }
    let pk = 0, gr = 0; for (let i = Math.round(s.t0 * sr); i < Math.min(L.length, Math.round(s.t1 * sr)); i++) { if (tpEnv[i] > pk) pk = tpEnv[i]; if (gain && gain[i] < 1) gr = Math.max(gr, -db(gain[i])); }
    const [mM] = maxIn(M, s.t0 + 0.4, s.t1 + 0.0001), [mS] = maxIn(S, s.t0 + 0.05, s.t1 + 0.0001);
    let cr = 0; if (clipRed) for (let k = Math.floor(s.t0 * 10); k < Math.ceil(s.t1 * 10) && k < clipRed.length; k++) cr = Math.max(cr, clipRed[k]);
    return { id: s.id, t0: s.t0, t1: s.t1, lufs: +lufs(e / Math.max(c, 1)).toFixed(1), maxM: +mM.toFixed(1), maxS: +mS.toFixed(1), tp: +db(pk).toFixed(1), gr: +gr.toFixed(1), clip: +cr.toFixed(1) };
  });
  // the loudest moments (momentary, at least 1.5 s apart)
  const idx = M.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]), peaksM = [];
  for (const [v, i] of idx) { if (peaksM.length >= 6) break; if (peaksM.every(p => Math.abs(p.t - (i + 1) / 10) > 1.5)) peaksM.push({ t: +((i + 1) / 10).toFixed(1), M: +v.toFixed(1) }); }
  const sIdx = S.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0])[0];
  // the impact must be the loudest moment: its max momentary (windows ending inside the impact shot) against the max
  // momentary of every window that does not contain it (ending before the impact, or starting after the shot)
  let margin = null;
  const imp = shots.find(s => cues.breakout != null && cues.breakout >= s.t0 && cues.breakout < s.t1);
  if (imp) { const [mi, ti] = maxIn(M, imp.t0, imp.t1 + 0.0001); let mo = -Infinity, to = 0;
    M.forEach((v, i) => { const te = (i + 1) / 10; if ((te <= imp.t0 + 1e-6 || te - 0.4 >= imp.t1 - 1e-6) && v > mo) { mo = v; to = te; } });
    margin = { impactM: +mi.toFixed(1), at: +ti.toFixed(1), nextM: +mo.toFixed(1), nextAt: +to.toFixed(1), lu: +(mi - mo).toFixed(1) }; }
  const hitCues = Object.fromEntries(HIT_CUES.filter(k => k in cues).map(k => [k, cues[k]]));
  return {
    I: +ld.I.toFixed(2), LRA: +ld.LRA.toFixed(1), tp: +db(tp).toFixed(2), tpAt: +tpT.toFixed(2),
    margin, maxM: peaksM[0], maxS: { t: +((sIdx[1] + 1) / 10).toFixed(1), from: +((sIdx[1] + 1) / 10 - 3).toFixed(1), S: +sIdx[0].toFixed(1) }, peaksM,
    curveS: S.filter((_, i) => i % 5 === 4).map(v => +v.toFixed(1)), curveM: M.map(v => +v.toFixed(1)),
    shots: shotRows,
    spectrum: Object.fromEntries(SECTIONS.map(([name, t0, t1]) => [name, spectrum(L, R, sr, t0, t1)])),
    sectionLufs: Object.fromEntries(SECTIONS.map(([name, t0, t1]) => { let e = 0, c = 0; for (let i = Math.round(t0 * 10); i < Math.round(t1 * 10); i++) { e += ld.power[i] || 0; c++; } return [name, +lufs(e / Math.max(c, 1)).toFixed(1)]; })),
    onsets: onsets(L, R, sr, hitCues),
    ...(({ shots: s, curve }) => ({ phone: s, phoneCurve: curve }))(phone(L, R, sr, shots)),
    bands: cueBands(L, R, sr, [...Object.entries(hitCues).filter(([k]) => CUE_NEED[k]?.length !== 0).map(([name, t]) => ({ name, t, need: CUE_NEED[name] })), ...marks]),
    clicks: clicks(L, R, sr),
    hiss: hiss(L, R, sr, shots),
    dc: [+(L.reduce((a, b) => a + b, 0) / L.length).toExponential(1), +(R.reduce((a, b) => a + b, 0) / R.length).toExponential(1)],
    edges: { first: +Math.max(Math.abs(L[0]), Math.abs(R[0])).toExponential(1), last: +Math.max(Math.abs(L[L.length - 1]), Math.abs(R[R.length - 1])).toExponential(1) },
  };
}
