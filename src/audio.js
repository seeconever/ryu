// RYŪ · 龍 — SOUND (owner: sound): the fully synthesized soundtrack, locked to SHOTS and CUES (src/shots.js).
// No samples: an original score (src/audio-score.js) + sound design (src/audio-sfx.js) built from the synth kit
// (src/audio-kit.js) on a Web Audio OfflineAudioContext, then mastered in JS (src/audio-master.js).
// API
//   create()                                         no picture (the engine loads every department; audio draws nothing)
//   renderSoundtrack(oac, { cues, shots, duration }) builds the graph on an OfflineAudioContext (2 ch, 48 kHz); the caller
//                                                    runs oac.startRendering(). Returns { marks, cues } for the analysis
//   masterSoundtrack(L, R, sr)                       -> { L, R, ... } at MIX.target LUFS, true peak <= MIX.ceiling dBTP
//   analyze(L, R, sr, { shots, cues, gain, marks })  loudness / phone / band gains / spectrum / onsets / clicks
// audio.html wires these together; tools/render-audio.mjs writes the WAV + m4a. Deterministic: seeded noise only.
// Mix: music (dry + wet) -> hall; world (ambience + sfx + big hits, big through a soft clipper) -> 32 Hz HP -> room / vast
// reverbs; quiet bus (survives the near silence). The bell cuts the music dead until the eye; the music and the world
// are gated down in the near silence (scratch -> soften), and everything takes a short breath before the big hits.
import { createKit, smooth } from './audio-kit.js';
import { score } from './audio-score.js';
import { sfx, shotLevel } from './audio-sfx.js';
import { master, analyze } from './audio-master.js';
export { analyze };

export const MIX = { target: -14, ceiling: -2.4 };   // the AAC adds ~0.7 dB: -2.4 on the WAV keeps the AAC at <= -1.5 dBTP
// level per shot (dB). A hierarchy: summer light, flight full, storm dark, breakout the loudest, dusk soft.
const MUS_DB = { s01: 1, s02: 0, s03: 0, s04: 0, s05: 1, s06: 0, s07: 0, s08: 0, s09: 0, s10: -1, s11: -2, s12: -2.5, s13: -3,
  s14: -2, s15: -2, s16: -2, s17: -2, s18: -2, s19: -2, s20: -3, s21: -2.5, s22: -2, s23: -2, s24: 2, s25: 0.8, s26: 0.5, s27: 0.5, s28: 0.5, s29: 0, s30: 3 };
const WORLD_DB = { s01: -1, s02: 0, s03: 0, s04: 0, s05: 0, s06: 0, s07: -1, s08: -1, s09: -1, s10: -2, s11: -1, s12: -2, s13: -3,
  s14: -2, s15: -3, s16: -3, s17: -3, s18: -3, s19: -2, s20: -2, s21: -1.5, s22: 0, s23: 0, s24: -1, s25: -4, s26: -3, s27: -2, s28: -2, s29: -1, s30: -2 };
const dbg = (d) => Math.pow(10, d / 20);

export function create() { return { update() {}, dispose() {} }; }

