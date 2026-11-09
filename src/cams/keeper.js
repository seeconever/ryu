// RYŪ · 龍 · cameras + looks of the keeper team (owner: keeper). See src/cams/index.js for the signature.
// All positions are shrine-local (keeper.toWorld). Camera on ones (raw t); violent shake in flight shots.
import { HORN, hornTopY, RIDGE } from '../shrine-sets.js';
import { Vector3 } from 'three';
import { lerp, ease } from '../pipeline-util.js';

const L = (a, b, k) => a.map((v, i) => lerp(v, b[i], ease(k)));
const shake = (t, a) => [a * (Math.sin(t * 61.3) * 0.5 + Math.sin(t * 97.1) * 0.3 + Math.sin(t * 143.7) * 0.2), a * (Math.sin(t * 73.9) * 0.5 + Math.sin(t * 109.3) * 0.3 + Math.sin(t * 157.1) * 0.2), a * 0.6 * Math.sin(t * 83.7)];
const add = (a, b) => a.map((v, i) => v + b[i]);
const kk = (st) => st.ctx.modules.keeper;
// a direction given in the shrine frame -> world (the shrine rides the head, which is turned and banked in flight). Pure: from headFrame(t), LOOKs run before the pose
const localDir = (st, t, d) => new Vector3(...d).transformDirection(st.ctx.modules.dragon.headFrame(t)).toArray();
const W = (st, p) => { const k = kk(st); return k ? k.toWorld(p) : p; };
const shot = (lt, d, st, p0, p1, l0, l1, fov, o = {}, sh = 0) => { const k = lt / d, t = st.shot.t0 + lt, q = shake(t, sh), pos = add(L(p0, p1, k), q), look = L(l0, l1, k); return { pos: W(st, pos), look: W(st, look), fov, near: 0.05, ...o }; };
const hit = (t, t0, a, decay = 6) => t < t0 ? 0 : a * Math.exp(-(t - t0) * decay);

