// RYŪ · WORLD hero block (owner: world): the detailed house on the quay where the cat sleeps (s02, s07, s30).
// Two storeys: dark wood siding below, cream plaster above, an engawa porch with sliding glass doors under the balcony,
// a tiled pent roof (real kawara rows: corrugated tiles, overlap steps, gutter, downspout) over the entrance where the
// cat sleeps, a balcony with a laundry pole, the main gable roof in real tile rows with stacked ridge tiles and
// onigawara, a vending machine with a made-up brand ("うみソーダ / UMI SODA"), the street pole with its transformer.
// Everything here is painted BG except the vending machine (cel, inked prop). Anchors for world-life.js.
import * as THREE from 'three';
import { Builder } from './world-geo.js';
import { ground } from './world-terrain.js';
import { HERO } from './world-town.js';

const C = (h) => new THREE.Color(h);
// kawara (S-tile) courses on a slope: the plane runs from (zTop, yTop) down to (zEave, yEave), x0..x1. Each tile is a
// convex roll + a concave pan (S profile, 0.3 m), each course overlaps the one below with a raised lip (its shaded step
// face reads as the course line), and the eave course ends in round end-caps (manju) on every roll with a stamped ring.
function tileRows(B, { x0, x1, zTop, yTop, zEave, yEave, col, R, period = 0.3, row = 0.26, seg = 10, caps = true }) {
  const dz = zEave - zTop, dy = yEave - yTop, L = Math.hypot(dz, dy), uz = dz / L, uy = dy / L;   // down-slope unit
  const ny = Math.abs(uz), nz = -uy * Math.sign(uz);                                                // up normal (y > 0)
  const nRows = Math.ceil(L / row), nT = Math.ceil((x1 - x0) / period), hump = 0.05, lip = 0.032;
  const prof = (u) => u < 0.4 ? hump * Math.sin(Math.PI * u / 0.4) : -hump * 0.3 * Math.sin(Math.PI * (u - 0.4) / 0.6);
  const P = (x, s, lift) => [x, yTop + uy * s + ny * lift, zTop + uz * s + nz * lift];
  const F = (a, b, c, d, cl) => (dz > 0 ? B.quad(d, c, b, a, undefined, cl) : B.quad(a, b, c, d, undefined, cl));
  for (let r = 0; r < nRows; r++) { const s0 = r * row, s1 = Math.min(L, s0 + row + 0.06), eave = s1 >= L - 1e-4;
    for (let t = 0; t < nT; t++) { const c = col.clone().multiplyScalar(0.9 + R() * 0.16); if (R() < 0.05) c.lerp(C(0xfff4e0), 0.15);
      for (let k = 0; k < seg; k++) { const xa = x0 + (t + k / seg) * period, xb = x0 + (t + (k + 1) / seg) * period; if (xa >= x1) break;
        const ha = prof(k / seg), hb = prof((k + 1) / seg), xe = Math.min(xb, x1);
        F(P(xa, s0, ha), P(xe, s0, hb), P(xe, s1, hb + lip), P(xa, s1, ha + lip), c);
        F(P(xa, s1, ha - 0.02), P(xe, s1, hb - 0.02), P(xe, s1, hb + lip), P(xa, s1, ha + lip), c.clone().multiplyScalar(0.5)); }   // the course step
      if (caps && eave) { const xc = x0 + (t + 0.2) * period; if (xc + 0.07 > x1) continue;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(...P(xc, L - 0.012, hump * 0.55 + lip)), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, uy, uz)), new THREE.Vector3(1, 1, 1));
        B.push(m); B.cyl(0, 0, 0, 0.068, 0.068, 0.035, { n: 16, col: c }); B.cyl(0, 0.035, 0, 0.046, 0.046, 0.008, { n: 14, col: c.clone().multiplyScalar(0.72) }); B.cyl(0, 0.043, 0, 0.02, 0.02, 0.006, { n: 10, col: c.clone().multiplyScalar(0.85) }); B.pop(); } } }
}

