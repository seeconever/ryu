// RYŪ · WORLD harbour (owner: world): the seawall (wave-return parapet, steps down to the pier, tide stains),
// tetrapods, the two breakwaters with their red / white lighthouses, the wooden pier (planks, stringers, pile caps, piles
// with a weed line, X braces, curbs, iron bitts, the end ladder, a lamp post) and the small fishing boats (lofted hulls,
// wheelhouse, mast, squid-fishing lamps, tyre fenders, flags) that ride the swell.
// The pier is CEL (inked) near the camera and swaps to a painted low-detail twin beyond ~70 m (no ink mush in wide shots).
import * as THREE from 'three';
import { Builder, wireGeometry } from './world-geo.js';
import { SEAWALL_Z, WALL_TOP, ground } from './world-terrain.js';

const C = (h) => new THREE.Color(h);
export const PIER = { deckY: 2.2, x0: -1.6, x1: 1.6, z0: SEAWALL_Z, z1: 0, bollards: [[-1.25, 2.2, -0.4], [1.25, 2.2, -0.4]],
  ladder: { x: -0.75, z: 0.07, top: 2.2, bottom: -1.7, rungs: [] } };
for (let y = 1.95; y > -1.7; y -= 0.3) PIER.ladder.rungs.push(+y.toFixed(2));
export const WALL = { x0: -405, x1: 385, top: WALL_TOP + 0.1, parapet: 0.9 };
export const BREAKWATERS = [[[300, -42], [300, 100], [175, 112]], [[112, -42], [112, 38]]];

// concrete texture for the seawall face: panels, lift lines, tide band, barnacles
function concreteTex(ctx) { const R = ctx.rng(3260);
  return ctx.kit.canvasTex(512, 256, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(110,105,100,${0.03 + R() * 0.06})`; c.fillRect(R() * W, R() * H, 3 + R() * 30, 2 + R() * 6); }
    for (let i = 0; i < 40; i++) { const x = R() * W; c.fillStyle = `rgba(90,85,80,${0.05 + R() * 0.06})`; c.fillRect(x, 0, 2 + R() * 4, H * (0.3 + R() * 0.5)); }
    c.fillStyle = 'rgba(70,70,80,0.55)'; c.fillRect(0, 0, 3, H); c.fillRect(W / 2, 0, 2, H);
    c.fillStyle = 'rgba(70,70,80,0.25)'; for (const y of [0.25, 0.5]) c.fillRect(0, H * y, W, 2);
    // tide band (v = (y + 1.5) / 5: y = -0.6..0.7 -> canvas rows) + barnacles
    const yb = (y) => H - (y + 1.5) / 5 * H; const g = c.createLinearGradient(0, yb(1.1), 0, yb(-0.8)); g.addColorStop(0, 'rgba(90,110,80,0)'); g.addColorStop(0.35, 'rgba(70,95,70,0.55)'); g.addColorStop(1, 'rgba(50,60,50,0.75)');
    c.fillStyle = g; c.fillRect(0, yb(1.1), W, yb(-1.5) - yb(1.1));
    for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '230,225,210' : '40,45,40'},${0.25 + R() * 0.3})`; c.beginPath(); c.arc(R() * W, yb(-0.4 + R() * 1.0), 0.8 + R() * 2.2, 0, 7); c.fill(); }
  }, { repeat: true }); }

