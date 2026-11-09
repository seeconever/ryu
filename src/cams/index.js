// RYŪ · 龍 · camera + look registry (owner: engine).
// Each department fills src/cams/<team>.js for the shots it owns (CONTRACT.md):
//   export const CAMS  = { s05: (lt, d, t, st) => ({ pos: [x,y,z], look: [x,y,z], fov, roll?, near?, far? }) };
//   export const LOOKS = { s05: (lt, d, t, st) => ({ ...partial LOOK, see BASE_LOOK in src/pipeline.js }) };
// lt = seconds into the shot, d = shot length, t = film time, st = { shot, k: lt/d, ctx } (ctx.modules.* = department APIs).
// Camera moves on ones (raw t), never on twos. Resolution per shot: DEFAULT_CAMS <- team CAMS. Looks: BASE_LOOK <- setLook(env, t) <- team LOOKS.
import { Vector3 } from 'three';
import { curve, lerp, sstep, ease } from '../pipeline-util.js';
import { END_CARD_LOOK } from '../pipeline-kit.js';
import { GEO } from '../shots.js';
import * as dragon from './dragon.js';
import * as keeper from './keeper.js';
import * as world from './world.js';
import * as fx from './fx.js';
import * as audio from './audio.js';

export const TEAM_CAMS = { dragon, keeper, world, fx, audio };

const L = (a, b, k) => a.map((v, i) => lerp(v, b[i], ease(k)));
const mv = (p0, p1, look, fov = 40, o = {}) => (lt, d) => ({ pos: L(p0, p1, lt / d), look, fov, ...o });
const add = (a, b) => a.map((v, i) => v + b[i]);
const I = GEO.ISLAND;
// shrine-local camera (rides the dragon)
const K = (p0, p1, l0, l1, fov = 36, o = {}) => (lt, d, t, st) => { const k = st.ctx.modules.keeper, f = (p) => k ? k.toWorld(p) : [I.x + p[0], I.peak + p[1], I.z + p[2]];
  return { pos: f(L(p0, p1, lt / d)), look: f(L(l0, l1, lt / d)), fov, near: 0.05, ...o }; };
const A = (st, name, t) => st.ctx.modules.dragon?.anchor(name, t).toArray() ?? [I.x, I.peak, I.z];
// a camera offset from the head; o.lookAt overrides the target
const chase = (off, fov = 45, name = 'head', o = {}) => (lt, d, t, st) => { const h = A(st, name, t); return { pos: add(h, off), look: o.lookAt || h, fov, ...o }; };

// close on the right eye, in the head's own frame (never inside the skull)
const eyeCam = (fov) => (lt, d, t, st) => { const f = st.ctx.modules.dragon?.headFrame(t), w = (p) => f ? new Vector3(...p).applyMatrix4(f).toArray() : [I.x + p[0], I.peak + p[1], I.z + p[2]];
  return { pos: w([95, -8, 95]), look: w([35, -12, 35]), fov }; };

export const DEFAULT_CAMS = {
  s01: mv([I.x + 1900, 130, I.z + 3500], [I.x + 1700, 125, I.z + 3100], [I.x, 280, I.z], 34),
  s02: K([3.6, 3.5, 10], [3.3, 3.4, 9.4], [0, 3, -2], [0, 3, -2], 38),
  s03: K([3.2, 1.2, 3.6], [3.0, 1.15, 3.4], [0, 0.6, 1.6], [0, 0.6, 1.6], 34),
  s04: K([0.6, 0.35, 3.1], [0.55, 0.33, 3.0], [0, 0.05, 2.2], [0, 0.05, 2.2], 28, { near: 0.02 }),
  s05: K([-2.2, 1, 4.6], [-2, 1, 4.2], [0, 0.7, 2], [0, 0.7, 2], 34),
  s06: K([-0.5, 1.3, 3.6], [-0.6, 1.35, 3.4], [-2.2, 1.6, 0.4], [-2.2, 1.6, 0.4], 38),
  s07: mv([I.x + 420, 200, I.z + 620], [I.x + 400, 205, I.z + 590], [I.x, 330, I.z], 40),
  s08: mv([I.x + 1100, 90, I.z + 1900], [I.x + 1000, 96, I.z + 1740], [I.x, 230, I.z], 40),
  s09: eyeCam(30),
  s10: K([2.6, 0.9, 3.8], [2.4, 0.9, 3.6], [0, 0.7, 1.6], [0, 0.7, 1.6], 34),
  s11: (lt, d, t, st) => ({ pos: [I.x + 900, 180, I.z + 2000], look: A(st, 'head', t), fov: 42 }),
  s12: (lt, d, t, st) => ({ pos: [-3500, 30, -450], look: A(st, 'head', t), fov: 38 }),
  s13: K([2, 0.8, 3.8], [1.9, 0.8, 3.7], [-2.2, 0.9, 1], [-2.2, 0.9, 1], 36),
  s14: (lt, d, t, st) => ({ pos: [I.x - 1600, 220, I.z - 2400], look: A(st, 'head', t), fov: 42 }),
  s15: chase([-100, 30, 180], 50),
  s16: (lt, d, t, st) => ({ pos: [-120, 60, -260], look: A(st, 'head', t), fov: 48 }),
  s17: K([1.0, 1.6, 0.6], [1.0, 1.6, 0.6], [0, 1, 8], [0, 1, 8], 46),
  s18: chase([-160, 40, -240], 46),
  s19: chase([0, 60, -420], 42, 'head', { lookAt: [0, 300, 9500] }),
  s20: chase([140, 60, -200], 48),
  s21: chase([60, 10, 110], 40),
  s22: K([2.4, 1.4, 3.6], [2.2, 1.3, 3.4], [0, 0.7, 1.4], [0, 0.7, 1.4], 34),
  s23: eyeCam(26),
  s24: (lt, d, t, st) => ({ pos: [260, 1800, 12200], look: A(st, 'head', t), fov: 46 }),
  s25: K([1.6, 0.4, 4.2], [1.4, 0.4, 4], [0, 1.1, 1.6], [0, 1.1, 1.6], 30),
  s26: chase([-300, 120, 200], 44),
  s27: mv([I.x + 1200, 240, I.z + 2200], [I.x + 1100, 230, I.z + 2000], [I.x, 300, I.z], 40),
  s28: eyeCam(28),
  s29: K([3.2, 1.2, 3.6], [3.0, 1.15, 3.4], [0, 0.6, 1.6], [0, 0.6, 1.6], 34),
  s30: () => ({ pos: [0, 0, 5], look: [0, 0, 0], fov: 40 }),
};

