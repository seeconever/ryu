// RYŪ · 龍 · WORLD (owner: world): the green island peak (terrain, instanced forest that ripples like fur, birds), the sea stacks.
// The paddies live in world-paddies.js, the town flight beats in world-flight.js.
import * as THREE from 'three';
import { GEO } from './shots.js';
import { fbm, sstep } from './world-terrain.js';

const I = GEO.ISLAND;
const DUSK_T = 63.5;

export function islandHeight(r, a) {
  const { R, peak } = I, k = Math.min(1, r / R), n = 1 + 0.12 * Math.sin(a * 3 + 1.2) + 0.08 * Math.sin(a * 7 + r * 0.01);
  const dent = 36 * (1 - sstep(50, 72, r));   // the seat of the sleeping head (dragon-path uses this too)
  if (r < 14) return peak - dent;
  const ridge = Math.abs(Math.sin(a * 3 + 0.9 + r * 0.0012)) - 0.6;    // radial ridges + gullies (seamless: integer multiples of a)
  return peak * Math.pow(1 - Math.pow(k, 1.25), 1.5) * (0.92 + 0.08 * n) + ridge * 46 * sstep(0.05, 0.3, k) * (1 - sstep(0.7, 1, k))
    + 22 * Math.sin(r * 0.018 + a * 4) * k * (1 - k) * 4 - 8 * k * k - dent;
}
export const islandGround = (x, z) => { const dx = x - I.x, dz = z - I.z; return islandHeight(Math.hypot(dx, dz), Math.atan2(dz, dx)); };

// one crown: 4 lobes, dark core, light tips; origin at the foot (the pivot of the bend)
function crownGeometry() {
  const P = [], N = [], Cc = [], Ix = [], lobes = [[0, 0.72, 0, 0.95], [0.55, 0.42, 0.26, 0.72], [-0.5, 0.46, -0.3, 0.7], [0.08, 1.22, -0.1, 0.62]];
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (const [cx, cy, cz, r] of lobes) { const s = new THREE.IcosahedronGeometry(1, 1), p = s.attributes.position, base = P.length / 3;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.1 * Math.sin(v.x * 5.1 + v.z * 3.3 + cx * 7) * Math.cos(v.y * 4.3 + cz * 5);
      w.set(cx + v.x * r * k, cy + v.y * r * k * 0.9, cz + v.z * r * k); P.push(w.x, w.y, w.z);
      const n = v.clone().multiplyScalar(0.55).addScaledVector(w.clone().setY(w.y - 0.3).normalize(), 0.85).normalize(); N.push(n.x, n.y, n.z);
      const c = 0.52 + 0.48 * sstep(0.1, 1.5, w.y + v.y * 0.3); Cc.push(c, c, c * 0.95); }
    const idx = s.index ? s.index.array : [...Array(p.count).keys()]; for (const j of idx) Ix.push(base + j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); g.setIndex(Ix); return g;
}
export const CROWN = crownGeometry;

