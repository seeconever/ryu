// RYŪ · 龍 · FX (owner: fx). Drawn effect cels (flat bands, hard edges, water on threes), pure function of t. No calls needed: everything
// is hooked by film time and anchored to ctx.modules.dragon (spine / anchors / headFrame) and ctx.modules.keeper (toWorld).
//
//   s06 bell sound rings          s07 ring over the island + birds        s09 trees sliding off the lid (s11-s12, s14 rocks + cedars)
//   s11 s12 s14 waterfalls + dust  s13-s19 s24-s26 speed lines + wind     s15 wake in a V      s18 tail spray wall + foam
//   s20 s21 rain + branching lightning + the bolt on the head             s22 s23 rain          s24 cloud-top burst
//   s26-s28 leaves + motes        s27 s28 trees and moss sliding back
//
// API  ctx.modules.fx  (optional: for other departments to sync with the FX)
//   flash(t) -> 0..~.34          lightning flash level (already applied to grade.flash; use it to light clouds / rim)
//   strike                       { t, target(t) } the head bolt (CUES.strike), target = hornL world position
//   burst(t) -> { t, p } | null  time + world point where the head crosses the cloud top (s24)
//   wind(t) -> 0..1              wind strength for cloth, rope, forest, fur (1 = full flight)
//   rain(t) -> 0..1              rain amount
//   enable(name, on)             debug switch: 'ring', 'birds', 'debris', 'water', 'lines', 'wind', 'wake', 'spray', 'rain', 'bolts', 'burst', 'drift'
// Files: fx-draw.js (cel batch, rock + cedar geometry), fx-air.js, fx-sheets.js, fx-debris.js.
import { celBatch, sstep } from './fx-draw.js';
import { FLIGHT, speedLines, windRibbons, wind2D, bellRing, groundRing, birds, rain as drawRain, rainTicks, lightning, flashLevel, cloudBurst, duskDrift } from './fx-air.js';
import { waterfalls, tailSpray, wake as drawWake } from './fx-sheets.js';
import { createDebris } from './fx-debris.js';
import { camFor } from './cams/index.js';

const PAL = {
  day: { line: 0xffffff, line2: 0xcfe2ff, waterA: 0x9fe3f5, waterB: 0x3a8fd8, spray: 0xffffff, sprayB: 0xa6c4f0, foam: 0xf4fbff, dust: 0xe6dfd2, dustB: 0x9b95a4, bird: 0xffffff, bird2: 0xc8c4e8, rain: 0xd8dcff, cloud: 0xffffff, cloudSh: 0xb9b6ec, bolt: 0x9fb4ff, boltGlow: 0x6a6cff, mote: 0xffd890, leafA: 0xf0a040, leafB: 0xd86a3a, leafC: 0xf7d06a, rim: 0xffffff },
  storm: { line: 0xd4d4ff, line2: 0x9c9ee8, waterA: 0x8088d8, waterB: 0x3c3a8e, spray: 0xc8ccff, sprayB: 0x6a68c0, foam: 0xc0c4f0, dust: 0x8c84b8, dustB: 0x4e4888, bird: 0xc8c8ff, bird2: 0x7a78c0, rain: 0xcfd2ff, cloud: 0xc4c2f4, cloudSh: 0x5a5498, bolt: 0xb0beff, boltGlow: 0x7a6cff, mote: 0xffd890, leafA: 0xf0a040, leafB: 0xd86a3a, leafC: 0xf7d06a, rim: 0xe8ecff },
  sky: { line: 0xffffff, line2: 0xd4e4ff, waterA: 0x9fe3f5, waterB: 0x3a8fd8, spray: 0xffffff, sprayB: 0xb9b6ec, foam: 0xffffff, dust: 0xffffff, dustB: 0xb9b6ec, bird: 0xffffff, bird2: 0xc8c4e8, rain: 0xd8dcff, cloud: 0xffffff, cloudSh: 0xb0b0ea, bolt: 0x9fb4ff, boltGlow: 0x6a6cff, mote: 0xffd890, leafA: 0xf0a040, leafB: 0xd86a3a, leafC: 0xf7d06a, rim: 0xfffff4 },
  dusk: { line: 0xffe8c8, line2: 0xffc8a0, waterA: 0xffc8a0, waterB: 0x9a5a90, spray: 0xffe0c0, sprayB: 0xb07a9a, foam: 0xffe8cc, dust: 0xf0c8a0, dustB: 0x9a6a78, bird: 0xffe0c0, bird2: 0xa07a90, rain: 0xffd8c0, cloud: 0xffd8b8, cloudSh: 0x9a78b8, bolt: 0xffd0a0, boltGlow: 0xff8a60, mote: 0xffc060, leafA: 0xff9a34, leafB: 0xe05a2e, leafC: 0xffd060, rim: 0xffd8a0 },
};
const palFor = (st, t) => t >= 63.5 ? PAL.dusk : st.env === 'storm' ? PAL.storm : st.env === 'sky' ? PAL.sky : PAL.day;

