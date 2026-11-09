// RYŪ · 龍 · debris (owner: fx): faceted rocks and cedars shed by the rising dragon, with drawn smears and impact dust.
// Solid pieces are InstancedMesh in the main pass (cel + ink); smears and dust are effect cels in the overlay.
// Emitters are evaluated once per particle from the dragon's pose at birth, then memoised (pure: the dragon path does not change).
import * as THREE from 'three';
import { FLAT, PUFF, h, sat, sstep, lerp, hullGeo, cedarGeo, col } from './fx-draw.js';
import { camFor } from './cams/index.js';

const ROCK = [0x9c92a6, 0x8f8695, 0xb3946d, 0xa79a82, 0x7d7690], TAU = Math.PI * 2;
const EMITTERS = [
  // id, n, t0, t1, from, kind (0 rock / 1 tree), size [min,max], g, bodyK (body velocity carried), out [min,max] (m/s)
  { n: 150, t0: 23.7, t1: 28.4, from: 'spine', u: [.02, 1], kind: 0, size: [3.5, 28], g: 42, body: .55, out: [6, 32] },
  { n: 26, t0: 24.4, t1: 28.2, from: 'spine', u: [.05, .8], kind: 0, size: [24, 48], g: 42, body: .4, out: [4, 16] },
  { n: 60, t0: 23.8, t1: 28.3, from: 'spine', u: [.03, .95], kind: 1, size: [30, 48], g: 34, body: .45, out: [3, 18] },
  { n: 64, t0: 28.5, t1: 31.0, from: 'head', kind: 0, size: [4, 26], g: 46, body: .25, out: [18, 62] },
  { n: 26, t0: 28.5, t1: 31.0, from: 'head', kind: 1, size: [28, 44], g: 38, body: .25, out: [10, 34] },
  { n: 22, t0: 28.55, t1: 30.9, from: 'cam', shot: 's12', kind: 0, size: [3, 11], g: 60, dist: [90, 420] },
  { n: 50, t0: 33.15, t1: 35.9, from: 'spine', u: [.25, 1], kind: 0, size: [4, 26], g: 44, body: .7, out: [8, 40] },
  { n: 18, t0: 33.2, t1: 35.8, from: 'spine', u: [.2, 1], kind: 1, size: [28, 44], g: 36, body: .6, out: [6, 26] },
  { n: 14, t0: 20.65, t1: 21.8, from: 'eye', kind: 1, size: [5, 10], g: 18, body: 0, out: [2, 9] },
  { n: 12, t0: 20.65, t1: 21.8, from: 'eye', kind: 0, size: [.8, 3.4], g: 22, body: 0, out: [2, 12] },
  { n: 24, t0: 39.1, t1: 41.8, from: 'town', kind: 0, size: [.5, 1.3], g: 30, body: 0, out: [20, 70], tile: true },
];
const SLIDE = [ // settle: pieces gliding back onto the body (ease-out, then stay)
  { n: 34, t0: 66.1, t1: 68.3, u: [.05, .9], kind: 1, size: [26, 42], d: [60, 170] },
  { n: 26, t0: 66.1, t1: 68.3, u: [.05, .9], kind: 0, size: [6, 24], d: [50, 150] },
  { n: 12, t0: 68.55, t1: 69.7, from: 'eye', kind: 1, size: [4, 8], d: [14, 34] },
  { n: 18, t0: 68.55, t1: 69.7, from: 'eye', kind: 2, size: [1.2, 3.6], d: [12, 30] },  // moss
];