export function buildIsland(ctx, parent) {
  const { R } = I, rings = 170, secs = 420, pos = [], col = [], idx = [];
  const C = (h) => new THREE.Color(h), SAND = C(0xf2e3ae), MEADOW = C(0x8ed668), UNDER = C(0x2d9256), FOREST = C(0x279c5c), ROCK = C(0x94909e), CLIFF = C(0xb3a48f);
  const G = (r, a) => islandHeight(r, a);
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= secs; j++) { const r = R * 1.05 * Math.pow(i / rings, 1.12), a = j / secs * Math.PI * 2, h = G(r, a);
    pos.push(I.x + Math.cos(a) * r, h, I.z + Math.sin(a) * r);
    const n = fbm(Math.cos(a) * r * 0.006 + 3, Math.sin(a) * r * 0.006 + 5), slope = Math.abs(G(r + 12, a) - h) / 12;
    let c = FOREST.clone().lerp(UNDER, sstep(0.4, 0.7, n)).lerp(MEADOW, sstep(0.62, 0.74, n) * 0.5);
    if (h < 7) c = SAND.clone();
    else if (h < 13) c.lerp(SAND, 1 - sstep(7, 13, h));
    if (h > 355) c.lerp(ROCK, sstep(355, 390, h + 16 * n));
    if (slope > 1.0 && h < 60) c.lerp(CLIFF, sstep(1.0, 1.5, slope) * 0.9);
    col.push(c.r, c.g, c.b); }
  for (let i = 0; i < rings; i++) for (let j = 0; j < secs; j++) { const a = i * (secs + 1) + j, b = a + secs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, ctx.mat.bg(0xffffff, { vertexColors: true, pig: 0.22, brush: 0.2, brushF: 1.4, hiAmt: 0.2, cool: 0.5 })); mesh.name = 'island'; parent.add(mesh);

  // ---- the forest ------------------------------------------------------------------------------------------------------
  const R0 = ctx.rng(3611), T = [];   // [x, y, z, sx, sy, yaw, r, a, ci]
  const SP = 19;
  for (let r = 72; r < 1045; r += SP) { const n = Math.max(6, Math.floor(2 * Math.PI * r / SP));
    for (let j = 0; j < n; j++) { const a = (j + (R0() - 0.5) * 0.7) / n * Math.PI * 2, rr = r + (R0() - 0.5) * SP * 0.8, x = I.x + Math.cos(a) * rr, z = I.z + Math.sin(a) * rr, h = G(rr, a);
      if (h < 9 || (h > 372 && R0() < 0.8)) continue;
      const cl = fbm(x * 0.012 + 11, z * 0.012 + 2); if (cl > 0.71) continue;   // a few meadows
      const s = 12 + R0() * 9, ci = Math.floor(R0() * 6); T.push([x, h - 2, z, s, s * (0.95 + R0() * 0.5), R0() * 6.28, rr, a, ci]); } }
  const greens = [0x35a862, 0x2c9a5a, 0x46b868, 0x62c468, 0x239058, 0x7cd070].map(C), sheen = C(0xd8f08c);
  const fm = ctx.mat.bg(0xffffff, { vertexColors: true, pig: 0.22, brush: 0.2, brushF: 1.2, hiAmt: 0.32, hiT: 0.68, cool: 0.5, soft: 0.03, rimW: 0.66 });
  const crown = crownGeometry(), N = T.length, im = new THREE.InstancedMesh(crown, fm, N); im.name = 'island-forest'; im.frustumCulled = false; parent.add(im);
  const col0 = new Float32Array(N * 3), qYaw = T.map(([, , , , , y]) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), y));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qB = new THREE.Quaternion(), ax = new THREE.Vector3(), V = new THREE.Vector3(), S = new THREE.Vector3(), cc = new THREE.Color();
  T.forEach(([x, y, z, sx, sy, , , , ci], i) => { const c = greens[ci].clone().multiplyScalar(0.92 + R0() * 0.16); c.toArray(col0, i * 3); im.setColorAt(i, c); });
  function poseTree(i, amp, shiver) { const t = T[i], [x, y, z, sx, sy] = t;
    // bend: tilts the crown down-slope (the fur of the mountain being stroked)
    const a = t[7], ang = amp * 0.85 + shiver; ax.set(Math.sin(a), 0, -Math.cos(a)); qB.setFromAxisAngle(ax, -ang); q.copy(qB).multiply(qYaw[i]);
    m4.compose(V.set(x, y, z), q, S.set(sx * (1 + amp * 0.1), sy * (1 - amp * 0.2), sx * (1 + amp * 0.1))); im.setMatrixAt(i, m4); }
  for (let i = 0; i < N; i++) poseTree(i, 0, 0);
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;

  // ---- waves of bend: bell shiver (s07), the big ripple (s08), the settle (s27). Fronts travel crest -> shore on twos --------
  const FRONTS = [[15.03, 0.42, 1.0, 0.13], [17.2, 1.0, 1.9, 0.13], [17.7, 0.82, 1.9, 0.13], [18.2, 0.66, 1.9, 0.14], [18.7, 0.5, 1.9, 0.16], [66.4, 0.6, 1.6, 0.2], [67.0, 0.4, 1.6, 0.2]];
  let trough = 0;
  const amp = (r, a, t) => { let v = 0; trough = 0; for (const [t0, A, dur, w] of FRONTS) { const arr = t0 + r / 1050 * dur + 0.05 * Math.sin(a * 5 + r * 0.012), d = (t - arr) / w; if (d > -3 && d < 3) v += A * Math.exp(-d * d); const e = d + 1.7; if (e > -2.5 && e < 2.5) trough += A * Math.exp(-e * e); } return Math.min(1.25, v); };
  let dirty = false;
  function update(t, shot) {
    if (!shot.groups.includes('island')) return;
    const active = (t > 14.9 && t < 21) || (t > 66.2 && t < 68.6), day = 1 - ctx.modules.sky?.dusk?.(t) ?? 1;
    fm.uniforms.uBase.value.setRGB(1, 1, 1).lerp(C(0xe8c088), 1 - day);
    if (!active) { if (dirty) { for (let i = 0; i < N; i++) { poseTree(i, 0, 0); im.instanceColor.setXYZ(i, col0[i * 3], col0[i * 3 + 1], col0[i * 3 + 2]); } im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; dirty = false; } return; }
    dirty = true; const ft = ctx.onTwos(t), colA = im.instanceColor.array;
    for (let i = 0; i < N; i++) { const [, , , , , , r, a] = T[i], A = amp(r, a, ft), sh = 0.012 * Math.sin(ft * 9 + r * 0.04 + a * 7) * Math.min(1, A * 3);
      poseTree(i, A, sh); const k = Math.min(1, A) * 0.92; cc.setRGB(col0[i * 3], col0[i * 3 + 1], col0[i * 3 + 2]).lerp(sheen, k).multiplyScalar(1 - Math.min(0.55, trough * 0.42)); colA[i * 3] = cc.r; colA[i * 3 + 1] = cc.g; colA[i * 3 + 2] = cc.b; }
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
  }

  // ---- birds burst from the forest at the bell (s07), still drifting in s08 ----------------------------------------------
  const BN = 340, wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, -1, 0.42, -0.1, 0, 0.0, -0.5,   0, 0, 0.5, 0, 0.0, -0.5, 1, 0.42, -0.1,   0, 0.05, -0.5, -0.16, 0.03, -0.92, 0.16, 0.03, -0.92], 3));
  wg.setAttribute('normal', new THREE.Float32BufferAttribute(Array(27).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0), 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(18), 2));
  const bm = ctx.mat.fx(0xfdfbf0, { k: 1.05, side: THREE.DoubleSide }), birds = new THREE.InstancedMesh(wg, bm, BN); birds.name = 'island-birds'; birds.frustumCulled = false; parent.add(birds);
  const RB = ctx.rng(3612), B = [];
  for (let i = 0; i < BN; i++) { const a = 0.45 + RB() * 1.5, r = 170 + RB() * 520, x0 = I.x + Math.cos(a) * r, z0 = I.z + Math.sin(a) * r, y0 = G(r, a) + 12;
    const o = [Math.cos(a), Math.sin(a)], ang = RB() * 6.28, vr = 16 + RB() * 34; B.push({ x0, y0, z0, t0: 15.0 + Math.pow(r / 700, 1.5) * 0.45 + RB() * 0.28, vx: o[0] * vr + Math.cos(ang) * 9, vz: o[1] * vr + Math.sin(ang) * 9, vy: 42 + RB() * 44, s: 4.5 + RB() * 5, ph: RB() * 6.28, curl: RB() * 2 - 1 }); }
  const Bp = new THREE.Vector3(), Bs = new THREE.Vector3(), Bq = new THREE.Quaternion(), Be = new THREE.Euler();
  function updateBirds(t, shot) {
    const on = shot.groups.includes('island') && t > 14.9 && t < 20; birds.visible = on; if (!on) return;
    const ft = ctx.onTwos(t);
    B.forEach((b, i) => { const tau = t - b.t0; if (tau <= 0) { m4.makeScale(0, 0, 0); birds.setMatrixAt(i, m4); return; }
      const e = 1 - Math.exp(-tau * 0.9);   // climb steep, then level out and scatter
      const x = b.x0 + b.vx * e * 1.6 + b.curl * 24 * Math.sin(tau * 2.1 + b.ph), y = b.y0 + b.vy * (1.7 * e + tau * 0.12), z = b.z0 + b.vz * e * 1.6 + b.curl * 18 * Math.cos(tau * 1.9 + b.ph);
      Bp.set(x, y, z); const yaw = Math.atan2(b.vx + b.curl * 40 * Math.cos(tau * 2.1 + b.ph), b.vz); Bq.setFromEuler(Be.set(-0.3, yaw, 0, 'YXZ'));
      const flap = Math.sin(ft * 21 + b.ph) > 0 ? 1 : -0.55;
      m4.compose(Bp, Bq, Bs.set(b.s, b.s * flap, b.s)); birds.setMatrixAt(i, m4); });
    birds.instanceMatrix.needsUpdate = true;
  }
  return { mesh, forest: im, birds, count: N, update(t, shot) { update(t, shot); updateBirds(t, shot); } };
}

