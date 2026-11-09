// RYŪ · 龍 · WORLD (owner: world): the terraced rice plain (s12, s15). Terraces follow contour lines that run roughly along the
// flight line; a corridor of instanced rice rows is flattened by a V wake behind the head (s15). All pure of t.
import * as THREE from 'three';
import { GEO } from './shots.js';
import { fbm, vnoise, sstep } from './world-terrain.js';
import { CROWN } from './world-island.js';

const P = GEO.PADDIES;
export const FLIGHT_A = [-4800, -1400], FLIGHT_B = [-1700, -900];
const dx = FLIGHT_B[0] - FLIGHT_A[0], dz = FLIGHT_B[1] - FLIGHT_A[1], dl = Math.hypot(dx, dz), DIR = [dx / dl, dz / dl], NOR = [-DIR[1], DIR[0]];
export const flightUV = (x, z) => { const rx = x - FLIGHT_A[0], rz = z - FLIGHT_A[1]; return [rx * DIR[0] + rz * DIR[1], rx * NOR[0] + rz * NOR[1]]; };   // u along, v seaward (+z side)

const STEP = 3.0;
function field(x, z) { const [u, v0] = flightUV(x, z), w = fbm(x * 0.0035 + 7, z * 0.0035 + 2) - 0.5, v = v0 + 170 * w;
  const valley = 13 * Math.exp(-Math.pow(v / 200, 2)), h0 = 25 - 0.022 * v - valley + 5 * w;
  const hills = Math.pow(sstep(-2250, -3500, z), 1.4) * 460 * (0.65 + 0.8 * fbm(x * 0.0012, z * 0.0012 + 4)) + Math.pow(sstep(-1450, -820, x), 1.3) * 300 * (0.7 + 0.6 * fbm(x * 0.002 + 3, z * 0.002));
  const land = sstep(-55, -190, z); return { u, v, h0, hills, land }; }
function terrace(h0) { const q = h0 / STEP, fl = Math.floor(q), f = q - fl; return { fl, f, h: STEP * (fl + sstep(0.88, 1.0, f)) }; }
export function paddyHeight(x, z) { const { h0, hills, land } = field(x, z), { h } = terrace(h0); return h * land + (-4) * (1 - land) + hills; }

const hashI = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
function paintMap(ctx) {
  const W = 1536, H = 1096, data = new Uint8Array(W * H * 4), x0 = -6000, x1 = -900, z0 = -3600, z1 = 40;
  const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const RICE = [0x84d94f, 0x6cc94f, 0xa3df58, 0x53b755, 0xbde66a, 0x77cf4a].map(hex), WATER = hex(0x9fdcf0), BUND = hex(0xdccda0), BUNDL = hex(0xf6efbe), SAND = hex(0xefe1b4), HILL = hex(0x2e9458), HILL2 = hex(0x52b264), MUD = hex(0xc6b87a);
  for (let j = 0; j < H; j++) { const z = z0 + (z1 - z0) * (j + 0.5) / H;
    for (let i = 0; i < W; i++) { const x = x0 + (x1 - x0) * (i + 0.5) / W, { u, h0, hills, land } = field(x, z), { fl, f } = terrace(h0);
      const n = vnoise(x * 0.09, z * 0.09) * 0.6 + vnoise(x * 0.27 + 5, z * 0.27) * 0.4, wob = vnoise(x * 0.01, z * 0.01 + fl * 3.1) * 70, cellW = 60 + 90 * hashI(fl, 1), uc = Math.floor((u + wob) / cellW), ucf = (u + wob) / cellW - uc;
      const h = hashI(uc, fl + 0.7), bk = hashI(uc * 3.1 + 2, fl * 1.7); let c;
      const flood = bk > 0.87;
      if (flood) { const shine = sstep(0.62, 0.8, vnoise(x * 0.04 + 1, z * 0.04 - 3)); c = WATER.map((v, k) => v * (0.88 + 0.12 * n) + (255 - v) * shine * 0.5); const clump = Math.sin(u * 0.9 + fl * 2.0) > 0.85 ? 0.35 : 0; c = c.map((v, k) => v * (1 - clump) + RICE[3][k] * clump); }
      else { const r0 = RICE[Math.floor(h * RICE.length) % RICE.length], row = Math.sin((u + wob * 0.3) * 1.3) * Math.sin((h0 + 40) * 7.0 + fl) > 0.1 ? 0.92 : 1.05; c = r0.map(v => v * row * (0.86 + 0.28 * n)); }
      if (f > 0.84) { const b = f > 0.94 ? BUNDL : BUND; c = b.map((v, k) => v * (0.92 + 0.14 * n)); }
      else if (Math.abs(ucf - 0.5) > 0.5 - 2.2 / cellW) c = BUND.map(v => v * (0.95 + 0.1 * n));
      if (bk < 0.1 && !flood && f < 0.84) c = c.map((v, k) => v * 0.7 + MUD[k] * 0.3);
      // hills + beach
      const hillK = sstep(4, 34, hills), hc = HILL.map((v, k) => (v + (HILL2[k] - v) * sstep(0.45, 0.62, vnoise(x * 0.02, z * 0.02))) * (0.9 + 0.2 * n));
      c = c.map((v, k) => v * (1 - hillK) + hc[k] * hillK); c = c.map((v, k) => SAND[k] * (1 - land) + v * land);
      const o = (H - 1 - j) * W * 4 + i * 4; data[o] = Math.min(255, c[0]); data[o + 1] = Math.min(255, c[1]); data[o + 2] = Math.min(255, c[2]); data[o + 3] = 255; } }
  const tx = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); tx.colorSpace = THREE.SRGBColorSpace; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.magFilter = THREE.LinearFilter; tx.anisotropy = 8; tx.generateMipmaps = true; tx.needsUpdate = true;
  return tx;
}