// an aluminium sliding window on a wall facing +z (centre x, y, wall plane z): frame + sill, two panes (the right one in
// front), dark glass with two sheen streaks, curtains pulled to the sides (2-tone folds) and a lace panel
function sashWindow(B, x, y, z, w, h, R) {
  const fr = C(0xd2d6dc), frD = C(0xa8adb6), glass = C(0x34485e), sheen = C(0x5a7a98);
  B.box(x, y, z + 0.02, w + 0.12, h + 0.12, 0.04, { col: fr }); B.box(x, y - h / 2 - 0.08, z + 0.07, w + 0.24, 0.06, 0.14, { col: C(0xe6e8ea) });
  const pw = w / 2 + 0.03;
  for (const [s, dzp] of [[-1, 0.045], [1, 0.07]]) { const px = x + s * (w / 4 - 0.015);
    B.box(px, y, z + dzp, pw, h, 0.012, { col: glass });
    B.quad([px - pw * 0.3, y - h / 2, z + dzp + 0.007], [px - pw * 0.12, y - h / 2, z + dzp + 0.007], [px + pw * 0.2, y + h / 2, z + dzp + 0.007], [px + pw * 0.02, y + h / 2, z + dzp + 0.007], undefined, sheen);
    for (const e of [-1, 1]) B.box(px + e * pw / 2, y, z + dzp + 0.01, 0.045, h, 0.03, { col: frD });
    B.box(px, y + h / 2, z + dzp + 0.01, pw, 0.045, 0.03, { col: frD }); B.box(px, y - h / 2, z + dzp + 0.01, pw, 0.045, 0.03, { col: frD }); }
  // curtains (behind the glass, gathered at the sides) + a lace panel
  const cur = [C(0xf4e2c8), C(0xf0c8c0), C(0xd8e4f0)][Math.floor(R() * 3)];
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) B.box(x + s * (w / 2 - 0.08 - k * 0.07), y + 0.02, z + 0.03, 0.07, h - 0.08, 0.01, { col: k % 2 ? cur : cur.clone().multiplyScalar(0.82) });
  B.box(x + w * 0.12, y + 0.05, z + 0.032, w * 0.3, h * 0.8, 0.005, { col: C(0xe8eef4) });
}

// the hero house plaster: cream with grime under the eave, rain streaks, mortar repair patches and hairline cracks (no
// windows: the real sash windows are geometry)
function heroPlasterTex(ctx) { const R = ctx.rng(3291);
  return ctx.kit.canvasTex(512, 512, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${150 + R() * 60},${140 + R() * 50},${135 + R() * 50},${0.03 + R() * 0.05})`; c.fillRect(R() * W, R() * H, 4 + R() * 40, 2 + R() * 10); }
    const g = c.createLinearGradient(0, 0, 0, 70); g.addColorStop(0, 'rgba(90,85,100,0.45)'); g.addColorStop(1, 'rgba(90,85,100,0)'); c.fillStyle = g; c.fillRect(0, 0, W, 70);
    for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H * 0.6, len = 60 + R() * 200; const s = c.createLinearGradient(0, y, 0, y + len); s.addColorStop(0, `rgba(95,90,100,${0.1 + R() * 0.12})`); s.addColorStop(1, 'rgba(95,90,100,0)'); c.fillStyle = s; c.fillRect(x, y, 3 + R() * 9, len); }
    for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '235,228,212' : '205,196,180'},0.6)`; c.fillRect(R() * W, R() * H, 30 + R() * 60, 20 + R() * 40); }
    c.strokeStyle = 'rgba(80,70,70,0.4)'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { let x = R() * W, y = R() * H; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 22; y += 8 + R() * 14; c.lineTo(x, y); } c.stroke(); }
    const b = c.createLinearGradient(0, H - 60, 0, H); b.addColorStop(0, 'rgba(110,105,95,0)'); b.addColorStop(1, 'rgba(110,105,95,0.35)'); c.fillStyle = b; c.fillRect(0, H - 60, W, 60);
  }, { repeat: true }); }

