// RYŪ · 龍 · air FX (owner: fx): sound ring, birds, speed lines, wind ribbons, rain, lightning, cloud-top burst, dusk leaves + motes.
// Every function draws into E.W (world) / E.S (screen) from film time only.
import { FLAT, WATER, PUFF, DOT, h, sat, sstep, lerp } from './fx-draw.js';

const TAU = Math.PI * 2;
export const FLIGHT = {   // per shot: speed lines n, inner clear radius (px), width, alpha; wind = world ribbons round the body; wind2 = screen ribbons (close shots)
  s13: { n: 54, inner: 330, w: 4, a: .75, wind: 0, wind2: 9, z: 3.2 },
  s14: { n: 34, inner: 300, w: 3.5, a: .55, wind: 26, ramp: [.2, 1.2] },
  s15: { n: 74, inner: 250, w: 4.5, a: .7, wind: 30 },
  s16: { n: 64, inner: 260, w: 4, a: .62, wind: 30 },
  s17: { n: 120, inner: 240, w: 6, a: .8, wind: 0, wind2: 12, z: 3.2 },
  s18: { n: 80, inner: 260, w: 4.5, a: .68, wind: 30 },
  s19: { n: 70, inner: 300, w: 4, a: .6, wind: 26 },
  s20: { n: 36, inner: 340, w: 3, a: .42, wind: 18 },
  s21: { n: 30, inner: 380, w: 3, a: .4, wind: 10 },
  s24: { n: 90, inner: 280, w: 5, a: .75, wind: 34 },
  s25: { n: 26, inner: 460, w: 3, a: .4, wind2: 5, z: 3.2 },
  s26: { n: 8, inner: 560, w: 1.8, a: .25, wind: 6 },
};

// ------------------------------------------------------------------------------------------------------------- speed lines
export function speedLines(E, c) {
  const { S, flow, pal, f } = E, dr = Math.floor(f / 2), k = c.ramp ? sstep(c.ramp[0], c.ramp[1], E.lt) : 1, n = Math.round(c.n * k); if (n < 1) return;
  const z = c.z ?? Math.max(14, E.headDepth * 1.04), st = { col: pal.line, a: c.a, soft: 3, z };
  for (let i = 0; i < n; i++) {
    const a = h(i, dr * 1.31 + 3), b = h(i + 7, dr), l = h(i + 11, dr), ww = c.w * (.5 + 1.8 * h(i + 13, dr) ** 2), tint = h(i + 17, dr) > .72;
    const s = tint ? { ...st, col: pal.line2 } : st;
    if (flow.radial) {
      const th = a * TAU, cx = Math.cos(th), sy = Math.sin(th), r0 = c.inner * (.85 + .75 * b), L = 380 + 1000 * l, v = flow.vp;
      S.line2([[v[0] + cx * r0, v[1] + sy * r0], [v[0] + cx * (r0 + L * .5), v[1] + sy * (r0 + L * .5)], [v[0] + cx * (r0 + L), v[1] + sy * (r0 + L)]], (u) => ww * u ** 1.15, s);
    } else {
      const d = flow.dir, nx = -d[1], ny = d[0], off = (a - .5) * 1500, along = (b - .5) * 2000, L = 240 + 760 * l, x = nx * off + d[0] * along, y = ny * off + d[1] * along; if (Math.abs(off) < c.inner * .55) continue;
      S.line2([[x, y], [x + d[0] * L * .5, y + d[1] * L * .5], [x + d[0] * L, y + d[1] * L]], (u) => ww * Math.sin(Math.PI * u) ** .7, s);
    }
  }
}

// world ribbons of wind streaming along the body + a few off the head
export function windRibbons(E, n) {
  const { W, pal, t } = E; if (!E.D) return;
  for (let i = 0; i < n; i++) {
    const seed = h(i, 41), u0 = (seed + t * (.32 + .4 * h(i, 9))) % 1, du = .05 + .1 * h(i, 13), ang = h(i, 17) * TAU, r = 90 + 130 * h(i, 21), hw = 2.2 + 5 * h(i, 25) ** 2, pts = [];
    for (let j = 0; j < 9; j++) { const sp = E.spineFrame(Math.min(1, u0 + j / 8 * du)); pts.push([sp.p[0] + (sp.r[0] * Math.cos(ang) + sp.up[0] * Math.sin(ang)) * r, sp.p[1] + (sp.r[1] * Math.cos(ang) + sp.up[1] * Math.sin(ang)) * r, sp.p[2] + (sp.r[2] * Math.cos(ang) + sp.up[2] * Math.sin(ang)) * r]); }
    const mid = pts[4], dd = Math.max(5, (mid[0] - E.cam[0]) * E.F[0] + (mid[1] - E.cam[1]) * E.F[1] + (mid[2] - E.cam[2]) * E.F[2]), cap = 5 * E.pxK * dd, hc = Math.min(hw, cap);   // never a fat bar near the lens
    W.line(pts, (u) => hc * Math.sin(Math.PI * u) ** .8, { col: i % 4 === 0 ? pal.line2 : pal.line, a: .85, soft: 12, px: 1.5, wn: hc });
  }
}

