// RYŪ · WORLD terrain (owner: world): the coast field, ground(x, z), the land meshes, the painted town ground map,
// the forested hills (instanced crowns), garden trees and the black pines on the cliffs.
// Geography (metres, y up, sea level 0): seawall face z = -42 (top 3.4), quay road z -52..-45, the town on the slope toward
// -z (to ~65 m at z -400), green hills behind (200-300 m at 1.2 km), two wooded headlands closing the bay (left centre
// (-900, 260), right (820, 160)); the bay opens to +z past z ≈ 600. The harbour + breakwaters sit on the right (x 112..300).
import * as THREE from 'three';

export const SEAWALL_Z = -42, WALL_TOP = 3.4;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const smax = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return a + (b - a) * h + k * h * (1 - h); };
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, z, o = 4) => { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * vnoise(x, z); x = x * 2.03 + 1.7; z = z * 2.03 + 9.2; a *= 0.5; } return s; };
const ridged = (x, z) => { let s = 0, a = 0.55; for (let i = 0; i < 4; i++) { const n = 1 - Math.abs(2 * vnoise(x, z) - 1); s += a * n * n; x = x * 2.1 + 3.7; z = z * 2.1 + 1.3; a *= 0.48; } return s; };

// coast fields: f0 = inland distance behind the seawall line; fl / fr = headlands; f = land (> 0) / sea (< 0)
export function coast(x, z) {
  const f0 = -(z - SEAWALL_Z), fl = 520 * (1 - Math.hypot((x + 900) / 520, (z - 260) / 560)), fr = 440 * (1 - Math.hypot((x - 820) / 460, (z - 160) / 420));
  return { f0, fl, fr, f: smax(smax(f0, fl, 60), fr, 60) };
}
const townH = (F) => F < 0 ? -9 + Math.max(F, -60) * 0.04 : F < 15 ? WALL_TOP : WALL_TOP + 0.2 * (Math.min(F, 380) - 15) * sstep(15, 45, F) + Math.max(0, F - 380) * 0.2 * sstep(380, 480, F) - Math.max(0, F - 1300) * 0.24;
const capeH = (F) => F < 0 ? -9 + Math.max(F, -60) * 0.05 : 34 * sstep(-2, 50, F) + 0.22 * Math.max(0, F - 50);
// terrain height (the town shelf is smooth; hills get rolling noise)
export function ground(x, z) {
  const { f0, fl, fr, f } = coast(x, z);
  let h = smax(smax(townH(f0), capeH(fl), 12), capeH(fr), 12);
  const inland = sstep(380, 800, f0) * (1 - sstep(-500, 500, Math.max(fl, fr))) + sstep(60, 320, Math.max(fl, fr));
  h += (fbm(x * 0.0021 + 3.1, z * 0.0021) - 0.5) * 140 * inland + (fbm(x * 0.011, z * 0.011 + 5) - 0.5) * 16 * inland;
  // town-side sides of the bay rise into wooded slopes beyond the town width
  h += sstep(380, 620, Math.abs(x)) * sstep(10, 120, f0) * 38 * (0.7 + 0.6 * fbm(x * 0.006, z * 0.006));
  // the far coastal range 2-6 km behind the hills: ridged peaks to ~1.3 km (they read blue through the haze in the wides)
  h += sstep(2600, 5200, f0) * (1 - sstep(-400, 200, Math.max(fl, fr))) * (260 + 760 * ridged(x * 0.00042 + 7.1, z * 0.00042 + 2.3));
  if (f < 0) h = Math.min(h, -6);
  return h;
}
export function slope(x, z) { const e = 1.5, h = ground(x, z); return Math.hypot(ground(x + e, z) - h, ground(x, z + e) - h) / e; }