export async function create(ctx) {
  const W = celBatch(ctx, { max: 90000, order: 7, name: 'fx-world' }), S = celBatch(ctx, { max: 30000, order: 9, screen: true, name: 'fx-screen' });
  const debris = createDebris(ctx), off = new Set(), D = () => ctx.modules.dragon, I = ctx.geo.ISLAND, on = (n) => !off.has(n);
  const groundAt = (x, z) => { const w = ctx.modules.world, dx = x - I.x, dz = z - I.z, r = Math.hypot(dx, dz);
    if (r < I.R * 1.4) { const y = w?.islandHeight?.(r, Math.atan2(dz, dx)); return Number.isFinite(y) ? y : Math.max(0, I.peak * (1 - r / I.R)); }
    const P = ctx.geo.PADDIES; if (Math.abs(x - P.x) < P.w / 2 + 300 && Math.abs(z - P.z) < P.d / 2 + 300) return P.y;
    const g = w?.ground?.(x, z); return Number.isFinite(g) ? Math.max(0, g) : 0; };

  // the cloud-top crossing (memoised: the head path is fixed)
  let burstX = null, burstDone = false;
  function burst() { if (burstDone) return burstX; burstDone = true; const d = D(); if (!d) return null; const top = ctx.geo.SKY.cloudTop; let a = 57.5, b = 61, ya = d.anchor('head', a).y, yb = d.anchor('head', b).y;
    if (ya >= top || yb <= top) { const T = ctx.cues.breakout; burstX = { t: T, p: [d.anchor('head', T).x, top, d.anchor('head', T).z] }; return burstX; }
    for (let i = 0; i < 18; i++) { const m = (a + b) / 2; if (d.anchor('head', m).y < top) a = m; else b = m; } const q = d.anchor('head', (a + b) / 2); burstX = { t: (a + b) / 2, p: [q.x, top, q.z] }; return burstX; }

  const api = {
    update() { },
    afterCamera(t, st) {
      if (st.set === 'card') { W.hide(); S.hide(); debris.hide(); return; }
      const cam = ctx.camera, m = cam.matrixWorld.elements, id = st.id, f = Math.round(t * 24), d = D();
      const E = { t, f, lt: st.lt, k: st.k, id, st, ctx, D: d, W, S, debris, cam: [m[12], m[13], m[14]], R: [m[0], m[1], m[2]], U: [m[4], m[5], m[6]], F: [-m[8], -m[9], -m[10]], tanY: Math.tan(cam.fov * Math.PI / 360), pal: palFor(st, t), groundAt,
        t2: Math.floor(f / 2) * 2 / 24, tq: Math.floor(f / 3) * 3 / 24 };
      E.pxK = 2 * E.tanY / 1080;
      const project = (p) => { const vx = p[0] - E.cam[0], vy = p[1] - E.cam[1], vz = p[2] - E.cam[2], z = vx * E.F[0] + vy * E.F[1] + vz * E.F[2]; const k = 540 / (Math.max(.1, z) * E.tanY); return [(vx * E.R[0] + vy * E.R[1] + vz * E.R[2]) * k, (vx * E.U[0] + vy * E.U[1] + vz * E.U[2]) * k, z]; };
      E.project = project;
      const head = d ? d.anchor('head', t).toArray() : [E.cam[0] + E.F[0] * 200, E.cam[1] + E.F[1] * 200, E.cam[2] + E.F[2] * 200];
      E.head = head; E.headDepth = project(head)[2]; if (E.headDepth < 1) E.headDepth = 60;
      // sun direction in the camera plane (for puff shading)
      const sun = st.look?.sun?.dir || [.3, .6, .7], sl = Math.hypot(sun[0] * E.R[0] + sun[1] * E.R[1] + sun[2] * E.R[2], sun[0] * E.U[0] + sun[1] * E.U[1] + sun[2] * E.U[2]) || 1, sr = (sun[0] * E.R[0] + sun[1] * E.R[1] + sun[2] * E.R[2]) / sl, su = (sun[0] * E.U[0] + sun[1] * E.U[1] + sun[2] * E.U[2]) / sl;
      E.sun2 = [sr, su];
      // spine sampled once this frame (frames of reference for ribbons)
      const table = new Map();
      E.spineFrameAt = (u, tt) => { const a = d.spine(Math.max(0, u - .01), tt).toArray(), b = d.spine(Math.min(1, u + .01), tt).toArray(), p = d.spine(u, tt).toArray(); let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl; let rx = tz, ry = 0, rz = -tx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl; const ux = ry * tz - rz * ty, uy = rz * tx - rx * tz, uz = rx * ty - ry * tx; return { p, t: [tx, ty, tz], r: [rx, ry, rz], up: [ux, uy, uz] }; };
      E.spineFrame = (u) => { if (!d) return { p: head, t: [0, 0, 1], r: [1, 0, 0], up: [0, 1, 0] }; const k = Math.round(Math.min(1, Math.max(0, u)) * 96); let v = table.get(k); if (!v) { v = E.spineFrameAt(k / 96, t); table.set(k, v); } return v; };
      // flow: how the world streams past the lens this frame (raw camera on ones)
      let dv = [0, 0, 0];
      try { const a = Math.max(st.t0, t - 1 / 24), b = a + 1 / 24, c0 = camFor(st, a, ctx), c1 = camFor(st, b, ctx); dv = [(c1.pos[0] - c0.pos[0]) * 24, (c1.pos[1] - c0.pos[1]) * 24, (c1.pos[2] - c0.pos[2]) * 24]; } catch { /* debug camera */ }
      const vR = dv[0] * E.R[0] + dv[1] * E.R[1] + dv[2] * E.R[2], vU = dv[0] * E.U[0] + dv[1] * E.U[1] + dv[2] * E.U[2], vF = dv[0] * E.F[0] + dv[1] * E.F[1] + dv[2] * E.F[2], sp = Math.hypot(vR, vU, vF);
      let flow; if (sp > 15 && vF / sp > .32) { const k = 540 / E.tanY, cl = (x, l) => Math.max(-l, Math.min(l, x)); flow = { radial: true, vp: [cl(vR / vF * k, 900), cl(vU / vF * k, 520)] }; }
      else if (sp > 15) { const l = Math.hypot(vR, vU) || 1; flow = { radial: false, dir: [-vR / l, -vU / l] }; }
      else { const p1 = project(head), p0 = d ? project(d.anchor('head', t - .1).toArray()) : p1; const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy); flow = { radial: false, dir: l > 2 ? [dx / l, dy / l] : [1, 0] }; }
      E.flow = flow;

      W.begin(E, E.pal.rim); S.begin(E);
      // ---- by shot
      if (on('ring') && (id === 's06')) bellRing(E);
      if (on('ring') && id === 's07') groundRing(E);
      if (on('birds') && id === 's07') birds(E);
      if (on('debris') && d && ((t >= 20.6 && t < 37) || (t >= 66 && t < 70.05)) && st.set !== 'shrine') debris.emit(E); else debris.hide();
      if (on('debris') && d && id === 's11') debris.curtain(E);
      if (on('water') && d && (id === 's11' || id === 's12' || id === 's14')) waterfalls(E);
      const c = FLIGHT[id]; if (c) { if (on('lines')) speedLines(E, c); if (on('wind')) { if (c.wind && d) windRibbons(E, c.wind); if (c.wind2) wind2D(E, c.wind2); } }
      if (on('wake') && id === 's15') drawWake(E);
      if (on('spray') && id === 's18') tailSpray(E);
      if (on('rain') && (id === 's20' || id === 's21' || id === 's22' || id === 's23')) { drawRain(E, id === 's23' ? .55 : 1); if (id === 's22') rainTicks(E); }
      if (on('bolts') && (id === 's20' || id === 's21') && d) lightning(E);
      if (on('burst') && id === 's24' && d) { const b = burst(); if (b) cloudBurst(E, b.t, b.p); }
      if (on('drift') && (id === 's26' || id === 's27' || id === 's28')) duskDrift(E, id === 's28' ? .5 : 1);
      W.end(); S.end();
      // ---- lightning flash in the grade, continuous over the s20 / s21 cut (ramps, luma step <= 25)
      let fl = flashLevel(t, ctx.cues.strike); if (id === 's20' && f >= Math.round(ctx.cues.strike * 24) - 1) fl *= .4; if (id === 's21' && f <= Math.round(ctx.cues.strike * 24) + 6) fl *= .18;   /* the impact backdrop carries this flash, the head stays black */ if (fl > 0) { const g = st.look.grade = { ...st.look.grade }; g.flash = Math.max(g.flash || 0, fl); g.flashCol = 0xd8dcff; }
    },
    dispose() { },
    flash: (t) => flashLevel(t, ctx.cues.strike),
    strike: { t: ctx.cues.strike, target: (t) => D()?.anchor('hornL', t) },
    burst: () => burst(),
    wind: (t) => sstep(31, 33.5, t) * (1 - sstep(61, 66, t) * .7),
    rain: (t) => sstep(49.2, 49.7, t) * (1 - sstep(57.2, 57.6, t)),
    enable: (n, v) => { if (v) off.delete(n); else off.add(n); },
  };
  return api;
}
