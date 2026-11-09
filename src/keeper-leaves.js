// RYŪ · 龍 · LEAVES (owner: keeper). Pile, swept leaves, the hero leaf (s04 macro, s29), scattered floor + leaves on Clawd (s29).
import * as THREE from 'three';
const T = THREE, V3 = T.Vector3, DEG = Math.PI / 180;
function R(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const PAL2 = [0x7f9a3e, 0xa8bb4a, 0x5f7f38, 0xb8452a, 0xd9a53a].map(c => new T.Color(c));
const PALETTE = [0xd9a53a, 0xcc7f32, 0xbe5a2c, 0x9caf46, 0xe2b94a].map(c => new T.Color(c));[0xd9a53a, 0xcc7f32, 0xbe5a2c, 0x9caf46, 0xe2b94a].map(c => new T.Color(c));
// leaf geometry: pointed oval lying in XZ, +y up, length along +z, 1 m long (scale per instance)
function leafGeo(curl = 0.14) {
  const s = new T.Shape(); s.moveTo(0, -0.5); s.quadraticCurveTo(0.42, -0.12, 0.05, 0.42); s.lineTo(0, 0.5); s.lineTo(-0.05, 0.42); s.quadraticCurveTo(-0.42, -0.12, 0, -0.5);
  const g = new T.ShapeGeometry(s, 8).rotateX(-Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, curl * (x * x * 3 - z * z * 0.8)); } g.computeVertexNormals(); return g;
}
export const PILE = { x: 1.42, z: 1.5, r: 0.42, h: 0.2 };
export const LEAF1 = [-0.22, -0.2, 2.64];    // landing spot of the s04 hero leaf (on the first step)
export const LEAF2 = [0.8, 0, 2.15];          // landing spot of the s29 leaf