// ---------------------------------------------------------------------------------------------------------------------
export function buildTerrain(ctx, g, { town }) {
  const { mat, rng } = ctx;
  // ---- outer land: warped grid (fine near the bay, coarse at the edges) ----
  const NX = 320, NZ = 260, wx = (u) => Math.sign(u) * 6000 * Math.pow(Math.abs(u), 1.75), wz = (v) => -150 + (v < 0 ? 6200 * -Math.pow(-v, 1.75) : 2900 * Math.pow(v, 1.6));
  const P = [], Cc = [], I = [];
  const cGrass = new THREE.Color(0x8cc65e), cMeadow = new THREE.Color(0xa8d06a), cForest = new THREE.Color(0x3f8f4e), cDeep = new THREE.Color(0x2f7446), cRock = new THREE.Color(0x9a8e80), cRockD = new THREE.Color(0x6f6a72), cSand = new THREE.Color(0xe6d6b0), cFar = new THREE.Color(0x7fa6b8), cFarD = new THREE.Color(0x6a92aa);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = wx(i / NX * 2 - 1); let z = wz(j / NZ * 2 - 1); let y = ground(x, z);
    // along the seawall the shore is a vertical concrete face: snap the first sea-side row onto the wall line
    if (Math.abs(x) < 410 && z > SEAWALL_Z && z < SEAWALL_Z + 7) { z = SEAWALL_Z + 0.02; y = -9; }
    const inTown = Math.abs(x) < town.x1 - 4 && z < town.z1 - 2 && z > town.z0 + 4; if (inTown) y -= 1.2;
    P.push(x, y, z);
    const { f } = coast(x, z), s = slope(x, z), n = fbm(x * 0.004, z * 0.004 + 7), n2 = vnoise(x * 0.03, z * 0.03);
    let c = cGrass.clone().lerp(cMeadow, sstep(0.45, 0.7, n2) * 0.6);
    c.lerp(n > 0.5 ? cDeep : cForest, sstep(40, 140, y + n * 60) * 0.85);
    c.lerp(n2 > 0.5 ? cRock : cRockD, sstep(0.55, 0.95, s) * (1 - sstep(70, 140, y)));
    c.lerp(cSand, sstep(3, 0, y) * sstep(-2, 1, y) * 0.8);
    c.lerp(n > 0.5 ? cFar : cFarD, sstep(2000, 5200, Math.hypot(x, z + 300)) * 0.75);   // painted aerial perspective on the far ranges
    Cc.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); lg.setIndex(I); lg.computeVertexNormals();
  const land = new THREE.Mesh(lg, mat.bg(0xffffff, { vertexColors: true, pig: 0.22, brush: 0.18, hiAmt: 0.15 })); land.name = 'land'; g.add(land);

  // ---- town patch: 1.5 m grid + painted ground map ----
  const W = town.x1 - town.x0, D = town.z1 - town.z0, SX = Math.round(W / 1.6), SZ = Math.round(D / 1.6);
  const tg = new THREE.PlaneGeometry(W, D, SX, SZ).rotateX(-Math.PI / 2).translate((town.x0 + town.x1) / 2, 0, (town.z0 + town.z1) / 2);
  const tp = tg.attributes.position, tuv = tg.attributes.uv;
  for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), z = tp.getZ(i); tp.setY(i, ground(x, z)); tuv.setXY(i, (x - town.x0) / W, (z - town.z0) / D); }
  tg.computeVertexNormals();
  const townMesh = new THREE.Mesh(tg, mat.bg(0xffffff, { map: town.map, pig: 0.12, brush: 0.1, hiAmt: 0.1 })); townMesh.name = 'town-ground'; g.add(townMesh);
  return { land, townMesh };
}