// quay texture, v 0..0.36 = the concrete apron (2.6 m), v 0.5..1 = the asphalt road (6.8 m); u = 24 m along the quay
function quayTex(ctx) { const R = ctx.rng(3262);
  return ctx.kit.canvasTex(1536, 512, (c, W, H) => {
    const ya = H * 0.36, yr = H * 0.5, sx = W / 24, sr = (H - yr) / 6.8;
    // apron: pale concrete slabs (4 m joints), stains, a tide-salt bloom near the parapet
    c.fillStyle = '#dcd6ca'; c.fillRect(0, 0, W, yr);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '120,112,104' : '250,248,240'},${0.04 + R() * 0.07})`; c.fillRect(R() * W, R() * ya, 2 + R() * 14, 1 + R() * 6); }
    c.fillStyle = 'rgba(90,86,84,0.55)'; for (let x = 0; x <= W; x += 4 * sx) c.fillRect(x - 1, 0, 3, ya);
    for (let i = 0; i < 10; i++) { const x = R() * W, w = 30 + R() * 120; const g = c.createRadialGradient(x, ya * 0.5, 2, x, ya * 0.5, w); g.addColorStop(0, 'rgba(110,100,90,0.18)'); g.addColorStop(1, 'rgba(110,100,90,0)'); c.fillStyle = g; c.fillRect(x - w, 0, w * 2, ya); }
    c.fillStyle = '#a8a294'; c.fillRect(0, ya, W, yr - ya);   // curb face band (between apron and road)
    // road: blue-grey asphalt + aggregate, repair patches, branching cracks, worn edge lines, gutter grates, a manhole
    c.fillStyle = '#7d828e'; c.fillRect(0, yr, W, H - yr);
    for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '40,42,52' : '200,200,206'},${0.06 + R() * 0.1})`; c.fillRect(R() * W, yr + R() * (H - yr), 1 + R() * 3, 1 + R() * 2); }
    for (let i = 0; i < 6; i++) { const x = R() * W, y = yr + R() * (H - yr - 60), w = 60 + R() * 200, h = 30 + R() * 70; c.fillStyle = 'rgba(70,72,84,0.7)'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(160,160,168,0.6)'; c.lineWidth = 2; c.strokeRect(x, y, w, h); }
    c.strokeStyle = 'rgba(38,38,46,0.75)'; c.lineWidth = 1.6;
    for (let i = 0; i < 14; i++) { let x = R() * W, y = yr + R() * (H - yr); c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (R() - 0.3) * 40; y += (R() - 0.5) * 24; c.lineTo(x, y); if (R() < 0.25) { c.moveTo(x, y); } } c.stroke(); }
    c.fillStyle = 'rgba(245,244,236,0.92)'; c.fillRect(0, yr + 0.25 * sr, W, 0.15 * sr); c.fillRect(0, H - 0.45 * sr, W, 0.15 * sr);
    c.fillStyle = 'rgba(125,130,142,1)'; for (let i = 0; i < 18; i++) c.fillRect(R() * W, yr + 0.25 * sr, 6 + R() * 30, 0.15 * sr);   // worn gaps in the line
    for (let x = 2 * sx; x < W; x += 8 * sx) { c.fillStyle = '#4a4c54'; c.fillRect(x, H - 0.3 * sr, 0.9 * sx, 0.3 * sr); c.fillStyle = '#2a2c32'; for (let k = 0; k < 6; k++) c.fillRect(x + 4 + k * 0.15 * sx, H - 0.27 * sr, 3, 0.24 * sr); }
    const mx = 13 * sx, my = yr + 3.6 * sr; c.fillStyle = '#5a5c64'; c.beginPath(); c.arc(mx, my, 0.32 * sx, 0, 7); c.fill(); c.strokeStyle = '#3a3c44'; c.lineWidth = 3; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(mx - 0.25 * sx, my + k * 7); c.lineTo(mx + 0.25 * sx, my + k * 7); c.stroke(); }
    for (let i = 0; i < 5; i++) { const x = R() * W, y = yr + R() * (H - yr); const g = c.createRadialGradient(x, y, 1, x, y, 40); g.addColorStop(0, 'rgba(40,40,50,0.25)'); g.addColorStop(1, 'rgba(40,40,50,0)'); c.fillStyle = g; c.fillRect(x - 40, y - 40, 80, 80); }
  }, { repeat: true }); }