// screen ribbons for close shots: long S curves blowing across the frame, away from the vanishing point
export function wind2D(E, n) {
  const { S, flow, pal, f } = E, dr = Math.floor(f / 2);
  for (let i = 0; i < n; i++) {
    const x0 = (h(i, 3 + dr * .17) - .5) * 2000, y0 = (h(i, 5 + dr * .13) - .5) * 1100, dx = flow.radial ? x0 - flow.vp[0] : flow.dir[0], dy = flow.radial ? y0 - flow.vp[1] : flow.dir[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l; if (Math.hypot(x0, y0) < 300) continue;
    const L = 500 + 700 * h(i, 7), w = 2.5 + 7 * h(i, 11) ** 2, bend = (h(i, 13) - .5) * 160, pts = [];
    for (let j = 0; j < 9; j++) { const s = j / 8; pts.push([x0 + ux * L * s - uy * bend * Math.sin(s * Math.PI * 1.5), y0 + uy * L * s + ux * bend * Math.sin(s * Math.PI * 1.5)]); }
    S.line2(pts, (u) => w * Math.sin(Math.PI * u) ** .8, { col: pal.line, a: .9, soft: 1, z: 3.4 });
  }
}

// ------------------------------------------------------------------------------------------------------------- sound ring
export function bellRing(E) {
  const { W, ctx, t2, pal } = E, K = ctx.modules.keeper, T0 = ctx.cues.bell, bell = K?.toWorld?.([-2.2, 1.95, 0.4]) ?? E.look; if (!bell) return;
  for (let i = 0; i < 3; i++) {
    const a = t2 - (T0 + i * .34); if (a < 0 || a > 1.7) continue;
    const r = .18 + 3.4 * (1 - Math.exp(-a * 1.05)), hw = Math.max(.006, .085 * (1 - a / 1.7) ** 1.2), pts = [], pts2 = [], c = 88;
    for (let j = 0; j <= c; j++) { const th = j / c * TAU, w = 1 + .012 * Math.sin(th * 3 + i * 2 + a * 5) + .006 * Math.sin(th * 7 + i), cs = Math.cos(th) * r * w, sn = Math.sin(th) * r * w; pts.push([bell[0] + E.R[0] * cs + E.U[0] * sn, bell[1] + E.R[1] * cs + E.U[1] * sn, bell[2] + E.R[2] * cs + E.U[2] * sn]);
      const q = r * .86; pts2.push([bell[0] + (E.R[0] * Math.cos(th) + E.U[0] * Math.sin(th)) * q, bell[1] + (E.R[1] * Math.cos(th) + E.U[1] * Math.sin(th)) * q, bell[2] + (E.R[2] * Math.cos(th) + E.U[2] * Math.sin(th)) * q]); }
    W.line(pts, hw, { col: 0xffcf6a, col2: 0xfffbea, p2: .62, soft: 0, px: 2 });
    W.line(pts2, hw * .22, { col: 0xfff2c8, soft: 0, px: 1, a: .9 });
  }
}
// the ring rolling out over the island (s07): a band lying on the terrain
export function groundRing(E) {
  const { W, t, ctx } = E, I = ctx.geo.ISLAND;
  for (let i = 0; i < 2; i++) {
    const R = 420 + (t - 15) * 430 - i * 300, hw = Math.max(2.5, 9 - (t - 15) * 2 - i * 3); if (R < 40) continue; const A = [], B = [], c = 200;
    for (let j = 0; j <= c; j++) { const th = j / c * TAU, w = 1 + .03 * Math.sin(th * 7 + i * 3), P = (r) => { const x = I.x + Math.cos(th) * r * w, z = I.z + Math.sin(th) * r * w; return [x, E.groundAt(x, z) + 10, z]; }; A.push(P(R - hw)); B.push(P(R + hw)); }
    W.strip(A, B, { col: 0xfff3cc, col2: 0xffffff, p2: .4, soft: 0, a: .96 });
  }
}

// ------------------------------------------------------------------------------------------------------------- birds (s07)
export function birds(E) {
  const { W, t, f, ctx, pal } = E, I = ctx.geo.ISLAND, T0 = ctx.cues.birds, age0 = t - T0; if (age0 < -.1) return;
  const drawBird = (p, dir, span, flap, seed) => {   // a drawn swept wing: curved, tapering to a point; white on the upstroke, shade tone on the down
    const l = Math.hypot(dir[0], dir[2]) || 1, sx = dir[2] / l, sz = -dir[0] / l, col = flap > .1 ? pal.bird : pal.bird2;
    for (const sd of [-1, 1]) { const pts = []; for (let j = 0; j < 6; j++) { const s = j / 5, out = span * .5 * s; pts.push([p[0] + sx * sd * out - dir[0] * span * .16 * s * s, p[1] + flap * span * .42 * s * (1 - .25 * s) - dir[1] * span * .16 * s * s, p[2] + sz * sd * out - dir[2] * span * .16 * s * s]); }
      W.line(pts, (u) => span * .058 * (1 - u) ** .6, { col, soft: 6, px: 1.1, wn: span * .058 }); }
    W.line([[p[0] - dir[0] * span * .2, p[1] - dir[1] * span * .2, p[2] - dir[2] * span * .2], [p[0], p[1], p[2]], [p[0] + dir[0] * span * .24, p[1] + dir[1] * span * .24, p[2] + dir[2] * span * .24]], (u) => span * .05 * Math.sin(Math.PI * Math.min(1, u * .95 + .05)), { col: pal.bird, soft: 6, px: 1, wn: span * .05 });
  };
  for (let i = 0; i < 72; i++) {
    const t0 = h(i, 3) * .9, a = age0 - t0; if (a < 0 || a > 2.4) continue;
    const th = h(i, 5) * TAU, r = 120 + 520 * h(i, 7), x = I.x + Math.cos(th) * r, z = I.z + Math.sin(th) * r, y0 = E.groundAt(x, z) + 12, dirA = th + (h(i, 9) - .5) * 1.6;
    const v = 34 + 42 * h(i, 11), dir = [Math.cos(dirA), .55 + .4 * h(i, 13), Math.sin(dirA)], d = Math.hypot(...dir), D = dir.map(q => q / d), lift = 26 * a - 3 * a * a;
    const p = [x + D[0] * v * a, y0 + D[1] * v * a + lift, z + D[2] * v * a]; if (E.project(p)[2] < 80) continue; const beat = Math.sin((Math.floor(f / 2) * 2 / 24 + h(i, 15)) * TAU * (3.6 + h(i, 17)));
    drawBird(p, D, 7 + 5 * h(i, 19), .9 * beat, h(i, 21));
  }
  // a few big ones close to the lens
  for (let i = 0; i < 6; i++) {
    const t0 = .15 + i * .22, a = age0 - t0; if (a < 0 || a > 1.8) continue;
    const D = 110 + 90 * h(i, 31), xs = (h(i, 33) - .5) * 2.2 * D * E.tanY * 1.78, ys = (h(i, 35) * .9 - .7) * D * E.tanY, v = 75 + 40 * h(i, 37), sgn = h(i, 39) > .5 ? 1 : -1, F = E.F, R = E.R, U = E.U;
    const p = [E.cam[0] + F[0] * D + R[0] * xs + U[0] * ys, E.cam[1] + F[1] * D + R[1] * xs + U[1] * ys, E.cam[2] + F[2] * D + R[2] * xs + U[2] * ys];
    const dir = [R[0] * sgn * .7 + U[0] * .7, R[1] * sgn * .7 + U[1] * .7, R[2] * sgn * .7 + U[2] * .7]; for (let c = 0; c < 3; c++) p[c] += dir[c] * v * a;
    const beat = Math.sin((Math.floor(f / 2) * 2 / 24 + h(i, 41)) * TAU * 2.8); drawBird(p, dir, 9 + 6 * h(i, 43), .85 * beat, h(i, 45));
  }
}

// ------------------------------------------------------------------------------------------------------------- rain
export function rain(E, amt = 1) {
  const { S, flow, pal, f } = E, dr = Math.floor(f / 2), layers = [[210, 55, 120, 1.0, .55, 500], [90, 120, 240, 1.7, .72, 45], [22, 300, 560, 3.4, .85, 0]];
  layers.forEach(([n, l0, l1, w, a, z], li) => { n = Math.round(n * amt);
    for (let i = 0; i < n; i++) {
      const x = (h(i, 3 + li + dr * .77) - .5) * 2300, y = (h(i, 5 + li + dr * .91) - .5) * 1350, L = lerp(l0, l1, h(i, 7 + li)); let dx, dy;
      if (flow.radial) { const q = Math.hypot(x - flow.vp[0], y - flow.vp[1]) || 1; dx = (x - flow.vp[0]) / q * .78; dy = (y - flow.vp[1]) / q * .78 - .55; } else { dx = flow.dir[0] * .6 - .25; dy = flow.dir[1] * .6 - .85; }
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      S.line2([[x, y], [x + dx * L, y + dy * L]], (u) => w * (.25 + .75 * Math.sin(Math.PI * u)), { col: pal.rain, a, soft: z ? 3 : 0, z });
    }
  });
}
// little crowns where rain hits the shrine platform (s22)
export function rainTicks(E) {
  const { W, f, ctx, pal } = E, K = ctx.modules.keeper; if (!K?.toWorld) return; const dr = Math.floor(f / 2);
  for (let i = 0; i < 26; i++) {
    const p = K.toWorld([(h(i, dr * .7 + 1) - .5) * 7, .03, (h(i, dr * .9 + 2) - .5) * 7]), R = E.R;
    for (const sd of [-1, 0, 1]) W.line([p, [p[0] + R[0] * sd * .07, p[1] + .1 - Math.abs(sd) * .03, p[2] + R[2] * sd * .07]], (u) => .012 * (1 - u * .8), { col: pal.rain, soft: .3, px: .9 });
  }
}

// ------------------------------------------------------------------------------------------------------------- lightning
const BOLTS = [[49.71, .10, 1], [50.17, .12, 2], [50.54, .07, 3], [50.96, .14, 4], [51.33, .08, 5], [51.71, .11, 6]];
const STRIKES = [[0, .24], [.29, .16], [.67, .12]];   // offsets from CUES.strike: main stroke + re-strikes
const env = (t, t0, peak) => { const df = Math.round(t * 24) - Math.round(t0 * 24); if (df < -2 || df > 9) return 0; const k = df <= 0 ? (df + 3) / 3 : df <= 1 ? 1 : 1 - (df - 1) / 8; return k * peak; };
export function flashLevel(t, strikeT) {
  let v = 0; for (const [T, p] of BOLTS) v = Math.max(v, env(t, T, p));
  for (const [o, p] of STRIKES) v = Math.max(v, env(t, strikeT + o, p)); return v;
}
// jagged polyline a -> b (midpoint displacement), n levels. Pure.
function jag(a, b, seed, n = 5, amt = .22) {
  let pts = [a, b]; const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let lv = 0; lv < n; lv++) { const nx = [], amp = L * amt / Math.pow(1.85, lv);
    for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], s = seed + lv * 7 + i * .37, m = [(p[0] + q[0]) / 2 + (h(s, 1) - .5) * amp, (p[1] + q[1]) / 2 + (h(s, 2) - .5) * amp * .6, (p[2] + q[2]) / 2 + (h(s, 3) - .5) * amp]; nx.push(p, m); }
    nx.push(pts[pts.length - 1]); pts = nx; }
  return pts;
}
function drawBolt(E, pts, wpx, seed, vis, lvl = 0) {
  const { W, pal } = E, n = Math.max(2, Math.round(pts.length * vis)), seg = pts.slice(0, n), taper = (u) => 1 - .72 * u;
  W.line(seg, (u) => 1e-3, { col: pal.boltGlow, a: .4, p1: 1, over: 0, soft: 0, px: wpx * 5.5, wn: 1e-3 });
  W.line(seg, (u) => 1e-3 * taper(u), { col: pal.bolt, col2: [3.2, 3.2, 3.4], p2: .64, soft: 6, px: wpx, wn: 1e-3 });
  if (lvl > 1) return;
  const nb = lvl === 0 ? 5 : 2;
  for (let b = 0; b < nb; b++) { const i = Math.floor((.15 + .75 * h(b, seed + 9)) * (n - 2)) + 1; if (i >= pts.length - 1) continue; const p = pts[i], q = pts[Math.min(pts.length - 1, i + Math.max(2, Math.floor(pts.length * .1)))], len = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * (2.2 + 2.8 * h(b, seed + 3));
    const ang = (h(b, seed + 5) - .5) * 2.4, ca = Math.cos(ang), sa = Math.sin(ang), dx = (q[0] - p[0]) * ca - (q[2] - p[2]) * sa, dz = (q[0] - p[0]) * sa + (q[2] - p[2]) * ca, l = Math.hypot(dx, q[1] - p[1], dz) || 1;
    const e = [p[0] + dx / l * len, p[1] + (q[1] - p[1]) / l * len - len * .35, p[2] + dz / l * len]; drawBolt(E, jag(p, e, seed + b * 13 + 40, 4), wpx * .55, seed + b + 90, 1, lvl + 1); }
}
export function lightning(E) {
  const { t, f, ctx, D } = E, T = ctx.cues.strike;
  for (const [T0, p, s] of BOLTS) {
    const age = f - Math.round(T0 * 24); if (age < 0 || age > 4) continue;
    const dr = Math.floor(age / 2), seed = s * 17 + dr * 3, u = .05 + .62 * h(s, 9), sp = E.spineFrame(u), off = 60 + 60 * h(s, 11), sd = h(s, 13) > .5 ? 1 : -1;
    const b = [sp.p[0] + sp.r[0] * off * sd, sp.p[1] + sp.up[1] * off * .4, sp.p[2] + sp.r[2] * off * sd], a = [b[0] + (h(s, 15) - .5) * 700, b[1] + 900 + 500 * h(s, 17), b[2] + (h(s, 19) - .5) * 500];
    drawBolt(E, jag(a, b, seed, 6, .2), lerp(4.5, 2.2, age / 4), seed, age === 0 ? .55 : 1);
  }
  if (!D) return;
  for (const [o] of STRIKES) {
    const t0 = T + o, age = f - Math.round(t0 * 24); if (age < -1 || age > 7) continue;
    const dr = Math.floor(Math.max(0, age) / 2), seed = 300 + o * 40 + dr * 7, tgt = (D.anchor('hornL', t0) || D.anchor('head', t0)).toArray();
    const a = [tgt[0] - 180 - 120 * h(o * 9, 3), tgt[1] + 1500, tgt[2] + 260];
    drawBolt(E, jag(a, tgt, seed, 6, .13), age <= 1 ? 20 : age <= 3 ? 13 : 8, seed, age < 0 ? .4 : age === 0 ? .8 : 1);
    if (age >= 0 && age <= 3) { const r = (age === 0 ? 34 : 70) * (age > 2 ? .7 : 1); E.W.quad(tgt, r, { mode: DOT, col: E.pal.bolt, col2: [3.4, 3.4, 3.6], p2: .55, soft: 2, over: .5 }); }
  }
  // arcs crawling over the head while it thrashes
  if (t >= T && t < T + 1.1) for (let i = 0; i < 7; i++) {
    const names = ['hornL', 'hornR', 'brow', 'eye', 'jaw', 'head'], dr = Math.floor(f / 2), a = D.anchor(names[i % 6], t), bn = D.anchor(names[(i + 1 + Math.floor(h(i, dr) * 4)) % 6], t);
    const s0 = (x) => (h(i * 3 + x, dr) - .5) * 28;
    drawBolt(E, jag([a.x + s0(1), a.y + s0(2), a.z + s0(3)], [bn.x + s0(4), bn.y + s0(5), bn.z + s0(6)], 700 + i * 5 + dr, 5, .24), 3.2, 700 + i + dr * 3, 1, 1);
  }
}