export function buildPaddies(ctx, parent) {
  const x0 = -6000, x1 = -900, z0 = -3600, z1 = 40, nx = 510, nz = 364, pos = [], uvs = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz; pos.push(x, paddyHeight(x, z), z); uvs.push(i / nx, 1 - j / nz); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
  const map = paintMap(ctx);
  const mesh = new THREE.Mesh(g, ctx.mat.bg(0xffffff, { map, pig: 0.2, brush: 0.14, brushF: 1.2, hiAmt: 0.1, cool: 0.45 })); mesh.name = 'paddies'; parent.add(mesh);

  const R = ctx.rng(3620), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  // ---- rice rows along the corridor (long ridges along the flight line: they streak instead of strobing) ------------------
  const tent = new THREE.BufferGeometry();
  tent.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,   -0.5, 1, 0, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 0, 0.5], 3)); tent.setIndex([0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7]); tent.computeVertexNormals();
  tent.setAttribute('color', new THREE.Float32BufferAttribute([0.8, 0.82, 0.74, 0.8, 0.82, 0.74, 1, 1, 0.94, 1, 1, 0.94, 1, 1, 0.94, 1, 1, 0.94, 0.8, 0.82, 0.74, 0.8, 0.82, 0.74], 3)); tent.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(16), 2));
  const rows = []; const yaw = Math.atan2(-DIR[1], DIR[0]), qY = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
  for (let v = -240; v <= 240; v += 5) for (let u = -200; u < 3500;) { const L = 15 + R() * 13, cu = u + L / 2, jv = v + (R() - 0.5) * 3, x = FLIGHT_A[0] + DIR[0] * cu + NOR[0] * jv, z = FLIGHT_A[1] + DIR[1] * cu + NOR[1] * jv; u += L + R() * 4;
    const { h0 } = field(x, z), t0 = terrace(h0); if (t0.f > 0.78) continue; rows.push({ x, z, y: paddyHeight(x, z) + 0.2, L, w: 2.3 + R() * 0.9, h: 1.1 + R() * 0.8, u: cu, v: jv, g: Math.floor(R() * 4) }); }
  const rm = ctx.mat.bg(0xffffff, { vertexColors: true, pig: 0.18, brush: 0.22, brushF: 2.0, hiAmt: 0.25, hiT: 0.6, cool: 0.2, term: -0.9 });
  const riceCol = [0x8fe052, 0x74d04f, 0xaee466, 0x5cbf57].map(c => new THREE.Color(c)), straw = new THREE.Color(0xfdf6c0), rim = new THREE.InstancedMesh(tent, rm, rows.length); rim.name = 'rice-rows'; rim.frustumCulled = false; parent.add(rim);
  rows.forEach((r, i) => { const c = riceCol[r.g].clone().multiplyScalar(0.92 + R() * 0.16); rim.setColorAt(i, c); r.c = c.toArray(); m4.compose(V.set(r.x, r.y, r.z), qY, S.set(r.L, r.h, r.w)); rim.setMatrixAt(i, m4); });
  rim.instanceMatrix.needsUpdate = true; rim.instanceColor.needsUpdate = true;

  // ---- windbreak trees + huts near the corridor (near parallax), forest on the hills -----------------------------------
  const tl = [];
  for (let i = 0; i < 90; i++) { const u = R() * 3600 - 100, v = (R() < 0.5 ? -1 : 1) * (70 + Math.pow(R(), 0.7) * 430), x = FLIGHT_A[0] + DIR[0] * u + NOR[0] * v, z = FLIGHT_A[1] + DIR[1] * u + NOR[1] * v;
    const row = 3 + Math.floor(R() * 5), s = 7 + R() * 6, ang = Math.atan2(DIR[1], DIR[0]) + (R() - 0.5) * 0.6; for (let k = 0; k < row; k++) { const px = x + Math.cos(ang) * k * s * 1.3, pz = z + Math.sin(ang) * k * s * 1.3; tl.push([px, paddyHeight(px, pz) - 0.5, pz, s * (0.85 + R() * 0.4), s * (1 + R() * 0.6), Math.floor(R() * 5)]); } }
  for (let z = -3550; z < -2150; z += 21) for (let x = -5950; x < -900; x += 21) { const jx = x + (R() - 0.5) * 14, jz = z + (R() - 0.5) * 14, f = field(jx, jz); if (f.hills < 8) continue; const s = 14 + R() * 9; tl.push([jx, paddyHeight(jx, jz) - 2, jz, s, s * (1 + R() * 0.5), Math.floor(R() * 5)]); }
  for (let z = -2150; z < -60; z += 22) for (let x = -1400; x < -900; x += 22) { const jx = x + (R() - 0.5) * 14, jz = z + (R() - 0.5) * 14, f = field(jx, jz); if (f.hills < 8) continue; const s = 13 + R() * 9; tl.push([jx, paddyHeight(jx, jz) - 2, jz, s, s * (1 + R() * 0.5), Math.floor(R() * 5)]); }
  const greens = [0x3cae66, 0x2f9e5c, 0x5abe6a, 0x74c868, 0x279858].map(c => new THREE.Color(c));
  const tm = ctx.mat.bg(0xffffff, { vertexColors: true, pig: 0.22, brush: 0.22, brushF: 1.1, hiAmt: 0.3, hiT: 0.7, cool: 0.5, soft: 0.03, rimW: 0.66 }), trees = new THREE.InstancedMesh(CROWN(), tm, tl.length); trees.name = 'paddy-trees'; trees.frustumCulled = false; parent.add(trees);
  tl.forEach(([x, y, z, sx, sy, ci], i) => { q.setFromAxisAngle(Y, R() * 6.28); m4.compose(V.set(x, y, z), q, S.set(sx, sy, sx)); trees.setMatrixAt(i, m4); const c = greens[ci % 5].clone().multiplyScalar(0.92 + R() * 0.16); trees.setColorAt(i, c); });
  trees.instanceMatrix.needsUpdate = true; trees.instanceColor.needsUpdate = true;
  // farm huts: gabled box + thatch roof
  const hutG = new THREE.BoxGeometry(1, 1, 1), roofG = new THREE.ConeGeometry(0.82, 0.7, 4).rotateY(Math.PI / 4);
  const hutL = []; for (let i = 0; i < 36; i++) { const u = R() * 3600, v = (R() < 0.5 ? -1 : 1) * (90 + R() * 420), x = FLIGHT_A[0] + DIR[0] * u + NOR[0] * v, z = FLIGHT_A[1] + DIR[1] * u + NOR[1] * v; hutL.push([x, paddyHeight(x, z), z, 6 + R() * 4, 4 + R() * 2, R() * 6.28]); }
  const hutM = new THREE.InstancedMesh(hutG, ctx.mat.bg(0xefe2c6, { pig: 0.2, brush: 0.15, hiAmt: 0.1 }), hutL.length), roofM = new THREE.InstancedMesh(roofG, ctx.mat.bg(0xb88b52, { pig: 0.25, brush: 0.25, hiAmt: 0.2, cool: 0.5 }), hutL.length); hutM.name = 'huts'; roofM.name = 'hut-roofs'; hutM.frustumCulled = roofM.frustumCulled = false; parent.add(hutM, roofM);
  hutL.forEach(([x, y, z, w, h, a], i) => { q.setFromAxisAngle(Y, a); m4.compose(V.set(x, y + h / 2, z), q, S.set(w, h, w * 1.3)); hutM.setMatrixAt(i, m4); m4.compose(V.set(x, y + h + h * 0.35, z), q, S.set(w * 1.45, h * 1.1, w * 1.85)); roofM.setMatrixAt(i, m4); });
  hutM.instanceMatrix.needsUpdate = true; roofM.instanceMatrix.needsUpdate = true;

  // ---- the V wake (s15): a row is flattened once the head has passed it by |v| * cot(half angle) ---------------------------
  const HALF_TAN = Math.tan(21 * Math.PI / 180), cc = new THREE.Color(); let table = null, dirty = false;
  function makeTable() { const d = ctx.modules.dragon; if (!d?.anchor) return null; const pts = []; for (let t = 35.2; t <= 39.6; t += 1 / 48) { const h = d.anchor('head', t); pts.push({ t, x: h.x, z: h.z }); } return pts; }
  function arrivals() { for (const r of rows) { let best = 1e12, bi = 0; for (let i = 0; i < table.length; i++) { const dx = table[i].x - r.x, dz = table[i].z - r.z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const a = table[Math.max(0, bi - 1)], b = table[Math.min(table.length - 1, bi + 1)], len = Math.hypot(b.x - a.x, b.z - a.z) || 1; r.ta = table[bi].t; r.sp = len / (b.t - a.t); const cross = ((r.x - table[bi].x) * (b.z - a.z) - (r.z - table[bi].z) * (b.x - a.x)) / len; r.cv = cross; } }
  function update(t, shot) {
    const on = shot.id === 's15' && shot.groups.includes('paddies');
    if (!on) { if (dirty) { rows.forEach((r, i) => { m4.compose(V.set(r.x, r.y, r.z), qY, S.set(r.L, r.h, r.w)); rim.setMatrixAt(i, m4); rim.instanceColor.setXYZ(i, r.c[0], r.c[1], r.c[2]); }); rim.instanceMatrix.needsUpdate = true; rim.instanceColor.needsUpdate = true; dirty = false; } return; }
    if (!table) { table = makeTable(); if (table) arrivals(); } if (!table) return; dirty = true;
    const ft = ctx.onTwos(t), a = rim.instanceColor.array, qT = new THREE.Quaternion(), ax = new THREE.Vector3(DIR[0], 0, DIR[1]);
    rows.forEach((r, i) => { const dt = ft - r.ta, wide = dt * r.sp * HALF_TAN - Math.abs(r.cv), k = Math.min(1, Math.max(0, wide / 55));
      const flat = k * (0.82 + 0.1 * Math.sin(ft * 25 + i * 1.7) * (1 - sstep(0.4, 1.4, dt))), rebound = sstep(1.2, 2.6, dt) * 0.25, ang = flat * 1.25 * (r.cv > 0 ? 1 : -1) * (1 - rebound);
      qT.setFromAxisAngle(ax, ang); q.copy(qT).multiply(qY); m4.compose(V.set(r.x, r.y, r.z), q, S.set(r.L * (1 + flat * 0.3), r.h * (1 - flat * 0.78), r.w * (1 + flat * 1.9))); rim.setMatrixAt(i, m4);
      const edge = k > 0.02 && k < 0.5 ? Math.sin(k / 0.5 * Math.PI) : 0; cc.setRGB(r.c[0], r.c[1], r.c[2]).multiplyScalar(1 - edge * 0.45).lerp(straw, flat * (1 - rebound)); a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; });
    rim.instanceMatrix.needsUpdate = true; rim.instanceColor.needsUpdate = true;
  }
  return { mesh, update, height: paddyHeight };
}
