// RYŪ · 龍 · the head (owner: dragon): SDF-sculpted skull + jaw, rock plates, antlers + shimenawa + shide, amber eyes with lids, teeth, moss beard, waterfall mane, mist whiskers.
import * as THREE from 'three';
import { rockMat, cedarGeo, plateGeo, surfaceNets, faceted, hash, mergeGeometries, toCreasedNormals } from './dragon-paint.js';
import { sstep, clamp, lerp, eyeState } from './dragon-path.js';
import { plateGeo as eyePlateGeo } from './dragon-paint.js';
import { onTwos } from './pipeline-util.js';
const V3 = THREE.Vector3;

const L3 = (x, y, z) => Math.hypot(x, y, z);
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);
const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => { const qx = (x - cx) / rx, qy = (y - cy) / ry, qz = (z - cz) / rz; return (L3(qx, qy, qz) - 1) * Math.min(rx, ry, rz); };
function cap(x, y, z, ax, ay, az, bx, by, bz, ra, rb) { const dx = bx - ax, dy = by - ay, dz = bz - az, px = x - ax, py = y - ay, pz = z - az, h = clamp((px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz), 0, 1); return L3(px - dx * h, py - dy * h, pz - dz * h) - lerp(ra, rb, h); }
const fbm = (x, y, z) => Math.abs(Math.sin(x * 0.21 + 2.1 * Math.sin(z * 0.13 + y * 0.1))) * 0.6 + Math.abs(Math.sin(z * 0.27 + 1.7 * Math.sin(x * 0.17 + 1.3))) * 0.4;

export const EYE = [30, -11, 28], EYE_DIR = new V3(0.68, 0.34, 0.65).normalize(), EYE_R = 11.5;
// the skull SDF (head-local metres), mirrored in x
export function skullSDF(x, y, z) {
  const ax = Math.abs(x);
  let d = ell(ax, y, z, 0, -24, -2, 41, 25, 44);                                             // cranium
  d = smin(d, cap(ax, y, z, 0, -30, 26, 0, -32, 82, 26, 15), 14);                             // snout
  d = smin(d, cap(ax, y, z, 0, -14, 6, 0, -19.5, 80, 6, 3.5), 9);                             // nose bridge ridge
  d = smin(d, cap(ax, y, z, 12, -2, 12, 40, 0, 19, 6, 5), 6);                              // brow ridge, the angry line above the eye
  d = smin(d, cap(ax, y, z, 36, -36, -8, 34, -42, 30, 12, 7), 6);                             // cheek
  d = smin(d, cap(ax, y, z, 42, -26, -18, 66, -8, -52, 8, 2.5), 7);                            // ear fin / crest
  d = smin(d, cap(ax, y, z, 38, -38, -22, 62, -36, -56, 7, 2), 6);                            // lower crest
  d = smin(d, cap(ax, y, z, 15, -24, 76, 18, -26, 86, 8, 6.5), 5);                            // nostril bulge
  d = smax(d, -(cap(ax, y, z, 14, -32, 86, 12, -26, 92, 2.8, 2.6)), 2);                      // nostril hole
  d = smax(d, -(y + 44.5 - 0.03 * z), 3);                                                     // mouth line (upper jaw underside)
  d = smin(d, cap(ax, y, z, 0, -16, -32, 0, -22, -64, 22, 25), 12);                           // neck root
  d = smax(d, -(L3(ax - EYE[0], y - EYE[1], z - EYE[2]) - 12.4), 2.5);                        // eye socket (tight: the shut lid fuses with the skull)
  const pw = sstep(26, 12, L3(x, z - 2)); if (pw > 0) d = lerp(d, smax(d, y + 1.0 + Math.max(0, z - 3) * 0.36, 2.5), pw);   // the shrine's plateau
  return d + 0.9 * (fbm(ax, y, z) - 0.5);
}
export function jawSDF(x, y, z) {   // lower jaw, around its own origin (pivot at the hinge, head-local (0, -46, -10))
  const ax = Math.abs(x);
  let d = cap(ax, y, z, 21, -7, -2, 14, -9, 66, 13, 9);
  d = smin(d, cap(ax, y, z, 0, -13, 8, 0, -13, 64, 16, 11), 8);
  d = smin(d, cap(ax, y, z, 0, -10, 60, 0, -11, 74, 12, 7), 6);
  d = smax(d, y - 1.5, 3);                                                                     // flat top at the mouth line
  d = smax(d, -(cap(ax, y, z, 0, 4, 18, 0, 3, 60, 13, 10)), 4);                                // tongue trough
  return d + 0.7 * (fbm(ax, y, z) - 0.5);
}