// ---------------------------------------------------------------------------------------------------------------------
// Trees: instanced crowns (painted bg). Forest on the hills + headlands, the shrine grove, garden trees.
// A crown = a cluster of leaf clumps (bumpy painted silhouette) shaded as ONE mass (clump normals bent toward the dome
// normal: 2 flat tones), vertex-coloured with a dark core under and between the clumps. The forest is a jittered grid
// (spacing grows with distance, crowns overlap 30-50 %, no bare slope) whose colour fades toward the sky with distance.
// setDusk(k) shifts the canopy to warm dark olive with a gold rim (s30-s35).
export function buildTrees(ctx, g, { avoid, extra = [] }) {
  const { mat, rng } = ctx, R = rng(3210);
  const crownGeo = (() => { const R0 = rng(3211), P = [], N = [], Cc = [], I = [];
    const clumps = [[0, 0.22, 0, 0.62], [0.5, -0.02, 0.18, 0.5], [-0.46, 0.0, 0.26, 0.5], [0.06, -0.04, -0.5, 0.5], [-0.24, 0.5, -0.12, 0.42], [0.3, 0.46, 0.08, 0.4], [-0.5, 0.02, -0.32, 0.44]];
    for (const [cx, cy, cz, r] of clumps) { const s = new THREE.IcosahedronGeometry(1, 1), p = s.attributes.position, base = P.length / 3, v = new THREE.Vector3(), w = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.12 * Math.sin(v.x * 5.1 + v.z * 3.3 + cx * 7) * Math.cos(v.y * 4.3 + cz * 5);
        w.set(cx + v.x * r * k, (cy + v.y * r * k) * 0.86, cz + v.z * r * k); P.push(w.x, w.y, w.z);
        const dome = w.clone().setY(w.y + 0.25).normalize(), n = v.clone().multiplyScalar(0.55).addScaledVector(dome, 0.85).normalize(); N.push(n.x, n.y, n.z);
        // dark core: clump undersides + the inside of the crown, light tips
        const c = 0.5 + 0.5 * sstep(-0.55, 0.75, v.y * 0.6 + w.y * 0.7) * (0.8 + 0.2 * sstep(0.2, 0.9, Math.hypot(w.x, w.z) + w.y)); Cc.push(c, c, c * 0.96); }
      const idx = s.index ? s.index.array : [...Array(p.count).keys()]; for (const j of idx) I.push(base + j); R0(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); geo.setIndex(I); return geo; })();
  const list = [];   // [x, y, z, sx, sy, colorIndex]
  const greens = [0x4f9a50, 0x3f8a4a, 0x5aa85a, 0x66b058, 0x37804a, 0x74b85a].map(h => new THREE.Color(h));
  // jittered grid over the hills behind the town and the two headlands
  const zones = [[-1700, 1700, -1950, -330], [-1550, -380, -320, 820], [380, 1450, -320, 700]];
  for (const [xa, xb, za, zb] of zones) for (let z = za; z < zb;) {
    const spz = 8 + Math.hypot(0, z + 150) / 85;
    for (let x = xa; x < xb;) { const d = Math.hypot(x, z + 150), sp = 8 + d / 85; x += sp;
      const px = x + (R() - 0.5) * sp * 0.8, pz = z + (R() - 0.5) * spz * 0.8;
      const { f0, fl, fr, f } = coast(px, pz); if (f < 6) continue;
      if (Math.abs(px) < 470 && f0 < 375 && fl < 0 && fr < 0) continue;   // the town
      if (avoid.some(([ax, az, ar]) => Math.hypot(px - ax, pz - az) < ar)) continue;
      if (fbm(px * 0.01 + 2, pz * 0.01) < 0.3 && f < 300) continue;      // a few meadow clearings low on the slopes
      const s = sp * (0.72 + R() * 0.22), y = ground(px, pz);
      list.push([px, y + s * 0.35, pz, s, s * (0.8 + R() * 0.25), Math.floor(R() * 6)]);
    }
    z += spz;
  }
  const nForest = list.length;
  for (const e of extra) list.push(e);
  const fm = mat.bg(0xffffff, { vertexColors: true, pig: 0.22, brush: 0.22, brushF: 1.1, hiAmt: 0.3, hiT: 0.7, cool: 0.5, soft: 0.03, rimW: 0.66 });
  const im = new THREE.InstancedMesh(crownGeo, fm, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), far = new THREE.Color(0x86aab4);
  list.forEach(([x, y, z, sx, sy, ci], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sx * (0.85 + R() * 0.3))); im.setMatrixAt(i, m4);
    const c = greens[ci % greens.length].clone().multiplyScalar(0.92 + R() * 0.16);
    if (i < nForest) c.lerp(far, sstep(700, 2300, Math.hypot(x, z + 150)) * 0.55);   // painted aerial perspective
    im.setColorAt(i, c); });
  im.instanceMatrix.needsUpdate = true; im.name = 'forest'; im.frustumCulled = false; g.add(im);
  const day = { base: new THREE.Color(0xffffff), shade: fm.uniforms.uShade.value.clone() }, olive = new THREE.Color(0xd8c088), oliveSh = new THREE.Color(0x6a5a78);
  im.setDusk = (k) => { fm.uniforms.uBase.value.copy(day.base).lerp(olive, k); fm.uniforms.uShade.value.copy(day.shade).lerp(oliveSh, k); fm.uniforms.uRimI.value = 0.9 * k; };
  return im;
}

export { fbm, vnoise, hash2, sstep, clamp };
