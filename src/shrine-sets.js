// RYŪ · 龍 · close set pieces for keeper shots (owner: keeper): a hero section of the horn (s17, s25), a hero brow ridge with the eye fold (s22).
// Both are built around the scale of Clawd and placed in the shrine frame, so the film's big dragon needs no extra detail at this scale.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const T = THREE, V3 = T.Vector3;
function R(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const paint = (g, c) => { const n = g.index ? g.toNonIndexed() : g, col = new T.Color(c), N = n.attributes.position.count, a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } n.setAttribute('color', new T.BufferAttribute(a, 3)); if (!n.attributes.uv) n.setAttribute('uv', new T.BufferAttribute(new Float32Array(N * 2), 2)); return n; };
const fbm = (x, y) => Math.sin(x * 1.7 + 2.0 * Math.sin(y * 0.9)) * 0.5 + Math.sin(y * 2.3 + x * 0.7) * 0.25 + Math.sin(x * 4.1 - y * 3.2) * 0.12;

export const HORN = { base: [7, -2.5, 0], len: 8, r0: 1.05, r1: 0.34 };
export const hornR = (y) => { const k = (y - HORN.base[1]) / HORN.len; return HORN.r0 + (HORN.r1 - HORN.r0) * Math.min(1, Math.max(0, k)); };
export const hornTopY = HORN.base[1] + HORN.len;

export function buildHorn(ctx, parent) {
  const { mat } = ctx, g = new T.Group(); g.name = 'hero-horn'; parent.add(g);
  const m = mat.cel(0xffffff, { id: mat.nextId(), vertexColors: true, shade: 0x8a7fb0 });
  // shaft: strata bands + lichen
  const N = 56, M = 24, pos = [], col = [], idx = [], c = new T.Color();
  for (let j = 0; j <= N; j++) { const v = j / N, y = v * HORN.len, r0 = HORN.r0 + (HORN.r1 - HORN.r0) * v; for (let i = 0; i <= M; i++) { const a = i / M * 6.283, n = 1 + 0.09 * Math.sin(a * 3 + y * 1.3) + 0.05 * Math.sin(a * 7 - y * 3) + 0.03 * Math.sin(y * 11), r = r0 * n;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r); const b = Math.sin(y * 7 + a * 0.8 + 0.8 * Math.sin(a * 2)); c.set(b > 0.5 ? 0xc6bdce : b > -0.3 ? 0xb2a8c4 : 0x9e93b8); if (Math.sin(a * 2.2 + y * 2) > 0.92 && j % 3 === 0) c.set(0x7f8d5c); col.push(c.r, c.g, c.b); } }
  for (let j = 0; j < N; j++) for (let i = 0; i < M; i++) { const a = j * (M + 1) + i, b = a + M + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  // flat cap (Clawd stands here)
  const ci = pos.length / 3; pos.push(0, HORN.len, 0); c.set(0xa89fae); col.push(c.r, c.g, c.b); for (let i = 0; i <= M; i++) { const a = i / M * 6.283, r = HORN.r1 * 1.0; pos.push(Math.cos(a) * r, HORN.len, Math.sin(a) * r); col.push(c.r, c.g, c.b); } for (let i = 0; i < M; i++) idx.push(ci, ci + i + 2, ci + i + 1);
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); sg.setAttribute('uv', new T.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); sg.setIndex(idx); sg.computeVertexNormals();
  const shaft = new T.Mesh(sg, m); shaft.position.set(...HORN.base); shaft.name = 'hero-horn-shaft'; g.add(shaft);
  // shimenawa ring + shide (flutter on threes)
  const y0 = HORN.base[1] + 4.3, r = hornR(y0) + 0.12, ropeG = paint(new T.TorusGeometry(r, 0.16, 10, 40).rotateX(Math.PI / 2).translate(HORN.base[0], y0, HORN.base[2]), 0xefdfad), ropeM = new T.Mesh(ropeG, mat.cel(0xffffff, { id: mat.nextId(), vertexColors: true, shade: 0xb49a8a })); g.add(ropeM);
  const SN = 7, shideG = new T.PlaneGeometry(0.18, 0.5, 2, 3), sM = new T.InstancedMesh(shideG, mat.cel(0xffffff, { id: mat.nextId(), side: T.DoubleSide, shade: 0xbab6e0 }), SN); sM.frustumCulled = false; g.add(sM);
  const O = new T.Object3D();
  const api = { group: g, shaft, y0, rope: ropeM, update(t) { const f = Math.floor(t * 24 / 3); for (let i = 0; i < SN; i++) { const a = i / SN * 6.283 + 0.4, flap = Math.sin(f * 1.7 + i * 2.1) * 0.5; O.position.set(HORN.base[0] + Math.cos(a) * r, y0 - 0.3, HORN.base[2] + Math.sin(a) * r); O.rotation.set(-0.85 + flap, a, 0); O.updateMatrix(); sM.setMatrixAt(i, O.matrix); } sM.instanceMatrix.needsUpdate = true; } };
  return api;
}