// ------------------------------------------------------------------------------------------------------------------------
export function buildHead(ctx, head) {
  const T = ctx.THREE, mat = ctx.mat;
  const rockFine = rockMat(ctx, { base: 0xb8afc9, shade: 0x7c72aa, moss: 0.8, voro: 0.13 });
  const plateGeos = [11, 23].map(s => plateGeo(s, { sides: 7, ledges: 2 })), M4 = new T.Matrix4();
  // skull + jaw meshes
  const skullG = surfaceNets(skullSDF, [-72, -62, -82], [72, 12, 104], 1.25), skull = new T.Mesh(skullG, rockFine); skull.name = 'dragon-skull'; head.add(skull);
  const jawG = surfaceNets(jawSDF, [-44, -34, -18], [44, 6, 86], 1.25), jawPivot = new T.Group(); jawPivot.position.set(0, -46, -10); head.add(jawPivot);
  const jawM = new T.Mesh(jawG, rockFine); jawPivot.add(jawM);
  const mouthM = new T.Mesh(new T.PlaneGeometry(1, 1), mat.cel(0x8a3e66, { id: mat.nextId(), shade: 0x5c2a58 })); mouthM.scale.set(28, 58, 1); mouthM.rotation.x = -Math.PI / 2; mouthM.position.set(0, -0.2, 35); jawPivot.add(mouthM);
  // rock plates on skull / jaw (shingled backward)
  function platesOn(geo, parent, count, sizeFn, filter, seed) {
    const P = geo.attributes.position, N = geo.attributes.normal, chosen = [], cellS = 21, seen = new Set();
    for (let i = 0; i < P.count; i += 3) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), key = Math.floor(x / cellS) + ',' + Math.floor(y / cellS) + ',' + Math.floor(z / cellS); if (seen.has(key) || !filter(x, y, z, N.getY(i))) continue; seen.add(key); chosen.push(i); }
    const out = []; for (let v = 0; v < plateGeos.length; v++) { const list = chosen.filter((_, i) => i % plateGeos.length === v), im = new T.InstancedMesh(plateGeos[v], rockMat(ctx, { base: 0xbcb2cc, shade: 0x7e74ac, paintScale: 8, moss: 1.2 }), list.length), seedA = new Float32Array(list.length);
      const n = new V3(), t = new V3(), s = new V3(), c = new T.Color();
      list.forEach((i, k) => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); n.fromBufferAttribute(N, i).normalize(); t.set(0, 0, -1).addScaledVector(n, n.z).normalize(); s.crossVectors(n, t).normalize(); const h = hash(seed + i * 0.13), sz = Math.min(sizeFn(x, y, z) * (0.8 + 0.5 * h), clearR(x, y, z) / PLATE_R, y > -18 ? 7 + 0.18 * Math.max(0, clearR(x, y, z) - 12) : 1e9), sc = new V3(sz * 1.15, sz * 1.15, sz * 1.5);
        M4.makeBasis(s, n, t); M4.scale(sc); M4.setPosition(x + n.x * 0.8, y + n.y * 0.8, z + n.z * 0.8); im.setMatrixAt(k, M4); const tone = 0.92 + 0.18 * hash(seed + i * 2.1); c.setRGB(tone, tone * 0.98, tone); im.setColorAt(k, c); seedA[k] = hash(seed + i * 5.3); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.geometry = plateGeos[v].clone(); im.geometry.setAttribute('aSeed', new T.InstancedBufferAttribute(seedA, 1)); im.frustumCulled = false; parent.add(im); out.push(im); }
    return out;
  }
  // shrine clear zone (head-local, top of the skull): a plate centred at (x, z) may reach no closer to this box than its own radius. Plate radius ~ 1.05 * size.
  const ZX = 14, Z0 = -18, Z1 = 19, PLATE_R = 1.05;
  function clearR(x, y, z) { if (y < -22) return 1e9; const dx = Math.max(0, Math.abs(x) - ZX), dz = Math.max(0, Z0 - z, z - Z1); return Math.hypot(dx, dz) - 0.5; }
  const safeShrine = (x, y, z) => clearR(x, y, z) < 2.6 * PLATE_R;
  const eyeDist = (x, y, z) => L3(Math.abs(x) - EYE[0], y - EYE[1], z - EYE[2]);
  platesOn(skullG, head, 0, (x, y, z) => lerp(17, 11, sstep(40, 90, z)), (x, y, z, ny) => !safeShrine(x, y, z) && eyeDist(x, y, z) > 24 && y > -44 && ny > 0.1, 3);
  platesOn(jawG, jawPivot, 0, () => 6.5, (x, y, z) => y < -3, 7);

  // teeth: stone fangs, upper (head) + lower (jaw)
  const toothG = new T.ConeGeometry(1, 1, 5).translate(0, -0.5, 0), toothM = mat.cel(0xe8e0cc, { id: mat.nextId(), shade: 0x9b98c0 });
  const teeth = (n, list, parent, m) => { const im = new T.InstancedMesh(toothG, m, n); list.forEach((tt, i) => { M4.compose(new V3(tt[0], tt[1], tt[2]), new T.Quaternion().setFromEuler(new T.Euler(tt[4] || 0, 0, tt[5] || 0)), new V3(tt[3] * 0.42, tt[3], tt[3] * 0.42)); im.setMatrixAt(i, M4); }); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; parent.add(im); };
  const upper = [], lower = []; for (let i = 0; i < 9; i++) { const z = 22 + i * 7.2, x = lerp(23, 10, i / 9), h = i < 2 ? 11 : 6.5; for (const s of [-1, 1]) upper.push([s * x, -44.2 - 0.03 * z, z, h, 0.1, 0.0]); }
  for (let i = 0; i < 8; i++) { const z = 20 + i * 7, x = lerp(22, 9, i / 8), h = i < 2 ? 10 : 6; for (const s of [-1, 1]) lower.push([s * x, 1.3, z, h, Math.PI, 0]); }
  teeth(upper.length, upper, head, toothM); teeth(lower.length, lower, jawPivot, toothM);

  // eyes
  const eyes = [-1, 1].map(s => makeEye(ctx, head, s));
  // antlers
  const antlers = [-1, 1].map(s => makeAntler(ctx, head, s, rockFine));
  // moss beard under the chin
  const mossMat = mat.cel(0x7fb257, { id: mat.nextId(), shade: 0x4c8f6f, spec: 0, brush: 0.22, brushF: 1.2 }), blob = new T.IcosahedronGeometry(1, 1), beardN = 42, beard = new T.InstancedMesh(blob, mossMat, beardN); beard.frustumCulled = false; jawPivot.add(beard);
  const beardBase = []; for (let i = 0; i < beardN; i++) { const a = i / beardN, s = (i % 2) * 2 - 1, z = lerp(70, 16, a), x = s * (6 + 22 * a * a) * (0.6 + hash(i * 7.7)), l = 7 + 13 * hash(i * 3.3), w = 3 + 2.5 * hash(i * 1.3); beardBase.push([x, -16 - 3 * hash(i), z, w, l, hash(i * 9.1)]); }
  // whiskers: mist ribbons from the snout
  const whiskerM = mat.fx(0xf4f6ff, { k: 1.05, opacity: 0.72, side: T.DoubleSide, depthWrite: false }), WN = 44, whiskers = [];
  for (const [s, y] of [[-1, -24], [1, -24], [-1, -30], [1, -30]]) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array((WN + 1) * 2 * 3), 3)); g.setAttribute('uv', new T.BufferAttribute(new Float32Array((WN + 1) * 2 * 2), 2)); const idx = []; for (let i = 0; i < WN; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3); g.setIndex(idx); const m = new T.Mesh(g, whiskerM); m.frustumCulled = false; head.add(m); whiskers.push({ g, s, y }); }
  // waterfall mane: strips from the jaw hinge, flowing down and back
  const waterTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#d8ecff'; x.fillRect(0, 0, 128, 512); for (let i = 0; i < 26; i++) { x.fillStyle = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#a8d2f2' : '#eaf6ff'; const w = 8 + 14 * hash(i * 1.7), xx = hash(i * 3.3) * 128, y0 = hash(i * 5.1) * 512, l = 80 + 200 * hash(i * 2.3); x.fillRect(xx, y0, w, l); x.fillRect(xx, y0 - 512, w, l); } const tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.needsUpdate = true; return tx; })();
  const waterM = mat.fx(0xffffff, { k: 1.15, opacity: 0.84, map: waterTex, side: T.DoubleSide, depthWrite: false }), MN = 22, mane = [];
  const sources = [[-40, -38, 12, 16], [-34, -46, 34, 11], [-30, -42, -8, 18], [40, -38, 12, 16], [34, -46, 34, 11], [30, -42, -8, 18]];
  for (const so of sources) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array((MN + 1) * 2 * 3), 3)); const uv = new Float32Array((MN + 1) * 2 * 2); for (let i = 0; i <= MN; i++) { uv[i * 4] = 0; uv[i * 4 + 1] = i / MN * 2; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / MN * 2; } g.setAttribute('uv', new T.BufferAttribute(uv, 2)); const idx = []; for (let i = 0; i < MN; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3); g.setIndex(idx); const m = new T.Mesh(g, waterM); m.frustumCulled = false; m.userData.noSolid = true; head.add(m); mane.push({ g, so }); }

  // collision: the skull, antlers
  const proxy = new T.Mesh(new T.BoxGeometry(84, 56, 118), new T.MeshBasicMaterial()); proxy.material.visible = false; proxy.position.set(0, -31, 10); head.add(proxy);
  ctx.solids.add('dragon-skull', proxy, { kind: 'box', group: 'dragon' });
  antlers.forEach((a, i) => ctx.solids.add(i ? 'dragon-hornR' : 'dragon-hornL', a.mesh, { kind: 'points', group: 'dragon', points: 200 }));

  function surfaceY(x, z) { let y = 14; for (let i = 0; i < 40; i++) { const d = skullSDF(x, y, z); if (d < 0.02) break; y -= Math.max(d * 0.8, 0.05); if (y < -60) return -60; } return y; }

  const dummy = new T.Object3D();
  return { surfaceY, jawPivot, eyes,
    update(t, shot, ST, speedK) {
      const tw = onTwos(t), es = ST.eye(tw);
      // jaw: roar in s21, slack at the rise, parted at the breakout
      const roar = sstep(52.1, 52.3, tw) * (1 - sstep(53.2, 53.5, tw)), open = lerp(0.02, 0.09, sstep(24, 26, tw)) * (1 - sstep(28, 30, tw)) + 0.5 * roar * (0.82 + 0.18 * Math.sin(tw * 52)) + 0.16 * sstep(57.4, 58, tw) * (1 - sstep(61, 62, tw));
      jawPivot.rotation.x = open;
      for (const e of eyes) e.pose(tw, es, shot);
      const hornsOn = t >= 23.5 && t < 70; for (const a of antlers) { a.parts.forEach(m => { m.visible = hornsOn; }); if (hornsOn) a.pose(tw, speedK); }   // the peak reads as a plain mountain until the reveal
      // beard sway
      for (let i = 0; i < beardN; i++) { const b = beardBase[i], sw = Math.sin(tw * 2.7 + b[5] * 7) * 0.18 - 0.5 * speedK; dummy.position.set(b[0], b[1], b[2]); dummy.rotation.set(sw, 0, Math.sin(tw * 1.9 + b[5] * 5) * 0.12); dummy.scale.set(b[3], b[4], b[3]); dummy.updateMatrix(); beard.setMatrixAt(i, dummy.matrix); } beard.instanceMatrix.needsUpdate = true;
      // whiskers: mist trailing back with the speed, waving
      whiskers.forEach((w, n) => { const P = w.g.attributes.position.array, uv = w.g.attributes.uv.array, s = w.s, x0 = s * 14, y0 = w.y, z0 = 92 - n * 2, len = lerp(60, 230, clamp(speedK, 0, 1)), wig = lerp(9, 22, speedK), ph = n * 1.7;
        for (let i = 0; i <= WN; i++) { const k = i / WN, wv = Math.sin(k * 8 - tw * 5.5 + ph) * wig * k, wv2 = Math.cos(k * 5 - tw * 4.3 + ph) * wig * 0.5 * k, x = x0 + s * (14 * k) + wv, y = y0 - 14 * k * (1 - speedK * 0.7) + wv2, z = z0 + 6 * k - len * k * (0.25 + speedK), wd = (1 - k) * 2.6 + 0.4;
          P[i * 6] = x - wd; P[i * 6 + 1] = y; P[i * 6 + 2] = z; P[i * 6 + 3] = x + wd; P[i * 6 + 4] = y; P[i * 6 + 5] = z; uv[i * 4 + 0] = 0; uv[i * 4 + 1] = k; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = k; } w.g.attributes.position.needsUpdate = true; });
      // mane: pour from the jaw in every shot once awake; streams back with speed
      const on = sstep(23.6, 24.4, t) * (1 - sstep(67.8, 68.6, t)) * (['s12', 's14', 's26'].includes(shot.id) ? 0 : 1);   // s12/s14: fx waterfalls replace it; s26: dry gold glide
      for (const m of mane) { m.g.visible = on > 0.01; const P = m.g.attributes.position.array, [x0, y0, z0, w0] = m.so, sx = Math.sign(x0);
        for (let i = 0; i <= MN; i++) { const k = i / MN, drop = 9.8 * 3.6 * k * k * on * 6.2, back = speedK * 340 * k * k, flut = Math.sin(k * 7 - tw * 8 + x0) * (2 + k * 8), x = x0 + sx * (8 + 34 * k) * k + flut * 0.5, y = y0 - drop * (1 - speedK * 0.55) - 6 * k, z = z0 - back + flut, wd = w0 * 0.42 * (1 + k * 0.5) * (1 - speedK * 0.35) * on + 0.1;
          P[i * 6] = x - wd * sx * 0.7; P[i * 6 + 1] = y; P[i * 6 + 2] = z - wd * 0.6; P[i * 6 + 3] = x + wd * sx * 0.7; P[i * 6 + 4] = y; P[i * 6 + 5] = z + wd * 0.6; }
        m.g.attributes.position.needsUpdate = true; }
      waterTex.offset.y = -t * 1.6;
    } };
}

