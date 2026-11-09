// RYŪ · keeper contacts (owner: keeper). Segment vs rounded body tests for everything the box solids cannot see: the whole broom (shaft + bristles),
// the bell rope, Clawd's nubs and legs against his rounded body, against each other, and against the set under him (platform, steps, hero horn, brow ridge).
// All tests run on the posed scene (no render), in shrine-local metres. Registered with ctx.solids.custom(), so tools/check.mjs reports them with the other solids.
import * as THREE from 'three';
const T = THREE, V3 = T.Vector3;

// Clawd's body: rounded box, mascot units (body node origin = its centre). Fit against the mesh vertices: within 7 mm of the real surface.
export const BODY = { he: [0.5, 0.37, 0.28], r: 0.17 };

export function sdRoundBox(px, py, pz, hx, hy, hz, r) {
  const x = Math.abs(px) - hx + r, y = Math.abs(py) - hy + r, z = Math.abs(pz) - hz + r;
  return Math.hypot(Math.max(x, 0), Math.max(y, 0), Math.max(z, 0)) + Math.min(Math.max(x, y, z), 0) - r;
}

export function createContacts(ctx, { rig, clawd, broom, BROOM, ropeRef, tailRef, root, isHeld, env }) {
  const B = clawd.nodes.body;
  const inv = new T.Matrix4(), bm = new T.Matrix4(), bi = new T.Matrix4(), p = new V3(), sc = new V3();
  let hx, hy, hz, rr;
  function frame() {   // body frame in shrine-local metres
    inv.copy(root.matrixWorld).invert(); bm.multiplyMatrices(inv, B.matrixWorld); bi.copy(bm).invert();
    const e = bm.elements; sc.set(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
    hx = BODY.he[0] * sc.x; hy = BODY.he[1] * sc.y; hz = BODY.he[2] * sc.z; rr = BODY.r * Math.min(sc.x, sc.y, sc.z);
  }
  const bodySD = (q) => { p.copy(q).applyMatrix4(bi); return sdRoundBox(p.x * sc.x, p.y * sc.y, p.z * sc.z, hx, hy, hz, rr); };
  // capsules from the posed rig, shrine-local
  const local = (o, x, y, z) => new V3(x, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
  const capsules = () => {
    const nub = (s) => { const a = rig.arms[s], k = s === 'R' ? 1 : -1; return { name: 'nub' + s, a: local(a, 0, 0, 0), b: local(a, k * 0.09, 0, 0), tip: local(a, k * 0.19, 0, 0), r: 0.05 }; };
    const leg = (s) => { const h = rig.legs[s]; return { name: 'leg' + s, a: local(h, 0, 0, 0), b: local(h, 0, -0.148, 0), tip: local(h, 0, -0.23, 0), r: 0.041 }; };
    return { nubs: [nub('L'), nub('R')], legs: ['FL', 'FR', 'BL', 'BR'].map(leg) };
  };
  const bl = (y, x = 0, z = 0) => local(broom, x, y, z);
  const lerpP = (a, b, k) => a.clone().lerp(b, k);
  const min = (a, b, f, n, from = 0, to = 1) => { let m = Infinity, at = null; for (let i = 0; i <= n; i++) { const q = lerpP(a, b, from + (to - from) * i / n), v = f(q); if (v < m) { m = v; at = q; } } return [m, at]; };
  const segSeg = (a0, a1, b0, b1, n = 10) => { let m = Infinity; for (let i = 0; i <= n; i++) { const q = lerpP(a0, a1, i / n); for (let j = 0; j <= n; j++) m = Math.min(m, q.distanceTo(lerpP(b0, b1, j / n))); } return m; };

  return function test(t, activeGroups, state) {
    if (!root.visible || !broom.visible || !B.visible) return [];
    root.updateMatrixWorld(true); frame();
    const out = [], hit = (a, b, depth, tol = 0.0) => { if (depth > tol) out.push({ a, b, depth: +depth.toFixed(4) }); };
    const { nubs, legs } = capsules(), L = BROOM.L;
    // ---- broom
    const shaftA = bl(0.26), shaftB = bl(L);
    { let [m] = min(shaftA, shaftB, bodySD, 56); hit('broom-shaft', 'clawd-body', 0.023 - m);
      const [e] = min(shaftA, shaftB, env.sd, 40); hit('broom-shaft', env.name(), 0.023 - e, 0.015); }
    { const lines = [[-0.1, 0.03], [-0.05, 0.015], [0, 0], [0.05, -0.015], [0.1, -0.03]].map(([x, z]) => [bl(0.26, x * 0.3, 0), bl(0.0, x * 1.3, z)]);
      for (const [a, b] of lines) { const [m] = min(a, b, bodySD, 24); hit('broom-head', 'clawd-body', 0.012 - m); const [e] = min(a, b, env.sd, 20); hit('broom-head', env.name(), 0.012 - e, 0.03); } }
    // the free nub and the legs must not be hit by the broom; the holding nub (R) is the grip
    for (const c of [nubs[0], ...legs]) { const d = segSeg(shaftA, shaftB, c.a, c.b, 14); hit('broom-shaft', 'clawd-' + c.name, 0.023 + c.r - d, 0.012); }
    // ---- nubs: the tip must stay outside the body (the root is the shoulder), the whole nub against the set
    for (const c of nubs) { hit('clawd-' + c.name, 'clawd-body', -bodySD(c.tip) + 0.012); const [e] = min(c.a, c.b, env.sd, 14); hit('clawd-' + c.name, env.name(), c.r - e, 0.014); }
    // ---- legs: the sole must stay outside the body, the whole leg against the set
    for (const c of legs) { hit('clawd-' + c.name, 'clawd-body', -bodySD(c.tip) + 0.012); const [e] = min(c.a, c.b, env.sd, 12); hit('clawd-' + c.name, env.name(), c.r - e, 0.016); }
    // ---- rope (visible curve, sampled)
    const rope = ropeRef.pts; const rr0 = 0.04, held = isHeld();
    if (rope && rope.length) {
      let mb = Infinity; for (const q of rope) mb = Math.min(mb, bodySD(q)); hit('rope', 'clawd-body', rr0 - mb, 0.002);
      for (const c of [...nubs, ...legs]) { const grip = held && c.name === 'nubL'; let md = Infinity; for (const q of rope) { if (grip && q.distanceTo(c.b) < 0.17) continue; const k = THREE.MathUtils.clamp(q.clone().sub(c.a).dot(c.b.clone().sub(c.a)) / c.b.distanceToSquared(c.a), 0, 1), d = q.distanceTo(lerpP(c.a, c.b, k)); md = Math.min(md, d); }
        hit('rope', 'clawd-' + c.name, rr0 + c.r - md, 0.012); }
      if (tailRef.p) { hit('rope-knot', 'clawd-body', 0.058 - bodySD(tailRef.p), 0.002); }
    }
    return out;
  };
}
