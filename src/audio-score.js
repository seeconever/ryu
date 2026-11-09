// RYŪ · 龍 — the score (owner: sound). One playful summer theme in G (yo-pentatonic), synthesized with src/audio-kit.js,
// locked to CUES and SHOTS (every time is a cue or shot time plus an offset).
//   A  0-13.2    summer: flute theme over koto, pizz, strings; the leaf stops it; tiptoe, trip, a hanging D, cut by the bell
//   B  13.2-20.5 nothing (the bell and the rumble, src/audio-sfx.js)
//   C  20.5-33   the eye, THE RISE: taiko and low brass, Gm -> Eb -> F -> D, accelerating, a breath before the take-off
//   D  33-47     flight, beat = 0.5 s (paddies, town, sea all land on beats): fanfare, theme tutti (36-44), lift to Bb (44-47)
//   E  47-53.5   storm, C minor, 3+3+2, the theme in minor, cut before the strike, cluster falls
//   F  53.5-58   near silence (quiet bus): one harmonic, two koto notes; soften: strings + choir swell, breath
//   G  58-63.5   breakout: theme head (beat 0.75) + cadence (beat 0.625) with choir, full orchestra; the loudest moment
//   H  63.5-73   dusk: flute and strings, the theme resolves on the soft bell at close; last leaf plink-plonk
//   I  73-76     solo koto under the card
import { mtof } from './audio-kit.js';

// [beat, midi, beats]: D E G E D B | D B A G A | B D E G A G | E D B A G
export const THEME = [[0, 74, 0.5], [0.5, 76, 0.5], [1, 79, 1], [2, 76, 0.5], [2.5, 74, 0.5], [3, 71, 1], [4, 74, 0.5], [4.5, 71, 0.5], [5, 69, 0.5], [5.5, 67, 0.5], [6, 69, 2],
  [8, 71, 0.5], [8.5, 74, 0.5], [9, 76, 1], [10, 79, 0.5], [10.5, 81, 0.5], [11, 79, 1], [12, 76, 0.5], [12.5, 74, 0.5], [13, 71, 0.5], [13.5, 69, 0.5], [14, 67, 2]];
const G = [43, 50, 59, 62], Em = [40, 47, 59, 67], C_ = [36, 43, 52, 64], D_ = [38, 45, 54, 62], Am = [45, 52, 60, 64];
const HARM = [[0, G], [2, Em], [4, G], [6, D_], [8, C_], [10, G], [12, Am], [13, D_], [14, G]];   // [beat, chord]