export function createDebris(ctx) {
  const { THREE: T, mat, scene, geo } = ctx;
  const rockMat = mat.cel(0xffffff, { shade: 0xbcb3cf, fill: 0x2c2840, id: mat.nextId(), brush: .02, hiAmt: .7, hiT: .72, rimI: .25, term: .02 });
  const treeMat = mat.cel(0xffffff, { shade: 0x9a9acc, id: mat.nextId(), brush: .03, hiAmt: .5, hiT: .72, vertexColors: true, cool: .4 });
  const mossMat = mat.cel(0x6fa86a, { shade: 0x3e7060, id: mat.nextId(), brush: .04, hiAmt: .5 });
  const MAXR = 640, MAXT = 220, MAXM = 40;
  const mkI = (geo, m, n) => { const q = new T.InstancedMesh(geo, m, n); q.instanceMatrix.setUsage(T.DynamicDrawUsage); q.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); q.instanceColor.setUsage(T.DynamicDrawUsage); q.frustumCulled = false; q.count = 0; q.visible = false; scene.add(q); return q; };
  const rocks = [hullGeo(11, 13, 1, .72, 1.25), hullGeo(47, 10, 1.1, .85, .8), hullGeo(83, 16, .9, .95, 1.05)].map(g => mkI(g, rockMat, MAXR)), trees = mkI(cedarGeo(), treeMat, MAXT), moss = mkI(hullGeo(5, 12, 1.3, .45, 1.3), mossMat, MAXM);
  const q = new T.Quaternion(), qa = new T.Quaternion(), qUp = new T.Quaternion(), M = new T.Matrix4(), P = new T.Vector3(), Sc = new T.Vector3(), Ax = new T.Vector3(), Up = new T.Vector3(), C = new T.Color();
  let parts = null, slides = null;

  function build(E) {
    parts = []; slides = []; const D = E.D; let idx = 0;
    EMITTERS.forEach((em, ei) => { for (let i = 0; i < em.n; i++) { const sd = ei * 137 + i, t0 = lerp(em.t0, em.t1, (i + h(sd, 3)) / em.n), size = lerp(em.size[0], em.size[1], h(sd, 5) ** 2.2);
      let p0, v0, up = [0, 1, 0];
      if (em.from === 'spine') { const u = lerp(em.u[0], em.u[1], h(sd, 7)), sf = E.spineFrameAt(u, t0), ang = (h(sd, 9) - .5) * 2.2, R = 50, cx = Math.cos(ang), sn = Math.sin(ang); up = [sf.up[0] * cx + sf.r[0] * sn, sf.up[1] * cx + sf.r[1] * sn, sf.up[2] * cx + sf.r[2] * sn]; p0 = [sf.p[0] + up[0] * R, sf.p[1] + up[1] * R, sf.p[2] + up[2] * R];
        const a = D.spine(u, t0 + .06).toArray(), b = D.spine(u, t0 - .06).toArray(), o = lerp(em.out[0], em.out[1], h(sd, 11)); v0 = [(a[0] - b[0]) / .12 * em.body + up[0] * o, (a[1] - b[1]) / .12 * em.body + up[1] * o, (a[2] - b[2]) / .12 * em.body + up[2] * o]; }
      else if (em.from === 'head' || em.from === 'eye') { const c = D.anchor(em.from === 'eye' ? 'eye' : 'head', t0).toArray(), spread = em.from === 'eye' ? 26 : 90, ang = h(sd, 7) * TAU; p0 = [c[0] + Math.cos(ang) * spread * h(sd, 9), c[1] - (em.from === 'eye' ? -14 - 8 * h(sd, 11) : 24), c[2] + Math.sin(ang) * spread * h(sd, 9)]; const a = D.anchor('head', t0 + .05).toArray(), b = D.anchor('head', t0 - .05).toArray(), o = lerp(em.out[0], em.out[1], h(sd, 13)), oa = h(sd, 15) * TAU; v0 = [(a[0] - b[0]) * 10 * em.body + Math.cos(oa) * o * .6, (a[1] - b[1]) * 10 * em.body + o * .22, (a[2] - b[2]) * 10 * em.body + Math.sin(oa) * o * .6]; }
      else if (em.from === 'town') { const c = D.anchor('head', t0).toArray(), oa = h(sd, 15) * TAU, o = lerp(em.out[0], em.out[1], h(sd, 13)); p0 = [c[0] + Math.cos(oa) * 60, Math.max(14, c[1] - 26), c[2] + Math.sin(oa) * 60]; v0 = [Math.cos(oa) * o, o * .55, Math.sin(oa) * o]; }
      else { const s = ctx.shot[em.shot], c = camFor(s, t0, ctx), cp = c.pos, lk = c.look, F = new T.Vector3(lk[0] - cp[0], lk[1] - cp[1], lk[2] - cp[2]).normalize(), Rt = new T.Vector3().crossVectors(F, new T.Vector3(0, 1, 0)).normalize(), U = new T.Vector3().crossVectors(Rt, F), tan = Math.tan((c.fov ?? 40) * Math.PI / 360), d = lerp(em.dist[0], em.dist[1], h(sd, 7) ** .8), x = (h(sd, 9) * 2 - 1) * tan * 1.78 * d * 1.05, y = (1.15 + .5 * h(sd, 11)) * tan * d; p0 = [cp[0] + F.x * d + Rt.x * x + U.x * y, cp[1] + F.y * d + Rt.y * x + U.y * y, cp[2] + F.z * d + Rt.z * x + U.z * y]; v0 = [(h(sd, 13) - .5) * 16, -55 - 45 * h(sd, 15), (h(sd, 17) - .5) * 16]; }
      const g = em.g, ground = (x, z) => E.groundAt(x, z), tA = (y0, vy, Y) => (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * Math.max(0, y0 - Y)))) / g; let ti = tA(p0[1], v0[1], ground(p0[0], p0[2])); const gy = ground(p0[0] + v0[0] * ti, p0[2] + v0[2] * ti); ti = tA(p0[1], v0[1], gy);
      parts.push({ i: idx++, t0, life: Math.min(6, ti), p0, v0, g, size, kind: em.kind, up, rot: lerp(.35, 1.6, h(sd, 19)) * (em.kind === 1 ? .55 : 1.1), ax: [h(sd, 21) - .5, h(sd, 23) - .5, h(sd, 25) - .5], rockV: Math.floor(h(sd, 27) * 3), tint: em.tile ? (h(sd, 29) > .5 ? 0x5a6a9a : 0x8a5c52) : ROCK[Math.floor(h(sd, 29) * ROCK.length)], gy, tImp: t0 + ti, big: size > 14, wet: gy <= 40 });
    } });
    SLIDE.forEach((em, ei) => { for (let i = 0; i < em.n; i++) { const sd = ei * 233 + i + 7, t0 = lerp(em.t0, em.t1, h(sd, 3)), size = lerp(em.size[0], em.size[1], h(sd, 5)), d = lerp(em.d[0], em.d[1], h(sd, 7)); let end, dir, up = [0, 1, 0];
      if (em.from === 'eye') { const f = E.ctx.modules.dragon.headFrame(69.5), ey = E.ctx.modules.dragon.anchor('eye', 69.5), ang = h(sd, 9) * TAU, rad = 36 + 26 * h(sd, 11), loc = ey.clone().add(new T.Vector3(Math.cos(ang) * rad * .5, Math.sin(ang) * rad, -Math.cos(ang) * rad * .5).transformDirection(f).multiplyScalar(rad)); end = loc.toArray(); dir = [(h(sd, 15) - .5) * .5, 1, (h(sd, 17) - .5) * .5]; }
      else { const u = lerp(em.u[0], em.u[1], h(sd, 9)), sf = E.spineFrameAt(u, 68.5), ang = (h(sd, 11) - .5) * 2, cx = Math.cos(ang), sn = Math.sin(ang); up = [sf.up[0] * cx + sf.r[0] * sn, sf.up[1] * cx + sf.r[1] * sn, sf.up[2] * cx + sf.r[2] * sn]; end = [sf.p[0] + up[0] * 50, sf.p[1] + up[1] * 50, sf.p[2] + up[2] * 50]; dir = [up[0] * .6 + (h(sd, 13) - .5), up[1] + .2, up[2] * .6 + (h(sd, 15) - .5)]; }
      const l = Math.hypot(...dir); dir = dir.map(x => x / l); slides.push({ t0, dur: .9 + .9 * h(sd, 19), end, dir, d, size, kind: em.kind, up, tint: ROCK[Math.floor(h(sd, 21) * ROCK.length)], ax: [h(sd, 23) - .5, h(sd, 25) - .5, h(sd, 27) - .5], rockV: Math.floor(h(sd, 29) * 3), phase: h(sd, 31) * TAU }); } });
  }

  function emit(E) {
    const { W, t, pal, sun2, f } = E, age2 = E.t2; if (!E.D) return; if (!parts) build(E);
    const nR = [0, 0, 0]; let nT = 0, nM = 0, puffs = 0;
    const place = (kind, rockV, p, size, up, ax, ang, tint) => {
      Ax.set(ax[0], ax[1], ax[2]).normalize(); qa.setFromAxisAngle(Ax, ang);
      if (kind === 1) { Up.set(up[0], up[1], up[2]).normalize(); qUp.setFromUnitVectors(new T.Vector3(0, 1, 0), Up); q.multiplyQuaternions(qa, qUp); } else q.copy(qa);
      P.set(p[0], p[1], p[2]); Sc.setScalar(size); M.compose(P, q, Sc);
      if (kind === 1) { if (nT >= MAXT) return; trees.setMatrixAt(nT, M); nT++; }
      else if (kind === 2) { if (nM >= MAXM) return; moss.setMatrixAt(nM, M); nM++; }
      else { if (nR[rockV] >= MAXR) return; const m = rocks[rockV], i = nR[rockV]++; m.setMatrixAt(i, M); C.set(tint); m.instanceColor.setXYZ(i, C.r, C.g, C.b); }
    };
    for (const b of parts) {
      const a = age2 - b.t0; if (a < 0) continue;
      if (a >= b.life) { // impact: dust / splash cels (big pieces only)
        const dt = age2 - b.tImp; if (b.big && dt < 1.5 && puffs < 80) { const x = b.p0[0] + b.v0[0] * b.life, z = b.p0[2] + b.v0[2] * b.life;
          for (let k = 0; k < 3; k++) { const th = h(b.i, k + 3) * TAU, q2 = 1 - Math.exp(-dt * 2.6), s = b.size * (1.1 + 1.6 * q2) * (1 - dt / 1.8), rr = b.size * 1.4 * q2 * (k + .4); if (s < 1) continue; puffs++; W.quad([x + Math.cos(th) * rr, b.gy + s * .55 + 6 * q2 * k, z + Math.sin(th) * rr], s, { mode: PUFF, col: b.wet ? pal.spray : pal.dust, col2: b.wet ? pal.sprayB : pal.dustB, seed: h(b.i, k) + Math.floor(f / 3) * .03, p1: sun2[0], p2: sun2[1], soft: 8 }); } }
        continue; }
      const p = [b.p0[0] + b.v0[0] * a, b.p0[1] + b.v0[1] * a - .5 * b.g * a * a, b.p0[2] + b.v0[2] * a];
      place(b.kind, b.rockV, p, b.size, b.up, b.ax, b.rot * a, b.tint);
      // drawn motion smear: tapered flat band behind the piece, in its shade tone + 2 speed hairs. Starts inside the piece, hidden by it through the soft depth test.
      const vel = [b.v0[0], b.v0[1] - b.g * a, b.v0[2]], sp = Math.hypot(...vel), d0 = Math.max(.5, Math.hypot(p[0] - E.cam[0], p[1] - E.cam[1], p[2] - E.cam[2])), px = sp / 12 / (E.pxK * d0);
      if (px > 8) { const dt = .11, r = b.kind === 1 ? b.size * .22 : b.size * .92, smc = col(b.kind === 1 ? 0x6f8a80 : b.tint, .95), tail = (m) => [p[0] - vel[0] * dt * m, p[1] - vel[1] * dt * m, p[2] - vel[2] * dt * m];
        // a comb of tapered strands off the silhouette (not one cone): widths and lengths vary, on twos
        const vx = p[0] - E.cam[0], vy = p[1] - E.cam[1], vz = p[2] - E.cam[2]; let sx = vel[1] * vz - vel[2] * vy, sy = vel[2] * vx - vel[0] * vz, sz = vel[0] * vy - vel[1] * vx; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
        for (let s = 0; s < 5; s++) { const off = (s / 4 - .5) * 1.7 * r, hs = h(b.i + s, Math.floor(f / 2)), m = .35 + .75 * hs, ww = r * (.08 + .13 * hs) * (s === 2 ? 1.5 : 1), o = [sx * off, sy * off, sz * off], a0 = tail(.02), a1 = tail(m * .5), a2 = tail(m); W.line([[a0[0] + o[0], a0[1] + o[1], a0[2] + o[2]], [a1[0] + o[0] * .85, a1[1] + o[1] * .85, a1[2] + o[2] * .85], [a2[0] + o[0] * .6, a2[1] + o[1] * .6, a2[2] + o[2] * .6]], (u) => ww * (1 - u) ** .65, { col: s === 3 ? col(b.kind === 1 ? 0xaabfae : 0xd8d2d0) : smc, a: .95, soft: 2.5, px: .8, wn: ww }); } }
    }
    for (const s of slides) { const a = (age2 - s.t0) / s.dur; if (a < 0) continue; const e = 1 - (1 - sat(a)) ** 3, y = s.d * (1 - e), p = [s.end[0] + s.dir[0] * y, s.end[1] + s.dir[1] * y, s.end[2] + s.dir[2] * y]; place(s.kind, s.rockV, p, s.size, s.up, s.ax, (1 - e) * 1.6 + s.phase * .08, s.tint); }
    rocks.forEach((m, i) => { m.count = nR[i]; m.visible = nR[i] > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.instanceMatrix.clearUpdateRanges?.(); });
    trees.count = nT; trees.visible = nT > 0; trees.instanceMatrix.needsUpdate = true; moss.count = nM; moss.visible = nM > 0; moss.instanceMatrix.needsUpdate = true;
  }
  const hide = () => { for (const m of [...rocks, trees, moss]) { m.visible = false; m.count = 0; } };
  // rising dust curtain where the body leaves the ground (s11)
  function curtain(E) {
    const { W, t, pal, sun2, f } = E, amt = sstep(23.6, 24.4, t) * (1 - sstep(27.8, 28.5, t)); if (amt < .02) return; const dr = Math.floor(f / 3);
    for (let i = 0; i < 22; i++) { const u = .05 + i / 22 * .9, sf = E.spineFrame(u), g = E.groundAt(sf.p[0], sf.p[2]); if (sf.p[1] - g > 220) continue; const th = h(i, 3) * TAU, off = 70 + 80 * h(i, 5), s = (16 + 54 * h(i, 7) ** 2) * amt; W.quad([sf.p[0] + Math.cos(th) * off, g + s * .5 + 8 * h(i, dr * .13), sf.p[2] + Math.sin(th) * off], s, { mode: PUFF, col: pal.dust, col2: pal.dustB, seed: h(i, 11) + dr * .05, p1: sun2[0], p2: sun2[1], soft: 12 }); }
  }
  return { emit, hide, curtain };
}