export const CAMS = {
  s02: (lt, d, t, st) => shot(lt, d, st, [1.4, -1.0, 10.3], [1.05, -0.95, 9.7], [0.1, 1.9, 0], [0.0, 1.9, 0], 40),
  s03: (lt, d, t, st) => shot(lt, d, st, [-0.38, 0.6, 3.72], [-0.2, 0.55, 3.45], [0.72, 0.3, 1.72], [0.8, 0.27, 1.7], 29),
  s04: (lt, d, t, st) => { const k = ease((lt - 0.75) / 0.6), L0 = [-0.2, -0.04, 2.42], L1 = [0.42, 0.3, 1.85], look = L0.map((v, i) => lerp(v, L1[i], k)), cam = [lerp(-0.05, 0.56, k), lerp(0.42, 0.23, k), lerp(3.3, 3.4, k)]; return { pos: W(st, cam), look: W(st, look), fov: lerp(24, 25, k), near: 0.03 }; },
  s05: (lt, d, t, st) => { const h = hit(t, 11.8 + 0.22, 0.05), q = shake(t, h); return { ...shot(lt, d, st, [-1.5, 0.34, 3.5], [-1.2, 0.31, 3.22], [0.1, 0.3, 1.95], [-0.05, 0.2, 2.05], 28), ...{ } , ...(() => ({ pos: W(st, add(L([-1.5, 0.34, 3.5], [-1.2, 0.31, 3.22], lt / d), q)) }))() }; },
  s06: (lt, d, t, st) => { const h = hit(t, 13.2, 0.1, 3), q = shake(t, h); return { pos: W(st, add(L([0.15, 0.42, 4.2], [0.0, 0.42, 3.95], lt / d), q)), look: W(st, add([-1.45, 1.05, 0.95], q.map(v => v * 0.5))), fov: 46 + h * 25, near: 0.05 }; },
  s10: (lt, d, t, st) => shot(lt, d, st, [-2.55, -0.3, 4.3], [-2.55, -0.22, 3.75], [-2.6, 0.26, 2.2], [-2.6, 0.3, 2.25], 26),
  s13: (lt, d, t, st) => { const k = kk(st), c = k ? k.clawdLocal().toArray() : [-4, 1, -2], q = shake(t, 0.06); return { pos: W(st, add(L([-5.95, 0.55, 0.55], [-5.65, 0.45, 0.4], lt / d), q)), look: W(st, add(c, [0.2, 0.15, 0.2])), fov: 30, near: 0.05, roll: 0.42 + Math.sin(t * 7) * 0.05 }; },
  s17: (lt, d, t, st) => { const h = HORN.base, q = shake(t, 0.07), p = [h[0] + 0.5, 2.55, 2.05], l = [h[0] + 0.05, 3.75, 0.55]; return { pos: W(st, add(p, q)), look: W(st, add(l, q.map(v => v * 0.4))), fov: 36, near: 0.05, roll: 0.06 * Math.sin(t * 5) }; },
  s22: (lt, d, t, st) => { const r = RIDGE.origin, q = shake(t, 0.04), k = kk(st), c = k ? k.clawdLocal().toArray() : r, cx = [r[0] + 0.25, r[1] + 0.36, r[2] + 0.95], a = ease((t - 54.2) / 0.5), P0 = [c[0] - 1.8, c[1] + 0.32, c[2] - 0.75], P1 = [c[0] - 1.5, c[1] + 0.3, c[2] - 0.65], look = [c[0] + 0.55 + a * 0.2, c[1] + 0.05, c[2] + 0.82 + a * 0.15]; return { pos: W(st, add(L(P0, P1, lt / d), q)), look: W(st, add(look, q.map(v => v * 0.4))), fov: 40, near: 0.05, roll: 0.05 * Math.sin(t * 4) }; },
  s25: (lt, d, t, st) => { const h = HORN.base, q = shake(t, 0.02); return { pos: W(st, add(L([h[0] + 0.5, hornTopY + 0.28, 2.4], [h[0] + 0.42, hornTopY + 0.22, 2.2], lt / d), q)), look: W(st, [h[0] + 0.02, hornTopY + 0.4, 0.1]), fov: 27, near: 0.05 }; },
  s29: (lt, d, t, st) => shot(lt, d, st, [-0.3, 0.55, 3.45], [-0.2, 0.52, 3.2], [0.62, 0.28, 1.78], [0.68, 0.26, 1.82], 27),
};

// The caster is Clawd alone, so the map only has to hold him: a tight radius around his body (resolved after the pose) keeps the texels under a pixel in the close-ups
const sh = (st) => ({ shadow: { center: () => kk(st).clawdWorld().toArray(), radius: 0.85, k: 1, bias: 0.0009 } });
export const LOOKS = {
  s02: (lt, d, t, st) => sh(st), s03: (lt, d, t, st) => sh(st), s04: (lt, d, t, st) => sh(st), s05: (lt, d, t, st) => sh(st), s06: (lt, d, t, st) => sh(st), s10: (lt, d, t, st) => sh(st), s13: (lt, d, t, st) => ({ ...sh(st), hero: { dir: localDir(st, t, [-0.5, 0.82, 0.28]), color: 0xfff4ea, k: 1.0 } }),
  s17: (lt, d, t, st) => ({ haze: { density: 0.0001, max: 0.3 }, hero: { dir: localDir(st, t, [0.1, 0.92, 0.36]), color: 0xfff4ea, k: 1.0 } }),
  s25: (lt, d, t, st) => ({ haze: { density: 0.00005, max: 0.25 }, sun: { dir: [0.25, 0.45, 0.86], color: 0xfff8ee, k: 1.05 }, hero: { dir: localDir(st, t, [0.12, 0.85, 0.5]), color: 0xfff6ea, k: 1.05 } }),
  s29: (lt, d, t, st) => sh(st),
};
