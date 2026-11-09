// RYŪ · 龍 · dragon motion (owner: dragon): head path, body rail, frames. Pure functions of t, no state.
// The body is a train on a rail: rail A = dormant spiral around the island + the flight path, rail B = dusk glide + the same spiral
// (the head climbs it and the body wraps the island behind it). Rails are precomputed, uniform 3 m steps, with parallel transport frames.
import * as THREE from 'three';
import { GEO } from './shots.js';
import { onTwos } from './pipeline-util.js';
const V3 = THREE.Vector3;
const I = GEO.ISLAND;
export const REST = [I.x, I.peak, I.z];
export const BODY_LEN = 1500;
export const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;

// brow keys of the day flight [t, x, y, z] (min clearance: the jaw hangs 60 m below the brow)
const A = [[0, ...REST], [23.5, ...REST], [25, I.x, I.peak + 30, I.z], [28.5, I.x, I.peak + 300, I.z - 350], [31, I.x, I.peak + 340, I.z - 900],
  [33, I.x, I.peak + 270, I.z - 1200], [34.5, -4300, 290, 300], [36, -4900, 118, -1400], [39, -1700, 112, -900], [39.9, -200, 185, -250], [40.9, 380, 215, -60], [42, 200, 150, 280],
  [44, 200, 110, 1500], [47, 0, 100, 5000], [49.5, 0, 260, 9000], [52, 120, 900, 10800], [53.5, -80, 1080, 11500], [56, 60, 1500, 12200], [57.5, 0, 3260, 12500], [58.2, 150, 3780, 12700],
  [61, 300, 4300, 12900], [63.5, 800, 4000, 13000]];
// dusk glide keys [x, y, z] from the cut (63.5) to the shore where the spiral starts
const GLIDE = [[-7000, 760, -300], [-6200, 560, 500], [-5400, 330, 1400], [-4950, 150, 2500]];
export const CUT = 63.5, TLAND = 68.45;

function cr(keys, t) {   // Catmull-Rom through time keys, clamped
  const n = keys.length; if (t <= keys[0][0]) return keys[0].slice(1); if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (t >= keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)], u = (t - p1[0]) / (p2[0] - p1[0]), h = p2[0] - p1[0];
  return [1, 2, 3].map(c => { const m1 = p1 === p0 ? 0 : (p2[c] - p0[c]) / (p2[0] - p0[0]) * h, m2 = p3 === p2 ? 0 : (p3[c] - p1[c]) / (p3[0] - p1[0]) * h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2; });
}
const crPts = (P, k) => { const n = P.length - 1, x = clamp(k, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), u = x - i, a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(n, i + 2)];
  return [0, 1, 2].map(j => 0.5 * (2 * b[j] + (c[j] - a[j]) * u + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * u * u + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * u * u * u)); };

// the helix of the breakout (s24), added to the keyed path
function pathA(t) {
  const p = cr(A, t), w = sstep(57.2, 58.4, t) * (1 - sstep(60.6, 62.4, t)), R = 300 * w, a = (t - 57.5) * 3.1;
  p[0] += Math.cos(a) * R - R * Math.cos(-0.0); p[2] += Math.sin(a) * R; return p;
}

