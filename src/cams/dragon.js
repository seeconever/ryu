// RYŪ · 龍 · cameras + looks of the dragon team (owner: dragon). See src/cams/index.js for the signature. Cameras on ones (raw t).
import * as THREE from 'three';
import { GEO } from '../shots.js';
import { EYE, EYE_DIR } from '../dragon-head.js';
const V3 = THREE.Vector3, I = GEO.ISLAND;
const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerpA = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const D = (st) => st.ctx.modules.dragon;
const local = (st, t, p) => new V3(...p).applyMatrix4(D(st).headFrame(t)).toArray();
const A = (st, name, t) => D(st).anchor(name, t).toArray();
// a close-up on the right eye in head space (rides the head); dist = metres from the eye centre, off = [x, y] offset
const eyeCU = (dist0, dist1, fov, sway = 0) => (lt, d, t, st) => { const dist = dist0 + (dist1 - dist0) * sstep(0, d, lt), n = EYE_DIR, r = new V3().crossVectors(new V3(0, 1, 0), n).normalize(), u = new V3().crossVectors(n, r);
  const c = new V3(...EYE), off = Math.sin(t * 0.7) * sway; const p = c.clone().addScaledVector(n, dist).addScaledVector(r, -dist * 0.22 + off).addScaledVector(u, dist * 0.34); return { pos: local(st, t, p.toArray()), look: local(st, t, c.clone().addScaledVector(r, -2).addScaledVector(u, 1).toArray()), fov, near: 1 }; };

export const CAMS = {
  s09: eyeCU(72, 56, 38, 0.6),
  // low three-quarter from the slope: the head climbs out of frame's centre, coils swell below
  s11: (lt, d, t, st) => { const h = A(st, 'head', t), k = sstep(0, 1, lt / d); const p = [I.x + 340 - 40 * k, 455 + 150 * k, I.z + 440 + 60 * k]; return { pos: p, look: [h[0] * 0.8 + I.x * 0.2 - 10, h[1] * 0.78 + 370 * 0.22, h[2] * 0.75 + I.z * 0.25], fov: 50, far: 60000 }; },
  // long lens from the rice fields: the colossal head against the sun
  s12: (lt, d, t, st) => { const h = A(st, 'head', t); return { pos: [-3540, 42, -280 + lt * 6], look: [h[0] * 0.985 - 40, h[1] - 18, h[2]], fov: 10, far: 60000 }; },
  // fixed beside the dive: head screams past, body whips after it (pan on ones)
  s14: (lt, d, t, st) => { const h = A(st, 'head', t), m = A(st, 'mid', t); return { pos: [-4760, 160, 600], look: lerpA(h, m, 0.16 + 0.18 * sstep(1, 2.8, lt)), fov: 46, far: 60000 }; },
  s21: (lt, d, t, st) => { const h = D(st).anchor('head', t).toArray(); return { pos: [h[0] + 210, h[1] - 34, h[2] + 150 - lt * 26], look: [h[0] + 4, h[1] + 14, h[2] + 10], fov: 36 - lt * 2, near: 1 }; },
  s23: eyeCU(46, 34, 34, 0),
  s24: (lt, d, t, st) => { const h = A(st, 'head', t), m = A(st, 'mid', t), y = Math.max(3760, h[1] + 175), c = sstep(0, 1.2, lt); const lk = lerpA(h, m, 0.22 * c); lk[1] = Math.max(lk[1], 3320); return { pos: [h[0] + lerpA([170], [270], c)[0] - lt * 18, y, h[2] + lerpA([-215], [-330], c)[0] + lt * 30], look: lk, fov: 58, far: 60000 }; },
  s26: (lt, d, t, st) => { const f = D(st), h = f.anchor('head', t), v = f.velocity(0.02, t).normalize(), s = new V3().crossVectors(v, new V3(0, 1, 0)).normalize(); const p = h.clone().addScaledVector(s, 320).addScaledVector(v, -40 + lt * 12).add(new V3(0, -38, 0)); return { pos: p.toArray(), look: h.clone().addScaledVector(v, 30).add(new V3(0, 40, 0)).toArray(), fov: 42, far: 60000 }; },
  s27: (lt, d) => { const k = lt / d; return { pos: [I.x + 1180 - 60 * k, 300 + 20 * k, I.z + 1980 - 120 * k], look: [I.x, 250, I.z], fov: 36, far: 60000 }; },
  s28: eyeCU(56, 66, 36),
};
export const LOOKS = {
  s21: () => ({ haze: { color: 0x3a3590, density: 0.00002, max: 0.14, sunScatter: 0.1, sky: 0.3 }, grade: { halation: 0 }, bloom: { strength: 0 } }),
  s26: () => ({ haze: { density: 0.000012, max: 0.08 } }),
};