export function score(K, bus, C, shots) {
  const { mus, wet, quiet } = bus, SH = Object.fromEntries(shots.map(s => [s.id, s])), T0 = (id) => SH[id].t0, T1 = (id) => SH[id].t1;

  // ---------------- A. summer ----------------
  const b0 = 0.55, A0 = C.leaf - 16 * b0, bA = (b) => A0 + b * b0;
  [55, 59, 62, 67, 71, 74, 79, 83].forEach((m, i) => K.koto(0.32 + i * 0.03, m, 0.32 + i * 0.03, wet, -0.5 + i * 0.14));
  for (const [b, m, d] of THEME) K.flute(bA(b), d * b0 * (d > 1 ? 0.95 : 0.78), m + 12, 0.075, mus, 0.12, { bend: b % 4 === 1 ? -0.7 : 0 });
  for (let b = 0; b < 16; b += 0.5) { const ch = [...HARM].reverse().find(h => h[0] <= b)[1], m = [ch[1], ch[2], ch[3], ch[2]][(b * 2) % 4] + 12; K.koto(bA(b), m, b % 2 === 0 ? 0.3 : 0.2, wet, -0.28 + ((b * 2) % 4) * 0.1, { damp: 0.9955 }); }
  for (let b = 0; b < 16; b += 2) { const ch = [...HARM].reverse().find(h => h[0] <= b)[1]; K.harp(bA(b), ch[0] + 12, 0.5, mus, -0.2, { damp: 0.986, soft: 0.45, dur: 1.2 }); }
  HARM.forEach(([b, ch], i) => K.strings(bA(b), bA(i + 1 < HARM.length ? HARM[i + 1][0] : 16), ch.map(m => m + 12), { v: 0.022, a: 0.35, rel: 0.25, cut: 1700, dst: mus, width: 0.6 }));
  for (let b = 0; b < 16; b += 1) K.taiko(bA(b), b % 4 === 0 ? 0.05 : 0.03, mus, { rim: true, pan: 0.3 });
  // the leaf: everything stops; tiptoe pizz, a twitch on the rim, the hurry, the trip
  [[0.28, 67], [0.72, 62], [1.1, 67]].forEach(([d, m]) => K.harp(C.leaf + d, m, 0.34, mus, 0.1, { damp: 0.98, soft: 0.4, dur: 0.6 }));
  [0, 0.09].forEach(d => K.taiko(C.leaf + 0.92 + d, 0.05, mus, { rim: true, pan: -0.2 }));
  K.flute(C.leaf + 0.28, 0.5, 81, 0.05, mus, 0.1, { slide: -0.4 });
  const s5 = T0('s05'), HURRY = [67, 69, 71, 74, 76, 79, 81, 83, 86, 83, 86, 88];
  HURRY.forEach((m, i) => { const t = s5 + 0.05 + (C.trip - s5 - 0.1) * (i / HURRY.length); K.koto(t, m, 0.3, wet, -0.3 + i * 0.05, { damp: 0.995 }); });
  K.flute(C.trip, 0.42, 88, 0.07, mus, 0, { slide: -14, a: 0.01, rel: 0.06, vib: 0 });     // the slide whistle of the trip
  for (let i = 0; i < 12; i++) K.koto(C.trip + 0.02 + i * 0.03, 86 - i * 2, 0.2, wet, 0.3 - i * 0.05, { damp: 0.99 });
  K.strings(C.trip + 0.45, C.bell - 0.07, [74, 86], { v: 0.016, a: 0.3, rel: 0.03, cut: 3500, trem: 0.5, tremHz: 11, vib: 3, dst: wet });
  K.harp(C.trip + 0.5, 62, 0.3, mus, 0, { damp: 0.98, soft: 0.4, dur: 0.6 }); K.harp(C.trip + 0.95, 57, 0.28, mus, 0, { damp: 0.98, soft: 0.4, dur: 0.6 });

  // ---------------- C. eye and THE RISE ----------------
  const R = C.rise, T = C.takeoff;
  K.brass(C.eye - 0.02, R - C.eye, [31, 43, 50, 55, 62], { v: 0.17, swell: true, mellow: true, rel: 0.1, dst: mus });
  K.strings(C.eye, R, [31, 43], { v: 0.03, a: 0.6, rel: 0.1, cut: 520, trem: 0.3, tremHz: 9, dst: mus });
  [C.eye, C.eye + 0.8, C.eye + 1.6, C.eye + 2.2, C.eye + 2.55, C.eye + 2.8].forEach((t, i) => K.taiko(t, i === 0 ? 0.95 : 0.3 + i * 0.06, mus, { f: 46, len: 1.5 }));
  const RISE = [[R, 3, [31, 43, 50, 58, 62]], [R + 3, 2, [39, 46, 55, 58, 63]], [T0('s12'), T0('s13') - T0('s12'), [41, 48, 57, 60, 65]], [T0('s13'), T - T0('s13') - 0.14, [38, 45, 54, 57, 62, 69]]];
  RISE.forEach(([t, d, ch], i) => { K.brass(t, Math.max(d, 0.2), ch, { v: 0.1 + i * 0.022, swell: i > 0, a: 0.06, rel: 0.14, mellow: i === 0, dst: mus });
    K.strings(t, t + d, ch.map(m => m + 12), { v: 0.04 + i * 0.012, a: 0.4, rel: 0.15, cut: 2200 + i * 600, trem: 0.3, tremHz: 11, dst: mus }); });
  K.choir(T0('s12'), T - 0.14, [50, 57, 62], { v: 0.05, a: 2.2, rel: 0.08, vowel: 'o', dst: wet });
  const TK = [R, R + 1, R + 2, R + 2.75, R + 3.5, R + 4.25, R + 5, R + 5.5, R + 6, R + 6.5, R + 7, R + 7.3, R + 7.6, R + 7.9, R + 8.2, R + 8.5, R + 8.7, R + 8.9, R + 9.1, R + 9.28];
  TK.forEach((t, i) => K.taiko(t, 0.42 + i * 0.022, mus, { f: 50 + (i > 9 ? 6 : 0), len: 1.2, pan: i % 2 ? 0.1 : -0.1 }));
  K.timpRoll(R + 7.4, T - 0.14, 43, 0.06, 0.34, mus);
  K.cymbal(T - 1.6, 1.46, 0.05, mus, { swell: true });

  // ---------------- D. flight: beat = 0.5 s ----------------
  const fl = (b) => T + b * 0.5, HI = [62, 67, 71];
  [[0, [43, 50, 55, 59, 62, 67], 1.2], [1.5, [43, 50, 55, 59, 62, 67], 1.2], [3, [36, 43, 52, 60, 64], 1.2], [4.5, [38, 45, 54, 62, 66], 1.3]].forEach(([b, ch, d]) => K.brass(fl(b), d * 0.5, ch, { v: 0.17, rel: 0.12, dst: mus }));
  [[0, 62, 1.5], [1.5, 67, 1.5], [3, 69, 1.5], [4.5, 74, 1.5]].forEach(([b, m, d]) => K.brass(fl(b), d * 0.46, [m, m + 12], { v: 0.1, rel: 0.1, dst: mus, bright: 1.2 }));
  K.cymbal(fl(0), 2.6, 0.06, mus); K.cymbal(fl(6), 2.4, 0.05, mus); K.cymbal(fl(14), 2.4, 0.045, mus); K.cymbal(fl(22), 2.4, 0.055, mus);
  // taiko engine for the whole flight (16ths at 0.125 s)
  const PAT = [1, 0, 0.35, 0.55, 0.8, 0, 0.45, 0, 1, 0.3, 0.4, 0.6, 0.85, 0, 0.65, 0.5];
  for (let i = 0; i < 112; i++) { const a = PAT[i % 16]; if (a) K.taiko(T + i * 0.125, (a > 0.75 ? 0.54 : 0.3) * a, mus, { f: a > 0.75 ? 62 : 80, len: a > 0.75 ? 0.8 : 0.35, pan: a > 0.75 ? 0 : (i % 2 ? 0.3 : -0.3) }); if (i % 4 === 2) K.taiko(T + i * 0.125, 0.09, mus, { rim: true, pan: 0.4 }); }
  // string ostinato (8ths) and the theme
  const chordAt = (b) => [...HARM].reverse().find(h => h[0] <= b)[1];
  for (let i = 0; i < 56; i++) { const b = i * 0.5, tb = b >= 6 && b < 22 ? chordAt(b - 6)[0] + 12 : b < 3 ? 55 : b < 4.5 ? 48 : 50, kk = i % 4 === 0 ? 1 : 0.72; K.stringNotes([[T + i * 0.25, tb, 0.16, kk], [T + i * 0.25, tb + 12, 0.16, kk * 0.8]], { v: 0.075, cut: 2200, dst: mus }); }
  for (const [b, m, d] of THEME) { const t = fl(6 + b), dur = d * 0.5 * (d >= 2 ? 0.95 : 0.8), sus = d * 0.5; K.brass(t, dur, [m - 12, m], { v: 0.18, rel: 0.08, dst: mus, bright: 1.1, scoop: 15 }); K.stringNotes([[t, m + 12, sus * 0.9, 1], [t, m, sus * 0.9, 0.7]], { v: 0.075, cut: 4200, dst: mus }); }
  HARM.forEach(([b, ch], i) => { const bb = i + 1 < HARM.length ? HARM[i + 1][0] : 16; K.strings(fl(6 + b), fl(6 + bb), ch.map(m => m + 12), { v: 0.05, a: 0.1, rel: 0.1, cut: 3200, dst: mus }); K.brass(fl(6 + b), (bb - b) * 0.5 * 0.9, ch, { v: 0.09, mellow: true, rel: 0.15, dst: mus }); });
  // sea: lift to Bb, the head, then the fall into C minor
  const LIFT = [[22, 77, 0.5], [22.5, 79, 0.5], [23, 82, 1], [24, 79, 0.5], [24.5, 77, 0.5], [25, 74, 1]];
  for (const [b, m, d] of LIFT) { K.brass(fl(b), d * 0.42, [m - 12, m], { v: 0.17, rel: 0.08, dst: mus, bright: 1.2 }); K.stringNotes([[fl(b), m + 12, d * 0.42, 1]], { v: 0.075, cut: 4600, dst: mus }); }
  K.strings(fl(22), fl(26), [46, 53, 58, 62, 65], { v: 0.055, a: 0.1, rel: 0.1, cut: 3200, dst: mus }); K.brass(fl(22), 2.0, [34, 46, 53], { v: 0.1, mellow: true, rel: 0.1, dst: mus });
  K.brass(fl(26), 1.0, [36, 43, 48, 51, 54], { v: 0.12, swell: true, rel: 0.02, dst: mus }); K.strings(fl(26), fl(28), [72, 78, 84], { v: 0.04, a: 0.5, rel: 0.05, cut: 5200, trem: 0.7, tremHz: 13, dst: mus });

  // ---------------- E. storm: C minor, 3+3+2 at 0.25 s ----------------
  const ST = C.storm, st = (i) => ST + i * 0.25, HITS = [0, 3, 6, 8, 11, 14, 16, 19];
  HITS.forEach((i, k) => { K.brass(st(i), 0.18, [36, 43, 48, 51 + (k % 3 ? 0 : 3), 60, 63 + (k % 3 ? 0 : 3)], { v: 0.22 + k * 0.012, rel: 0.09, dst: mus, bright: 1.5 }); K.stringNotes([[st(i), 72, 0.14, 1], [st(i), 75 + (k % 3 ? 0 : 3), 0.14, 0.8]], { v: 0.08, cut: 5200, dst: mus }); K.taiko(st(i), 0.5 + k * 0.025, mus, { f: 54, len: 0.9 }); K.timp(st(i), 36, 0.3, mus, 0.2, 0.6); });
  for (let i = 0; i < 20; i++) if (!HITS.includes(i)) K.taiko(st(i), 0.11, mus, { f: 92, len: 0.3, pan: i % 2 ? 0.35 : -0.35 });
  K.strings(ST, C.strike - 0.14, [72, 73, 79, 80], { v: 0.09, a: 0.5, rel: 0.03, cut: 4200, trem: 0.7, tremHz: 14, dyn: (t) => 0.5 + (t - ST) / 5 * 0.7, dst: mus });
  K.strings(ST, C.strike - 0.14, [36, 42, 48], { v: 0.06, a: 0.4, rel: 0.03, cut: 900, trem: 0.3, tremHz: 9, dst: mus });
  K.choir(ST + 1.0, C.strike - 0.14, [48, 54, 60], { v: 0.05, a: 2.4, rel: 0.05, vowel: 'u', dst: wet });
  [[T0('s20'), 60, 0.5], [T0('s20') + 0.5, 62, 0.5], [T0('s20') + 1, 63, 1], [T0('s20') + 2, 62, 0.5]].forEach(([t, m, d]) => K.brass(t, d * 0.8, [m - 24, m - 12], { v: 0.16, rel: 0.09, dst: mus, bright: 1.1 }));
  K.cymbal(ST, 1.4, 0.06, mus); K.cymbal(C.strike - 1.9, 1.76, 0.07, mus, { swell: true });
  K.timpRoll(C.strike - 1.3, C.strike - 0.14, 36, 0.1, 0.42, mus);
  const SK = C.strike;
  K.brass(SK, 0.32, [36, 42, 48, 54, 60, 66], { v: 0.26, rel: 0.25, dst: mus, bright: 1.4 }); K.timp(SK, 36, 0.8, mus); K.taiko(SK, 0.9, mus, { f: 44, len: 2 }); K.cymbal(SK, 1.5, 0.09, mus);
  for (let i = 0; i < 11; i++) K.stringNotes([[SK + 0.35 + i * 0.09, 84 - i * 3, 0.1, 0.9]], { v: 0.06, cut: 4200, dst: mus });
  K.strings(SK + 0.1, T0('s22') + 0.2, [40, 46, 52], { v: 0.05, a: 0.1, rel: 0.5, cut: 800, trem: 0.4, tremHz: 8, dst: mus });

  // ---------------- F. near silence, soften ----------------
  const So = C.soften, BO = C.breakout;
  K.strings(C.scratch - 0.2, So + 0.3, [86], { v: 0.006, a: 0.7, rel: 0.5, cut: 5000, vib: 3, dst: quiet });
  K.koto(C.scratch + 0.5, 79, 0.1, quiet, -0.15, { damp: 0.997 }); K.koto(C.scratch + 1.05, 76, 0.09, quiet, 0.15, { damp: 0.997 });
  K.strings(So, BO - 0.16, [43, 50, 55, 59, 62, 71], { v: 0.05, a: 0.9, rel: 0.04, cut: 1800, dyn: (t) => 0.35 + (t - So) / 1.7 * 0.65, bright: 1.2, dst: wet });
  K.choir(So + 0.1, BO - 0.16, [55, 59, 62, 67, 74], { v: 0.03, a: 0.8, rel: 0.03, vowel: 'u', dyn: (t) => 0.4 + (t - So) / 1.7 * 0.8, dst: wet });
  [59, 62, 67, 71, 74, 79, 83, 86, 91].forEach((m, i) => K.harp(BO - 0.82 + i * 0.075, m, 0.3 + i * 0.04, wet, -0.5 + i * 0.12));
  K.cymbal(BO - 1.1, 0.94, 0.06, mus, { swell: true }); K.timpRoll(BO - 0.9, BO - 0.17, 43, 0.06, 0.32, mus);

  // ---------------- G. breakout: the theme in full glory ----------------
  const bh = (b) => BO + b * 0.75, bc = (b) => C.peak + (b - 12) * 0.625, GL = (b) => (b < 8 ? bh(b) : bc(b));
  // head: D E G E D B (beats 0-4, 0.75 s), cadence: E D B A G (beats 12-16, 0.625 s, the G lands on home)
  const MEL = [...THEME.slice(0, 6), ...THEME.slice(17)];
  for (const [b, m, d] of MEL) { const t = GL(b), bl = b < 8 ? 0.75 : 0.625, len = d * bl * (d >= 2 ? 0.95 : 0.9), v = b < 8 ? 0.2 : 0.17;
    K.brass(t, len, [m - 12, m, m + 12], { v, rel: 0.12, dst: mus, bright: 1.3, scoop: 18 }); K.stringNotes([[t, m + 12, d * bl * 0.92, 1], [t, m + 24, d * bl * 0.92, 0.7], [t, m, d * bl * 0.92, 0.8]], { v: 0.09, cut: 5200, dst: mus });
    K.bell(t, mtof(m + 24), 0.028, wet, { parts: K.PARTS.glock, pan: 0.25 }); }
  const CH = [[BO, C.peak - BO - 1.5, [31, 43, 50, 55, 59, 62, 67]], [C.peak - 1.5, 1.5, [28, 40, 47, 55, 59, 64, 67]], [C.peak, 0.625, [33, 45, 52, 57, 60, 64]], [C.peak + 0.625, 0.625, [38, 50, 57, 62, 66, 69]], [C.peak + 1.25, C.home - C.peak - 1.25, [31, 43, 50, 55, 59, 62, 67, 74]]];
  CH.forEach(([t, d, ch]) => { K.brass(t, d * 0.94, ch, { v: 0.2, rel: 0.16, mellow: true, dst: mus }); K.strings(t, t + d, ch.map(m => m + 12), { v: 0.075, a: 0.1, rel: 0.2, cut: 5200, dst: mus }); K.choir(t, t + d, ch.slice(2).map(m => m + 12), { v: 0.13, a: 0.12, rel: 0.2, vowel: 'a', dst: wet, breath: 0.12 }); });
  for (let i = 0; i <= 7; i++) { const t = i < 4 ? bh(i) : bc(12 + (i - 4)); K.taiko(t, i % 4 === 0 ? 0.75 : 0.45, mus, { f: 56, len: 1.0 }); K.timp(t, i % 2 ? 50 : 43, 0.4, mus, 0.2, 1.1); }
  K.cymbal(BO, 3.2, 0.1, mus); K.cymbal(C.peak, 2.4, 0.075, mus);
  [79, 83, 86, 91, 95].forEach((m, i) => K.harp(BO + 0.06 * i, m, 0.42, wet, 0.5 - i * 0.2));

  // ---------------- H. dusk ----------------
  const H = C.home, bd = 0.85, dk = (b) => H + b * bd, DUSK = [[0, 71, 0.5], [0.5, 74, 0.5], [1, 76, 1], [2, 79, 0.5], [2.5, 81, 0.5], [3, 79, 1], [4, 76, 0.5], [4.5, 74, 0.5], [5, 71, 0.5], [5.5, 69, 0.5], [6, 67, 2.5]];
  for (const [b, m, d] of DUSK) K.flute(dk(b), d * bd * 0.86, m, 0.075, mus, -0.05, { vib: 16 });
  const DH = [[0, [36, 48, 55, 64], 2], [2, [43, 50, 59, 62], 1], [3, [40, 52, 59, 67], 1], [4, [33, 45, 52, 60], 1.3], [5.3, [38, 50, 57, 62], 0.7], [6, [43, 50, 55, 59, 62], 3.4]];
  DH.forEach(([b, ch, d]) => K.strings(dk(b), dk(b + d), ch, { v: 0.04, a: 0.55, rel: 0.7, cut: 1500, width: 0.6, dst: mus }));
  [[0, 67], [1, 64], [2, 71], [3, 67], [4, 69], [5, 66], [6, 67]].forEach(([b, m]) => K.koto(dk(b), m, 0.26, wet, -0.25, { damp: 0.9975 }));
  K.choir(dk(4), dk(8), [62, 67, 71], { v: 0.018, a: 1.2, rel: 1.2, vowel: 'u', dst: wet });
  // after the bell: a few notes, then the last leaf (a tiny comic beat), the smile
  const LL = C.lastleaf;
  K.koto(T0('s29') + 0.5, 74, 0.2, wet, -0.1, { damp: 0.9975 }); K.koto(T0('s29') + 0.5 + 0.34, 71, 0.18, wet, 0.1, { damp: 0.9975 });
  K.harp(LL + 0.02, 74, 0.3, mus, 0.25, { damp: 0.98, soft: 0.5, dur: 0.5 }); K.harp(LL + 0.22, 55, 0.34, mus, -0.1, { damp: 0.985, soft: 0.4, dur: 0.7 });
  K.flute(LL + 0.45, 0.32, 79, 0.03, mus, 0, { slide: -2 });
  [[0, 67], [0.14, 71], [0.28, 74]].forEach(([d, m]) => K.koto(LL + 0.95 + d, m, 0.18, wet, -0.05, { damp: 0.997 }));

  // ---------------- I. solo koto under the card (the G lands on the seal tap) ----------------
  // the card's hanko lands at card-time 2.85 / 1.5789 = 1.805 s (main.js speeds the card up to fit), first stamped frame f1796 = 74.83: the G and the tap land on it (74.85)
  const SEAL_T = C.card + 1.85, c0 = C.card + 0.04, kb = (SEAL_T - c0) / 4.5, KT = [[0, 74, 0.5], [0.5, 76, 0.5], [1, 79, 1], [2, 76, 0.5], [2.5, 74, 0.5], [3, 71, 1], [4, 69, 0.5], [4.5, 67, 2]];
  for (const [b, m, d] of KT) K.koto(c0 + b * kb, m + 0, b === 4.5 ? 0.42 : 0.36, wet, -0.12 + (m - 72) * 0.012, { damp: 0.9975, dur: d >= 2 ? 3 : 2.2, soft: 0.8 });
  K.koto(c0 + 4.5 * kb, 55, 0.22, wet, -0.2, { damp: 0.998, dur: 3 });
}