// ------------------------------------------------------------------------------------------------------------- cloud-top burst (s24)
export function cloudBurst(E, tX, pX) {
  const { W, t, pal, sun2 } = E, a = t - tX; if (a < -.25) return; const col = pal.cloud, sh = pal.cloudSh;
  // torn cloud tongues flung radially
  for (let i = 0; i < 18; i++) {
    const th = h(i, 3) * TAU, v0 = 480 + 500 * h(i, 5), up = 200 + 340 * h(i, 7), L = 200 + 260 * h(i, 9), age = Math.max(0, a), dist = v0 * (1 - Math.exp(-age * 1.1)) * 1.3, yr = up * (1 - Math.exp(-age * 1.1)) - 28 * age * age;
    for (let j = 0; j < 6; j++) { const s = j / 5, rr = dist + L * (s - .5), ww = (h(i, 11) - .5) * 80, R = (70 + 110 * h(i, 13)) * (1.05 - .8 * s) * sstep(0, .25, age + .05); if (R < 4) continue;
      W.quad([pX[0] + Math.cos(th) * rr + Math.sin(th) * ww * s, pX[1] + yr * (1 - .4 * s) + s * s * 60, pX[2] + Math.sin(th) * rr + Math.cos(th) * ww * s], R, { mode: PUFF, col, col2: sh, seed: h(i * 7 + j, 19) + Math.floor(E.f / 3) * .02, p1: sun2[0], p2: sun2[1], soft: 40 }); }
  }
  // billowing cel puffs thrown up and out: the wall of the burst
  for (let i = 0; i < 44; i++) {
    const th = h(i, 21) * TAU, rd = 80 + 360 * h(i, 23), up = 90 + 620 * h(i, 25) ** 1.6, R = 70 + 190 * h(i, 27), age = Math.max(0, a - .03 * i * .4);
    const k = 1 - Math.exp(-age * 1.7), xy = rd * k * 1.5, y = up * k - 42 * age * age;
    W.quad([pX[0] + Math.cos(th) * xy, pX[1] + y + 40, pX[2] + Math.sin(th) * xy], R * (.45 + .55 * k) * (1 + .22 * age), { mode: PUFF, col, col2: sh, seed: h(i, 29) + Math.floor(E.f / 3) * .02, p1: sun2[0], p2: sun2[1], soft: 40 });
  }
  // shock ring on the cloud plane, then the bright hole
  for (let i = 0; i < 2; i++) { const R = 150 + 1300 * (1 - Math.exp(-Math.max(0, a - i * .22) * 1.6)), hw = Math.max(3, 26 - a * 13), A = [], B = [], n = 90; if (a < i * .22 || hw <= 3.01) continue;
    for (let j = 0; j <= n; j++) { const th = j / n * TAU, c = Math.cos(th), s = Math.sin(th), P = (r) => [pX[0] + c * r, pX[1] + 14, pX[2] + s * r]; A.push(P(R - hw)); B.push(P(R + hw)); } W.strip(A, B, { col: pal.cloudSh, col2: 0xffffff, p2: .5, soft: 0, a: .7 }); }
}