export function buildHero(ctx, g, { textures }) {
  const { mat, rng } = ctx, R = rng(3290);
  const HX = HERO.x, ZF = HERO.zf, W = HERO.w, D = HERO.d, YG = ground(HX, ZF - D / 2) + 0.02;
  const x0 = HX - W / 2, x1 = HX + W / 2, zB = ZF - D;
  const A = new Builder(), Bw = new Builder(), T = new Builder(), Pn = new Builder();
  const cream = C(0xf6ecd8), wood = C(0x7a5a46), trim = C(0x4a3a32), tileC = C(0x8e96a6), FH = 2.9, EH = 2 * FH + 0.25;
  // walls: ground floor wood siding (front + sides), upper floor plaster, back plaster
  Bw.box(HX + 2.6, FH / 2 - 0.6, ZF - 0.01, W - 5.2, FH + 1.2, 0.02, { col: wood, uv: [3.6, FH], faces: 'pz' });
  for (const s of [-1, 1]) Bw.box(HX + s * W / 2, FH / 2 - 0.6, ZF - D / 2, 0.02, FH + 1.2, D, { col: wood, uv: [3.6, FH], faces: s > 0 ? 'px' : 'nx' });
  A.box(HX, FH + (EH - FH) / 2, ZF - D / 2, W, EH - FH, D, { col: cream, uv: [3.6, FH], faces: 'pxnxpznz', uvO: [0.2, 0] });
  A.box(HX, FH / 2 - 0.6, zB, W, FH + 1.2, 0.02, { col: cream, uv: [3.6, FH], faces: 'nz' });
  Pn.box(HX, YG + FH + 0.05 - YG, ZF + 0.03, W + 0.04, 0.16, 0.06, { col: trim });   // floor band
  // engawa (left, under the balcony): recessed glass doors + wooden deck + step stone
  const ex0 = x0 + 0.4, ex1 = HX + 0.8, ez = ZF - 0.9;
  Pn.box((ex0 + ex1) / 2, FH / 2, ez, ex1 - ex0, FH, 0.04, { col: C(0x3a4a5c) });
  for (let i = 0; i <= 4; i++) Pn.box(ex0 + (ex1 - ex0) * i / 4, FH * 0.47, ez + 0.05, 0.07, FH * 0.94, 0.08, { col: C(0xb89a74) });
  Pn.box((ex0 + ex1) / 2, FH * 0.94, ez + 0.05, ex1 - ex0, 0.08, 0.1, { col: C(0xb89a74) }); Pn.box((ex0 + ex1) / 2, 0.42, ez + 0.05, ex1 - ex0, 0.06, 0.1, { col: C(0xb89a74) });
  for (let i = 0; i < 4; i++) { const xa = ex0 + (ex1 - ex0) * (i + 0.2) / 4; Pn.quad([xa, 0.9, ez + 0.03], [xa + 0.35, 2.55, ez + 0.03], [xa + 0.5, 2.55, ez + 0.03], [xa + 0.15, 0.9, ez + 0.03], undefined, C(0x8aa6c4)); }
  for (const s of [ex0, ex1]) Pn.box(s, FH / 2, (ez + ZF) / 2, 0.04, FH, 0.9, { col: wood });
  Pn.box((ex0 + ex1) / 2, FH - 0.02, (ez + ZF) / 2, ex1 - ex0, 0.04, 0.92, { col: C(0xc8b498) });
  Pn.box((ex0 + ex1) / 2, 0.42, ZF - 0.4, ex1 - ex0 + 0.1, 0.07, 1.0, { col: C(0xa98458) }); for (let i = 0; i < 6; i++) Pn.box(ex0 + 0.2 + i * (ex1 - ex0 - 0.4) / 5, 0.2, ZF + 0.02, 0.09, 0.4, 0.09, { col: C(0x8a6a48) });
  Pn.box(HX - 2.5, 0.1, ZF + 0.45, 0.8, 0.2, 0.45, { col: C(0xa8a4a0) });
  // entrance (right of the engawa): sliding lattice door + window with lattice
  Pn.box(HX + 1.9, 1.05, ZF + 0.02, 1.5, 2.1, 0.04, { col: C(0x5a4232) }); for (let i = 0; i < 9; i++) Pn.box(HX + 1.25 + i * 0.16, 1.05, ZF + 0.05, 0.03, 1.9, 0.03, { col: C(0xc8a878) });
  Pn.box(HX + 3.6, 1.6, ZF + 0.02, 1.4, 1.0, 0.04, { col: C(0x34465a) }); for (let i = 0; i < 8; i++) Pn.box(HX + 3.0 + i * 0.17, 1.6, ZF + 0.05, 0.03, 0.96, 0.03, { col: C(0xd4bc94) });
  Pn.box(HX + 1.9, 2.25, ZF + 0.1, 0.5, 0.14, 0.04, { col: C(0xf2eee4) });   // name plate
  Pn.box(HX + 4.3, 1.2, ZF + 0.14, 0.32, 0.4, 0.22, { col: C(0xc84038) });   // mailbox
  // pent roof over the entrance (real tiles), gutter + downspout
  const px0 = HX + 0.9, px1 = x1 + 0.25, hz0 = ZF, hz1 = ZF + 1.15, hy0 = FH + 0.2, hy1 = FH - 0.12;
  tileRows(T, { x0: px0, x1: px1, zTop: hz0, yTop: hy0, zEave: hz1, yEave: hy1, col: tileC, R });
  Pn.box((px0 + px1) / 2, hy1 - 0.02, hz1 - 0.02, px1 - px0, 0.12, 0.08, { col: trim }); Pn.quad([px1, hy1 - 0.08, hz1], [px0, hy1 - 0.08, hz1], [px0, hy0 - 0.12, hz0], [px1, hy0 - 0.12, hz0], undefined, C(0x6a5446));
  Pn.tube([[px0, hy1 - 0.05, hz1 + 0.07], [px1, hy1 - 0.08, hz1 + 0.07]], 0.06, { n: 8, col: C(0x8a94a4) }); Pn.tube([[px1 - 0.05, hy1 - 0.08, hz1 + 0.07], [px1 - 0.05, hy1 - 0.3, hz1 - 0.6], [px1 - 0.05, 0.05, hz1 - 0.95]], 0.035, { n: 6, col: C(0x8a94a4) });
  Pn.box(px0 - 0.02, (hy0 + hy1) / 2, (hz0 + hz1) / 2, 0.06, 0.2, 1.15, { col: trim });
  // balcony over the engawa: slab, railing bars + rail, laundry pole + supports, AC unit, sliding door upstairs
  const bx0 = x0 + 0.25, bx1 = HX + 0.75, by = FH + 0.12, bz1 = ZF + 1.05;
  Pn.box((bx0 + bx1) / 2, by, (ZF + bz1) / 2, bx1 - bx0, 0.16, bz1 - ZF, { col: C(0xd8d2c8) });
  for (let x = bx0 + 0.05; x <= bx1; x += 0.12) Pn.box(x, by + 0.55, bz1 - 0.03, 0.022, 0.95, 0.022, { col: C(0xe8eaee) });
  for (const s of [bx0, bx1]) for (let z = ZF + 0.1; z < bz1; z += 0.12) Pn.box(s, by + 0.55, z, 0.022, 0.95, 0.022, { col: C(0xe8eaee) });
  Pn.box((bx0 + bx1) / 2, by + 1.04, bz1 - 0.03, bx1 - bx0 + 0.04, 0.05, 0.06, { col: C(0xdfe2e6) });
  for (const s of [bx0 + 0.15, bx1 - 0.15]) Pn.box(s, by + 0.9, bz1 - 0.12, 0.04, 1.0, 0.04, { col: C(0xb0b4bc) });
  Pn.tube([[bx0 + 0.05, by + 1.78, bz1 - 0.12], [bx1 - 0.05, by + 1.78, bz1 - 0.12]], 0.022, { n: 8, col: C(0x9ac0e0) });
  Pn.box(bx1 - 0.6, by + 0.38, ZF + 0.3, 0.8, 0.6, 0.3, { col: C(0xe6e6e2) }); Pn.cyl(bx1 - 0.6, by + 0.38, ZF + 0.46, 0.2, 0.2, 0.01, { n: 14, col: C(0x7a7a84) });
  sashWindow(Pn, (bx0 + bx1) / 2 - 0.4, by + 1.1, ZF, 3.0, 1.95, R);   // the balcony sliding door
  // upstairs window above the pent roof: aluminium sash (two sliding panes, the right one in front), sill, curtains
  sashWindow(Pn, HX + 3.0, FH + 1.55, ZF, 2.2, 1.2, R);
  // weathering + services on the front wall: drainpipes at both corners, the outdoor AC unit on its bracket with its pipe,
  // the electricity meter box by the entrance, the gas meter, a rain-stained hood over the small side window
  const pipeC = C(0xb8bcc2);
  { const xx = x0 + 0.12; Pn.tube([[xx, EH - 0.05, ZF + 0.62], [xx, EH - 0.3, ZF + 0.12], [xx, 0.05, ZF + 0.12]], 0.045, { n: 8, col: pipeC });
    for (let y = 0.6; y < EH - 0.4; y += 1.3) Pn.box(xx, y, ZF + 0.07, 0.12, 0.04, 0.1, { col: C(0x9a9ea6) }); }
  { const zz = zB + 0.12; Pn.tube([[x1 + 0.6, EH - 0.05, zz - 0.62], [x1 + 0.12, EH - 0.3, zz], [x1 + 0.12, 0.05, zz]], 0.045, { n: 8, col: pipeC }); }
  const acx = HX + 4.45, acy = FH + 2.25; Pn.box(acx, acy, ZF + 0.2, 0.62, 0.5, 0.26, { col: C(0xecebe6) }); Pn.cyl(acx - 0.06, acy, ZF + 0.335, 0.17, 0.17, 0.008, { n: 16, col: C(0x6e7078) });
  for (let k = -3; k <= 3; k++) Pn.box(acx - 0.06, acy + k * 0.045, ZF + 0.345, 0.34, 0.012, 0.01, { col: C(0xdcdad4) });
  Pn.box(acx, acy - 0.29, ZF + 0.16, 0.66, 0.035, 0.3, { col: C(0x8a8c92) }); Pn.tube([[acx + 0.25, acy - 0.1, ZF + 0.08], [acx + 0.35, acy - 0.1, ZF + 0.06], [acx + 0.35, FH + 0.9, ZF + 0.06], [acx - 0.6, FH + 0.9, ZF + 0.06]], 0.03, { n: 6, col: C(0xf0eee8) });
  Pn.box(HX + 2.9, 1.75, ZF + 0.08, 0.32, 0.42, 0.12, { col: C(0xd4d6d8) }); Pn.cyl(HX + 2.9, 1.8, ZF + 0.14, 0.07, 0.07, 0.012, { n: 12, col: C(0x3c4654) }).box(HX + 2.9, 1.6, ZF + 0.145, 0.2, 0.05, 0.01, { col: C(0x2a2e36) });
  Pn.box(HX + 4.55, 0.55, ZF + 0.09, 0.3, 0.36, 0.16, { col: C(0xe2dccc) }); Pn.tube([[HX + 4.55, 0.73, ZF + 0.1], [HX + 4.55, 1.0, ZF + 0.1], [HX + 4.9, 1.0, ZF + 0.1]], 0.02, { n: 5, col: C(0xd8b030) });
  // window laundry brackets under the upstairs window (monohoshi arms) + their pole
  const wpx0 = HX + 1.55, wpx1 = HX + 3.35, wpy = FH + 0.86, wpz = ZF + 0.56;
  for (const x of [wpx0 + 0.1, wpx1 - 0.1]) { Pn.box(x, wpy - 0.02, ZF + 0.29, 0.04, 0.04, 0.58, { col: C(0xb4b8c0) }); Pn.box(x, wpy - 0.17, ZF + 0.1, 0.04, 0.3, 0.04, { col: C(0xb4b8c0) });
    Pn.tube([[x, wpy - 0.3, ZF + 0.03], [x, wpy - 0.02, wpz]], 0.012, { n: 5, col: C(0xb4b8c0) }); }
  Pn.tube([[wpx0, wpy + 0.02, wpz], [wpx1, wpy + 0.02, wpz]], 0.02, { n: 8, col: C(0x9ac0e0) });
  // main gable roof (real tile rows), fascia, barge boards, ridge stack, onigawara
  const ov = 0.55, ovg = 0.45, pitch = 0.5, ye = EH - ov * pitch, yr = EH + (D / 2) * pitch, zc = ZF - D / 2;
  tileRows(T, { x0: x0 - ovg, x1: x1 + ovg, zTop: zc, yTop: yr, zEave: ZF + ov, yEave: ye, col: tileC, R });
  tileRows(T, { x0: x0 - ovg, x1: x1 + ovg, zTop: zc, yTop: yr, zEave: zB - ov, yEave: ye, col: tileC, R });
  for (const s of [-1, 1]) { const zz = s > 0 ? ZF + ov : zB - ov; Pn.box(HX, ye - 0.08, zz, W + 2 * ovg, 0.2, 0.1, { col: trim });
    Pn.quad([x1 + ovg, ye - 0.12, zz], [x0 - ovg, ye - 0.12, zz], [x0 - ovg, yr - 0.25, zc], [x1 + ovg, yr - 0.25, zc], undefined, C(0x5c4a40)); }
  for (const s of [-1, 1]) { const xx = s > 0 ? x1 + ovg : x0 - ovg; A.tri([HX + s * W / 2, EH, ZF], [HX + s * W / 2, EH, zB], [HX + s * W / 2, yr, zc], [0, 2], [2.2, 2], [1.1, 3], cream);
    for (const zz of [ZF + ov, zB - ov]) Pn.tube([[xx, ye - 0.02, zz], [xx, yr + 0.02, zc]], 0.07, { n: 4, col: trim }); }
  for (let k = 0; k < 3; k++) Pn.box(HX, yr + 0.06 + k * 0.07, zc, W + 2 * ovg - 0.3 - k * 0.1, 0.07, 0.42 - k * 0.06, { col: tileC.clone().multiplyScalar(0.82 + k * 0.06) });
  Pn.tube([[x0 - ovg + 0.2, yr + 0.3, zc], [x1 + ovg - 0.2, yr + 0.3, zc]], 0.11, { n: 10, col: tileC.clone().multiplyScalar(0.9) });
  for (const s of [-1, 1]) { const xx = HX + s * (W / 2 + ovg - 0.1); Pn.box(xx, yr + 0.38, zc, 0.22, 0.6, 0.6, { col: tileC.clone().multiplyScalar(0.75) }); Pn.cyl(xx, yr + 0.62, zc, 0.3, 0.06, 0.2, { n: 10, col: tileC.clone().multiplyScalar(0.75) }); }
  // meshes: shift the local (YG-relative) builders up by YG
  const lift = new THREE.Matrix4().makeTranslation(0, YG, 0), out = new THREE.Group(); out.name = 'hero-house'; g.add(out);
  const add = (b, m, name) => { const geo = b.geometry(); geo.applyMatrix4(lift); const me = new THREE.Mesh(geo, m); me.name = name; out.add(me); return me; };
  add(A, mat.bg(0xffffff, { vertexColors: true, map: heroPlasterTex(ctx), pig: 0.14, brush: 0.1, hiAmt: 0.15 }), 'hero-plaster');
  add(Bw, mat.bg(0xffffff, { vertexColors: true, map: textures.B, pig: 0.14, brush: 0.1, hiAmt: 0.1 }), 'hero-wood');
  add(T, mat.bg(0xffffff, { vertexColors: true, hi: 0xfff2de, pig: 0.14, brush: 0.1, hiAmt: 0.6, hiT: 0.55, soft: 0.015, cool: 0.55 }), 'hero-tiles');   // silver kawara, warm sun bounce
  add(Pn, mat.bg(0xffffff, { vertexColors: true, pig: 0.12, brush: 0.08, hiAmt: 0.3, side: THREE.DoubleSide }), 'hero-detail');

  // vending machine (cel prop): body, lit display with cans, logo band, buttons, coin plate, dispenser; recycle bin
  const vend = new THREE.Group(); vend.name = 'vending'; const VW = 1.0, VH = 1.83, VD = 0.72;
  const vBody = mat.cel(0x2f78c8, { id: mat.nextId(), hiAmt: 0.5, hiT: 0.6, spec: 0.4, bevel: 0.03 }), vWhite = mat.cel(0xf2f4f6, { id: mat.nextId(), hiAmt: 0.4 });
  const vDisp = mat.cel(0xffffff, { id: mat.nextId(), map: vendTex(ctx), emissive: 0xfff6e8, emisK: 0.55, hiAmt: 0.2, keyK: 0.6 }), vDark = mat.cel(0x23262e, { id: mat.nextId() });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); vend.add(b); return b; };
  box(VW, VH, VD, vBody, 0, VH / 2, 0); box(VW * 0.86, VH * 0.5, 0.04, vDisp, 0, VH * 0.66, VD / 2 + 0.01); box(VW + 0.02, 0.06, VD + 0.02, vWhite, 0, VH + 0.03, 0);
  box(VW * 0.62, 0.22, 0.06, vDark, -0.08, 0.32, VD / 2 + 0.02); box(0.16, 0.42, 0.04, vWhite, 0.36, 0.86, VD / 2 + 0.02); box(0.04, 0.12, 0.02, vDark, 0.36, 0.94, VD / 2 + 0.05);
  const vx = x1 + 1.15, vz = ZF + 0.05; vend.position.set(vx, YG, vz); g.add(vend);
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.7, 16), mat.cel(0x2f8ad0, { id: mat.nextId(), hiAmt: 0.5 })); bin.position.set(vx + 0.75, YG + 0.35, vz + 0.1); g.add(bin);
  ctx.solids.add('vending', vend, { group: 'world-static', groups: ['coast'] });
  return { group: out, vend, YG, x0, x1, ZF, zB, EH, FH,
    pent: { x0: px0, x1: px1, z0: hz0, y0: YG + hy0, z1: hz1, y1: YG + hy1 },
    balcony: { x0: bx0, x1: bx1, y: YG + by, z0: ZF, z1: bz1, pole: { y: YG + by + 1.78, z: bz1 - 0.12 } },
    winPole: { x0: wpx0, x1: wpx1, y: YG + wpy + 0.02, z: wpz },
    furin: [HX + 2.4, YG + ye - 0.06, ZF + ov - 0.2], roof: { ye: YG + ye, yr: YG + yr, zc, zEave: ZF + ov } };
}