function resample(poly, ds = 3) {   // polyline [[x,y,z]..] -> uniform table with frames
  const out = []; let acc = 0, a = poly[0].slice(); out.push(a.slice());
  for (let i = 1; i < poly.length; i++) { const b = poly[i], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (l < 1e-6) continue;
    let d = ds - acc; while (d <= l) { const k = d / l; out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]); d += ds; }
    acc = (acc + l) % ds; a = b.slice(); }
  const n = out.length, P = new Float32Array(n * 3), T = new Float32Array(n * 3), U = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) P[i * 3 + c] = out[i][c];
  const t = new V3(), up = new V3(0, 1, 0), wup = new V3(0, 1, 0), w = 6;
  for (let i = 0; i < n; i++) { const i0 = Math.max(0, i - w), i1 = Math.min(n - 1, i + w);
    t.set(P[i1 * 3] - P[i0 * 3], P[i1 * 3 + 1] - P[i0 * 3 + 1], P[i1 * 3 + 2] - P[i0 * 3 + 2]); if (t.lengthSq() < 1e-6) t.set(0, 0, 1); t.normalize();
    up.addScaledVector(t, -up.dot(t)); up.lerp(wup, 0.012 * (1 - Math.abs(t.y))); up.addScaledVector(t, -up.dot(t)).normalize();
    T[i * 3] = t.x; T[i * 3 + 1] = t.y; T[i * 3 + 2] = t.z; U[i * 3] = up.x; U[i * 3 + 1] = up.y; U[i * 3 + 2] = up.z; }
  return { n, ds, L: (n - 1) * ds, P, T, U };
}
// sample rail at arc s (clamped); fills out = { p, t, u } (Vector3s)
function railAt(r, s, out) { const x = clamp(s / r.ds, 0, r.n - 1.001), i = Math.floor(x), k = x - i, a = i * 3, b = a + 3;
  out.p.set(lerp(r.P[a], r.P[b], k), lerp(r.P[a + 1], r.P[b + 1], k), lerp(r.P[a + 2], r.P[b + 2], k));
  out.t.set(lerp(r.T[a], r.T[b], k), lerp(r.T[a + 1], r.T[b + 1], k), lerp(r.T[a + 2], r.T[b + 2], k));
  out.u.set(lerp(r.U[a], r.U[b], k), lerp(r.U[a + 1], r.U[b + 1], k), lerp(r.U[a + 2], r.U[b + 2], k)); }