// ------------------------------------------------------------------------------------------------------------- dusk leaves + motes (s26-s28)
export function duskDrift(E, amt = 1) {
  const { W, t, cam, pal, f } = E, BOX = 280, flow = E.flow, n = Math.round(amt * 90), nL = Math.round(amt * 46);
  const dv = flow.radial ? [E.F[0] * 90, E.F[1] * 90 + 4, E.F[2] * 90] : [E.R[0] * flow.dir[0] * 40, 4, E.R[2] * flow.dir[0] * 40];
  for (let i = 0; i < n + nL; i++) {
    const wrap = (c, k) => { const b = BOX, v = (h(i, c) * b - dv[k] * t * .5 + Math.sin(t * (.4 + h(i, c + 3)) + i) * 6) % b; return (v < 0 ? v + b : v) - b / 2; };
    const px = cam[0] + wrap(3, 0) + E.F[0] * 110, py = cam[1] + wrap(5, 1) * .7 + E.F[1] * 110, pz = cam[2] + wrap(7, 2) + E.F[2] * 110;
    if (i < n) W.quad([px, py, pz], .22 + .32 * h(i, 9), { mode: DOT, col: pal.mote, col2: [2.2, 1.7, 1.1], p2: .4, soft: 6, px: 1.6, a: .95 });
    else { const spin = Math.floor(f / 2) * .19 + h(i, 11) * TAU, c = Math.cos(spin) * .9, s = Math.sin(spin) * .9, R = E.R, U = E.U, sz = .7 + 1.1 * h(i, 13), tilt = h(i, 19) * 1.5 - .75;
      const A = [px - (R[0] * c + U[0] * s) * sz, py - (R[1] * c + U[1] * s) * sz, pz - (R[2] * c + U[2] * s) * sz], B = [px + (R[0] * c + U[0] * s) * sz, py + (R[1] * c + U[1] * s) * sz, pz + (R[2] * c + U[2] * s) * sz], M = [px, py + tilt * .2, pz];
      W.line([A, M, B], (u) => sz * .46 * Math.sin(Math.PI * u) ** .7, { col: h(i, 15) > .5 ? pal.leafA : pal.leafB, col2: pal.leafC, p2: .18, soft: 3, px: 1.2, seed: h(i, 17) }); }
  }
}