function vendTex(ctx) { return ctx.kit.canvasTex(256, 320, (c, W, H) => {
  c.fillStyle = '#eef6ff'; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, 70); g.addColorStop(0, '#34a0f0'); g.addColorStop(1, '#1f6cc8'); c.fillStyle = g; c.fillRect(0, 0, W, 70);
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= W; x += 4) c.lineTo(x, 56 + 5 * Math.sin(x / 14)); c.stroke();
  c.fillStyle = '#ffffff'; c.font = '700 34px "Yu Gothic", "Meiryo", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('うみソーダ', W / 2, 26);
  c.font = '700 13px sans-serif'; c.fillText('UMI SODA', W / 2, 48);
  const cols = ['#3a8af0', '#f05a4a', '#f6c23a', '#4ac07a', '#f08a3a', '#a06ae8', '#ffffff', '#5ad0e0'];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { const x = 14 + i * 39, y = 86 + r * 76, col = cols[(r * 3 + i) % cols.length];
    c.fillStyle = col; c.fillRect(x, y, 26, 46); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x + 4, y + 4, 5, 38); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 19, y, 7, 46);
    c.fillStyle = '#273040'; c.fillRect(x - 2, y + 50, 30, 10); c.fillStyle = r === 1 && i === 2 ? '#5aff8a' : '#ff5a4a'; c.fillRect(x + 6, y + 52, 14, 5); }
}); }