function lidGeometry(T) {
  const NT = 56, NR = 6, P = new Float32Array((NT + 1) * (NR + 1) * 3), Nr = new Float32Array(P.length), idx = []; for (let i = 0; i < NT; i++) for (let j = 0; j < NR; j++) { const a = i * (NR + 1) + j, b = a + NR + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }   // outward winding (DoubleSide flips N on back faces: reversed triangles lit the lid from below)
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nr, 3)); g.setIndex(idx); g.boundingSphere = new T.Sphere(new T.Vector3(), 30);
  return { g, set(Rlid, lip, Hu, Hl, W, roll) { const rimA = 1.72;
    for (let i = 0; i <= NT; i++) { const th = i / NT * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), H = Math.abs(s) < 1e-4 ? (s >= 0 ? Hu : Hl) : (s >= 0 ? Hu : Hl);
      // lens |y| = H (1 - (x / W)^2) -> edge along the ray; roll rotates the opening
      const cc = c * Math.cos(roll) - s * Math.sin(roll), ss = Math.abs(c * Math.sin(roll) + s * Math.cos(roll)), a = H * cc * cc / (W * W);
      let r = a < 1e-4 ? (ss > 1e-4 ? H / ss : W) : (-ss + Math.sqrt(ss * ss + 4 * a * H)) / (2 * a); r = Math.min(W, r) * Rlid * 0.98;
      const phiE = Math.asin(clamp(r / Rlid, 0, 0.995));
      for (let j = 0; j <= NR; j++) { const f = j / NR, phi = lerp(phiE, rimA, f), Rj = j === 0 ? Rlid - lip : Rlid, sp = Math.sin(phi), cp = Math.cos(phi), k = (i * (NR + 1) + j) * 3; P[k] = Rj * sp * c; P[k + 1] = Rj * sp * s; P[k + 2] = Rj * cp; Nr[k] = sp * c; Nr[k + 1] = sp * s; Nr[k + 2] = cp; } }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; } };
}

