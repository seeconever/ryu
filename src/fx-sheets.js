// RYŪ · 龍 · water FX (owner: fx): waterfalls off the jaw and coils (s11, s12, thin in s14), tail spray wall and foam (s18), wind wake on
// the paddies (s15). Water is drawn on threes: shape at tq (the drawing clock), root re-anchored on ones so sheets stay attached.
import * as THREE from 'three';
import { WATER, PUFF, h, sat, sstep, lerp } from './fx-draw.js';
const G = 62, TAU = Math.PI * 2;

export function waterfalls(E) {
  const { W, t, tq, ctx, D, pal, sun2 } = E; if (!D) return; const T0 = ctx.cues.rise + .35; if (t < T0) return;
  const amt = t < 31 ? sstep(0, .8, t - T0) : 1 - sstep(33, 36, t) * .85, rimSide = sun2[0] >= 0 ? 1 : -1;
  const Mi = new THREE.Matrix4().copy(D.headFrame(t)).invert(), jaw = D.anchor('jaw', t).clone().applyMatrix4(Mi).toArray();
  const NT = 15, tauMax = Math.min(3.2, (t - T0) * 1.05 + .4) * (t > 33 ? .42 : 1), mats = [], pos = new THREE.Vector3(), mq = D.headFrame(tq), mn = D.headFrame(t);
  for (let i = 0; i < NT; i++) mats.push(new THREE.Matrix4().copy(D.headFrame(tq - i / (NT - 1) * tauMax)));
  // ---- the mane off the jaw
  for (let s = 0; s < 9; s++) {
    if (E.id === 's12' && Math.abs(s - 4) < 2.5) continue;   // keep the neck readable: only the outer curtain falls on s12
    const hs = h(s, 3), lx = (s - 4) * 15 + (hs - .5) * 10, lz = (h(s, 5) - .5) * 26 - 8, ly = (h(s, 7) - .5) * 8, loc = new THREE.Vector3(jaw[0] + lx, jaw[1] + ly, jaw[2] + lz), wid = (11 + 12 * h(s, 9)) * amt * (E.id === 's12' ? .55 : 1), pts = [];
    const dv = new THREE.Vector3().copy(loc).applyMatrix4(mn).sub(new THREE.Vector3().copy(loc).applyMatrix4(mq));
    for (let i = 0; i < NT; i++) { const tau = i / (NT - 1) * tauMax; pos.copy(loc).applyMatrix4(mats[i]); pts.push([pos.x + dv.x + lx * tau * .22, pos.y + dv.y - .5 * G * tau * tau, pos.z + dv.z + lz * tau * .3]); }
    W.line(pts, (u) => wid * (.32 + .68 * sstep(0, .22, u)) * (1 - .22 * u), { mode: WATER, col: pal.waterA, col2: pal.waterB, seed: h(s, 11) + .13, p1: tq * 3.1, p2: rimSide, soft: 8 });
    // spray at the broken end
    const e = pts[NT - 1]; for (let k = 0; k < 2; k++) { const dr = Math.floor(E.f / 3); W.quad([e[0] + (h(s + k, dr * .3) - .5) * 40, e[1] + h(s + k, dr * .7) * 20, e[2] + (h(s + k, dr * .5) - .5) * 40], (10 + 18 * h(s * 3 + k, 13)) * amt, { mode: PUFF, col: pal.spray, col2: pal.sprayB, seed: h(s, 15) + dr * .04, p1: sun2[0], p2: sun2[1], soft: 12 }); }
  }
  // ---- sheets off the coils
  const NC = 11, uF = (s) => .06 + (s + .5) / NC * .9;
  for (let s = 0; s < NC; s++) {
    const u = uF(s), sf = E.spineFrame(u), base = sf.p; if (base[1] < E.groundAt(base[0], base[2]) + 40) continue;
    const sd = h(s, 21) > .5 ? 1 : -1, wid = (7 + 13 * h(s, 23)) * amt, R = 42 + 22 * h(s, 25), dv = [sf.r[0] * sd * R, sf.up[1] * .25 * R, sf.r[2] * sd * R], len = Math.min(tauMax * .95, 2.6), n = 12, pts = [];
    const dn = sub(D.spine(u, t).toArray(), D.spine(u, tq).toArray());
    for (let i = 0; i < n; i++) { const tau = i / (n - 1) * len, q = D.spine(u, tq - tau).toArray(); pts.push([q[0] + dn[0] + dv[0], q[1] + dn[1] + dv[1] - .5 * G * tau * tau * .86, q[2] + dn[2] + dv[2]]); }
    W.line(pts, (x) => wid * (.08 + .92 * sstep(0, .3, x)) * (1 - .3 * x), { mode: WATER, col: pal.waterA, col2: pal.waterB, seed: h(s, 27) + .51, p1: tq * 2.7, p2: rimSide, soft: 10 });
  }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// s18: the tail tearing a wall of spray. Columns are born at quantised times where the tail was, keep rising and fall back.
export function tailSpray(E) {
  const { W, t, tq, D, pal, sun2 } = E; if (!D) return; const DT = .035, n0 = Math.floor(t / DT), rimSide = sun2[0] >= 0 ? 1 : -1, seaY = 0;
  const tailAt = (x) => D.anchor('tail', x).toArray(), headAt = (x) => D.anchor('head', x).toArray();
  for (const [src, COLS, Hmax, scale, bias] of [[tailAt, 44, 220, 1, 0], [headAt, 26, 120, .6, 300]]) for (let k = 0; k < COLS; k++) for (const sd of [-1, 1]) {
    const id = (n0 - k) * 1.0 + (sd > 0 ? .5 : 0) + bias, t0 = (n0 - k) * DT, age = t - t0; if (age < 0 || age > 1.6) continue; const p = src(t0), pp = src(t0 - .05); if (p[1] > 180) continue;
    let dx = p[0] - pp[0], dz = p[2] - pp[2], l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz * sd, nz = dx * sd, H = (Hmax * .6 + Hmax * .4 * h(id, 3)) * sstep(0, .22, age) * (1 - (age / 1.6) ** 2), W0 = (20 + 26 * h(id, 5)) * scale, off = 18 + age * 150, base = [p[0] + nx * off, seaY, p[2] + nz * off], pts = [];
    if (H < 8 || E.project(base)[2] < 60) continue;
    for (let i = 0; i < 10; i++) { const s = i / 9; pts.push([base[0] + nx * H * .5 * s * s, base[1] + H * s * (1 - .14 * s), base[2] + nz * H * .5 * s * s]); }
    W.line(pts, (u) => W0 * (.95 - .55 * u) * (1 + .18 * Math.sin(u * 6 + id)), { mode: WATER, col: pal.spray, col2: pal.waterB, seed: h(id, 7), p1: tq * 2.3, p2: rimSide, soft: 14 });
    if (h(id, 9) > .4 && E.project(pts[9])[2] > 240) W.quad(pts[9], (18 + 34 * h(id, 11)) * (1 + age * .5), { mode: PUFF, col: pal.spray, col2: pal.sprayB, seed: h(id, 13) + Math.floor(E.f / 3) * .03, p1: sun2[0], p2: sun2[1], soft: 18 });
    if (h(id, 17) > .55 && E.project(pts[9])[2] > 180) { const dp = pts[9], g = age * age * 40; W.line([[dp[0], dp[1] - g, dp[2]], [dp[0] - nx * 18, dp[1] - g + 14 * age, dp[2] - nz * 18]], (u) => 1.6 * (1 - u), { col: pal.spray, soft: 8, px: 1.8, wn: 1.6 }); }
  }
  // the foam scar on the sea behind the tail
  const A = [], B = [], LN = 36; for (let i = 0; i < LN; i++) { const c = t - i * .04, p = tailAt(c), q = tailAt(c - .03), s = 8 + i * 5.2, dx = p[0] - q[0], dz = p[2] - q[2], l = Math.hypot(dx, dz) || 1; A.push([p[0] - dz / l * s, seaY + 1.5, p[2] + dx / l * s]); B.push([p[0] + dz / l * s, seaY + 1.5, p[2] - dx / l * s]); }
  W.strip(A, B, { col: pal.foam, col2: 0xffffff, p2: .55, a: 1, soft: 0 });
}

// s15: V wake of wind over the rice: two curved bands flung outward from the head's track + flecks of torn rice
export function wake(E) {
  const { W, t, tq, D, ctx, f } = E; if (!D) return; const Y = (ctx.geo.PADDIES.y) + 3.5, NT = 40, DUR = 2.1, col = 0xf6f2b8;
  for (const sd of [-1, 1]) for (let band = 0; band < 2; band++) {
    const A = [], B = [], spread = 165 + band * 85;
    for (let i = 0; i < NT; i++) { const ta = i / (NT - 1), c = t - ta * DUR, p = D.anchor('head', c).toArray(), q = D.anchor('head', c - .05).toArray(), dx = p[0] - q[0], dz = p[2] - q[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * sd, nz = dx / l * sd, s = 16 + spread * ta ** .8 * DUR, wd = (26 + 46 * ta) * (1 - ta * .45) * (band ? .55 : 1);
      A.push([p[0] + nx * s, Y, p[2] + nz * s]); B.push([p[0] + nx * (s + wd), Y, p[2] + nz * (s + wd)]); }
    W.strip(A, B, { col: band ? 0x2f7a35 : col, col2: band ? 0x1f5a30 : 0xffffff, p2: band ? 0 : .45, a: band ? .75 : 1, soft: 0 });
  }
  // torn rice flecks kicked up along the arms
  const dr = Math.floor(f / 2); for (let i = 0; i < 70; i++) { const ta = h(i, dr * .4), sd = i % 2 ? 1 : -1, c = t - ta * DUR, p = D.anchor('head', c).toArray(), q = D.anchor('head', c - .05).toArray(), dx = p[0] - q[0], dz = p[2] - q[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * sd, nz = dx / l * sd, s = 20 + 220 * h(i, 3) * ta, y = Y + 6 + 30 * h(i, 5) * ta, pf = [p[0] + nx * s, y, p[2] + nz * s]; if (E.project(pf)[2] < 45) continue;
    W.line([pf, [p[0] + nx * (s + 4), y + 2.4, p[2] + nz * (s + 4)]], (u) => .55 * (1 - u), { col: h(i, 7) > .5 ? 0xc7e88e : 0xf1efa8, soft: 6, px: 1.4 }); }
}