export function buildHarbour(ctx, g) {
  const { mat, rng } = ctx, R = rng(3261);
  // ---- seawall (painted) ----
  const S = new Builder(), conc = C(0xe4e0d6);
  const face = (x0, x1) => S.quad([x0, -6, SEAWALL_Z], [x1, -6, SEAWALL_Z], [x1, WALL.top, SEAWALL_Z], [x0, WALL.top, SEAWALL_Z], [[x0 / 10, -0.9], [x1 / 10, -0.9], [x1 / 10, (WALL.top + 1.5) / 5], [x0 / 10, (WALL.top + 1.5) / 5]], conc);
  face(WALL.x0, PIER.x0 - 0.2); face(PIER.x1 + 0.2, WALL.x1);
  S.box((WALL.x0 + WALL.x1) / 2, WALL.top - 0.05, SEAWALL_Z - 1.6, WALL.x1 - WALL.x0, 0.1, 3.2, { col: C(0xd8d2c6), faces: 'py', uv: 10 });
  // wave-return parapet with a gap at the pier steps
  for (const [a, b] of [[WALL.x0, -2.4], [2.4, WALL.x1]]) { S.box((a + b) / 2, WALL.top + WALL.parapet / 2, SEAWALL_Z - 0.3, b - a, WALL.parapet, 0.6, { col: conc, uv: [10, 5], uvO: [0, 0.75] });
    S.box((a + b) / 2, WALL.top + WALL.parapet + 0.06, SEAWALL_Z - 0.15, b - a, 0.12, 0.9, { col: C(0xd2ccc0) }); }
  // steps from the deck (2.2) up to the wall top, cut into the wall
  const nSt = 6; for (let i = 0; i < nSt; i++) { const y = PIER.deckY + (i + 1) * (WALL.top - PIER.deckY) / nSt; S.box(0, (y + PIER.deckY - 0.3) / 2, SEAWALL_Z - 0.2 - i * 0.32 - 0.16, 3.6, y - PIER.deckY + 0.3, 0.32, { col: C(0xd8d2c6), faces: 'pzpy' }); }
  for (const s of [-1, 1]) S.box(s * 1.9, (PIER.deckY + WALL.top) / 2 - 0.2, SEAWALL_Z - 1.0, 0.2, WALL.top - PIER.deckY + 0.8, 2.0, { col: conc, faces: 'pxnxpz' });
  const sw = new THREE.Mesh(S.geometry(), mat.bg(0xffffff, { vertexColors: true, map: concreteTex(ctx), pig: 0.14, brush: 0.12, hiAmt: 0.2 })); sw.name = 'seawall'; g.add(sw);
  // ---- the quay surface (close-up quality for s02 / s07 / s33): asphalt road with cracks, patches, a manhole, gutter
  //      grates and worn edge lines, then the concrete apron on the wall top with its slab joints. 24 m texture tiles.
  const Q = new Builder(), qy = WALL_TOP + 0.016, ay = WALL.top + 0.006, TL = 24;
  for (let x = WALL.x0; x < WALL.x1; x += TL) { const xe = Math.min(WALL.x1, x + TL), u1 = (xe - x) / TL;
    Q.quad([x, qy, -45.2], [xe, qy, -45.2], [xe, qy, -52.0], [x, qy, -52.0], [[0, 0.5], [u1, 0.5], [u1, 1], [0, 1]]);
    for (const [a, b] of [[x, Math.min(xe, -2.1)], [Math.max(x, 2.1), xe]]) { if (b <= a) continue; const ua = (a - x) / TL, ub = (b - x) / TL;   // (open over the pier steps)
      Q.quad([a, ay, -42.62], [b, ay, -42.62], [b, ay, -45.2], [a, ay, -45.2], [[ua, 0], [ub, 0], [ub, 0.36], [ua, 0.36]]); } }
  const qm = mat.bg(0xffffff, { map: quayTex(ctx), pig: 0.1, brush: 0.06, hiAmt: 0.12, hiT: 0.7 }); qm.polygonOffset = true; qm.polygonOffsetFactor = -2; qm.polygonOffsetUnits = -2;
  const quay = new THREE.Mesh(Q.geometry(), qm); quay.name = 'quay-surface'; g.add(quay);
  // ---- breakwaters + lighthouses ----
  const Bk = new Builder(), bwc = C(0xdcd8ce);
  for (const line of BREAKWATERS) for (let i = 0; i < line.length - 1; i++) { const [a, b] = [line[i], line[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
    Bk.at((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, ang); Bk.box(0, -1.5, 0, 8, 10, L + 8, { col: bwc, uv: [10, 5] }); Bk.box(-3.2, 4.0, 0, 1.6, 1.4, L + 8, { col: C(0xd0ccc2), uv: [10, 5] }); Bk.pop(); }
  const lh = (x, z, col) => { const y = 3.5; Bk.cyl(x, y, z, 1.5, 1.2, 8.5, { n: 18, col }); Bk.cyl(x, y + 8.5, z, 1.8, 1.8, 0.25, { n: 18, col: C(0xf4f2ee) }); Bk.cyl(x, y + 8.75, z, 0.8, 0.8, 1.2, { n: 12, col: C(0xcfe8ee) });
    Bk.cyl(x, y + 9.95, z, 1.05, 0.15, 0.9, { n: 12, col }); for (let k = 0; k < 3; k++) Bk.box(x + Math.cos(k * 2.1) * 1.21, y + 2 + k * 2.2, z + Math.sin(k * 2.1) * 1.21, 0.5, 0.7, 0.5, { col: C(0x2a3040) }); };
  lh(175, 112, C(0xd83a2e)); lh(112, 38, C(0xf6f4ee));
  const bk = new THREE.Mesh(Bk.geometry(), mat.bg(0xffffff, { vertexColors: true, map: concreteTex(ctx), pig: 0.12, brush: 0.1, hiAmt: 0.35 })); bk.name = 'breakwaters'; g.add(bk);
  // ---- tetrapods (instanced) at the wall foot (left) and on the breakwaters' sea side ----
  const tg = new THREE.BufferGeometry(); { const parts = []; const dirs = [[0, 1, 0], [0.943, -0.333, 0], [-0.471, -0.333, 0.816], [-0.471, -0.333, -0.816]];
    for (const d of dirs) { const c = new THREE.CylinderGeometry(0.22, 0.42, 1.1, 8).translate(0, 0.55, 0); c.lookAt(new THREE.Vector3(...d)); c.rotateX(0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d)); c.applyQuaternion(q); parts.push(c.toNonIndexed()); }
    const P = []; for (const p of parts) P.push(...p.attributes.position.array); tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.computeVertexNormals(); }
  const tps = [];
  for (let x = WALL.x0 + 4; x < -120; x += 2.2 + R() * 1.2) for (let r = 0; r < 2; r++) tps.push([x + R(), -0.4 + r * 1.3 + R() * 0.5, SEAWALL_Z + 2.0 + r * 1.8 + R() * 1.6, 2.3 + R() * 0.5]);
  for (let z = -30; z < 100; z += 2.4 + R()) tps.push([305 + R() * 3, -0.2 + R() * 0.8, z, 2.4 + R() * 0.4]);
  for (let x = 172; x < 298; x += 2.4 + R()) tps.push([x, -0.2 + R() * 0.8, 117.5 + R() * 3, 2.4 + R() * 0.4]);
  const tim = new THREE.InstancedMesh(tg, mat.bg(0xe2ded4, { pig: 0.2, brush: 0.14, hiAmt: 0.3 }), tps.length), m4 = new THREE.Matrix4();
  tps.forEach(([x, y, z, s], i) => { m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)), new THREE.Vector3(s, s, s)); tim.setMatrixAt(i, m4); });
  tim.name = 'tetrapods'; g.add(tim);
  // solids: the quay wall + breakwaters
  const wallSolid = new THREE.Mesh(new THREE.BoxGeometry(WALL.x1 - WALL.x0, 10, 3.2)); wallSolid.position.set((WALL.x0 + WALL.x1) / 2, -1.5, SEAWALL_Z - 1.6); wallSolid.visible = true; wallSolid.userData.solidProxy = true;
  wallSolid.material.colorWrite = false; wallSolid.material.depthWrite = false; wallSolid.layers.set(31); g.add(wallSolid);
  ctx.solids.add('seawall', wallSolid, { group: 'world-static', groups: ['coast'] });
  return { seawall: sw, breakwaters: bk, tetrapods: tim };
}

