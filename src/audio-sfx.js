// RYŪ · 龍 — sound design (owner: sound). Ambience beds locked to SHOTS (crossfades at cuts) and effects locked to CUES.
// All synthesized with src/audio-kit.js. Every hit has a body small speakers can play (harmonics at 150-500 Hz).
//   sfx(K, bus, C, SHOTS, D) -> marks: [{ name, t, need }] foley events that are not CUES (checked by the analysis)
import { smooth, clamp, rng } from './audio-kit.js';

// level of one layer at film time t: the shot's value, crossfaded over `xf` each side of a cut
export function shotLevel(SHOTS, table, key, xf = 1 / 24) {
  const val = (s, t) => { const v = table[s.id]?.[key]; return typeof v === 'function' ? v(t) : (v ?? 0); };
  return (t) => {
    let i = SHOTS.findIndex(s => t >= s.t0 && t < s.t1); if (i < 0) i = t < SHOTS[0].t0 ? 0 : SHOTS.length - 1;
    const s = SHOTS[i];
    if (i > 0 && t - s.t0 < xf) return val(SHOTS[i - 1], t) + (val(s, t) - val(SHOTS[i - 1], t)) * (0.5 + (t - s.t0) / (2 * xf));
    if (i < SHOTS.length - 1 && s.t1 - t < xf) return val(s, t) + (val(SHOTS[i + 1], t) - val(s, t)) * (0.5 - (s.t1 - t) / (2 * xf));
    return val(s, t);
  };
}

