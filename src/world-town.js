// RYŪ · WORLD town (owner: world): ~600 procedural Japanese houses (kawara gable / hip / pent roofs, plaster, wood
// siding and mortar walls, balconies with laundry, shop awnings, TV antennas), telephone poles with sagging wires, the
// shrine on the hill (vermilion torii, stone steps, lanterns, grove), the school, the fish market, and the painted town
// ground map (roads, lots, gardens, baked eave shadows). All painted BG, merged per material (a handful of draw calls).
import * as THREE from 'three';
import { Builder, catenary } from './world-geo.js';
import { ground, coast, SEAWALL_Z, WALL_TOP, fbm, sstep } from './world-terrain.js';

export const TOWN = { x0: -470, x1: 470, z0: -430, z1: -42.6 };
export const QUAY = { z0: -52, z1: -45 };
const LANES = [-82, -124, -168, -214, -264, -320].map((z, k) => (x) => z + 3 * Math.sin(x / 45 + k * 1.7));
const STREETS = [-405, -322, -248, -172, -100, 24, 98, 170, 244, 320, 400].map((x, m) => (z) => x + 3 * Math.sin(z / 40 + m));
export const HERO = { x: -42, zf: -55.5, w: 10, d: 8 };          // hero house (detailed in world-hero.js), front facing the quay
export const HERO_POLES = [-61, -30.5];                             // the two quay poles in front of it (the gulls' wire, s07)
const RESERVED = [[-48.4, -33.4, -66, -50], [-12, 18, -64, -50], [126, 256, -66, -50], [168, 312, -305, -232], [-262, -158, -440, -300], [-226, -194, -300, -150]];
const reserved = (x, z, m = 0) => RESERVED.some(([a, b, c, d]) => x > a - m && x < b + m && z > c - m && z < d + m);

const C = (h) => new THREE.Color(h);
const WALLS = [0xf6efe0, 0xfbf8f0, 0xe9e2d2, 0xf0e2c6, 0xd9e6ea, 0xe0ecd8, 0xf4e6dc, 0xe6e4e0];
const WOODS = [0x9a7458, 0x7c6050, 0x6a5a52, 0x8aa0ae, 0x9ab0a4];
const MORTAR = [0xdedad2, 0xe8e2d6, 0xcfd2d4, 0xece8dc];
const ROOFS = [0x56657c, 0x5d6a80, 0x3f60a2, 0x2f4880, 0xb25a3c, 0x9e4c36, 0x45474f, 0x3d7e8c, 0x6a7890, 0x8f5440];
const AWN = [0x2f6fc0, 0xd8483a, 0x2f9a6a, 0xe8a030, 0x7a4ab0];
const LAUNDRY = [0xffffff, 0xf8f4ea, 0xf09ab0, 0x7ab4f0, 0xf8d860, 0x9ad87a, 0xffffff, 0xe86a5a];