// ------------------------------------------------------------------------------------------------------------------------
function makeEye(ctx, head, side) {
  const T = ctx.THREE, mat = ctx.mat, R = EYE_R;
  // pivot at the eye centre, +z = looking direction, +y up
  const g = new T.Group(); g.position.set(EYE[0] * side, EYE[1], EYE[2]); const look = new V3(EYE_DIR.x * side, EYE_DIR.y, EYE_DIR.z);
  g.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(look, new V3(0, 0, 0), new V3(0, 1, 0))); head.add(g);
  // the eyeball: amber iris painted on a canvas, planar projected on a sphere
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); x.fillStyle = '#ffd24a'; x.fillRect(0, 0, 1024, 1024);
  const G = x.createRadialGradient(512, 512, 40, 512, 512, 500); G.addColorStop(0, '#ffe870'); G.addColorStop(0.55, '#ffb52e'); G.addColorStop(0.78, '#e8791a'); G.addColorStop(1, '#a23a10'); x.fillStyle = G; x.beginPath(); x.arc(512, 512, 500, 0, Math.PI * 2); x.fill();
  // hard bands, radial hand strokes
  x.fillStyle = '#ffc23a'; x.beginPath(); x.arc(512, 512, 455, 0, Math.PI * 2); x.fill(); x.fillStyle = '#ffdc62'; x.beginPath(); x.arc(512, 512, 330, 0, Math.PI * 2); x.fill(); x.fillStyle = '#ffee96'; x.beginPath(); x.arc(512, 512, 190, 0, Math.PI * 2); x.fill();
  x.lineCap = 'round'; for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, r0 = 200 + 80 * hash(i * 3.1), r1 = 360 + 80 * hash(i * 1.9); x.strokeStyle = 'rgba(170,70,8,.16)'; x.lineWidth = 3 + 5 * hash(i * 7.3); x.beginPath(); x.moveTo(512 + Math.cos(a) * r0, 512 + Math.sin(a) * r0); x.lineTo(512 + Math.cos(a) * r1, 512 + Math.sin(a) * r1); x.stroke(); }
  x.lineWidth = 34; x.strokeStyle = '#a84a12'; x.beginPath(); x.arc(512, 512, 488, 0, Math.PI * 2); x.stroke(); x.lineWidth = 9; x.strokeStyle = '#ffe9a0'; x.beginPath(); x.arc(512, 512, 425, 0.3, 2.5); x.stroke();