// ---- BROW RIDGE (s22): a sculpted patch of rock plates with the eyelid fold. Local frame: origin = centre of the patch at height 0,
// crawl direction +z; the scratch point (crease behind the eye) at SCRATCH; the amber eye sliver at the far +z side below the lid.
export const RIDGE = { origin: [34, 2, 24], crease: [0.2, 0, 1.15], yawCrawl: 0, eye: [1.55, 0.72, 2.35], eyeR: 0.92 };
// point on the eye surface the broom tips rub (ridge-local): the edge of the iris nearest to Clawd
export const EYE_TOUCH = (() => { const c = new V3(...RIDGE.eye), n = new V3(-0.75, 0.03, -0.65).normalize(); return c.addScaledVector(n, RIDGE.eyeR * 1.14).toArray(); })();
const plate = (x, z) => { const u = x * 1.1 + 0.35 * Math.sin(z * 2.1), v = z * 1.1 + 0.3 * Math.sin(x * 1.9); return Math.round(u) * 7.13 + Math.round(v) * 13.71; };
export function ridgeH(x, z) {   // height of the ridge surface in ridge-local coords (pure)
  const cr = fbm(x * 0.8 + 0.3, z * 0.7) * 0.18, wave = 0.5 * Math.sin((z + 2) * 0.35) * 0.2;
  const dome = 0.42 - (x * x) / 16 * 0.75 - Math.max(0, z - 1.6) * Math.max(0, z - 1.6) * 0.42;  // falls away to the eye (far +z)
  const scale = (Math.sin(plate(x, z)) * 0.5 + 0.5) * 0.09;
  const fold = -0.45 * Math.exp(-Math.pow((z - 1.35) / 0.18, 2)) * Math.exp(-x * x / 8);   // the crease behind the eye
  return dome + cr + wave + scale + fold;
}
// a smooth roof over the ridge's plates: what Clawd plants on (the plate noise is a step function and would pop him up and down)
export function ridgeTop(x, z) { const cr = fbm(x * 0.8 + 0.3, z * 0.7) * 0.18, wave = 0.5 * Math.sin((z + 2) * 0.35) * 0.2, dome = 0.42 - (x * x) / 16 * 0.75 - Math.max(0, z - 1.6) * Math.max(0, z - 1.6) * 0.42, fold = -0.45 * Math.exp(-Math.pow((z - 1.35) / 0.18, 2)) * Math.exp(-x * x / 8); return dome + cr + wave + fold + 0.09; }
export function buildRidge(ctx, parent) {
  const { mat } = ctx, g = new T.Group(); g.name = 'hero-ridge'; g.position.set(...RIDGE.origin); parent.add(g);
  const pg = new T.PlaneGeometry(13, 11, 180, 150).rotateX(-Math.PI / 2), p = pg.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = ridgeH(x, z); p.setY(i, h); const pl = plate(x, z), s = Math.sin(pl * 3.1); const creased = Math.exp(-Math.pow((z - 1.35) / 0.3, 2)) * Math.exp(-x * x / 9);
    c.set(s > 0.55 ? 0xb4a8b0 : s > 0 ? 0x97899f : s > -0.55 ? 0x7d7195 : 0xaf9a68); if (Math.sin(x * 2.3 + pl) > 0.75) c.set(0x7f9a4e); if (creased > 0.55) c.lerp(new T.Color(0x5c3f6a), 0.5); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  pg.setAttribute('color', new T.BufferAttribute(col, 3)); pg.computeVertexNormals();
  const skin = new T.Mesh(pg, mat.cel(0xffffff, { id: mat.nextId(), vertexColors: true, shade: 0x8b86ac })); skin.name = 'ridge-skin'; g.add(skin);
  // the eye: the amber eye with its slit, the iris painted facing the shot's camera (planar projection along n)
  const C = RIDGE.eye, R = RIDGE.eyeR, n = new V3(-0.79, 0.02, -0.61).normalize(), rt = new V3().crossVectors(new V3(0, 1, 0), n).normalize(), up = new V3().crossVectors(n, rt);
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024; const x = cv.getContext('2d'); x.fillStyle = '#a23a10'; x.fillRect(0, 0, 1024, 1024);
  const rings = [[500, '#a84a12'], [470, '#e8791a'], [420, '#ffb52e'], [320, '#ffdc62'], [180, '#ffee96']]; for (const [rr, c] of rings) { x.fillStyle = c; x.beginPath(); x.arc(512, 512, rr, 0, 6.2832); x.fill(); }
  x.lineCap = 'round'; for (let i = 0; i < 64; i++) { const a = i / 64 * 6.2832, r0 = 210 + 70 * Math.abs(Math.sin(i * 3.1)), r1 = 370 + 70 * Math.abs(Math.sin(i * 1.9)); x.strokeStyle = 'rgba(170,70,8,.22)'; x.lineWidth = 4 + 5 * Math.abs(Math.sin(i * 7.3)); x.beginPath(); x.moveTo(512 + Math.cos(a) * r0, 512 + Math.sin(a) * r0); x.lineTo(512 + Math.cos(a) * r1, 512 + Math.sin(a) * r1); x.stroke(); }
  // the slit pupil, thin and vertical (the dragon is terrified here), with a dark halo
  x.fillStyle = '#1a1224'; x.beginPath(); x.moveTo(512, 40); x.quadraticCurveTo(566, 512, 512, 984); x.quadraticCurveTo(458, 512, 512, 40); x.fill();
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true;
  const eg = new T.SphereGeometry(R, 56, 40), pe = eg.attributes.position, ue = eg.attributes.uv, v = new V3(); for (let i = 0; i < pe.count; i++) { v.fromBufferAttribute(pe, i); ue.setXY(i, v.dot(rt) / (R * 1.02) * 0.5 + 0.5, v.dot(up) / (R * 1.02) * 0.5 + 0.5); }
  const eye = new T.Mesh(eg, mat.cel(0xcfb890, { id: mat.nextId(), shade: 0xcfb890, map: tex, spec: 0, brush: 0, hiAmt: 0, ambLit: 1, rimI: 0, recvShadow: false, lock: 1 })); eye.position.set(...C); eye.name = 'ridge-eye'; g.add(eye);
  const glossM = mat.fx(0xffffff, { k: 1.05 }), gloss = (a, b, r) => { const m = new T.Mesh(new T.CircleGeometry(r, 24), glossM), o = new V3().addScaledVector(rt, a * R).addScaledVector(up, b * R), z = Math.sqrt(Math.max(R * R - o.lengthSq(), 0.01)); m.position.copy(new V3(...C).add(o).addScaledVector(n, z + 0.03)); m.quaternion.setFromUnitVectors(new V3(0, 0, 1), n); g.add(m); }; gloss(-0.3, 0.12, 0.08);
  // the heavy lid: a rock fold over the top of the eye
  // lids: two domes wrapping the ball, an almond of eye left between them (no ball outline anywhere)
  const domeG = (cap, radius) => { const dg = new T.SphereGeometry(radius, 48, 16, 0, Math.PI * 2, 0, cap).rotateX(0); dg.computeVertexNormals(); return dg; };
  const lidM = mat.cel(0xb7a9ae, { id: mat.nextId(), shade: 0x7a6f9c, spec: 0, hiAmt: 0.3, side: T.DoubleSide }), lid = new T.Mesh(domeG(1.32, R * 1.1), lidM), lower = new T.Mesh(domeG(0.92, R * 1.08), lidM);
  const axis = up.clone().addScaledVector(n, 0.32).normalize(); lid.position.set(...C); lid.quaternion.setFromUnitVectors(new V3(0, 1, 0), axis); lower.position.set(...C); lower.quaternion.setFromUnitVectors(new V3(0, 1, 0), axis.clone().negate()); g.add(lid, lower);
  // rock plates over the lid dome: it must read as hide, not as a ball
  { let s3 = 4411; const r2 = () => { s3 = (s3 * 16807) % 2147483647; return s3 / 2147483647; }, PG = new T.CircleGeometry(1, 6).rotateX(-Math.PI / 2), plateM = mat.cel(0xb7a9ae, { id: mat.nextId(), shade: 0xb7a9ae, spec: 0, hiAmt: 0 }), N2 = 54, im2 = new T.InstancedMesh(PG, plateM, N2), o2 = new T.Object3D(), q0 = new T.Quaternion().setFromUnitVectors(new V3(0, 1, 0), axis), qn = new T.Quaternion(); for (let i = 0; i < N2; i++) { const a = r2() * 6.283, ph = 0.28 + 1.0 * Math.sqrt(r2()), dv = new V3(Math.sin(ph) * Math.cos(a), Math.cos(ph), Math.sin(ph) * Math.sin(a)).applyQuaternion(q0); o2.position.set(...C).addScaledVector(dv, R * 1.105); qn.setFromUnitVectors(new V3(0, 1, 0), dv); o2.quaternion.copy(qn); const s0 = 0.13 + 0.12 * r2(); o2.scale.set(s0 * 1.25, 1, s0); o2.updateMatrix(); im2.setMatrixAt(i, o2.matrix); } im2.instanceMatrix.needsUpdate = true; im2.frustumCulled = false; g.add(im2); }
  return { group: g, skin, eye, lid };
}