export async function renderSoundtrack(oac, { cues, shots, duration, solo = null }) {
  const K = createKit(oac, { seed: 3636 }), D = duration, C = cues, SH = Object.fromEntries(shots.map(s => [s.id, s]));
  const S = (n) => K.stereo(n), out = S(K.gain(1)), hp = S(K.filter('highpass', 24, 0.6, oac.destination)); out.connect(hp);

  // breaths before the big hits [cue, length, dB]
  const BREATH = [[C.rise, 0.1, -5], [C.takeoff, 0.14, -7], [C.storm, 0.1, -6], [C.strike, 0.14, -9], [C.breakout, 0.16, -10]];
  const breath = (t) => { let g = 1; for (const [c, len, d] of BREATH) if (t > c - len - 0.03 && t < c) g *= dbg(d * smooth((t - (c - len - 0.03)) / 0.03) * (1 - smooth((t - c + 0.006) / 0.006))); return g; };
  // music gate: the bell cuts it, the eye reopens it; near silence from s22 until soften
  const Q0 = C.scratch - 1.0, Q1 = C.scratch - 0.1;
  const musGate = (t) => {
    if (t >= C.bell - 0.02 && t < C.eye - 0.05) return t < C.bell + 0.02 ? 1 - smooth((t - (C.bell - 0.02)) / 0.04) : 0;
    if (t >= C.eye - 0.05 && t < C.eye + 0.02) return smooth((t - (C.eye - 0.05)) / 0.07);
    if (t >= Q0 && t < C.soften + 0.5) return Math.max(1 - smooth((t - Q0) / (Q1 - Q0)), smooth((t - C.soften) / 0.5));
    return 1;
  };
  // world gate: drops for the scratch, back in the last moments before the breakout
  const worldGate = (t) => (t >= Q0 && t < C.breakout ? Math.max(0.05, 1 - smooth((t - Q0) / (Q1 - Q0)), smooth((t - (C.breakout - 1.2)) / 1.0)) : 1);
  const musShot = shotLevel(shots, Object.fromEntries(shots.map(s => [s.id, { g: dbg(MUS_DB[s.id] || 0) }])), 'g', 0.15);
  const worldShot = shotLevel(shots, Object.fromEntries(shots.map(s => [s.id, { g: dbg(WORLD_DB[s.id] || 0) }])), 'g', 0.15);

  const musOut = S(K.gain(1, out)); K.curve(musOut.gain, 0, D, (t) => breath(t) * musGate(t) * musShot(t), 1000);
  const musAir = S(K.filter('highshelf', 4500, 0.707, musOut, 3));
  const hall = K.reverb(K.ir(3.6, { rt60: 2.8, pre: 0.024, seed: 5 }), musAir, 1);
  const mus = S(K.gain(0.9, musAir)), wet = S(K.gain(0.8, musAir)); mus.connect(K.gain(0.2, hall)); wet.connect(K.gain(0.55, hall));

  const worldOut = S(K.gain(1, out)); K.curve(worldOut.gain, 0, D, (t) => breath(t) * worldGate(t) * worldShot(t), 1000);
  const worldClip = K.softClip(0.32, 0.62, worldOut), worldLow = S(K.filter('lowshelf', 80, 0.707, worldClip.input, -3));
  const worldHP = S(K.filter('highpass', 32, 0.7, worldLow));
  const room = K.reverb(K.ir(1.2, { rt60: 0.75, pre: 0.008, bright: 0.7, seed: 11 }), worldHP, 1);
  const vast = K.reverb(K.ir(6, { rt60: 5.5, pre: 0.05, bright: 0.6, dark: 0.05, seed: 23 }), worldHP, 1);
  const clip = K.softClip(0.25, 0.48, worldHP), amb = S(K.gain(1, worldHP)), fx = S(K.gain(1, worldHP)), big = S(K.gain(1, clip.input));
  fx.connect(K.gain(0.12, room)); fx.connect(K.gain(0.12, vast)); big.connect(K.gain(0.35, vast));
  const quiet = S(K.gain(1, out)); const qr = S(K.gain(0.18, quiet)); void qr;
  if (solo) for (const [name, node] of [['music', musOut], ['world', worldOut], ['quiet', quiet]]) if (name !== solo) node.disconnect();

  const bus = { mus, wet, quiet, amb, sfx: fx, big }, STEP = 0.5, LEAD = 0.1;
  K.deferred = true;
  score(K, bus, C, shots);
  const marks = sfx(K, bus, C, shots, D);
  K.flush(STEP + LEAD);
  for (let T = STEP; T < D; T += STEP) { const h = T + STEP + LEAD; oac.suspend(T).then(() => { K.flush(h); oac.resume(); }); }
  return { marks, cues: C };
}

export function masterSoundtrack(L, R, sr) { return master(L, R, sr, { target: MIX.target, ceiling: MIX.ceiling, fadeIn: 0.3, fadeOut: 0.7, clip: [-3.5, 3.3] }); }