const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true;
  const ballG = new T.SphereGeometry(R, 48, 32); { const p = ballG.attributes.position, uv = ballG.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / R * 0.5 + 0.5, p.getY(i) / R * 0.5 + 0.5); }
  const ball = new T.Mesh(ballG, mat.cel(0xffffff, { id: mat.nextId(), shade: 0xffffff, map: tex, spec: 0, brush: 0, hiAmt: 0, ambLit: 0, rimI: 0, recvShadow: false, lock: 1 })); g.add(ball);   // flat paint, no shading: a drawn iris, not a marble
  // slit pupil: a lens on the eyeball
  const pupilW = 0.58, rowsP = 24, colsP = 6, pp = [], idx = [];
  for (let j = 0; j <= rowsP; j++) { const y = (j / rowsP * 2 - 1) * 0.72 * R, hw = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y) / (0.72 * R), 1.6)), 0.75) * pupilW * R;
    for (let i = 0; i <= colsP; i++) { const x = (i / colsP * 2 - 1) * hw, z = Math.sqrt(Math.max(R * R - x * x - y * y, 1)); const q = new V3(x, y, z).normalize().multiplyScalar(R * 1.008); pp.push(q.x, q.y, q.z); } }
  for (let j = 0; j < rowsP; j++) for (let i = 0; i < colsP; i++) { const a = j * (colsP + 1) + i, b = a + colsP + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pp, 3)); pg.setIndex(idx); pg.computeVertexNormals();
  const pupil = new T.Mesh(pg, mat.cel(0x1a1224, { id: mat.nextId(), shade: 0x120c1c, spec: 0, hiAmt: 0, recvShadow: false })); g.add(pupil);
  // cel gloss: two hard white shapes, fixed to the head
  const glossM = mat.fx(0xffffff, { k: 1.02 });
  const gA = new T.Mesh(new T.CircleGeometry(1, 24), glossM); gA.scale.set(1.0, 1.25, 1); gA.position.set(-3.6, 1.9, Math.sqrt(R * R - 3.6 * 3.6 - 1.9 * 1.9) + 0.5); g.add(gA);
  const gB = new T.Mesh(new T.CircleGeometry(1, 18), glossM); gB.scale.set(0.6, 0.6, 1); gB.position.set(3.7, -1.2, Math.sqrt(R * R - 3.7 * 3.7 - 1.2 * 1.2) + 0.35); g.add(gB);
  // lids: one rock sheet around the eye with an almond opening (rebuilt from the eye state on twos); a dark band under the upper lid
  const lidG2 = lidGeometry(T), lidM2 = mat.cel(0xb4a3a6, { id: mat.nextId(), shade: 0x756991, spec: 0, hiAmt: 0.35, hiT: 0.7, brush: 0.1, brushF: 0.5, side: T.DoubleSide }); const lidSheet = new T.Mesh(lidG2.g, lidM2); g.add(lidSheet);   // the eyelid skin: plain drawn tones; rock starts where the plates start
  const shutLid = new T.Mesh(new T.SphereGeometry(R + 1.4, 56, 28, 0, Math.PI * 2, 0, 1.72).rotateX(Math.PI / 2), lidM2); shutLid.visible = false; g.add(shutLid);   // fully closed: one unbroken surface, no degenerate slit for the ink to catch
  // a collar of rock plates over the dome: only the almond and a band of lid skin stay bare, so the socket reads as a brow and a lid, never as a ball in a hole
  { const list = []; const inside = (x, y) => Math.abs(y) < (y > 0 ? 0.6 : 0.42) * (1 - Math.min(1, (x * x) / (1.0))) + 0.11; for (let r = 0; r < 5; r++) { const phi = 0.55 + r * 0.25, n = 10 + r * 4; for (let i = 0; i < n; i++) { const a = (i + r * 0.5) / n * Math.PI * 2 + 0.2, x = Math.sin(phi) * Math.cos(a), y = Math.sin(phi) * Math.sin(a); if (!inside(x, y)) list.push([phi, a]); } }
    const pg = eyePlateGeo(23 + side, { sides: 8, ledges: 2 }), N = list.length, im = new T.InstancedMesh(pg, rockMat(ctx, { base: 0xbcb2cc, shade: 0x7e74ac, paintScale: 8, moss: 0.9 }), N), seeds = new Float32Array(N), M = new T.Matrix4(), s0 = new V3(), n0 = new V3(), t0 = new V3();
    list.forEach(([phi, a], k) => { n0.set(Math.sin(phi) * Math.cos(a), Math.sin(phi) * Math.sin(a), Math.cos(phi)); t0.set(0, 1, 0).addScaledVector(n0, -n0.y).normalize(); s0.crossVectors(n0, t0).normalize(); const sz = 5.4 + 2.4 * hash(k * 2.7 + side); M.makeBasis(s0, n0, t0); M.scale(new V3(sz * 1.15, sz * 0.9, sz * 1.3)); M.setPosition(n0.x * (R + 2.05), n0.y * (R + 2.05), n0.z * (R + 2.05)); im.setMatrixAt(k, M); seeds[k] = hash(k * 5.1 + side); });
    im.geometry = pg.clone(); im.geometry.setAttribute('aSeed', new T.InstancedBufferAttribute(seeds, 1)); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; g.add(im); }
  const shadowG = lidGeometry(T), shadowSheet = new T.Mesh(shadowG.g, mat.cel(0xa35a22, { id: mat.nextId(), shade: 0x7a4322, side: T.DoubleSide, spec: 0, recvShadow: false, hiAmt: 0 })); g.add(shadowSheet);
  // the shut eye: the seam where the lids meet and the crease of the upper lid, drawn on the dome
  const inkM = mat.cel(0x2a1a2e, { id: mat.nextId(), shade: 0x2a1a2e, spec: 0, hiAmt: 0, recvShadow: false });
  const arc = (rad, tube, span, y, tilt) => { const a = new T.Mesh(new T.TorusGeometry(rad, tube, 6, 56, span).rotateZ(-span / 2 + Math.PI / 2).rotateX(Math.PI / 2 - tilt).translate(0, y, 0), inkM); a.visible = false; g.add(a); return a; };
  const seam = arc(R + 1.75, 0.3, 2.2, 0.4, -0.3);
  const lidU = new T.Group(); g.add(lidU);
  // trees sliding off the upper lid (s09)
  const treeG = cedarGeo(), treeM = mat.cel(0x4fb45a, { id: mat.nextId(), shade: 0x1d7a82, spec: 0, vertexColors: true, hi: 0x8bdc6a, brush: 0.2, brushF: 1.2 }), TN = 12, trees = new T.InstancedMesh(treeG, treeM, TN); trees.frustumCulled = false; const treeSeeds = [];
  for (let i = 0; i < TN; i++) treeSeeds.push([hash(i * 7.7 + side) - 0.5, hash(i * 3.1 + side), 8 + 7 * hash(i * 5.3 + side)]); lidU.add(trees);
  const dummy = new T.Object3D();
  return { group: g,
    pose(tw, es, shot) {
      // almond opening: Hu / Hl = heights above / below the slit axis (in eye radii), W = half width, roll tilts it (rage)
      const W = 0.93, o = es.open, Hu = lerp(0.001, 0.42 + es.soft * 0.1 - es.narrow * 0.16, o), Hl = lerp(0.001, 0.25 + es.soft * 0.06 - es.narrow * 0.03, o);
      lidG2.set(R + 1.4, 0.66, Hu, Hl, W, es.narrow * -0.2 * side + es.soft * 0.08 * side);
      shadowG.set(R + 0.25, 0.04, Hu * 0.62, 1.15, W * 1.02, es.narrow * -0.2 * side + es.soft * 0.08 * side); shadowSheet.visible = o > 0.08;
      lidU.rotation.x = lerp(0.4, -0.55, o);
      // a shut eye is a lid, not a ball: it sinks and flattens into the skull
      const shut = 1 - clamp((o - 0.05) / 0.55, 0, 1); g.scale.set(1 + 0.08 * shut, 1 + 0.08 * shut, 1 - 0.55 * shut); g.position.set(EYE[0] * side, EYE[1], EYE[2]).addScaledVector(look, -5.5 * shut);
      pupil.scale.x = clamp(es.pupil, 0.08, 1); gA.visible = gB.visible = es.open > 0.3;
      gA.scale.set(1.0 + es.soft * 0.45, 1.25 + es.soft * 0.6, 1); seam.visible = shut > 0.7; ball.visible = pupil.visible = o > 0.03; shutLid.visible = o <= 0.03; lidSheet.visible = o > 0.03;
      // lid trees slide off as the lid opens
      const sl = sstep(0.05, 0.9, es.open); for (let i = 0; i < TN; i++) { const s = treeSeeds[i], a = s[0] * 1.6, th = -0.6 + s[1] * 1.0, slide = sl * (10 + 24 * s[1]); const rr = R + 1.6, dirY = Math.cos(th), dirZ = Math.sin(th); dummy.position.set(Math.sin(a) * rr, dirY * rr * Math.cos(a) + slide * 0.2, dirZ * rr * Math.cos(a) + slide); dummy.rotation.set(sl * 0.9 + 0.2, 0, s[0]); dummy.scale.setScalar(s[2] * (1 - sl * 0.25)); dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix); } trees.instanceMatrix.needsUpdate = true; trees.visible = sl < 1 && tw < 22.5;
    } };
}

