// RYŪ · 龍 · THE DRAGON (owner: dragon). Files: dragon.js (API + build), dragon-path.js (motion), dragon-head.js, dragon-body.js, dragon-paint.js.
//
// ctx.modules.dragon  (every call is a pure function of t; call them from your own update / camera, any order)
//   root                       Group in ctx.scene holding the whole dragon. Visible 0 <= t < 73 (head from t=0, body 20..70), hidden on the card.
//   head                       Group posed every frame to headFrame(t) (matrixAutoUpdate off). Children ride the head rigidly.
//   headFrame(t) -> Matrix4    origin = the brow between the horns = shrine base (platform top y 0). +y up, +z toward the snout, +x = the dragon's left.
//                              The keeper parents the shrine to this matrix: the shrine and Clawd ride it exactly. Rest pose = (-3600, 420, 2600), +z forward.
//   browFrame(t) -> Matrix4    alias of headFrame(t).
//   brow(t) -> { position: Vector3, quaternion: Quaternion, matrix: Matrix4 }   the same frame, decomposed.
//   spine(u, t) -> Vector3     body centre line. u 0 = neck .. 1 = tail tip. Also: spline(u, t), radius(u) (body radius, metres).
//   anchor(name, t) -> Vector3 world point. names: brow, head, snout, jaw, chin, eye (= eyeR), eyeL, eyeR, hornL, hornR, hornTipL, hornTipR, mouth, nose, neck, mid, tail, tailTip,
//                              legFL, legFR, legBL, legBR (feet), maneL, maneR (waterfall sources at the jaw hinge).
//   velocity(u, t) -> Vector3  world m/s of the body at u (u = -1: the brow). speed(t) head speed m/s.
//   surfaceY(x, z) -> number   head-local y of the skull surface at head-local (x, z): plant props / Clawd's crawl on it. Scratch point: anchor 'scratch' (head-local [-27, -4, 10], just behind the right eye).
//   eye(t) -> { open, pupil, soft, narrow }   eye state in use: open 0..1, pupil 0.09 slit .. 0.92 round, soft 0..1 (kind), narrow 0..1 (rage). Authored from CUES.
//   setEye(fn)                 optional override: fn(t) -> partial state (must itself be pure); setEye(null) clears it.
//   thrash(t) -> 0..1          the bolt reaction (52.0-53.5). flyK(t) -> 0..1 flight weight. bodyLen = 1500 m.
//   LOCAL                      head-local anchor table { name: [x, y, z] }.
// Update order: dragon runs before keeper and fx, so their update(t) sees the posed head; read head.matrixWorld or headFrame(t).
// Solids registered: 'dragon-skull' (box proxy, top y -3 in head space, under the plateau), 'dragon-hornL', 'dragon-hornR' (group 'dragon').
// Antlers + shimenawa + shide appear with the eye (visible t in [20, 70)); the peak is a plain mountain until s08. The 36 m dent under the sleeping head is baked into world.islandHeight. Waterfall mane on 23.6-68.6.
import { buildPath, BODY_LEN, eyeState, sstep, clamp } from './dragon-path.js';
import { buildHead } from './dragon-head.js';
import { buildBody, radiusAt } from './dragon-body.js';

const LOCAL = { brow: [0, 0, 0], head: [0, -20, 30], snout: [0, -26, 82], nose: [0, -22, 84], mouth: [0, -44, 62], jaw: [0, -52, 42], chin: [0, -62, 62], eye: [30, -11, 28], eyeR: [30, -11, 28], eyeL: [-30, -11, 28],
  hornL: [-15, 2, -16], hornR: [15, 2, -16], hornTipL: [-44, 64, -74], hornTipR: [44, 64, -74], scratch: [-27, -4, 10], neck: [0, -26, -36], maneL: [-34, -42, 18], maneR: [34, -42, 18] };