// ---------------------------------------------------------------------------------------------------------------------
// painted textures (white bases; the vertex colour tints them)
function wallTextures(ctx) {
  const T = (draw) => ctx.kit.canvasTex(512, 256, draw, { repeat: true });
  const glass = (c, x, y, w, h, R) => { const g = c.createLinearGradient(x, y, x + w * 0.4, y + h); g.addColorStop(0, '#5a7896'); g.addColorStop(1, '#2c3c54'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(x + w * 0.15, y + h); c.lineTo(x + w * 0.42, y); c.lineTo(x + w * 0.56, y); c.lineTo(x + w * 0.29, y + h); c.fill();
    if (R() < 0.6) { c.fillStyle = ['rgba(255,236,210,0.85)', 'rgba(250,210,215,0.8)', 'rgba(220,235,250,0.8)'][Math.floor(R() * 3)]; const cw = w * (0.2 + R() * 0.3); c.fillRect(R() < 0.5 ? x : x + w - cw, y, cw, h); } };
  const R = ctx.rng(3220);
  // rain streaks under sills / corners + grime (weathering that survives the paint pass as soft vertical washes)
  const streaks = (c, x, y, w, n, a = 0.1) => { for (let i = 0; i < n; i++) { const sx = x + R() * w, len = 20 + R() * 70; const g = c.createLinearGradient(0, y, 0, y + len); g.addColorStop(0, `rgba(90,85,95,${a + R() * a})`); g.addColorStop(1, 'rgba(90,85,95,0)'); c.fillStyle = g; c.fillRect(sx, y, 2 + R() * 7, len); } };
  // windows are big, framed, high-contrast rectangles (~1.8 m wide): they must read as windows 400 m away, not dots
  const sash = (c, x, y, w, h, frame = '#e8eaee') => { c.fillStyle = 'rgba(60,55,70,0.35)'; c.fillRect(x - 6, y + h + 2, w + 12, 7);
    c.fillStyle = frame; c.fillRect(x - 6, y - 6, w + 12, h + 12); const hw = (w - 6) / 2; glass(c, x, y, hw, h, R); glass(c, x + hw + 6, y, hw, h, R);
    c.fillStyle = frame; c.fillRect(x + hw, y, 6, h); c.fillStyle = '#f4f2ee'; c.fillRect(x - 8, y + h + 4, w + 16, 5); };
  const A = T((c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${150 + R() * 60},${140 + R() * 50},${140 + R() * 50},${0.03 + R() * 0.05})`; c.fillRect(R() * W, R() * H, 4 + R() * 40, 2 + R() * 10); }
    c.fillStyle = 'rgba(110,100,120,0.42)'; c.fillRect(0, 0, W, 12); c.fillStyle = 'rgba(110,100,120,0.18)'; c.fillRect(0, 12, W, 10);
    // bay 1: wide aluminium sliding window, bay 2: a smaller window + vent
    sash(c, 30, 46, 250, 150); streaks(c, 30, 205, 250, 6, 0.08);
    sash(c, 340, 62, 120, 110, '#d6dade'); streaks(c, 340, 180, 120, 3, 0.08);
    c.fillStyle = '#b8b4b0'; c.beginPath(); c.arc(488, 40, 10, 0, 7); c.fill(); c.fillStyle = '#8a8690'; c.beginPath(); c.arc(488, 40, 6, 0, 7); c.fill(); });
  const B = T((c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 9) { c.fillStyle = 'rgba(60,40,30,0.35)'; c.fillRect(0, y, W, 1.5); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, y + 2, W, 2); }
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(40,30,20,${0.04 + R() * 0.08})`; c.fillRect(R() * W, R() * H, 20 + R() * 80, 3); }
    c.fillStyle = 'rgba(40,30,30,0.45)'; c.fillRect(0, 0, W, 12);
    sash(c, 40, 50, 230, 150, '#d8c8a8'); c.fillStyle = 'rgba(200,180,140,0.9)'; for (let x = 52; x < 270; x += 14) c.fillRect(x, 50, 4, 150);
    c.fillStyle = '#e6dcc8'; c.fillRect(320, 52, 150, 140); c.fillStyle = 'rgba(120,100,80,0.7)'; for (let x = 320; x <= 470; x += 30) c.fillRect(x, 52, 4, 140); for (let y = 52; y <= 192; y += 35) c.fillRect(320, y, 150, 4); });
  const Cc = T((c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { const x = R() * W; c.fillStyle = `rgba(120,120,130,${0.03 + R() * 0.05})`; c.fillRect(x, R() * H * 0.5, 2 + R() * 6, 40 + R() * 120); }
    c.fillStyle = 'rgba(100,100,115,0.3)'; c.fillRect(0, 0, W, 10);
    for (const x0 of [24, 280]) { sash(c, x0, 56, 200, 130, '#cfd4da'); streaks(c, x0, 196, 200, 5, 0.09); } });
  const roof = ctx.kit.canvasTex(256, 256, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) { const y0 = r * 64; const g = c.createLinearGradient(0, y0, 0, y0 + 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(60,60,80,0.12)'); g.addColorStop(1, 'rgba(30,30,50,0.42)'); c.fillStyle = g; c.fillRect(0, y0, W, 64);
      for (let k = 0; k < 4; k++) { const x0 = k * 64 + (r % 2) * 0; const h = c.createLinearGradient(x0, 0, x0 + 64, 0); h.addColorStop(0, 'rgba(30,30,50,0.22)'); h.addColorStop(0.35, 'rgba(255,255,255,0.18)'); h.addColorStop(0.6, 'rgba(255,255,255,0.05)'); h.addColorStop(1, 'rgba(30,30,50,0.25)'); c.fillStyle = h; c.fillRect(x0, y0, 64, 62); }
      c.fillStyle = 'rgba(25,25,40,0.5)'; c.fillRect(0, y0 + 61, W, 3); }
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '20,20,30'},${0.04 + R() * 0.06})`; c.fillRect(Math.floor(R() * 4) * 64, Math.floor(R() * 4) * 64, 64, 62); } }, { repeat: true });
  return { A, B, C: Cc, roof };
}

// ---------------------------------------------------------------------------------------------------------------------
// one house into the builders (local frame: front = +z, origin = footprint centre at ground height)
function house(B, o, R, wires) {
  const { w, d, floors, roofType, pitch, ridgeX, wallStyle, wallCol, roofCol, trim } = o;
  const FH = 2.9, eh = floors * FH + 0.25, wb = B['wall' + wallStyle];
  wb.box(0, (eh - 2.6) / 2, 0, w, eh + 2.6, d, { col: wallCol, uv: [3.6, FH], faces: 'pxnxpznz', uvO: [R() * 2, 0] });
  B.wallC.box(0, -1.575, 0, w + 0.1, 3.25, d + 0.1, { col: C(0xaaa49a), uv: [3.6, FH], faces: 'pxnxpznz', uvO: [0, 0.62] });   // stone / concrete base (slopes)
  const roofB = B.roof, plain = B.plain, dark = trim;
  if (roofType === 'flat') {
    plain.box(0, eh + 0.05, 0, w, 0.1, d, { col: C(0xa8a6a4) });
    wb.box(0, eh + 0.45, d / 2 - 0.1, w, 0.8, 0.2, { col: wallCol, uv: [3.6, FH], uvO: [0, 0.02] }); wb.box(0, eh + 0.45, -d / 2 + 0.1, w, 0.8, 0.2, { col: wallCol, uv: [3.6, FH], uvO: [0, 0.02] });
    wb.box(w / 2 - 0.1, eh + 0.45, 0, 0.2, 0.8, d, { col: wallCol, uv: [3.6, FH], uvO: [0, 0.02] }); wb.box(-w / 2 + 0.1, eh + 0.45, 0, 0.2, 0.8, d, { col: wallCol, uv: [3.6, FH], uvO: [0, 0.02] });
    if (R() < 0.7) { const tx = (R() - 0.5) * w * 0.4, tz = (R() - 0.5) * d * 0.3; plain.cyl(tx, eh + 1.3, tz, 0.75, 0.75, 1.3, { n: 12, col: C(R() < 0.5 ? 0x5a8ac0 : 0xe8e4dc) });
      for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) plain.box(tx + a, eh + 0.65, tz + b, 0.08, 1.3, 0.08, { col: C(0x6a6a72) }); }
    if (R() < 0.5) wb.box(-w * 0.25, eh + 1.2, -d * 0.2, 2.2, 2.4, 2.2, { col: wallCol, uv: [3.6, FH], uvO: [0.3, 0.1] });
    return { top: eh + 1 };
  }
  // pitched roofs: the long axis carries the ridge
  const L = ridgeX ? w : d, S = ridgeX ? d : w, ov = 0.5, ovg = 0.4;
  const X = L / 2 + ovg, Z = S / 2 + ov, ye = eh - ov * pitch, yr = eh + (S / 2) * pitch;
  const rot = ridgeX ? null : new THREE.Matrix4().makeRotationY(Math.PI / 2);
  for (const b of [roofB, plain, wb]) b.push(rot || new THREE.Matrix4());
  const sl = Math.hypot(Z, yr - ye), rc = roofCol, uvs = (x0, x1) => [[x0 / 1.2, 0], [x1 / 1.2, 0], [x1 / 1.2, sl / 1.2], [x0 / 1.2, sl / 1.2]];
  if (roofType === 'gable' || roofType === 'shed') {
    if (roofType === 'gable') {
      roofB.quad([-X, ye, Z], [X, ye, Z], [X, yr, 0], [-X, yr, 0], uvs(-X, X), rc); roofB.quad([X, ye, -Z], [-X, ye, -Z], [-X, yr, 0], [X, yr, 0], uvs(-X, X), rc);
      plain.quad([X, ye - 0.02, Z], [-X, ye - 0.02, Z], [-X, yr - 0.2, 0], [X, yr - 0.2, 0], undefined, dark); plain.quad([-X, ye - 0.02, -Z], [X, ye - 0.02, -Z], [X, yr - 0.2, 0], [-X, yr - 0.2, 0], undefined, dark);
      for (const s of [-1, 1]) wb.tri([s * L / 2, eh, s * S / 2], [s * L / 2, eh, -s * S / 2], [s * L / 2, yr, 0], [0, eh / FH], [S / 3.6, eh / FH], [S / 7.2, yr / FH], wallCol);
      plain.box(0, yr + 0.08, 0, 2 * X + 0.1, 0.24, 0.36, { col: rc.clone().multiplyScalar(0.8) });
      for (const s of [-1, 1]) { plain.quad([s * X, ye - 0.2, s * Z], [s * X, ye - 0.2, -s * Z].map((v, i) => i === 1 ? ye - 0.2 : v), [s * X, ye, -s * Z], [s * X, ye, s * Z], undefined, dark); }
      for (const s of [-1, 1]) { plain.quad([s * X, ye - 0.18, Z * 1.0], [s * X, yr - 0.18, 0], [s * X, yr + 0.02, 0], [s * X, ye + 0.02, Z], undefined, dark); plain.quad([s * X, yr - 0.18, 0], [s * X, ye - 0.18, -Z], [s * X, ye + 0.02, -Z], [s * X, yr + 0.02, 0], undefined, dark); }
    } else {
      const yb = eh + S * pitch * 0.9;
      roofB.quad([-X, ye, Z], [X, ye, Z], [X, yb, -Z], [-X, yb, -Z], uvs(-X, X), rc); plain.quad([X, ye - 0.02, Z], [-X, ye - 0.02, Z], [-X, yb - 0.2, -Z], [X, yb - 0.2, -Z], undefined, dark);
      for (const s of [-1, 1]) wb.quad(...(s > 0 ? [[L / 2, eh, S / 2], [L / 2, eh, -S / 2], [L / 2, yb, -S / 2], [L / 2, eh, S / 2]] : [[-L / 2, eh, -S / 2], [-L / 2, eh, S / 2], [-L / 2, eh, S / 2], [-L / 2, yb, -S / 2]]), undefined, wallCol);
      wb.box(0, (eh + yb) / 2, -S / 2 + 0.01, L, yb - eh, 0.02, { col: wallCol, uv: [3.6, 2.9], faces: 'nz' });
    }
    plain.box(0, ye - 0.08, Z - 0.05, 2 * X, 0.2, 0.12, { col: dark });
    if (roofType === 'gable') plain.box(0, ye - 0.08, -Z + 0.05, 2 * X, 0.2, 0.12, { col: dark });
  } else {   // hip
    const rx = Math.max(0.3, X - Z);
    roofB.quad([-X, ye, Z], [X, ye, Z], [rx, yr, 0], [-rx, yr, 0], uvs(-X, X), rc); roofB.quad([X, ye, -Z], [-X, ye, -Z], [-rx, yr, 0], [rx, yr, 0], uvs(-X, X), rc);
    roofB.tri([-X, ye, -Z], [-X, ye, Z], [-rx, yr, 0], [-Z / 1.2, 0], [Z / 1.2, 0], [0, sl / 1.2], rc); roofB.tri([X, ye, Z], [X, ye, -Z], [rx, yr, 0], [-Z / 1.2, 0], [Z / 1.2, 0], [0, sl / 1.2], rc);
    plain.quad([X, ye - 0.02, Z], [-X, ye - 0.02, Z], [-X, ye - 0.02, -Z], [X, ye - 0.02, -Z], undefined, dark);
    plain.box(0, yr + 0.07, 0, 2 * rx + 0.3, 0.22, 0.34, { col: rc.clone().multiplyScalar(0.8) });
    plain.box(0, ye - 0.08, 0, 2 * X, 0.18, 2 * Z, { col: dark, faces: 'pxnxpznz' });
  }
  for (const b of [roofB, plain, wb]) b.pop();
  // pent roof over the ground floor (front), balcony with laundry, awning, AC unit, antenna
  if (floors >= 2 && R() < 0.55) { const pw = w * (0.55 + 0.4 * R()), px = (R() - 0.5) * (w - pw), y0 = FH + 0.15, dz = 0.85;
    roofB.quad([px - pw / 2, y0 - dz * 0.35, d / 2 + dz], [px + pw / 2, y0 - dz * 0.35, d / 2 + dz], [px + pw / 2, y0, d / 2], [px - pw / 2, y0, d / 2], [[0, 0], [pw / 1.2, 0], [pw / 1.2, 0.8], [0, 0.8]], roofCol);
    plain.box(px, y0 - dz * 0.35 - 0.06, d / 2 + dz - 0.04, pw, 0.14, 0.1, { col: dark }); plain.quad([px + pw / 2, y0 - dz * 0.35 - 0.1, d / 2 + dz], [px - pw / 2, y0 - dz * 0.35 - 0.1, d / 2 + dz], [px - pw / 2, y0 - 0.12, d / 2], [px + pw / 2, y0 - 0.12, d / 2], undefined, dark); }
  if (floors >= 2 && R() < 0.42) { const bw = 2.6 + R() * 2.2, bx = (R() - 0.5) * (w - bw), by = FH + 0.05;
    plain.box(bx, by, d / 2 + 0.45, bw, 0.14, 0.9, { col: C(0xd8d4cc) });
    plain.box(bx, by + 0.55, d / 2 + 0.88, bw, 0.95, 0.06, { col: C(R() < 0.5 ? 0xe4e6ea : 0xa8b4bc) });
    for (const s of [-1, 1]) plain.box(bx + s * bw / 2, by + 0.55, d / 2 + 0.45, 0.06, 0.95, 0.9, { col: C(0xd0d4d8) });
    const nL = 2 + Math.floor(R() * 4); for (let i = 0; i < nL; i++) { const lx = bx - bw / 2 + 0.35 + (bw - 0.7) * (i + R() * 0.3) / nL, lh = 0.5 + R() * 0.5, lw = 0.35 + R() * 0.4;
      plain.quad([lx - lw / 2, by + 1.85 - lh, d / 2 + 0.6], [lx + lw / 2, by + 1.85 - lh, d / 2 + 0.6], [lx + lw / 2, by + 1.85, d / 2 + 0.6], [lx - lw / 2, by + 1.85, d / 2 + 0.6], undefined, C(LAUNDRY[Math.floor(R() * LAUNDRY.length)])); }
    plain.box(bx, by + 1.88, d / 2 + 0.6, bw, 0.04, 0.04, { col: C(0x8a8a90) }); }
  if (o.awning) { const aw = w * 0.8; plain.quad([-aw / 2, 2.35, d / 2 + 1.3], [aw / 2, 2.35, d / 2 + 1.3], [aw / 2, 2.9, d / 2], [-aw / 2, 2.9, d / 2], undefined, C(AWN[Math.floor(R() * AWN.length)]));
    plain.quad([aw / 2, 2.35, d / 2 + 1.3], [-aw / 2, 2.35, d / 2 + 1.3], [-aw / 2, 2.05, d / 2 + 1.3], [aw / 2, 2.05, d / 2 + 1.3].map((v, i) => v), undefined, C(0xf4f0e8)); }
  if (R() < 0.5) { const side = R() < 0.5 ? -1 : 1; plain.box(side * (w / 2 + 0.2), 0.35, d * (R() - 0.5) * 0.6, 0.35, 0.65, 0.8, { col: C(0xe2e2e0) }); }
  if (roofType !== 'flat' && R() < 0.4 && wires) { const ax = (R() - 0.5) * w * 0.4, top = o.y + eh + (ridgeX ? (d / 2) * pitch : (w / 2) * pitch);
    const pt = (lx, ly, lz) => { const v = new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), o.rot); return [o.x + v.x, ly, o.z + v.z]; };
    wires.push({ pts: [pt(ax, top, 0), pt(ax, top + 2.6, 0)], r: 0.025 });
    for (const [hy, hw] of [[2.4, 0.9], [2.0, 0.7], [1.6, 0.55]]) wires.push({ pts: [pt(ax - hw, top + hy, 0.2), pt(ax + hw, top + hy, 0.2)], r: 0.012 }); }
  return { top: eh + 2 };
}

// ---------------------------------------------------------------------------------------------------------------------
export function buildTown(ctx, g) {
  const { mat, rng } = ctx, R = rng(3230);
  const tx = wallTextures(ctx);
  const B = { wallA: new Builder(), wallB: new Builder(), wallC: new Builder(), roof: new Builder(), plain: new Builder() };
  const houses = [], wires = [], lots = [];
  const place = (o) => {
    const sn = Math.sin(o.rot), cs = Math.cos(o.rot), gp = (lx, lz) => ground(o.x + lx * cs + lz * sn, o.z - lx * sn + lz * cs);
    const y = Math.max(gp(-0.45 * o.w, -0.45 * o.d), gp(0.45 * o.w, -0.45 * o.d), gp(0, 0)) + 0.05;
    o.y = y; for (const b of Object.values(B)) b.at(o.x, y, o.z, o.rot);
    const r = house(B, o, R, wires); for (const b of Object.values(B)) b.pop(); houses.push({ ...o, top: y + r.top }); lots.push(o);
  };
  const mk = (x, z, w, d, extra = {}) => {
    for (const k of Object.keys(extra)) if (extra[k] === undefined) delete extra[k];
    const floors = extra.floors ?? (R() < 0.3 ? 1 : R() < 0.72 ? 2 : 3), conc = floors >= 4 || (floors === 3 && R() < 0.6);
    const wallStyle = conc ? 'C' : R() < 0.24 ? 'B' : 'A';
    const wallCol = C(wallStyle === 'A' ? WALLS[Math.floor(R() * WALLS.length)] : wallStyle === 'B' ? WOODS[Math.floor(R() * WOODS.length)] : MORTAR[Math.floor(R() * MORTAR.length)]);
    const roofType = conc ? 'flat' : R() < 0.56 ? 'gable' : R() < 0.9 ? 'hip' : 'shed';
    const o = { x, z, w, d, rot: (R() - 0.5) * 0.06 + (extra.rot || 0), floors, roofType, pitch: 0.42 + R() * 0.16, ridgeX: R() < 0.72 || roofType === 'shed', wallStyle, wallCol,
      roofCol: C(ROOFS[Math.floor(R() * ROOFS.length)]).multiplyScalar(0.92 + R() * 0.16), trim: C(R() < 0.6 ? 0x4a3e38 : 0x5c5a60), awning: false, ...extra };
    place(o);
  };
  // fill blocks: between the quay / lanes (z) and the streets (x)
  const zEdges = [(x) => QUAY.z0, ...LANES];
  for (let k = 0; k < zEdges.length; k++) {
    for (let m = 0; m < STREETS.length - 1; m++) {
      const zf = (x) => zEdges[k](x) - (k === 0 ? 0.4 : 2.4), zb = k + 1 < zEdges.length ? (x) => zEdges[k + 1](x) + 2.4 : (x) => -372 - 20 * Math.cos(x / 160);
      let x = STREETS[m](zf(0)) + 2.6 + R() * 1.5; const xe = STREETS[m + 1](zf(0)) - 2.6;
      while (x < xe - 6) {
        // footprints vary from small 1-storey cottages to the odd 4-storey apartment block (flat roof)
        const big = R() < 0.07 && k > 0, w = big ? 15 + R() * 7 : 5.6 + R() * 7.4, d = big ? 8.6 + R() * 2 : 5.8 + R() * 4.6, cx = x + w / 2; if (cx + w / 2 > xe) break;
        const front = zf(cx), back = zb(cx), depth = front - back;
        const skip = R() < 0.1 || reserved(cx, front - d / 2, w / 2 + 1.2);
        const { f0 } = coast(cx, front - d / 2); if (Math.abs(cx) > 430 - f0 * 0.15) { x += w + 2; continue; }
        if (!skip) { const sb = 0.6 + R() * 1.6; mk(cx, front - sb - d / 2, w, d, { awning: k === 0 && R() < 0.35, floors: big ? 4 : k === 0 && R() < 0.3 ? 2 : undefined });
          if (depth > 2 * d + 5 && !reserved(cx, back + d / 2 + 1, w / 2 + 1.2) && R() < 0.85) { const d2 = 6 + R() * 3; mk(cx + (R() - 0.5) * 2, back + 1 + d2 / 2, w * (0.8 + R() * 0.3), d2); } }
        x += w + 0.9 + R() * 1.7 + (R() < 0.06 ? 7 : 0);
      }
    }
  }
  // the school (3 storeys, long, white, clock) + its sports ground
  { const sx = 238, sz = -290, y = ground(sx, sz) - 0.1, b = B.wallC;
    b.at(sx, y, sz, 0.02); b.box(0, 4.6, 0, 62, 12.4, 14, { col: C(0xf4f2ec), uv: [3.6, 2.9], faces: 'pxnxpznz', uvO: [0, 0.6] }); b.pop();
    B.plain.at(sx, y, sz, 0.02); B.plain.box(0, 10.85, 0, 63, 0.3, 15, { col: C(0xb8b6b2) }); B.plain.box(0, 9.6, 7.15, 62.4, 0.25, 0.4, { col: C(0xdcdad6) }); B.plain.box(0, 6.7, 7.15, 62.4, 0.25, 0.4, { col: C(0xdcdad6) }); B.plain.box(0, 3.8, 7.15, 62.4, 0.25, 0.4, { col: C(0xdcdad6) });
    B.plain.box(0, 12.4, 7.1, 4, 3.2, 0.5, { col: C(0xf4f2ec) }); B.plain.cyl(0, 12.6, 7.36, 1.1, 1.1, 0.1, { n: 20, col: C(0xfafafa) }); B.plain.pop();
    houses.push({ x: sx, z: sz, w: 62, d: 14, y, top: y + 13 }); }
  // the fish market shed on the quay (right), blue roof, open front
  { const fx = 190, fz = -60, y = WALL_TOP; B.plain.at(fx, y, fz, 0);
    for (let i = -5; i <= 5; i++) B.plain.box(i * 11, 2.6, 4.5, 0.3, 5.2, 0.3, { col: C(0xc8c8cc) });
    B.plain.box(0, 2.6, -4.6, 112, 5.2, 0.3, { col: C(0xe6e4de) }); B.roof.at(fx, y, fz, 0);
    B.roof.quad([-57, 5.0, 5.6], [57, 5.0, 5.6], [57, 6.6, 0], [-57, 6.6, 0], [[0, 0], [95, 0], [95, 5], [0, 5]], C(0x3f6aa8)); B.roof.quad([57, 5.0, -5.6], [-57, 5.0, -5.6], [-57, 6.6, 0], [57, 6.6, 0], [[0, 0], [95, 0], [95, 5], [0, 5]], C(0x3f6aa8));
    B.roof.pop(); B.plain.box(0, 4.9, 0, 114, 0.12, 11.2, { col: C(0x5a5a62), faces: 'ny' }); B.plain.pop();
    houses.push({ x: fx, z: fz, w: 114, d: 11, y, top: y + 6.6 }); }
  const mats = {
    wallA: mat.bg(0xffffff, { vertexColors: true, map: tx.A, pig: 0.16, brush: 0.12, hiAmt: 0.15 }), wallB: mat.bg(0xffffff, { vertexColors: true, map: tx.B, pig: 0.16, brush: 0.12, hiAmt: 0.1 }),
    wallC: mat.bg(0xffffff, { vertexColors: true, map: tx.C, pig: 0.16, brush: 0.12, hiAmt: 0.15 }), roof: mat.bg(0xffffff, { vertexColors: true, map: tx.roof, pig: 0.2, brush: 0.14, hiAmt: 0.45, hiT: 0.7 }),
    plain: mat.bg(0xffffff, { vertexColors: true, pig: 0.14, brush: 0.1, hiAmt: 0.2, side: THREE.DoubleSide }) };
  const meshes = {}; for (const [k, b] of Object.entries(B)) { if (!b.count) continue; const m = new THREE.Mesh(b.geometry(), mats[k]); m.name = 'town-' + k; g.add(m); meshes[k] = m; }
  return { houses, wires, lots, meshes, textures: tx };
}

// ---------------------------------------------------------------------------------------------------------------------
// telephone poles + wires along the quay road, the lanes and a few streets. Returns { poles: [...], lines: [...] }
export function buildPoles(ctx, g, { wires, houses }) {
  const { mat, rng } = ctx, R = rng(3240), B = new Builder();
  const poles = [];
  const routes = [];
  { const xs = []; for (let x = -420; x <= 420; x += 30 + R() * 6) if ((x < -68 || x > -24) && !(x > -14 && x < 20)) xs.push(x);
    xs.push(HERO_POLES[0], HERO_POLES[1]); xs.sort((a, b) => a - b); routes.push(xs.map(x => [x, -53.6])); }
  for (const k of [0, 2, 4]) { const r = []; for (let x = -390; x <= 390; x += 34 + R() * 8) r.push([x, LANES[k](x) + 2.8]); routes.push(r); }
  for (const m of [3, 5, 7]) { const r = []; for (let z = -60; z >= -330; z -= 32 + R() * 6) r.push([STREETS[m](z) + 2.4, z]); routes.push(r); }
  const poleTop = 10.6; let heroSpan = null;
  for (const [ri, r] of routes.entries()) {
    const tops = [];
    for (const [x, z] of r) { if (ri > 0 && reserved(x, z, 1)) { tops.push(null); continue; }
      const y = ground(x, z) - 0.1; const p = { x, y, z, h: poleTop + R() * 1.2, tr: R() < 0.3 }; poles.push(p); tops.push(p); }
    // every span runs pole -> pole; the back-lane routes are tagged far (world.js hides them in the wide shots, s01)
    const far = ri > 0;
    for (let i = 0; i < tops.length - 1; i++) { const a = tops[i], b = tops[i + 1]; if (!a || !b) continue;
      const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x), L = Math.hypot(b.x - a.x, b.z - a.z);
      for (const o of [-0.55, 0, 0.55]) wires.push({ pts: catenary([a.x + side.x * o, a.y + a.h - 0.35, a.z + side.z * o], [b.x + side.x * o, b.y + b.h - 0.35, b.z + side.z * o], 0.35 + L * 0.012), r: 0.011, far });
      const tele = catenary([a.x, a.y + a.h - 2.6, a.z], [b.x, b.y + b.h - 2.6, b.z], 0.6 + L * 0.016, 24); wires.push({ pts: tele, r: 0.022, far });
      if (ri === 0 && a.x === HERO_POLES[0] && b.x === HERO_POLES[1]) heroSpan = tele;
      wires.push({ pts: catenary([a.x + side.x * 0.15, a.y + 6.2, a.z + side.z * 0.15], [b.x + side.x * 0.15, b.y + 6.2, b.z + side.z * 0.15], 0.8 + L * 0.02), r: 0.03, far }); }
    for (const p of tops) if (p) p.far = far;
  }
  // service drops: pole -> the facing wall of the nearest house, just under its eave (never onto a roof)
  for (const p of poles) { if (R() < 0.35) continue; let best = null, bd = 1e9; for (const h of houses) { const d = Math.hypot(h.x - p.x, h.z - p.z); if (d < bd && d > 4) { bd = d; best = h; } }
    if (!best || bd > 22) continue;
    const dx = p.x - best.x, dz = p.z - best.z, k = Math.min(best.w / 2 / Math.max(Math.abs(dx), 1e-3), best.d / 2 / Math.max(Math.abs(dz), 1e-3)) * 0.98;
    const ey = best.y + (best.floors ?? 2) * 2.9 - 0.35;
    wires.push({ pts: catenary([p.x, p.y + 6.0, p.z], [best.x + dx * k, Math.min(ey, p.y + 6.0), best.z + dz * k], 0.4), r: 0.009, far: p.far }); }
  // pole geometry (painted, detailed enough for the close shots)
  const grey = C(0xbab6b0), dk = C(0x55545c), yel = C(0xf2c230), blk = C(0x2a2a30);
  for (const p of poles) { B.at(p.x, p.y, p.z, Math.atan2(1, 0));
    B.cyl(0, 0, 0, 0.17, 0.11, p.h, { n: 10, col: grey });
    B.box(0, p.h - 0.35, 0, 0.12, 0.12, 1.5, { col: dk }); for (const o of [-0.55, 0, 0.55]) B.cyl(0, p.h - 0.28, o, 0.045, 0.035, 0.16, { n: 6, col: C(0xf0f0ec) });
    for (let i = 0; i < 6; i++) { const yy = 2.2 + i * 0.45, a = i % 2 ? 0 : Math.PI / 2; B.box(Math.cos(a) * 0.2, yy, Math.sin(a) * 0.2, 0.26 * Math.abs(Math.cos(a)) + 0.03, 0.03, 0.26 * Math.abs(Math.sin(a)) + 0.03, { col: dk }); }
    for (let i = 0; i < 6; i++) B.cyl(0, 0.2 + i * 0.3, 0, 0.18, 0.18, 0.15, { n: 10, col: i % 2 ? blk : yel, cap: false });
    B.box(0.18, 2.6, 0, 0.02, 0.55, 0.22, { col: C(0x3a64b0) });
    if (p.tr) { B.cyl(0.42, p.h - 3.4, 0, 0.26, 0.26, 0.95, { n: 10, col: C(0x9aa0a4) }); B.box(0.2, p.h - 3.0, 0, 0.3, 0.08, 0.08, { col: dk }); }
    B.pop(); }
  const pm = new THREE.Mesh(B.geometry(), mat.bg(0xffffff, { vertexColors: true, pig: 0.1, brush: 0.06, hiAmt: 0.4, hiT: 0.6 })); pm.name = 'poles'; g.add(pm);
  return { poles, mesh: pm, heroSpan };
}

// ---------------------------------------------------------------------------------------------------------------------
// the shrine on the hill: stone steps up the slope, stone lanterns, a vermilion myojin torii, the hall roof in the grove
export const SHRINE = { x: -210, z: -396, zBottom: -326 };
export function buildShrine(ctx, g) {
  const { mat } = ctx, B = new Builder(), V = new Builder();
  const stone = C(0xd8d2c6), stoneD = C(0x9a948e), sx = SHRINE.x;
  const yTop = ground(sx, SHRINE.z) + 0.3, yBot = ground(sx, SHRINE.zBottom);
  // a wide pale stone stair straight up the slope (reads as a line up the hill in the wide shot), posts every 9 steps
  const N = Math.round((yTop - yBot) / 0.18), run = (SHRINE.zBottom - (SHRINE.z + 6)) / N;
  for (let i = 0; i < N; i++) { const z = SHRINE.zBottom - i * run, y = yBot + (i + 1) * (yTop - yBot) / N; B.box(sx, y - 0.6, z - run / 2, 5.2, 1.2, -run + 0.02, { col: i % 2 ? stone : stone.clone().multiplyScalar(0.9) }); }
  for (const s of [-1, 1]) for (let i = 0; i < N; i += 9) { const z = SHRINE.zBottom - i * run, y = yBot + i * (yTop - yBot) / N; B.box(sx + s * 3.1, y + 0.3, z, 0.5, 1.2, 0.5, { col: stoneD }); }
  B.box(sx, yTop - 0.35, SHRINE.z + 1, 14, 0.7, 16, { col: C(0xd2c8b4) });
  for (const s of [-1, 1]) for (const zz of [SHRINE.zBottom + 2, SHRINE.z + 8]) { const y = ground(sx + s * 3.6, zz); const lx = sx + s * 3.6;
    B.box(lx, y + 0.2, zz, 0.9, 0.4, 0.9, { col: stoneD }); B.cyl(lx, y + 0.4, zz, 0.16, 0.14, 1.1, { n: 8, col: stone }); B.box(lx, y + 1.7, zz, 0.7, 0.6, 0.7, { col: stone });
    B.cyl(lx, y + 2.0, zz, 0.62, 0.05, 0.42, { n: 6, col: stoneD }); }
  // torii (vermilion + black kasagi): a great one (15 m) at the foot of the stair, clear of the grove (the wide-shot
  // landmark), and the 9 m one at the top in front of the hall
  const ver = C(0xf04a26), blk = C(0x2c2a2e);
  const torii = (tx, ty, tz, S) => {
    for (const s of [-1, 1]) { V.cyl(tx + s * 2.6 * S, ty, tz, 0.36 * S, 0.3 * S, 8.2 * S, { n: 14, col: ver }); V.cyl(tx + s * 2.6 * S, ty - 0.3, tz, 0.44 * S, 0.42 * S, 0.7 * S + 0.3, { n: 14, col: blk }); }
    V.box(tx, ty + 6.7 * S, tz, 7.6 * S, 0.42 * S, 0.42 * S, { col: ver });
    V.box(tx, ty + 8.0 * S, tz, 0.4 * S, 1.2 * S, 0.3 * S, { col: ver }); V.box(tx, ty + 7.9 * S, tz + 0.18 * S, 1.1 * S, 0.8 * S, 0.06 * S, { col: blk });
    V.box(tx, ty + 8.55 * S, tz, 8.6 * S, 0.42 * S, 0.62 * S, { col: ver });
    for (let i = -6; i < 6; i++) { const x0 = i / 6 * 5.4 * S, x1 = (i + 1) / 6 * 5.4 * S, lift = (x) => 0.22 * S * Math.pow(Math.abs(x) / (5.4 * S), 2.2), y0 = ty + 8.78 * S, y1 = ty + 9.18 * S, zz = 0.42 * S;
      V.quad([tx + x0, y0 + lift(x0), tz + zz], [tx + x1, y0 + lift(x1), tz + zz], [tx + x1, y1 + lift(x1) * 1.3, tz + zz], [tx + x0, y1 + lift(x0) * 1.3, tz + zz], undefined, blk);
      V.quad([tx + x1, y0 + lift(x1), tz - zz], [tx + x0, y0 + lift(x0), tz - zz], [tx + x0, y1 + lift(x0) * 1.3, tz - zz], [tx + x1, y1 + lift(x1) * 1.3, tz - zz], undefined, blk);
      V.quad([tx + x0, y1 + lift(x0) * 1.3, tz + zz], [tx + x1, y1 + lift(x1) * 1.3, tz + zz], [tx + x1, y1 + lift(x1) * 1.3, tz - zz], [tx + x0, y1 + lift(x0) * 1.3, tz - zz], undefined, blk);
      V.quad([tx + x1, y0 + lift(x1), tz + zz], [tx + x0, y0 + lift(x0), tz + zz], [tx + x0, y0 + lift(x0), tz - zz], [tx + x1, y0 + lift(x1), tz - zz], undefined, ver); } };
  const tz = SHRINE.z + 5.5, ty = yTop, bz = SHRINE.zBottom + 3, by = ground(sx, bz);
  torii(sx, ty, tz, 1); torii(sx, by, bz, 1.65);
  // hall: copper-green roof among the trees
  const hz = SHRINE.z - 6, hy = ground(sx, hz);
  B.box(sx, hy + 2.2, hz, 9, 4.4, 7, { col: C(0xe8dcc4) });
  B.quad([sx - 6.5, hy + 4.2, hz + 5], [sx + 6.5, hy + 4.2, hz + 5], [sx + 4.5, hy + 8, hz], [sx - 4.5, hy + 8, hz], undefined, C(0x5f9a8e));
  B.quad([sx + 6.5, hy + 4.2, hz - 5], [sx - 6.5, hy + 4.2, hz - 5], [sx - 4.5, hy + 8, hz], [sx + 4.5, hy + 8, hz], undefined, C(0x5f9a8e));
  B.tri([sx - 6.5, hy + 4.2, hz - 5], [sx - 6.5, hy + 4.2, hz + 5], [sx - 4.5, hy + 8, hz], undefined, undefined, undefined, C(0x548a80));
  B.tri([sx + 6.5, hy + 4.2, hz + 5], [sx + 6.5, hy + 4.2, hz - 5], [sx + 4.5, hy + 8, hz], undefined, undefined, undefined, C(0x548a80));
  const sm = new THREE.Mesh(B.geometry(), mat.bg(0xffffff, { vertexColors: true, pig: 0.18, brush: 0.14, side: THREE.DoubleSide })); sm.name = 'shrine'; g.add(sm);
  const vm = new THREE.Mesh(V.geometry(), mat.bg(0xffffff, { vertexColors: true, pig: 0.08, brush: 0.06, hiAmt: 0.5, hiT: 0.6, side: THREE.DoubleSide })); vm.name = 'torii'; g.add(vm);
  return { stepsTop: [sx, yTop, SHRINE.z + 6], torii: [sx, by, bz], toriiTop: [sx, ty, tz] };
}

// ---------------------------------------------------------------------------------------------------------------------
// painted town ground map (roads, lots, gardens, fields, baked shadows). Drawn on a canvas, mapped on the town patch.
export function paintGroundMap(ctx, { houses, sun = [0.3, 0.62, 0.72] }) {
  const W = 2048, H = 1024, sx = W / (TOWN.x1 - TOWN.x0), sz = H / (TOWN.z1 - TOWN.z0), R = ctx.rng(3250);
  const X = (x) => (x - TOWN.x0) * sx, Z = (z) => (TOWN.z1 - z) * sz;   // canvas y = 0 at the seawall (top), texture v flips
  return ctx.kit.canvasTex(W, H, (c) => {
    // a green town: hedges, vegetable plots and gardens between the houses (the lots + roads are painted over it)
    c.fillStyle = '#93b672'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { c.fillStyle = ['#7fae5a', '#6a9e4e', '#a4c878', '#5f9448', '#b4cc84'][i % 5]; const x = R() * W, y = R() * H; c.beginPath(); c.ellipse(x, y, 3 + R() * 14, 2 + R() * 8, R() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${R() < 0.6 ? '50,80,40' : '235,235,205'},${0.06 + R() * 0.1})`; const x = R() * W, y = R() * H; c.beginPath(); c.ellipse(x, y, 2 + R() * 10, 1 + R() * 5, R() * 3, 0, 7); c.fill(); }
    // fields at the top of the town
    for (let i = 0; i < 40; i++) { const x = R() * W, y = H * (0.82 + R() * 0.16), w = 30 + R() * 70, h = 14 + R() * 26; c.fillStyle = ['#b8d27a', '#8cbc5c', '#d8cc8a', '#a4c86c'][i % 4]; c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(90,120,50,0.35)'; c.lineWidth = 1; for (let k = 2; k < h; k += 4) { c.beginPath(); c.moveTo(x, y + k); c.lineTo(x + w, y + k); c.stroke(); } }
    // lots under / around houses (gravel, concrete, small gardens)
    for (const h of houses) { const cx = X(h.x), cz = Z(h.z), hw = (h.w / 2 + 0.9) * sx, hd = (h.d / 2 + 1.2) * sz;
      c.fillStyle = ['#d8d4ca', '#cfccc4', '#c6c4bc', '#dcd6c8'][Math.floor(R() * 4)]; c.fillRect(cx - hw, cz - hd, hw * 2, hd * 2);
      if (R() < 0.6) { c.fillStyle = ['#6fa850', '#86b85e', '#5c9446'][Math.floor(R() * 3)]; c.fillRect(cx - hw * (R() < 0.5 ? 1 : -0.5), cz - hd * 1.1, hw * 0.6, hd * 0.5); } }
    // baked shadows (sun from +z/+x: shadows fall toward -z/-x, i.e. uphill = canvas down)
    const sh = Math.hypot(sun[0], sun[2]) / sun[1], dx = -sun[0] / Math.hypot(sun[0], sun[2]), dz = -sun[2] / Math.hypot(sun[0], sun[2]);
    c.fillStyle = 'rgba(70,64,120,0.32)';
    for (const h of houses) { const len = Math.max(0, (h.top - h.y) * sh * 0.75 - 0.13 * 3), cx = X(h.x), cz = Z(h.z), hw = h.w / 2 * sx, hd = h.d / 2 * sz;
      c.beginPath(); c.moveTo(cx - hw, cz - hd); c.lineTo(cx + hw, cz - hd); c.lineTo(cx + hw + dx * len * sx, cz - hd - dz * len * sz); c.lineTo(cx - hw + dx * len * sx, cz + hd - dz * len * sz + hd * 0); c.lineTo(cx - hw, cz + hd); c.closePath(); c.fill(); }
    // roads: quay road (asphalt + white edge line), lanes, streets
    const road = (pts, w, col = '#8f949e') => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, z], i) => i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z))); c.stroke(); };
    c.fillStyle = '#d6d0c4'; c.fillRect(0, Z(-42.6), W, Z(QUAY.z1) - Z(-42.6));
    c.fillStyle = '#8c919c'; c.fillRect(0, Z(QUAY.z1), W, Z(QUAY.z0) - Z(QUAY.z1));
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(0, Z(QUAY.z0) - 4, W, 2.5); c.fillRect(0, Z(QUAY.z1) + 2, W, 2.5);
    for (let x = TOWN.x0; x < TOWN.x1; x += 6) c.fillRect(X(x), Z((QUAY.z0 + QUAY.z1) / 2) - 1, 3 * sx, 2);
    for (const L of LANES) { const pts = []; for (let x = TOWN.x0; x <= TOWN.x1; x += 8) pts.push([x, L(x)]); road(pts, 4.6 * sz, '#a4a6ac'); }
    for (const S of STREETS) { const pts = []; for (let z = QUAY.z0; z >= -380; z -= 8) pts.push([S(z), z]); road(pts, 4.2 * sx, '#a4a6ac'); }
    for (let i = 0; i < 1600; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '60,60,70' : '255,250,240'},${0.03 + R() * 0.05})`; c.fillRect(R() * W, R() * H, 2 + R() * 10, 1 + R() * 4); }
    // school ground
    c.fillStyle = '#c8a678'; c.fillRect(X(176), Z(-238), 124 * sx, 44 * sz); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.beginPath(); c.ellipse(X(238), Z(-260), 44 * sx, 15 * sz, 0, 0, 7); c.stroke();
    // shrine grove floor
    c.fillStyle = '#4f8a50'; c.beginPath(); c.ellipse(X(-210), Z(-405), 60 * sx, 40 * sz, 0, 0, 7); c.fill();
  }, { repeat: false });
}
export { LANES, STREETS, reserved };