export function buildLeaves(ctx, parent, bodyNode) {
  const { mat } = ctx, geo = leafGeo();
  const smat = (o = {}) => mat.cel(0xffffff, { ink: false, side: T.DoubleSide, id: 0, shade: 0xa49ab8, ...o });
  const makeSet = (n, name, p = parent) => { const m = new T.InstancedMesh(geo, smat(), n); m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3); m.name = name; m.frustumCulled = false; m.userData.noSolid = true; p.add(m); return m; };
  const pileGroup = new T.Group(); parent.add(pileGroup);
  const rnd = R(77), pal = () => PALETTE[Math.floor(rnd() * PALETTE.length)];
  const M = new T.Matrix4(), P = new V3(), Q = new T.Quaternion(), E = new T.Euler(), S = new V3();
  const place = (m, i, x, y, z, rx, ry, rz, s, col) => { E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); P.set(x, y, z); S.setScalar(s); M.compose(P, Q, S); m.setMatrixAt(i, M); if (col) m.setColorAt(i, col); };

  // the neat pile: a dome of leaves
  const NP = 190, pile = makeSet(NP, 'pile', pileGroup);
  for (let i = 0; i < NP; i++) { const u = rnd(), a = rnd() * 6.283, r = PILE.r * Math.sqrt(u), y = PILE.h * (1 - u) * (0.75 + 0.5 * rnd()) + 0.012; place(pile, i, PILE.x + Math.cos(a) * r, y, PILE.z + Math.sin(a) * r, (rnd() - 0.5) * 0.9, rnd() * 6.28, (rnd() - 0.5) * 0.9, 0.09 + rnd() * 0.05, pal()); }
  pile.instanceMatrix.needsUpdate = true; pile.instanceColor.needsUpdate = true;

  // leaves on the floor that the broom pushes into the pile during s03
  const NW = 26, swept = makeSet(NW, 'swept'), sw = [];
  for (let i = 0; i < NW; i++) { const a = rnd() * 6.283, d = 0.3 + rnd() * 0.65; const sx = 0.55 + rnd() * 0.75, sz = 1.3 + rnd() * 0.85, ex = PILE.x - 0.35 + rnd() * 0.5, ez = PILE.z - 0.35 + rnd() * 0.7;
    sw.push({ sx, sz, ex, ez, y: 0.006 + rnd() * 0.006, ry: rnd() * 6.28, tilt: (rnd() - 0.5) * 0.2, s: 0.08 + rnd() * 0.04, col: pal() }); }

  // s29: scattered floor + leaves all over Clawd
  const NS = 520, strewn = makeSet(NS, 'strewn');
  for (let i = 0; i < NS; i++) { const x = -3.4 + rnd() * 6.8, z = -4.3 + rnd() * 6.6; place(strewn, i, x, 0.008 + rnd() * 0.01, z, (rnd() - 0.5) * 0.12, rnd() * 6.28, (rnd() - 0.5) * 0.12, 0.09 + rnd() * 0.06, PAL2[Math.floor(rnd() * PAL2.length)]); }
  strewn.instanceMatrix.needsUpdate = true; strewn.instanceColor.needsUpdate = true;
  const NB = 46, body = bodyNode ? makeSet(NB, 'on-clawd', bodyNode) : null;
  if (body) { const up = new V3(0, 1, 0), n = new V3();   // on the rounded box of the body (half 0.5, 0.37, 0.28 around y 0.52), never on the face
    for (let i = 0; i < NB; i++) { const r = rnd(); let x, y, z;
      if (r < 0.52) { n.set(0, 1, 0); x = (rnd() - 0.5) * 0.92; z = (rnd() - 0.5) * 0.48; y = 0.37; }
      else if (r < 0.74) { const s = rnd() < 0.5 ? -1 : 1; n.set(s, 0, 0); x = s * 0.5; y = (rnd() - 0.5) * 0.62; z = (rnd() - 0.5) * 0.46; }
      else if (r < 0.88) { n.set(0, 0, 1); z = 0.28; const s = rnd() < 0.5 ? -1 : 1; x = s * (0.34 + rnd() * 0.12); y = -0.05 + (rnd() - 0.5) * 0.5; }
      else { n.set(0, 0, -1); x = (rnd() - 0.5) * 0.9; y = (rnd() - 0.5) * 0.62; z = -0.28; }
      Q.setFromUnitVectors(up, n); const twist = new T.Quaternion().setFromAxisAngle(up, rnd() * 6.28); Q.multiply(twist); P.set(x, y + 0.52, z).addScaledVector(n, 0.014); S.setScalar(0.17 + rnd() * 0.09); M.compose(P, Q, S); body.setMatrixAt(i, M); body.setColorAt(i, pal()); }
    body.instanceMatrix.needsUpdate = true; body.instanceColor.needsUpdate = true; }
  // the hero leaf: bigger, inked
  const heroG = new T.Group(); heroG.name = 'hero-leaf'; parent.add(heroG);
  const hLeaf = new T.Mesh(leafGeo(0.2), mat.cel(0xa8c54e, { id: mat.nextId(), side: T.DoubleSide, shade: 0x6f8f50 })); hLeaf.scale.setScalar(0.17); hLeaf.userData.noSolid = true; heroG.add(hLeaf);
  const rib = new T.Mesh(new T.BoxGeometry(0.008, 0.004, 0.14), mat.cel(0x5a6c32, { ink: false, id: 0 })); rib.position.y = 0.004; rib.userData.noSolid = true; heroG.add(rib);

  // leaf i of the broom sweep: goes from start to the pile with the strokes (pure of t)
  function heroPos(t) {
    if (t >= 8.4 && t < 63.5) { const L = LEAF1, k = clamp((t - 8.7) / 0.7); return { on: true, p: [L[0] + (1 - k) * (0.28 + 0.14 * Math.sin(k * 7.5)), L[1] + 0.015 + (1 - k) * 1.05 + 0.05 * (1 - k) * Math.abs(Math.sin(k * 7.5)), L[2] - (1 - k) * 0.2], rx: (1 - k) * 0.95 * Math.sin(k * 11), rz: (1 - k) * 0.7 * Math.cos(k * 9), ry: 0.4 + k * 1.2 }; }
    if (t >= 70.55) { const L = LEAF2, k = clamp((t - 70.6) / 1.0), push = ss(72.2, 72.95, t);
      return { on: true, p: [L[0] + (1 - k) * (0.4 + 0.18 * Math.sin(k * 7)) + push * 0.45, L[1] + 0.012 + (1 - k) * 1.8, L[2] - (1 - k) * 0.25 - push * 0.35], rx: (1 - k) * 0.9 * Math.sin(k * 10), rz: (1 - k) * 0.6 * Math.cos(k * 8), ry: 1.1 + k + push * 2.4 }; }
    return { on: false, p: [0, 0, 0], rx: 0, rz: 0, ry: 0 };
  }

  return {
    pile, swept, strewn, body, hero: heroG, PILE,
    heroPos,
    update(t, ct) {
      // pile trembles from the bell through the forest ripple
      const q = ss(13.2, 13.5, t) * (1 - ss(15.0, 20.0, t)), f = Math.floor(t * 24 / 2);
      pileGroup.position.set(q * 0.008 * Math.sin(f * 2.1), q * 0.004 * Math.abs(Math.sin(f * 3.7)), q * 0.008 * Math.cos(f * 3.1));
      // visibility: pile and swept leaves stay from the start until the storm clears it all away; strewn only at the end
      const dayEarly = t < 70, end = t >= 70;
      pileGroup.visible = dayEarly; swept.visible = dayEarly; strewn.visible = end; if (body) body.visible = end;
      if (swept.visible) { const k = ss(5.5, 8.1, ct); for (let i = 0; i < NW; i++) { const s = sw[i], stair = (Math.floor(ct * 2.2 + i * 0.13) / (2.2 * 3)) % 1, adv = clamp(k * 1.2 - i * 0.012), xx = s.sx + (s.ex - s.sx) * adv, zz = s.sz + (s.ez - s.sz) * adv + 0.03 * Math.sin(adv * 13 + i); place(swept, i, xx, s.y, zz, s.tilt, s.ry + adv * 2 + stair * 0.2, s.tilt, s.s, i === 0 ? s.col : s.col); } swept.instanceMatrix.needsUpdate = true; if (t < 0.2) swept.instanceColor.needsUpdate = true; else swept.instanceColor.needsUpdate = true; }
      const h = heroPos(t); heroG.visible = h.on; if (h.on) { heroG.position.set(...h.p); heroG.rotation.set(h.rx, h.ry, h.rz); }
      return h;
    },
  };
}