// sea stacks + foam reefs along the s18 flight: near objects to whip past (the corridor stays clear)
export function buildSeaRocks(ctx, parent) {
  const R0 = ctx.rng(3613), geo = new THREE.IcosahedronGeometry(1, 2), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.82 + 0.38 * Math.abs(Math.sin(v.x * 3.1 + v.z * 2.3)) * (0.7 + 0.5 * Math.sin(v.y * 4.1)); p.setXYZ(i, v.x * k, v.y * k * (v.y > 0 ? 1.35 : 0.5), v.z * k); }
  geo.computeVertexNormals();
  const mat = ctx.mat.bg(0xffffff, { vertexColors: false, pig: 0.28, brush: 0.32, brushF: 2.0, hiAmt: 0.25, cool: 0.5 }); mat.uniforms.uBase.value.set(0xa39bb5); mat.uniforms.uShade.value.set(0x4f4a7c);
  const L = []; for (let i = 0; i < 26; i++) { const z = 1800 + i * 150 + R0() * 90, xp = 200 - 200 * (z - 1500) / 3500, s = (R0() < 0.5 ? -1 : 1), x = xp + s * (150 + R0() * 340); L.push([x, -2, z, 8 + R0() * 16, 12 + R0() * 22, 8 + R0() * 16]); }
  const im = new THREE.InstancedMesh(geo, mat, L.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); im.name = 'sea-rocks'; im.frustumCulled = false; parent.add(im);
  L.forEach(([x, y, z, a, b, c], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R0() * 6.28); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(a, b, c)); im.setMatrixAt(i, m4); });
  im.instanceMatrix.needsUpdate = true; return im;
}