// Set looks (bright high-key). Dusk is a hard cut at s26 (63.5).
const DAY = {
  sun: { dir: [0.3, 0.62, 0.72], color: 0xfff6ea, k: 1.0 },
  amb: { sky: 0xb4c4ff, ground: 0x9c8e86, k: 0.95 },
  haze: { color: 0xc6dcff, density: 0.00005, h0: 0, falloff: 0.0011, max: 0.35, sunScatter: 0.3, sky: 0.3 },
  water: { on: true, level: 0 },
  shafts: { on: false },
};
const DUSK = {
  sun: { dir: [0.15, 0.1, 0.98], color: 0xffb27a, k: 1.0 },
  amb: { sky: 0x9a8ee0, ground: 0x8e6a72, k: 0.9 },
  rim: { color: 0xffc89a, k: 1.2 },
  hero: { color: 0xffd6b0, k: 1.0 },
  haze: { color: 0xf0b8a8, density: 0.0004, h0: 0, falloff: 0.001, max: 0.75, sunScatter: 0.8, sky: 0.4 },
  water: { on: true, level: 0 },
  grade: { hiTint: 0xfff0e0, shTint: 0xe8e4ff, sat: 1.16 },
};
const HIGH = { sun: { dir: [0.3, 0.62, 0.72], color: 0xfff8ee, k: 1.05 }, amb: { sky: 0xb8c8ff, ground: 0xe0e4f4, k: 1.0 },
  haze: { color: 0xd4e4ff, density: 0.00006, h0: 1500, falloff: 0.0003, max: 0.6, sunScatter: 0.3, sky: 0.2 }, water: { on: false } };
const STORM = { sun: { dir: [-0.3, 0.55, 0.45], color: 0xb8c8ff, k: 0.8 }, amb: { sky: 0x6a66c8, ground: 0x3a3468, k: 0.95 },
  haze: { color: 0x3b3584, density: 0.00025, h0: 0, falloff: 0, max: 0.7, sunScatter: 0.1, sky: 0.3 }, water: { on: false }, grade: { sat: 1.1, shTint: 0xd8d4ff } };
const DUSK_SKY = { ...DUSK, water: { on: false } };
const SHRINE_SHADOW = { center: [0, 0, 0], radius: 8, k: 1 };
export const SET_LOOKS = { island: DAY, shrine: DAY, paddies: DAY, town: DAY, sea: DAY, storm: STORM, sky: HIGH, card: END_CARD_LOOK };

export function setLook(env, t) {
  const dusk = t >= 63.5;
  if (env === 'storm') return STORM;
  if (env === 'sky') return dusk ? DUSK_SKY : HIGH;
  if (env === 'card') return END_CARD_LOOK;
  return dusk ? DUSK : DAY;
}

// camera for a shot at film time t (team CAMS override the placeholders)
export function camFor(shot, t, ctx) {
  const lt = t - shot.t0, d = shot.t1 - shot.t0, st = { shot, k: lt / d, ctx };
  const team = TEAM_CAMS[shot.owner]?.CAMS?.[shot.id];
  return (team || DEFAULT_CAMS[shot.id] || DEFAULT_CAMS.s01)(lt, d, t, st);
}
export function lookFor(shot, t, ctx) {
  const lt = t - shot.t0, d = shot.t1 - shot.t0, st = { shot, k: lt / d, ctx };
  const team = TEAM_CAMS[shot.owner]?.LOOKS?.[shot.id];
  return { set: setLook(shot.env, t), shot: team ? team(lt, d, t, st) : null };
}
export { curve, sstep };