// ---------------------------------------------------------------------------------------------------------------------
// the pier: cel near (inked), painted twin far
export function buildPier(ctx, g) {
  const { mat, rng } = ctx, R = rng(3270);
  const near = new THREE.Group(); near.name = 'pier-near'; g.add(near);
  const ids = { plank: mat.nextId(), beam: mat.nextId(), pile: mat.nextId(), iron: mat.nextId(), ladder: mat.nextId(), curb: mat.nextId() };
  const wood = mat.cel(0xffffff, { id: ids.plank, vertexColors: true, bevel: 0.03, hiAmt: 0.45, hiT: 0.7, spec: 0.1 });
  const beamM = mat.cel(0x8a6648, { id: ids.beam, hiAmt: 0.3, spec: 0.05 }), curbM = mat.cel(0xa07a54, { id: ids.curb, hiAmt: 0.4, spec: 0.05 });
  const pileM = mat.cel(0xffffff, { id: ids.pile, vertexColors: true, hiAmt: 0.3, spec: 0.05 });
  const iron = mat.cel(0x3c404c, { id: ids.iron, spec: 0.7, specThr: 0.96, hiAmt: 0.6, hiT: 0.55, bevel: 0.05 }), ladM = mat.cel(0x505664, { id: ids.ladder, spec: 0.6, hiAmt: 0.5, bevel: 0.02 });
  const { deckY, x0, x1, z0, z1 } = PIER;
  // planks across the pier
  const P = new Builder(); let z = z1; let n = 0;
  while (z > z0 + 0.05) { const w = 0.235 + R() * 0.02, top = deckY + (R() - 0.5) * 0.006, c = C(0xc49a6a).multiplyScalar(0.86 + R() * 0.2).lerp(C(0xa8a0a0), R() * 0.25);
    P.box(R() * 0.03 - 0.015, top - 0.03, z - w / 2, x1 - x0 + (R() - 0.5) * 0.04, 0.06, w - 0.016, { col: c }); z -= w; n++; }
  const planks = new THREE.Mesh(P.geometry(), wood); planks.name = 'pier-planks'; near.add(planks);
  // stringers, pile caps, piles, braces, curbs
  const Bm = new Builder(), Pl = new Builder(), Cb = new Builder();
  for (const s of [-1, 1]) Bm.box(s * 1.05, deckY - 0.06 - 0.14, (z0 + z1) / 2, 0.22, 0.28, z1 - z0, {});
  Bm.box(0, deckY - 0.06 - 0.14, (z0 + z1) / 2, 0.22, 0.28, z1 - z0, {});
  const piles = [];
  for (let zz = -0.25; zz > z0 + 0.5; zz -= 3) {
    Bm.box(0, deckY - 0.34 - 0.15, zz, 3.4, 0.3, 0.3, {});
    for (const s of [-1, 1]) { const px = s * 1.38; piles.push([px, zz, 0.16]);
      const seg = 10; for (let k = 0; k < seg; k++) { const y0 = -4 + k * (deckY - 0.64 + 4) / seg, y1 = y0 + (deckY - 0.64 + 4) / seg, mid = (y0 + y1) / 2;
        const col = mid < -0.2 ? C(0x3e4a3c) : mid < 0.5 ? C(0x5a5440) : C(0x86684e).multiplyScalar(0.92 + R() * 0.1); Pl.cyl(px, y0, zz, 0.16, 0.16, y1 - y0, { n: 12, col, cap: false }); } }
    if (zz < -1) { for (const [a, b] of [[-1, 1], [1, -1]]) Bm.tube([[a * 1.3, deckY - 0.7, zz + 0.12], [b * 1.3, -0.3, zz + 0.12]], 0.05, { n: 6 }); }
  }
  for (const s of [-1, 1]) for (let zz = z1 - 0.6; zz > z0 + 1; zz -= 3) Cb.box(s * 1.5, deckY + 0.07, zz - 1.35, 0.16, 0.14, 2.6, {});
  // end fascia (the end face the ladder hangs on)
  Bm.box(0, deckY - 0.2, z1 - 0.06, 3.3, 0.36, 0.12, {});
  near.add(Object.assign(new THREE.Mesh(Bm.geometry(), beamM), { name: 'pier-beams' }), Object.assign(new THREE.Mesh(Pl.geometry(), pileM), { name: 'pier-piles' }), Object.assign(new THREE.Mesh(Cb.geometry(), curbM), { name: 'pier-curbs' }));
  // iron bitts (bollards): flange, waisted body, mushroom cap with a flat top (the cup sits at deckY + 0.41)
  const bitt = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.16, 0.035], [0.12, 0.05], [0.105, 0.12], [0.11, 0.28], [0.13, 0.33], [0.17, 0.355], [0.17, 0.39], [0.15, 0.41], [0, 0.41]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const bollards = PIER.bollards.map(([bx, by, bz], i) => { const m = new THREE.Mesh(bitt, iron); m.position.set(bx, by, bz); m.name = 'bollard' + i; near.add(m); return m; });
  // ladder on the end face (rails curve over the deck edge)
  const L = new Builder(), lx = PIER.ladder.x, lz = PIER.ladder.z;
  for (const o of [-0.2, 0.2]) L.tube([[lx + o, deckY + 0.005, -0.3], [lx + o, deckY + 0.03, -0.05], [lx + o, deckY - 0.02, lz + 0.05], [lx + o, deckY - 0.25, lz + 0.06], [lx + o, PIER.ladder.bottom, lz + 0.06]], 0.024, { n: 8 });
  for (const y of PIER.ladder.rungs) L.tube([[lx - 0.2, y, lz + 0.06], [lx + 0.2, y, lz + 0.06]], 0.017, { n: 6 });
  const ladder = new THREE.Mesh(L.geometry(), ladM); ladder.name = 'pier-ladder'; near.add(ladder);
  // lamp post midway (right side)
  const Lp = new Builder(); Lp.cyl(1.62, deckY - 0.3, -21, 0.06, 0.045, 4.2, { n: 10 }); Lp.tube([[1.62, deckY + 3.85, -21], [1.45, deckY + 4.1, -21], [1.15, deckY + 4.05, -21]], 0.035, { n: 6 }); Lp.cyl(1.15, deckY + 3.72, -21, 0.17, 0.08, 0.3, { n: 12 });
  const lamp = new THREE.Mesh(Lp.geometry(), ladM); near.add(lamp);
  // far twin (painted, cheap)
  const F = new Builder(); F.box(0, deckY - 0.15, (z0 + z1) / 2, 3.3, 0.3, z1 - z0, { col: C(0xb8926a) }); for (const [px, pz] of piles) F.cyl(px, -3, pz, 0.17, 0.17, deckY + 2.7, { n: 6, col: C(0x6e5a48) });
  const far = new THREE.Mesh(F.geometry(), mat.bg(0xffffff, { vertexColors: true, pig: 0.1 })); far.name = 'pier-far'; g.add(far);
  // solids
  const deckProxy = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.4, z1 - z0)); deckProxy.position.set(0, deckY - 0.2, (z0 + z1) / 2); deckProxy.material.colorWrite = false; deckProxy.material.depthWrite = false; deckProxy.layers.set(31); g.add(deckProxy);
  ctx.solids.add('pier-deck', deckProxy, { group: 'world-static', groups: ['coast'] });
  bollards.forEach((b, i) => { ctx.solids.add('bollard' + i, b, { group: 'world-static', groups: ['coast'] }); ctx.solids.allow('cup', 'bollard' + i, 0.01); });   // the cup rests on a bitt (s09-s16, s35)
  ctx.solids.add('pier-ladder', ladder, { kind: 'points', group: 'world-static', groups: ['coast'], points: 300 });
  // LOD: distance from the camera to the pier centre line
  const setLOD = (cp) => { const zc = Math.min(z1, Math.max(z0, cp.z)), d = Math.hypot(cp.x, cp.y - deckY, cp.z - zc), nearOn = d < 75; near.visible = nearOn; far.visible = !nearOn; };
  return { near, far, planks, bollards, ladder, piles, setLOD };
}