export async function create(ctx) {
  const { THREE: T, mat } = ctx;
  const V3 = T.Vector3;
  const terrain = ctx.modules.world?.islandHeight ?? ((r) => ctx.geo.ISLAND.peak * Math.max(0, 1 - r / ctx.geo.ISLAND.R));
  const P = buildPath(terrain);
  const root = new T.Group(); root.name = 'dragon'; ctx.scene.add(root);
  const head = new T.Group(); head.name = 'dragon-head'; head.matrixAutoUpdate = false; root.add(head);
  let eyeFn = null;
  const eye = (t) => eyeFn ? { ...eyeState(t), ...eyeFn(t) } : eyeState(t);
  const spine = (u, t) => P.spine(u, t);
  const headFrame = (t) => P.headFrame(t);
  const legAt = (name, t) => { const u = name[3] === 'F' ? 0.17 : 0.61, side = name[4] === 'L' ? -1 : 1, p = P.spine(u, t), r = 50, f = {}; return p.add(new V3(side * r, -r * 0.6, 0)); };

  const pub = {
    root, head, headFrame, browFrame: headFrame, spine, spline: spine, radius: (u) => 44, LOCAL, bodyLen: BODY_LEN,
    flyK: P.flyK, thrash: P.thrash, eye, setEye(fn) { eyeFn = fn; },
    anchor(name, t) { if (name === 'tail') return spine(0.92, t); if (name === 'tailTip') return spine(1, t); if (name === 'mid') return spine(0.5, t);
      if (name.startsWith('leg')) return legAt(name, t);
      return new V3(...(LOCAL[name] || LOCAL.head)).applyMatrix4(headFrame(t)); },
    velocity(u, t) { const h = 0.5 / 24; let t1 = t + h, t0 = t - h; if (t < 63.5 && t1 >= 63.5) t1 = 63.4999; if (t >= 63.5 && t0 < 63.5) t0 = 63.5; const a = u < 0 ? P.headPos(t1) : spine(u, t1), b = u < 0 ? P.headPos(t0) : spine(u, t0); return a.sub(b).multiplyScalar(1 / (t1 - t0)); },
    speed(t) { return P.headPos(t + 0.02).distanceTo(P.headPos(t - 0.02)) * 25; },
    surfaceY: (x, z) => -1,
    brow(t) { const m = headFrame(t), p = new V3(), q = new T.Quaternion(), s = new V3(); m.decompose(p, q, s); return { position: p, quaternion: q, matrix: m }; },
  };

  // s21 impact frame: the dragon goes black against a blinding backdrop that ramps over 3 frames (luma rule), the amber eye stays
  const back = new T.Mesh(new T.CircleGeometry(1, 48), mat.fx(0xfbf9ff, { k: 1.3, side: T.DoubleSide, depthWrite: false })); back.frustumCulled = false; back.visible = false; back.name = 'impact-back'; root.add(back);
  const STRIKE_F = Math.round(ctx.cues.strike * 24), impactBack = (f) => { const x = f - STRIKE_F; return x < -1 ? 0 : x === -1 ? 0.3 : x === 0 ? 0.6 : x <= 14 ? 1 : x <= 22 ? 1 - (x - 14) / 8 : 0; }, impactDark = (f) => { const x = f - STRIKE_F; return x < 0 ? 0 : x <= 15 ? 1 : x <= 22 ? 1 - (x - 15) / 7 : 0; };
  let silMats = null; const DARK = new T.Color(0x171028);
  function setDark(k) { if (!silMats) { const seen = new Set(); silMats = []; root.traverse(o => { const m = o.material; if (!m || seen.has(m) || !m.uniforms?.uBase) return; seen.add(m); if (m.uniforms.uMap?.value || m.uniforms.tMap?.value || m.map) return; for (const n in m.uniforms) { const v = m.uniforms[n].value; if (v?.isColor && !lightColors.has(v)) silMats.push({ v, c: v.clone() }); } }); } for (const e of silMats) e.v.copy(e.c).lerp(DARK, k); }
  // the shared LIGHT rig colours are uniforms of every dragon material too: they belong to the look, never to this snapshot (freezing them here made the look of the whole film depend on the first frame rendered)
  const lightColors = new Set(Object.values(ctx.light.u).map(u => u.value).filter(v => v?.isColor));
  const H = buildHead(ctx, head); pub.surfaceY = H.surfaceY;
  const B = buildBody(ctx, root, P); pub.radius = radiusAt;
  ctx.shadowRoots.push(head);
  return {
    ...pub, jawPivot: H.jawPivot,
    update(t, shot) {
      root.visible = shot.set !== 'card' && t < 73; if (!root.visible) return;
      const f = headFrame(t); head.matrix.copy(f); head.matrixWorldNeedsUpdate = true;
      B.group.visible = t >= 20 && t < 70;
      if (B.group.visible) B.update(t, shot, f);
      H.update(t, shot, { eye }, clamp(pub.speed(t) / 420, 0, 1));
      const f24 = Math.round(t * 24); setDark(shot.id === 's21' ? impactDark(f24) : 0);
      // the head may not throw its shadow over the shrine in the close shots (s13: its neck blacked the courtyard out)
      const wantShadow = shot.set !== 'shrine', hi = ctx.shadowRoots.indexOf(head); if (wantShadow && hi < 0) ctx.shadowRoots.push(head); else if (!wantShadow && hi >= 0) ctx.shadowRoots.splice(hi, 1);
    },
    afterCamera(t, shot) {
      const k = shot.id === 's21' ? impactBack(Math.round(t * 24)) : 0; back.visible = k > 0; if (!back.visible) return;
      const h = pub.anchor('head', t), c = ctx.camera.position, dir = h.clone().sub(c).normalize(); back.position.copy(h).addScaledVector(dir, 260); back.scale.setScalar(120 + 280 * k); back.lookAt(c);
    },
    dispose() { root.removeFromParent(); },
  };
}