export function sfx(K, bus, C, SHOTS, D) {
  const { amb, sfx: fx, big, quiet } = bus, SH = Object.fromEntries(SHOTS.map(s => [s.id, s])), T0 = (id) => SH[id].t0, T1 = (id) => SH[id].t1, R = rng(3636), rnd = (a = 0, b = 1) => a + (b - a) * R();
  const marks = [];

  // ---- beds: level per shot; one function of time per layer ----
  const AMB = {
    s01: { cic: 0.8, surf: 0.55, breeze: 0.55 }, s02: { cic: 1, breeze: 0.6 }, s03: { cic: 0.75, breeze: 0.3 }, s04: { cic: (t) => 0.55 - 0.3 * smooth((t - 9.2) / 0.2), breeze: 0.2 }, s05: { cic: 0.75, breeze: 0.25 }, s06: {},
    s07: { rumble: 0.4 }, s08: { rumble: 0.65 }, s09: { rumble: 0.55 }, s10: { rumble: 0.95, breeze: 0.1 }, s11: { rumble: 1.0, fall: 0.6 }, s12: { rumble: 0.8, fall: 0.9, breeze: 0.3 }, s13: { rumble: 0.5, wind: 0.5, hiss: 0.3 },
    s14: { wind: 0.85, hiss: 0.45, rumble: 0.5 }, s15: { wind: 1, hiss: 0.55 }, s16: { wind: 0.95, hiss: 0.6 }, s17: { wind: 1, hiss: 1 }, s18: { wind: 1, hiss: 0.6, surf: 0.9 },
    s19: { wind: 0.85, dark: 0.7, hiss: 0.3 }, s20: { wind: 0.7, dark: 1, rain: 1, hiss: 0.25 }, s21: { wind: 0.8, dark: 1, rain: 1 }, s22: { rain: 0.06, dark: 0.05 }, s23: { rain: 0.05 },
    s24: { wind: 0.55, hiss: 0.5, air: 1 }, s25: { wind: 0.4, hiss: 0.3, air: 0.9 }, s26: { air: 0.55, breeze: 0.35 }, s27: { breeze: 0.25, surf: 0.3, rumble: 0.4 }, s28: { breeze: 0.3, rumble: 0.25, surf: 0.3 }, s29: { breeze: 0.2, surf: 0.1, even: 0.9 }, s30: { even: 0.3 },
  };
  const lev = (k, xf = 1 / 24) => shotLevel(SHOTS, AMB, k, xf);
  const gust = (t, a) => 1 + a * (0.5 * Math.sin(t * 1.3 + 1) + 0.3 * Math.sin(t * 3.1) + 0.2 * Math.sin(t * 7.3 + 2));
  const bed = (cfg, fn, f = null) => { const l = K.layer(0, D + 0.02, { dst: amb, ...cfg }); K.curve(l.g.gain, 0, D, fn, 120); if (f) K.curve(l.f.frequency, 0, D, f, 120); return l; };

  // cicadas (0 -> the bell cuts them dead; a thin evening version back at the end)
  [[3900, 37, 0, -0.5], [5200, 43, 2.1, 0.55], [6900, 31, 4.2, 0.05]].forEach(([f, am, ph, pan], i) => {
    const l = K.layer(0, C.bell + 0.3, { dst: amb, color: 'white', type: 'bandpass', f, q: 7, pan }), c = lev('cic');
    K.curve(l.g.gain, 0, C.bell + 0.25, (t) => { const cut = t < C.bell ? 1 : Math.max(0, 1 - (t - C.bell) / 0.05); const sw = 0.65 + 0.35 * Math.sin(t * 0.7 + ph * 2); return cut * smooth(t / 0.5) * c(t) * sw * 0.2 * (0.55 + 0.45 * Math.sin(2 * Math.PI * am * t + ph)); }, 1200);
  });
  const surf = lev('surf'), bree = lev('breeze', 0.2), wind = lev('wind', 0.1), dark = lev('dark', 0.08), hiss = lev('hiss', 0.08), rain = lev('rain', 0.1), fall = lev('fall', 0.2), air = lev('air', 0.15), rumble = lev('rumble', 0.25);
  bed({ color: 'pink', type: 'lowpass', f: 1500, q: 0.5 }, (t) => surf(t) * 0.075 * (0.65 + 0.35 * Math.sin(t * 0.8 + 0.6)));
  bed({ color: 'pink', type: 'bandpass', f: 1100, q: 0.4 }, (t) => bree(t) * 0.045 * gust(t, 0.3));
  bed({ color: 'brown', type: 'lowpass', f: 95, q: 0.8 }, (t) => rumble(t) * 0.7 * (0.75 + 0.25 * Math.sin(t * 2.2)) * gust(t, 0.15));
  // the rumble's harmonics, so phones can hear it
  bed({ color: 'brown', type: 'bandpass', f: 230, q: 0.7 }, (t) => rumble(t) * 0.3 * (0.7 + 0.3 * Math.sin(t * 3.1 + 1)));
  bed({ color: 'pink', type: 'highpass', f: 1400, q: 0.5 }, (t) => fall(t) * 0.11 * gust(t, 0.12));
  bed({ color: 'brown', type: 'lowpass', f: 700, q: 0.6 }, (t) => wind(t) * 0.42 * gust(t, 0.22), (t) => 500 + 500 * wind(t) * gust(t, 0.2));
  bed({ color: 'pink', type: 'bandpass', f: 2200, q: 0.8, pan: 0.12 }, (t) => hiss(t) * 0.1 * gust(t, 0.35), (t) => 1700 + 1600 * smooth((t - 33) / 13) * gust(t, 0.15));
  bed({ color: 'brown', type: 'lowpass', f: 280, q: 1.3 }, (t) => dark(t) * 0.75 * gust(t, 0.35));
  bed({ color: 'white', type: 'highpass', f: 3200, q: 0.5 }, (t) => rain(t) * 0.075 * gust(t, 0.12));
  bed({ color: 'pink', type: 'bandpass', f: 1300, q: 0.6 }, (t) => rain(t) * 0.05 * gust(t, 0.2));
  bed({ color: 'pink', type: 'highpass', f: 5200, q: 0.6, pan: -0.2 }, (t) => air(t) * 0.05 * gust(t, 0.3));

  // ---- helpers ----
  const whoosh = (t, len, { v = 0.2, p0 = -0.8, p1 = 0.8, f0 = 280, fm = 2200, f1 = 380, q = 0.8, color = 'pink', dst = fx } = {}) => K.at(t, () => {
    const p = K.pan(p0, dst), g = K.gain(0, p), fl = K.filter('bandpass', f0, q, g);
    p.pan.setValueAtTime(p0, t); p.pan.linearRampToValueAtTime(p1, t + len);
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(fm, t + len * 0.5); fl.frequency.exponentialRampToValueAtTime(f1, t + len);
    K.env(g.gain, [[t, 0], [t + len * 0.42, v], [t + len * 0.58, v], [t + len, 0]]); K.noiseSrc(t, t + len + 0.03, fl, color);
  });
  const thunder = (t, v, pan = 0, close = false) => {
    if (close) K.burst(t, 0.08, { color: 'white', type: 'highpass', f: 1800, a: 0.0015, v: v * 0.55, tau: 0.018, pan, dst: big });
    K.burst(t, 0.28, { color: 'white', type: 'bandpass', f: 1100, q: 0.5, a: 0.003, v: v * 0.5, tau: 0.08, pan, dst: big });
    let d = 0; for (let i = 0; i < 8; i++) { d += 0.1 + rnd() * 0.2; K.burst(t + d, 1.6, { color: 'brown', type: 'lowpass', f: 300 - i * 18, q: 0.7, a: 0.02, v: v * (1 - i * 0.09), tau: 0.55 + i * 0.1, pan: pan * (1 - i * 0.1), dst: big }); }
  };
  const rock = (t, v, pan, f = 200, dst = fx) => { K.sweep(t, 0.35, { f0: f * 1.5, f1: f * 0.7, v: v * 0.5, a: 0.002, tau: 0.07, pan, dst }); K.burst(t, 0.22, { color: 'pink', type: 'bandpass', f: f * 3, q: 0.9, a: 0.002, v: v * 0.5, tau: 0.05, pan, dst }); };
  const broom = (t, len, v, pan = 0, dst = fx, f = 2400) => { K.burst(t, len, { color: 'pink', type: 'bandpass', f, f1: f * 0.7, q: 0.9, a: len * 0.3, v, tau: len * 0.5, pan, dst }); K.burst(t + len * 0.1, len * 0.8, { color: 'white', type: 'highpass', f: 4200, a: len * 0.2, v: v * 0.28, tau: len * 0.4, pan, dst }); };
  // the voice of the dragon: rough sawtooth stack, formants, soft saturation, a low body for the room and harmonics for phones
  const roar = (t, len, v, { f = 62, dst = big, pan = 0, F = [[420, 880, 2300], [320, 650, 1900]], rough = 0.6 } = {}) => K.at(t, () => {
    const end = t + len + 0.03, out = K.pan(pan, dst), env = K.gain(0, out); K.env(env.gain, [[t, 0], [t + 0.05, v], [t + len * 0.6, v * 0.95], [t + len * 0.86, v * 0.55], [t + len, 0]]);
    const sum = K.gain(1), sh = K.shaper(2.4, env), lowBody = K.gain(0.5, sh), lp = K.filter('lowpass', 240, 0.8, lowBody); sum.connect(lp);
    const bank = F[0].map((_, i) => { const g = K.gain([1.6, 1.1, 0.5][i], sh), bp = K.filter('bandpass', F[0][i], [4, 6, 8][i], g); sum.connect(bp); bp.frequency.setValueAtTime(F[0][i], t); bp.frequency.linearRampToValueAtTime(F[1][i], t + len); return bp; });
    const am = K.gain(1, sum); K.curve(am.gain, t, t + len, (x) => { const p = x - t; return 1 - rough * (0.5 + 0.5 * Math.sin(2 * Math.PI * (26 + 8 * Math.sin(p * 5)) * p + 1.3 * Math.sin(p * 37))); }, 900);
    const g0 = (m, det, a) => { const o = K.osc('sawtooth', f * m, t, end, K.gain(a, am), { det, phase: rnd() }); o.frequency.setValueAtTime(f * m * 1.15, t); o.frequency.linearRampToValueAtTime(f * m * 1.3, t + len * 0.25); o.frequency.linearRampToValueAtTime(f * m * 0.7, t + len); };
    g0(1, -8, 0.5); g0(1, 7, 0.5); g0(0.5, 0, 0.55); g0(1.5, 3, 0.2);
    K.noiseSrc(t, end, K.gain(0.18, am), 'brown');
    void bank;
  });
  const purr = (t, len, v, dst = quiet) => K.at(t, () => {
    const out = K.pan(0, dst), env = K.gain(0, out), lp = K.filter('lowpass', 520, 0.7, env); K.env(env.gain, [[t, 0], [t + 0.25, v], [t + len - 0.4, v * 0.9], [t + len, 0]]);
    const am = K.gain(1, lp); K.curve(am.gain, t, t + len, (x) => 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 23 * (x - t)), 1.6), 900);
    K.osc('sawtooth', 47, t, t + len + 0.03, K.gain(0.55, am), { det: -8 }); K.osc('sawtooth', 94, t, t + len + 0.03, K.gain(0.3, am), { det: 6 });
  });
  const wings = (t, len, n, v) => { for (let i = 0; i < n; i++) { const dt = rnd(0, len), p = rnd(-0.9, 0.9), f = rnd(700, 1800); for (let k = 0; k < 4; k++) K.burst(t + dt + k * rnd(0.05, 0.08), 0.05, { color: 'pink', type: 'bandpass', f, q: 1.2, a: 0.004, v: v * (1 - k * 0.2), tau: 0.016, pan: p, dst: fx }); } };

  // ---- foley: summer ----
  const s3 = T0('s03');
  for (let i = 0; i < 5; i++) broom(s3 + 0.15 + i * 0.68, 0.34, 0.12, -0.12 + 0.06 * i);
  K.burst(C.leaf, 0.05, { color: 'pink', type: 'highpass', f: 2500, a: 0.002, v: 0.22, tau: 0.014, dst: quiet }); K.sweep(C.leaf, 0.05, { f0: 3100, f1: 2100, v: 0.05, a: 0.002, tau: 0.016, dst: quiet }); marks.push({ name: 'leafTick', t: C.leaf, need: ['hi'] });
  for (let i = 0; i < 6; i++) K.burst(T0('s05') + 0.08 + i * 0.12, 0.05, { color: 'pink', type: 'bandpass', f: 1800, q: 1, a: 0.002, v: 0.08, tau: 0.014, pan: 0.06 * i - 0.1, dst: fx });   // pat-pat-pat
  K.burst(C.trip, 0.12, { color: 'pink', type: 'bandpass', f: 800, q: 0.8, a: 0.002, v: 0.22, tau: 0.04, dst: fx }); K.sweep(C.trip, 0.2, { f0: 240, f1: 120, v: 0.18, a: 0.002, tau: 0.06, dst: fx }); marks.push({ name: 'tripThud', t: C.trip });
  [[0, 0.1], [0.25, 0.07], [0.5, 0.06]].forEach(([d, v]) => K.burst(C.trip + 0.4 + d, 0.3, { color: 'pink', type: 'bandpass', f: 1400, f1: 900, q: 3, a: 0.02, v, tau: 0.1, pan: 0.15, dst: fx }));   // the rope creaks

  // ---- the bell, and what it wakes ----
  K.bonsho(C.bell, 73.42, 0.235, big, { pan: 0 });
  K.bonsho(C.close, 73.42, 0.075, fx, { pan: 0, log: 0, len: 16 });
  wings(C.birds, 1.4, 22, 0.1); for (let i = 0; i < 26; i++) { const t = C.birds + rnd(0, 1.3), f = rnd(2400, 4200); K.sweep(t, 0.09, { f0: f * 0.85, f1: f * 1.15, v: 0.03, a: 0.004, tau: 0.03, pan: rnd(-0.8, 0.8), dst: fx }); }
  for (let i = 0; i < 40; i++) K.burst(T0('s07') + rnd(0, T1('s07') - T0('s07')), 0.04, { color: 'white', type: 'bandpass', f: 4200, q: 1, a: 0.003, v: 0.03, tau: 0.01, pan: rnd(-0.3, 0.3), dst: fx });   // the leaf pile trembles
  whoosh(C.ripple, 2.9, { v: 0.1, color: 'white', p0: -0.95, p1: 0.95, f0: 2600, fm: 5200, f1: 3000, q: 1, dst: fx });
  for (let i = 0; i < 80; i++) { const dt = rnd(0, 2.7), pan = -0.9 + (dt / 2.7) * 1.8; K.burst(C.ripple + dt, 0.07, { color: 'pink', type: 'bandpass', f: rnd(2500, 6000), q: 1.4, a: 0.006, v: 0.03, tau: 0.02, pan, dst: fx }); }
  // the eye: a rock lid dragging, trees sliding off it
  roar(C.eye + 0.2, 2.2, 0.16, { f: 42, F: [[320, 700, 1900], [260, 560, 1600]], rough: 0.85 });
  K.burst(C.eye, 2.4, { color: 'brown', type: 'bandpass', f: 420, f1: 240, q: 0.8, a: 0.25, v: 0.5, tau: 1.2, pan: 0.2, dst: big });
  for (let i = 0; i < 14; i++) rock(C.eye + rnd(0.2, 2.6), rnd(0.08, 0.2), rnd(-0.4, 0.5), rnd(260, 520));
  K.drum(C.eye, 1.15, big, { f: 44, len: 2 }); K.burst(C.eye, 0.5, { color: 'pink', type: 'bandpass', f: 380, q: 0.7, a: 0.004, v: 0.55, tau: 0.13, dst: big }); marks.push({ name: 'eyeHit', t: C.eye, need: ['lo', 'mid'] });

  // ---- the rise ----
  const Ri = C.rise;
  thunder(Ri, 0.5, 0.1, true); K.drum(Ri, 1, big, { f: 40, len: 2.2 });
  roar(Ri + 0.9, 3.2, 0.3, { f: 50, F: [[300, 620, 1800], [460, 900, 2300]], rough: 0.65 });
  for (let i = 0; i < 70; i++) rock(Ri + rnd(0, T1('s11') - Ri), rnd(0.08, 0.3), rnd(-0.8, 0.8), rnd(120, 480));
  for (let i = 0; i < 26; i++) { const t = T0('s12') + rnd(0, 2.4); K.sweep(t, 0.6, { f0: 150, f1: 70, v: rnd(0.14, 0.28), a: 0.004, tau: 0.17, pan: rnd(-0.7, 0.7), dst: fx }); K.burst(t, 0.3, { color: 'pink', type: 'bandpass', f: 500, q: 0.8, a: 0.002, v: 0.18, tau: 0.07, pan: rnd(-0.7, 0.7), dst: fx }); }
  [[0, 0.1], [0.6, 0.12], [1.3, 0.08]].forEach(([d, v]) => K.burst(T0('s13') + d, 0.4, { color: 'pink', type: 'bandpass', f: 1200, f1: 800, q: 3.5, a: 0.03, v, tau: 0.14, pan: 0.2, dst: fx }));

  // ---- flight: one whoosh per pass ----
  const Tk = C.takeoff;
  K.drum(Tk, 1, big, { f: 38, len: 2 }); whoosh(Tk - 0.05, 2.0, { v: 0.5, p0: -0.5, p1: 0.9, fm: 1500, f1: 300, color: 'pink', q: 0.6, dst: big }); roar(Tk + 0.1, 2.0, 0.26, { f: 58, F: [[460, 980, 2400], [360, 720, 2000]] }); marks.push({ name: 'takeoffHit', t: Tk });
  whoosh(C.paddies - 0.2, 1.8, { v: 0.4, p0: 0.9, p1: -0.9, fm: 2600, color: 'white', q: 0.7 }); K.burst(C.paddies, 2.8, { color: 'white', type: 'bandpass', f: 3800, f1: 2200, q: 0.5, a: 0.3, v: 0.11, tau: 1.3, pan: -0.2, dst: fx });
  for (let i = 0; i < 60; i++) { const dt = rnd(0, 2.8); K.burst(C.paddies + dt, 0.05, { color: 'white', type: 'bandpass', f: rnd(3000, 7000), q: 2, a: 0.006, v: 0.03, tau: 0.018, pan: rnd(-0.9, 0.9), dst: fx }); }   // crops whipped flat
  const Tn = C.town; [0, 0.62, 1.25, 1.95, 2.55].forEach((d, i) => whoosh(Tn + d, 0.55, { v: 0.32, p0: (i % 2 ? 0.8 : -0.8), p1: (i % 2 ? -0.8 : 0.8), fm: 1800 + i * 200, color: 'pink', q: 0.9 }));
  for (let i = 0; i < 60; i++) rock(Tn + rnd(0, 3), rnd(0.05, 0.14), rnd(-0.6, 0.6), rnd(500, 1100));   // tiles rattling
  [[0.95, 2600], [1.75, 3200], [2.3, 2200]].forEach(([d, f], i) => { const t = Tn + d, p = i % 2 ? 0.6 : -0.5; K.sweep(t, 0.3, { type: 'triangle', f0: f, f1: f * 0.25, glide: 0.22, v: 0.14, a: 0.002, tau: 0.09, pan: p, dst: fx }); K.burst(t, 0.03, { color: 'white', type: 'highpass', f: 3000, a: 0.001, v: 0.2, tau: 0.008, pan: p, dst: fx }); });   // wires snapping
  [0.45, 0.55, 0.65, 0.75, 0.85, 0.95].forEach((d) => K.burst(Tn + d, 0.08, { color: 'white', type: 'bandpass', f: 1500, q: 1, a: 0.004, v: 0.14, tau: 0.03, pan: 0.5, dst: fx }));   // laundry ripped
  K.at(Tn + 2.3, () => { const t = Tn + 2.3, g = K.gain(0, K.pan(-0.4, fx)), bp = K.filter('bandpass', 1100, 3, g), o = K.osc('sawtooth', 500, t, t + 0.5, bp); o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(880, t + 0.18); o.frequency.linearRampToValueAtTime(380, t + 0.46); K.env(g.gain, [[t, 0], [t + 0.04, 0.09], [t + 0.36, 0.08], [t + 0.48, 0]]); });   // the cat, unimpressed
  const s17 = T0('s17'); whoosh(s17, 1.1, { v: 0.22, fm: 3000 }); K.at(s17 + 0.1, () => { const t = s17 + 0.1, len = 1.75, g = K.gain(0, K.pan(0.1, fx)), lp = K.filter('bandpass', 1400, 2.5, g), o = K.osc('sawtooth', 700, t, t + len, lp), o2 = K.osc('square', 703, t, t + len, K.gain(0.3, lp)); K.env(g.gain, [[t, 0], [t + 0.06, 0.05], [t + len - 0.2, 0.05], [t + len, 0]]); K.curve(o.frequency, t, t + len, (x) => 720 + 140 * Math.sin((x - t) * 34) + 80 * Math.sin((x - t) * 7)); K.curve(o2.frequency, t, t + len, (x) => 724 + 140 * Math.sin((x - t) * 34) + 80 * Math.sin((x - t) * 7)); });   // tiny Clawd scream
  const Se = C.sea; whoosh(Se - 0.2, 1.6, { v: 0.36, p0: -0.7, p1: 0.7, fm: 1900, color: 'pink', q: 0.6 });
  K.burst(Se + 0.3, 2.6, { color: 'white', type: 'highpass', f: 3000, a: 0.5, v: 0.08, tau: 1.6, pan: 0.2, dst: fx }); [0.6, 1.3, 1.9, 2.5].forEach((d, i) => K.burst(Se + d, 0.7, { color: 'pink', type: 'bandpass', f: 900, f1: 1800, q: 0.7, a: 0.08, v: 0.13, tau: 0.25, pan: i % 2 ? 0.5 : -0.5, dst: fx }));   // spray sheets
  whoosh(C.storm - 0.2, 1.8, { v: 0.3, p0: 0.2, p1: -0.3, fm: 900, f0: 220, f1: 120, color: 'brown', q: 0.6 }); K.drum(C.storm, 0.75, big, { f: 36, len: 2 }); marks.push({ name: 'stormHit', t: C.storm, need: ['lo', 'mid'] });
  [[0.8, 0.26, 0.6], [2.7, 0.34, -0.5], [3.8, 0.44, 0.2]].forEach(([d, v, p]) => thunder(C.storm + d, v, p, d > 3));

  // ---- the strike ----
  const Sk = C.strike;
  thunder(Sk, 1.1, 0.05, true); K.drum(Sk, 1.5, big, { f: 36, len: 2.4 });
  K.at(Sk, () => { const g = K.gain(0, K.pan(0, fx)), hp = K.filter('highpass', 2600, 0.7, g), am = K.gain(1, hp); K.env(g.gain, [[Sk, 0], [Sk + 0.005, 0.32], [Sk + 0.28, 0]]); K.curve(am.gain, Sk, Sk + 0.3, (x) => 0.2 + 0.8 * Math.pow(Math.abs(Math.sin((x - Sk) * 310)), 3), 1800); K.noiseSrc(Sk, Sk + 0.32, am, 'white'); });
  roar(Sk + 0.06, 1.95, 0.48, { f: 64, F: [[560, 1200, 2700], [340, 760, 2100]], rough: 0.72 });
  K.at(Sk + 0.6, () => {}); marks.push({ name: 'strikeHit', t: Sk });

  // ---- near silence ----
  const Sc = C.scratch;
  for (let i = 0; i < 7; i++) broom(Sc + 0.05 + i * 0.235, 0.17, 0.15 - i * 0.008, 0.12 * (i % 2 ? 1 : -1), quiet, 3100);
  marks.push({ name: 'scratch', t: Sc + 0.05, need: ['hi'] });
  purr(Sc + 0.25, 1.75, 0.2);
  purr(C.soften, 1.65, 0.2, quiet); K.burst(C.soften + 0.15, 1.4, { color: 'pink', type: 'lowpass', f: 700, f1: 400, q: 0.5, a: 0.4, v: 0.06, tau: 0.8, dst: quiet });

  // ---- breakout: through the cloud top ----
  const Bo = C.breakout;
  K.burst(Bo - 0.45, 0.45, { color: 'white', type: 'highpass', f: 800, a: 0.35, v: 0.12, tau: 0.6, dst: fx });
  whoosh(Bo - 0.1, 2.4, { v: 0.6, f0: 500, fm: 5200, f1: 1600, p0: -0.2, p1: 0.2, color: 'pink', q: 0.6, dst: big }); K.drum(Bo, 0.9, big, { f: 42, len: 2.2 }); thunder(Bo, 0.4, 0, false); marks.push({ name: 'breakoutHit', t: Bo });
  whoosh(C.peak - 0.1, 1.3, { v: 0.22, f0: 900, fm: 3800, f1: 1400, color: 'pink', q: 0.8 });

  // ---- dusk and home ----
  const Se2 = C.settle; for (let i = 0; i < 14; i++) rock(Se2 + rnd(0, 2.4), rnd(0.06, 0.14), rnd(-0.5, 0.5), rnd(140, 320));
  roar(Se2 + 0.4, 2.2, 0.075, { f: 46, F: [[300, 640, 1800], [240, 520, 1500]], rough: 0.5, dst: fx });
  K.burst(C.close, 1.8, { color: 'brown', type: 'lowpass', f: 260, a: 0.15, v: 0.32, tau: 0.8, dst: fx });
  // higurashi at dusk: a falling "ka-na-ka-na", thin and far away
  for (const [t0, p] of [[T0('s29') + 0.2, -0.5], [T0('s29') + 1.5, 0.55]]) for (let i = 0; i < 9; i++) K.sweep(t0 + i * 0.13, 0.11, { f0: 5600 - i * 110, f1: 4800 - i * 110, v: 0.018 * (1 - i * 0.06), a: 0.006, tau: 0.04, pan: p, dst: amb });
  const s29 = T0('s29');
  [0.15, 0.75].forEach((d) => broom(s29 + d, 0.34, 0.1, -0.1));
  K.burst(C.lastleaf, 0.05, { color: 'pink', type: 'highpass', f: 3000, a: 0.002, v: 0.09, tau: 0.01, dst: quiet }); marks.push({ name: 'lastTick', t: C.lastleaf, need: ['hi'] });
  K.burst(C.lastleaf + 0.5, 0.55, { color: 'pink', type: 'bandpass', f: 1100, f1: 520, q: 0.9, a: 0.12, v: 0.05, tau: 0.3, dst: quiet });    // the sigh
  [1.2, 1.55].forEach((d, i) => broom(C.lastleaf + d, 0.3, 0.09, 0.05 + i * 0.05));
  // the seal tap: a small wood-on-paper knock on the last koto note
  const tap = C.card + 1.85;   // = the end card's hanko stamp frame (see audio-score SEAL_T)
  K.burst(tap, 0.09, { color: 'pink', type: 'bandpass', f: 720, q: 1.4, a: 0.002, v: 0.22, tau: 0.018, dst: quiet }); K.sweep(tap, 0.16, { f0: 240, f1: 120, v: 0.26, a: 0.002, tau: 0.045, dst: quiet }); marks.push({ name: 'sealTap', t: tap, need: ['mid'] });
  void clamp;
  return marks;
}