export function buildPath(terrain) {
  // the dormant spiral, outer end -> peak; arrives at the peak travelling +z
  const R0 = I.R * 0.9, TURN = 0.62, NS = 900, sp = [];
  for (let i = 0; i <= NS; i++) { const w = 1 - i / NS, r = R0 * Math.pow(w, 1.05), a = -Math.PI / 2 + w * TURN * Math.PI * 2;
    const h = terrain(r, a), bury = 66 * sstep(0, 150, r), y = lerp(h + 22 - bury, I.peak, 1 - sstep(10, 90, r));
    sp.push([I.x + Math.cos(a) * r, y, I.z + Math.sin(a) * r]); }
  const flight = []; const dt = 1 / 96, T0 = 23.5; for (let t = T0 + dt; t <= CUT + 1e-6; t += dt) flight.push(pathA(t));
  const railA = resample([...sp, ...flight]); const LSP = (() => { let l = 0; for (let i = 1; i < sp.length; i++) l += Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1], sp[i][2] - sp[i - 1][2]); return l; })();
  // arc position of the head on rail A at each sample time
  const nA = Math.ceil((CUT - T0) / dt) + 1, SA = new Float32Array(nA);
  { let s = LSP, q = pathA(T0); SA[0] = s; for (let i = 1; i < nA; i++) { const p = pathA(T0 + i * dt); s += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); SA[i] = s; q = p; } }
  // rail B: straight run-in behind the cut, the glide, then the spiral
  const glide = []; const g0 = GLIDE[0], g1 = GLIDE[1]; const glen = Math.hypot(g1[0] - g0[0], g1[1] - g0[1], g1[2] - g0[2]);
  const PRE = BODY_LEN + 400; for (let i = 40; i > 0; i--) { const k = i / 40 * PRE / glen; glide.push([g0[0] - (g1[0] - g0[0]) * k, g0[1] - (g1[1] - g0[1]) * k, g0[2] - (g1[2] - g0[2]) * k]); }
  const GP = [...GLIDE, sp[0], sp[Math.round(NS * 0.08)]]; for (let i = 0; i <= 200; i++) glide.push(crPts(GP, i / 200 * 0.8));   // stop on the 2nd-last key
  const railB = resample([...glide, ...sp.slice(Math.round(NS * 0.08))]);
  const SB0 = PRE, SB1 = railB.L;
  const tmp = { p: new V3(), t: new V3(), u: new V3() };

  const headS = (t) => { if (t < CUT) { if (t <= T0) return SA[0]; const x = Math.min(nA - 1.001, (t - T0) / dt), i = Math.floor(x); return lerp(SA[i], SA[i + 1], x - i); }
    const k = clamp((t - CUT) / (TLAND - CUT), 0, 1); return lerp(SB0, SB1, 1 - Math.pow(1 - k, 2.0)); };
  const headPos = (t) => { if (t < CUT) return new V3(...pathA(t)); railAt(railB, headS(t), tmp); return tmp.p.clone(); };
  const rail = (t) => t < CUT ? railA : railB;

  // bank (rad, right wing down when turning right) and flight weight
  const flyK = (t) => sstep(25, 29, t) * (1 - sstep(66.6, 68.4, t));
  function headDir(t, out = new V3()) { let t1 = t + 0.09, t0 = t - 0.09; if (t < CUT && t1 >= CUT) t1 = CUT - 1e-4; if (t >= CUT && t0 < CUT) t0 = CUT;   // never sample across the dusk cut
    out.subVectors(headPos(t1), headPos(t0)); if (out.lengthSq() < 1e-4) out.set(0, 0, 1); return out.normalize(); }
  const yawRate = (t) => { const d1 = headDir(t + 0.2), d0 = headDir(t - 0.2); return Math.atan2(d1.x * d0.z - d1.z * d0.x, d1.x * d0.x + d1.z * d0.z) / 0.4; };

  // THE head frame: origin = brow (shrine base), +y up, +z forward. Heavy moves on ones (camera rides it), overlay shake on twos.
  const headFrame = (t, shake = true) => {
    const p = headPos(t), f = headDir(t), w = sstep(24.2, 26.2, t) * (1 - sstep(66.6, 68.3, t)), pc = 0.42 + 0.7 * sstep(57.2, 58.4, t) * (1 - sstep(60.8, 62, t)), h = Math.hypot(f.x, f.z);
    f.y = clamp(f.y, -pc * h, pc * h); f.normalize(); const dir = new V3(0, 0, 1).lerp(f, w).normalize();
    const up = new V3(0, 1, 0), right = new V3().crossVectors(up, dir).normalize(), u2 = new V3().crossVectors(dir, right);
    let roll = clamp(yawRate(t) * 0.33, -0.55, 0.55) * w; let yaw = 0, pitch = -0.03 * w + 0.16 * sstep(23.6, 26.5, t) * (1 - sstep(27.8, 31, t));   // the rearing head tilts up (eyes on the camera)
    yaw += turnK(t);   // the wide shots: the head looks back along its own body, a pose instead of a log with a nose
    if (shake) { const q = onTwos(t), th = thrash(q); roll += th * 0.2 * Math.sin(q * 31.3 + 0.6); yaw += th * 0.26 * Math.sin(q * 23.7); pitch += th * 0.16 * Math.sin(q * 41.9 + 1.2); }
    const m = new THREE.Matrix4().makeBasis(right, u2, dir), e = new THREE.Euler(pitch, yaw, roll, 'YXZ'); m.multiply(new THREE.Matrix4().makeRotationFromEuler(e)); m.setPosition(p); return m;
  };
  const thrash = (t) => sstep(52.0, 52.15, t) * (1 - sstep(53.0, 53.6, t));
  // windows of the wide flight shots (constant inside the shot, ramped outside it so the velocity of frame one stays honest)
  const win = (a, b, t) => sstep(a - 0.3, a, t) * (1 - sstep(b, b + 0.3, t));
  const turnK = (t) => 0.42 * win(33, 36, t) - 0.5 * win(44, 47, t) + 0.38 * win(57.5, 61, t);
  const curveK = (t) => win(33, 36, t) + win(44, 47, t) + win(57.5, 61, t);

  // body centre line. s = metres behind the neck. Rail + lift (coils breaking out of the slopes) + serpent wave + rigid neck blend.
  const NECK = new V3(0, -26, -36);
  const P0 = new V3(), P1 = new V3(), SIDE = new V3();
  function bodyAt(s, t, out, frame) {
    const r = rail(t), S = headS(t) - s, tw = onTwos(t);
    railAt(r, S, tmp); out.copy(tmp.p).addScaledVector(tmp.u, -22);
    const up = tmp.u, T = tmp.t; SIDE.crossVectors(up, T).normalize();
    // coil lift: coils swell out through the slopes (rail section on the spiral only)
    const onSp = r === railA ? clamp(1 - S / LSP, 0, 1) : clamp((S - (railB.L - LSP * 0.92)) / (LSP * 0.92), 0, 1) * 0 + (S > railB.L - LSP * 0.92 ? clamp((railB.L - S) / (LSP * 0.92), 0, 1) : 0);
    if (onSp > 0 && r === railA) { const w = sstep(23.7 + onSp * 2.2, 25.4 + onSp * 2.2, t); out.y += w * (66 + 30 * Math.sin(S * 0.018 - t * 1.6)) * sstep(0, 0.1, onSp); }
    if (r === railB) { const k = S > railB.L - LSP * 0.92 ? 1 : 0, w = k * (1 - sstep(67.5, 68.5, t + onSp * 0.2)); out.y += w * (76 + 18 * Math.sin(S * 0.02 + 2)) * sstep(0, 0.1, onSp); }
    // serpent wave, on twos
    const fk = flyK(t), th = thrash(tw), u = clamp(s / BODY_LEN, 0, 1), env = sstep(0.05, 0.3, u);
    const ck = curveK(t), amp = fk * (40 + th * 90 + 150 * ck) * (1 - 0.35 * u) * env, ph = 2 * Math.PI * (u * lerp(2.3, 1.65, ck) - tw * 0.85), ph2 = 2 * Math.PI * (u * 1.5 - tw * 0.55) + 1.3;
    out.addScaledVector(SIDE, Math.sin(ph) * amp).addScaledVector(up, Math.sin(ph2) * amp * lerp(0.55, 0.3, ck));
    if (frame) { frame.t.copy(T); frame.u.copy(up); frame.side.copy(SIDE); }
    // rigid neck blend at the head
    if (s < 170) { const hk = 1 - sstep(0, 170, s); P0.copy(NECK); P0.z -= s; P0.applyMatrix4(frame?.head || headFrame(t)); out.lerp(P0, hk * hk); }
    return out;
  }
  // u: 0 = neck .. 1 = tail tip
  const spine = (u, t, out = new V3()) => bodyAt(u * BODY_LEN, t, out);

  return { headPos, headFrame, headDir, headS, rail, railA, railB, LSP, bodyAt, spine, flyK, thrash, yawRate };
}

// eye state, pure of t. open 0..1 (lids), pupil 0.12 slit .. 1 wide, soft 0..1 (kind lid shape), narrow 0..1 (angry lid)
export function eyeState(t) {
  const open = sstep(20.4, 21.5, t) * (1 - 0.15 * sstep(36, 36.5, t) * 0) * (1 - sstep(68.6, 69.7, t));
  const blink = 1 - 0.85 * sstep(29.9, 30.0, t) * (1 - sstep(30.05, 30.18, t));   // one heavy blink before take-off
  const pupil = lerp(lerp(0.14, 0.24, sstep(20.8, 21.8, t)), 0.1, sstep(23.5, 24.5, t)) + 0.12 * sstep(36, 40, t) * (1 - sstep(51.9, 52.1, t));
  const fear = sstep(51.95, 52.15, t) * (1 - sstep(55.5, 56.3, t));
  const soften = sstep(56.3, 57.2, t);
  return { open: open * blink, pupil: lerp(lerp(pupil, 0.09, fear), 0.5, soften), soft: soften, narrow: fear };
}