function makeAntler(ctx, head, s, rockFine) {
  const T = ctx.THREE, mat = ctx.mat, m = (p) => p.map(v => [v[0] * s, v[1], v[2]]);
  const trunk = m([[15, -3, -16], [19, 14, -22], [26, 34, -36], [36, 50, -56], [44, 64, -76]]), tine1 = m([[22, 23, -29], [18, 42, -22], [16, 60, -12]]), tine2 = m([[31, 44, -48], [44, 62, -40], [54, 80, -42]]), tine3 = m([[39, 56, -62], [36, 72, -80], [34, 86, -94]]), tine4 = m([[33, 46, -54], [24, 58, -62], [20, 74, -60]]);
  const parts = [faceted(trunk, [9, 8.6, 6.5, 5, 2.2], { seed: 3 + s }), faceted(tine1, [4.6, 3.6, 1.6], { seed: 5 + s, sides: 5 }), faceted(tine2, [4.2, 3.2, 1.2], { seed: 8 + s, sides: 5 }), faceted(tine3, [3.8, 2.8, 1.1], { seed: 13 + s, sides: 5 }), faceted(tine4, [3.0, 2.2, 0.9], { seed: 17 + s, sides: 5 })];
  const mesh = new T.Mesh(toCreasedNormals(mergeGeometries(parts), 0.5), rockMat(ctx, { base: 0xc6bdce, shade: 0x8a7fb0, ochre: 0.5, moss: 0.4, side: T.FrontSide })); mesh.name = 'antler' + s; head.add(mesh);
  // shimenawa: a thick twisted rope winding the antler base (helix around the lower trunk)
  const twistN = 220, loops = 3.4; const rope0 = [], rope1 = [];
  const TU = new V3(19 - 15, 14 + 3, -22 + 16).normalize(), base = new V3(15 * s, -3, -16), tmpA = new V3(1, 0, 0); tmpA.addScaledVector(TU, -tmpA.dot(TU)).normalize(); const tmpB = new V3().crossVectors(TU, tmpA);
  for (let i = 0; i <= twistN; i++) { const k = i / twistN, a = k * loops * Math.PI * 2, r = 10.4 + 1.2 * Math.sin(k * 40), cen = base.clone().addScaledVector(TU, 1 + k * 24).addScaledVector(tmpA, Math.cos(a) * r).addScaledVector(tmpB, Math.sin(a) * r); const dA = Math.cos(k * 40 * Math.PI), dB = Math.sin(k * 40 * Math.PI); rope0.push(cen.clone().addScaledVector(TU, dA * 1.3).addScaledVector(tmpA, dB * 1.3).toArray()); rope1.push(cen.clone().addScaledVector(TU, -dA * 1.3).addScaledVector(tmpA, -dB * 1.3).toArray()); }
  const ropeM = mat.cel(0xefdfad, { id: mat.nextId(), shade: 0xb49a8a, spec: 0 }); const r0 = new T.Mesh(faceted(rope0, Array(rope0.length).fill(1.6), { sides: 5, jitter: 0.06 }), ropeM), r1 = new T.Mesh(faceted(rope1, Array(rope1.length).fill(1.6), { sides: 5, jitter: 0.06 }), ropeM); head.add(r0, r1); r0.userData.noSolid = r1.userData.noSolid = true;
  // shide: white zigzag paper strips hanging from the rope loops
  const SN = 14, card = (() => { const w = 1.5, seg = [[0, 0], [1.5, -1.6], [0, -3.2], [1.5, -4.8], [0, -6.4], [1.5, -8]], pos = [], idx = []; seg.forEach(([x, y], i) => pos.push(x - w, y, 0, x + w, y, 0)); for (let i = 0; i < seg.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed(); })();
  const shideM = mat.cel(0xffffff, { id: mat.nextId(), shade: 0xbab6e0, side: T.DoubleSide, spec: 0, brush: 0.04 }); card.computeVertexNormals(); const shide = new T.InstancedMesh(card, shideM, SN); shide.frustumCulled = false; head.add(shide);
  const hooks = []; for (let i = 0; i < SN; i++) { const k = (i + 0.5) / SN, a = k * loops * Math.PI * 2, r = 12.2, p = base.clone().addScaledVector(TU, 1 + k * 24).addScaledVector(tmpA, Math.cos(a) * r).addScaledVector(tmpB, Math.sin(a) * r); hooks.push(p); }
  const dummy = new T.Object3D();
  return { mesh, parts: [mesh, r0, r1, shide], pose(tw, speedK) { for (let i = 0; i < SN; i++) { const ph = i * 2.3 + s, fl = Math.sin(tw * 9.5 + ph) * (0.18 + speedK * 0.6); dummy.position.copy(hooks[i]); dummy.rotation.set(-0.15 - speedK * 1.15 + fl * 0.3, ph * 1.3, fl); dummy.scale.setScalar(1.25); dummy.updateMatrix(); shide.setMatrixAt(i, dummy.matrix); } shide.instanceMatrix.needsUpdate = true; } };
}