// ---------------------------------------------------------------------------------------------------------------------
// fishing boats: lofted hull + wheelhouse + mast + squid lamps + tyres + flag. Each boat = a Group posed by update().
const STRIPES = [0x2f62b8, 0xd8402e, 0x2f8f6a, 0xe6a42e, 0x2a3a78];
function hullGeometry(Lh, Wh, sheer, stripe) {
  // sections along z (stern -L/2 .. bow +L/2); rows bottom -> gunwale; crisp colour bands (duplicated rows)
  const NS = 14, out = { P: [], C: [], I: [] };
  const rows = [[-0.55, 0.0, 'keel'], [-0.32, 0.55, 'bilge'], [0.02, 0.92, 'wl'], [0.62, 1.0, 's0'], [0.82, 1.0, 's1'], [1.0, 0.98, 'top']];
  const bands = [[0, 2, C(0xc84a3a)], [2, 3, C(0xf4f2ec)], [3, 4, C(stripe)], [4, 5, C(0xf4f2ec)]];
  const sec = (u) => { const zz = -Lh / 2 + u * Lh, bow = Math.max(0, (u - 0.62) / 0.38), stern = Math.max(0, (0.08 - u) / 0.08);
    const halfW = Wh / 2 * Math.sqrt(Math.max(0, 1 - bow * bow)) * (1 - stern * 0.12), lift = sheer * bow * bow + 0.05 * stern, keelUp = 0.45 * Math.pow(bow, 2.5);
    return rows.map(([y, wk]) => { const yy = y + (y > 0.5 ? lift * (y - 0.5) / 0.5 : 0) + (y < 0 ? keelUp * (-y / 0.55) : 0); return [halfW * wk, yy, zz]; }); };
  const S = []; for (let i = 0; i <= NS; i++) S.push(sec(i / NS));
  for (const [r0, r1, col] of bands) for (const side of [-1, 1]) for (let i = 0; i < NS; i++) {
    const base = out.P.length / 3, quad = [S[i][r0], S[i + 1][r0], S[i + 1][r1], S[i][r1]];
    for (const p of quad) { out.P.push(p[0] * side, p[1], p[2]); out.C.push(col.r, col.g, col.b); }
    if (side > 0) out.I.push(base, base + 2, base + 1, base, base + 3, base + 2); else out.I.push(base, base + 1, base + 2, base, base + 2, base + 3); }
  // transom
  { const s = S[0], base = out.P.length / 3, col = C(0xf4f2ec); for (const p of [s[0], s[5], [-s[5][0], s[5][1], s[5][2]], [-s[0][0], s[0][1], s[0][2]]]) { out.P.push(...p); out.C.push(col.r, col.g, col.b); } out.I.push(base, base + 2, base + 1, base, base + 3, base + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out.P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(out.C, 3)); g.setIndex(out.I); g.computeVertexNormals();
  return { geo: g, deckAt: (u) => sec(u)[5] };
}
export const BOAT_SPOTS = [[8.6, -13, 0.12, 9.0], [17, -33.5, 1.52, 8.4], [-12.5, -27, -0.22, 8.0], [-24, -10, 0.35, 9.6], [142, -33, 1.6, 10.2], [168, -34, 1.54, 9.0], [206, -31, 1.48, 10.6], [242, -33.5, 1.6, 9.4], [278, -6, 0.06, 10.0], [150, 6, 0.55, 8.6], [60, 40, -0.4, 10.4]];
export function buildBoats(ctx, g) {
  const { mat, rng } = ctx, R = rng(3280), boats = [];
  const hullM = mat.cel(0xffffff, { id: mat.nextId(), vertexColors: true, hiAmt: 0.5, hiT: 0.7, spec: 0.25, bevel: 0.3, side: THREE.DoubleSide });
  const cabM = mat.cel(0xf6f4ee, { id: mat.nextId(), hiAmt: 0.5, spec: 0.2 }), roofMs = [0x3a5a9a, 0x5a6470, 0x2f7a8a].map(c => mat.cel(c, { id: mat.nextId(), hiAmt: 0.4 }));
  const winM = mat.cel(0x26344a, { id: mat.nextId(), spec: 0.9, specThr: 0.95, flatSpec: 0, hiAmt: 0.6, hiT: 0.4 }), deckM = mat.cel(0xb8b4a8, { id: mat.nextId(), hiAmt: 0.3 });
  const mastM = mat.cel(0xe8e6e0, { id: mat.nextId(), hiAmt: 0.4 }), tyreM = mat.cel(0x2c2c32, { id: mat.nextId(), hiAmt: 0.3, spec: 0.3 }), bulbM = mat.cel(0xf4f8ff, { id: mat.nextId(), spec: 1.0, specThr: 0.9, hiAmt: 0.8, hiT: 0.3 });
  const buoyM = mat.cel(0xf2742e, { id: mat.nextId(), hiAmt: 0.6, spec: 0.4 }), flagM = mat.cel(0xffffff, { id: mat.nextId(), side: THREE.DoubleSide, map: flagTex(ctx), hiAmt: 0.2 });
  const tyreG = new THREE.TorusGeometry(0.22, 0.09, 8, 16), bulbG = new THREE.SphereGeometry(0.11, 12, 8), buoyG = new THREE.SphereGeometry(0.22, 12, 8);
  BOAT_SPOTS.forEach(([x, z, yaw, Lh], i) => {
    const Wh = Lh * (0.25 + R() * 0.03), sheer = 0.5 + R() * 0.25, root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.name = 'boat' + i;
    const { geo, deckAt } = hullGeometry(Lh, Wh, sheer, STRIPES[i % STRIPES.length]); body.add(new THREE.Mesh(geo, hullM));
    const deck = new THREE.Mesh(new THREE.BoxGeometry(Wh * 0.86, 0.06, Lh * 0.82), deckM); deck.position.set(0, 0.72, -Lh * 0.05); body.add(deck);
    const cz = -Lh * (0.16 + R() * 0.08), cw = Wh * 0.72, ch = 1.6 + R() * 0.3, cl = Lh * 0.2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cl), cabM); cab.position.set(0, 0.75 + ch / 2, cz); body.add(cab);
    const rf = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.25, 0.1, cl + 0.35), roofMs[i % 3]); rf.position.set(0, 0.75 + ch + 0.05, cz + 0.1); body.add(rf);
    // wheelhouse: 3 front panes + 2 per side (white mullions), a rear door with its port, a life ring, an aerial,
    // a searchlight; a bow rail on stanchions; a net drum + a winch on the aft deck
    const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; body.add(o); return o; };
    const wy = 0.75 + ch * 0.7, wh = ch * 0.34;
    for (let k = -1; k <= 1; k++) add(new THREE.BoxGeometry(cw * 0.27, wh, 0.04), winM, k * cw * 0.3, wy, cz + cl / 2 + 0.01);
    for (const s of [-1, 1]) { for (const k of [-1, 1]) add(new THREE.BoxGeometry(0.04, wh, cl * 0.36), winM, s * (cw / 2 + 0.01), wy, cz + k * cl * 0.21);
      add(new THREE.TorusGeometry(0.2, 0.05, 6, 16), buoyM, s * (cw / 2 + 0.05), 0.75 + ch * 0.32, cz - cl * 0.15, Math.PI / 2); }
    add(new THREE.BoxGeometry(cw * 0.36, ch * 0.78, 0.04), deckM, cw * 0.18, 0.75 + ch * 0.42, cz - cl / 2 - 0.01);
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10).rotateX(Math.PI / 2), winM, cw * 0.18, 0.75 + ch * 0.62, cz - cl / 2 - 0.04);
    add(new THREE.CylinderGeometry(0.012, 0.018, 1.6, 5), mastM, cw * 0.35, 0.75 + ch + 0.9, cz - cl * 0.3);
    add(new THREE.CylinderGeometry(0.13, 0.1, 0.18, 10).rotateX(Math.PI / 2), mastM, -cw * 0.3, 0.75 + ch + 0.2, cz + cl * 0.3);
    { const R2 = 0.022, posts = []; for (let k = 0; k <= 5; k++) { const u = 0.5 + k * 0.088, dd = deckAt(u); posts.push(dd); }
      for (const s of [-1, 1]) { const top = posts.map(dd => new THREE.Vector3(s * (dd[0] - 0.06), dd[1] + 0.55, dd[2]));
        for (const [i, dd] of posts.entries()) add(new THREE.CylinderGeometry(R2, R2, 0.55, 5), mastM, s * (dd[0] - 0.06), dd[1] + 0.27, dd[2]);
        const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), 16, R2, 5, false), mastM); body.add(rail); } }
    add(new THREE.CylinderGeometry(0.32, 0.32, Wh * 0.5, 14).rotateZ(Math.PI / 2), roofMs[(i + 1) % 3], 0, 1.1, -Lh * 0.36);
    add(new THREE.BoxGeometry(0.45, 0.4, 0.4), tyreM, Wh * 0.18, 0.95, cz + cl / 2 + 0.55); add(new THREE.CylinderGeometry(0.14, 0.14, 0.36, 10).rotateZ(Math.PI / 2), mastM, Wh * 0.18, 1.2, cz + cl / 2 + 0.55);
    const mh = 3.4 + R(), mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, mh, 8), mastM); mast.position.set(0, 0.75 + ch + mh / 2, cz); body.add(mast);
    const yard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), mastM); yard.position.set(0, 0.75 + ch + mh * 0.75, cz); body.add(yard);
    const radar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 14), mastM); radar.position.set(0, 0.75 + ch + 0.3, cz - cl * 0.25); body.add(radar);
    // squid lamps on a line from the bow post to the mast
    const bowP = deckAt(0.97), stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 6), mastM); stem.position.set(0, bowP[1] + 0.9, bowP[2] - 0.2); body.add(stem);
    const a = new THREE.Vector3(0, bowP[1] + 1.75, bowP[2] - 0.2), b = new THREE.Vector3(0, 0.75 + ch + mh * 0.6, cz), nb = 5 + Math.floor(R() * 4), lamps = [];
    for (let k = 1; k <= nb; k++) { const p = a.clone().lerp(b, k / (nb + 1)); p.y -= Math.sin(Math.PI * k / (nb + 1)) * 0.3 + 0.18; const bl = new THREE.Mesh(bulbG, bulbM); bl.position.copy(p); body.add(bl); lamps.push(p.clone().setY(p.y + 0.18)); }
    root.userData.lampWire = { pts: [a, ...lamps, b].map(v => v.toArray()) };
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const ty = new THREE.Mesh(tyreG, tyreM); const u = 0.3 + k * 0.18, d = deckAt(u); ty.position.set(s * (d[0] + 0.05), 0.55, d[2]); ty.rotation.y = Math.PI / 2; body.add(ty); }
    for (let k = 0; k < 4; k++) { const bu = new THREE.Mesh(buoyG, buoyM); bu.position.set((R() - 0.5) * Wh * 0.5, 0.95, Lh * (0.12 + R() * 0.2)); body.add(bu); }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 6, 3), flagM); flag.position.set(0.45, 0.75 + ch + mh - 0.3, cz); body.add(flag);
    root.position.set(x, 0, z); root.rotation.y = yaw; g.add(root);
    const solid = new THREE.Mesh(new THREE.BoxGeometry(Wh, 1.6, Lh)); solid.position.set(0, 0.25, 0); solid.material.colorWrite = false; solid.material.depthWrite = false; solid.layers.set(31); body.add(solid);
    ctx.solids.add('boat' + i, solid, { group: 'boat' + i, groups: ['coast'] });
    boats.push({ root, body, flag, x, z, yaw, L: Lh, W: Wh, phase: R() * 6.28, lampPts: root.userData.lampWire.pts });
  });
  return boats;
}
function flagTex(ctx) { return ctx.kit.canvasTex(128, 80, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.fillStyle = '#e03a2e'; c.beginPath(); c.arc(W * 0.5, H * 0.5, H * 0.3, 0, 7); c.fill();
  c.fillStyle = '#2a5ab8'; c.fillRect(0, H - 12, W, 12); c.fillRect(0, 0, W, 6); }); }
