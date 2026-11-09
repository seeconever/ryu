// RYŪ · WORLD life (owner: world): the calico cat (asleep on the hot pent-roof tiles in s02; sitting up watching the
// shooting stars in s30), the gulls (perched on the quay wires -> burst in s07, gliding over the harbour in s01, scattering
// from the rising giant in s15), the furin wind chime on the porch (rings in s02, stops dead in s07) and the laundry on the
// balcony (flaps in the sea breeze). Characters on twos (ctx.onTwos), cel + ink; the calico patches are painted in the cel
// shader from the cat's own body space (crisp, no texture seams).
import * as THREE from 'three';
import { catenary } from './world-geo.js';

const V3 = THREE.Vector3, C = (h) => new THREE.Color(h);
const ell = (cx, cy, cz, rx, ry, rz, { seg = 28, rot = null } = {}) => { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)); g.scale(rx, ry, rz); if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))); g.translate(cx, cy, cz); return g; };
function merge(geos) { const P = [], N = []; for (const g0 of geos) { const g = g0.index ? g0.toNonIndexed() : g0; P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); g.computeBoundingSphere(); return g; }
const tube = (pts, r, seg = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new V3(...p))), seg, r, 12, false);
// a tube whose radius eases from r0 to r1, closed with a rounded tip (a tail, not a capsule)
function taperTube(pts, r0, r1, seg = 40) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p))), g = new THREE.TubeGeometry(curve, seg, 1, 12, false), p = g.attributes.position, RS = 13, v = new V3();
  for (let i = 0; i < p.count; i++) { const j = Math.floor(i / RS), u = j / seg, c = curve.getPointAt(Math.min(1, u)), r = r0 + (r1 - r0) * u * u;
    v.fromBufferAttribute(p, i).sub(c).multiplyScalar(r).add(c); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  const end = curve.getPointAt(1), dir = curve.getTangentAt(1), tip = new THREE.SphereGeometry(r1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  tip.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir)); tip.translate(end.x, end.y, end.z);
  return merge([g, tip]);
}
const HEAD_SLEEP = [0.05, -0.6, -0.14];   // the sleeping head: chin down on the paws, face turned 3/4 toward the s02 camera

// calico cel material: patches = [[cx, cy, cz, rx, ry, rz, kind]] (kind 1 = orange, 2 = black) in the mesh's own space
function catMat(ctx, patches, id) {
  const m = ctx.mat.cel(0xfbf6ee, { id, hiAmt: 0.22, hiT: 0.74, spec: 0.0, rimI: 0.35, bevel: 0.03 });
  const pc = patches.concat(Array(6).fill([0, 0, 0, 1e-3, 1e-3, 1e-3, 0])).slice(0, 6);
  m.uniforms.uPC = { value: pc.map(p => new V3(p[0], p[1], p[2])) }; m.uniforms.uPR = { value: pc.map(p => new V3(p[3], p[4], p[5])) }; m.uniforms.uPK = { value: pc.map(p => p[6]) };
  const lin = (h) => C(h);
  m.uniforms.uCO = { value: lin(0xee9a48) }; m.uniforms.uCB = { value: lin(0x3c3438) }; m.uniforms.uSO = { value: ctx.mat.shadeOf(0xee9a48) }; m.uniforms.uSB = { value: ctx.mat.shadeOf(0x3c3438).multiplyScalar(0.9) };
  m.uniforms.uSW = { value: C(0xc4bce0) };
  ctx.glsl.patchShader(m, 'calico', (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 uBase,', 'uniform vec3 uPC[6]; uniform vec3 uPR[6]; uniform float uPK[6]; uniform vec3 uCO, uCB, uSO, uSB, uSW;\nuniform vec3 uBase,')
      .replace('vec3 base = uBase * vIC, shade = uShade * vIC, hiC = uHi * vIC;', `float po = 0.0, pb = 0.0; float pn = n3(vO * 24.0) * 0.6 + n3(vO * 61.0) * 0.4;
        for (int i = 0; i < 6; i++){ if (uPK[i] < 0.5) continue; float d = length((vO - uPC[i]) / uPR[i]) + (pn - 0.5) * 0.55; float k = 1.0 - smoothstep(0.97, 1.0, d); if (uPK[i] < 1.5) po = max(po, k); else pb = max(pb, k); }
        vec3 base = mix(mix(uBase, uCO, po), uCB, pb) * vIC, shade = mix(mix(uSW, uSO, po), uSB, pb) * vIC, hiC = mix(mix(uHi, uCO * 1.15, po), uCB * 1.6, pb) * vIC;`);
  });
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
function buildCat(ctx) {
  const { mat } = ctx, ids = { body: mat.nextId(), head: mat.nextId(), tail: mat.nextId() };
  const pink = mat.cel(0xf29aa8, { id: 101, ink: false, hiAmt: 0.3 }), inkM = mat.cel(0x2a2026, { id: 102, ink: false, hiAmt: 0 });
  const eyeM = mat.cel(0xe8b030, { id: 103, ink: false, hiAmt: 0.6, hiT: 0.2, spec: 0.8, specThr: 0.9, flatSpec: 0 }), pupM = mat.cel(0x141016, { id: 104, ink: false, hiAmt: 0 }), shineM = mat.cel(0xffffff, { id: 105, ink: false, keyK: 1.4, hiAmt: 0 });
  // one smooth skull (no merged-ellipsoid seams): a sphere pushed into cheeks + a short muzzle; facing +x, top +y
  const skullGeo = (() => { const g = new THREE.SphereGeometry(1, 44, 30), p = g.attributes.position, v = new V3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i);
      let x = v.x * 0.066, y = v.y * (v.y > 0 ? 0.054 : 0.06), z = v.z * 0.074;
      const low = Math.max(0, 0.15 - v.y); z *= 1 + 0.2 * low;                                                             // full cheeks
      const fr = Math.max(0, v.x); x += 0.02 * fr * fr * Math.max(0, 1 - Math.abs(v.y + 0.38) * 2.4) * Math.max(0, 1 - Math.abs(v.z) * 1.7);   // muzzle
      p.setXYZ(i, x, y + 0.035, z); }
    g.computeVertexNormals(); return g; })();
  // a smooth flattened ear (many segments: no faceted ink), its opening facing +x; the pink inner ear is a single-sided
  // plate on the front face only (never seen from behind)
  const earGeo = new THREE.ConeGeometry(0.031, 0.056, 16, 1).scale(1, 1, 0.5).rotateY(Math.PI / 2);
  const innerGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.018, 0); s.quadraticCurveTo(-0.004, 0.02, 0, 0.043); s.quadraticCurveTo(0.004, 0.02, 0.018, 0); s.lineTo(-0.018, 0);
    return new THREE.ShapeGeometry(s, 6).rotateY(Math.PI / 2); })();
  const head = (open) => { const h = new THREE.Group();
    h.add(new THREE.Mesh(skullGeo, catMat(ctx, [[-0.03, 0.09, -0.05, 0.06, 0.05, 0.05, 1], [-0.025, 0.095, 0.05, 0.04, 0.035, 0.04, 2]], ids.head)));
    for (const s of [-1, 1]) { const ear = new THREE.Group(); ear.position.set(-0.004, 0.083, s * 0.04); ear.rotation.set(s * -0.32, 0, -0.1); h.add(ear);
      const shell = new THREE.Mesh(earGeo.clone().translate(0, 0.024, 0), catMat(ctx, s > 0 ? [[0, 0.03, 0, 0.05, 0.05, 0.05, 2]] : [[0, 0.03, 0, 0.05, 0.05, 0.05, 1]], ids.head)); ear.add(shell);
      const inner = new THREE.Mesh(innerGeo, pink); inner.position.set(0.015, 0.002, 0); inner.rotation.z = 0.27; ear.add(inner); }
    const nose = new THREE.Mesh(ell(0.083, 0.02, 0, 0.006, 0.005, 0.009, { seg: 12 }), pink); h.add(nose);
    if (!open) for (const s of [-1, 1]) { const arc = new THREE.TorusGeometry(0.016, 0.0036, 6, 18, Math.PI * 0.9); arc.rotateZ(Math.PI * 1.05); arc.rotateY(Math.PI / 2 + s * 0.5); arc.translate(0.06, 0.044, s * 0.03); h.add(new THREE.Mesh(arc, inkM)); }
    else for (const s of [-1, 1]) { const eg = new THREE.Group(); eg.position.set(0.064, 0.044, s * 0.031); eg.lookAt(new V3(1, 0.35, s * 0.42).add(eg.position)); h.add(eg);
      const disc = (r, ry, m, z) => { const d = new THREE.Mesh(new THREE.CircleGeometry(r, 24).scale(1, ry, 1), m); d.position.z = z; eg.add(d); return d; };
      disc(0.0185, 0.82, inkM, 0.0); disc(0.0155, 0.8, eyeM, 0.0012); eg.userData.pupil = disc(0.0118, 0.9, pupM, 0.0024); disc(0.0042, 1, shineM, 0.0036).position.set(-0.004, 0.006, 0.0036); disc(0.002, 1, shineM, 0.0036).position.set(0.005, -0.004, 0.0036); }
    const mouth = new THREE.TorusGeometry(0.008, 0.0018, 4, 10, Math.PI); mouth.rotateY(Math.PI / 2); for (const s of [-1, 1]) { const mm = mouth.clone().translate(0.087, 0.004, s * 0.008); h.add(new THREE.Mesh(mm, inkM)); }
    return h; };
  // sleeping (curled, head on the paws, tail wrapped round the front); cat space: spine along +x, lying on y = 0
  const sleep = new THREE.Group(); sleep.name = 'cat-sleep';
  const sBody = merge([ell(-0.02, 0.088, 0, 0.19, 0.088, 0.12, { rot: [0, -0.15, 0] }), ell(-0.13, 0.082, 0.025, 0.1, 0.082, 0.11), ell(0.1, 0.07, 0.035, 0.085, 0.068, 0.095),
    ell(0.2, 0.021, 0.085, 0.052, 0.021, 0.03), ell(0.205, 0.021, 0.02, 0.052, 0.021, 0.03)]);   // + the two forepaws the chin rests on
  sleep.add(new THREE.Mesh(sBody, catMat(ctx, [[0.0, 0.18, -0.06, 0.15, 0.09, 0.12, 1], [-0.17, 0.15, -0.01, 0.08, 0.08, 0.1, 2], [0.07, 0.16, -0.07, 0.05, 0.05, 0.05, 2]], ids.body)));
  // the tail wraps round the front of the body, tapering to a soft tip (no capsule end)
  const tailS = new THREE.Mesh(taperTube([[-0.2, 0.05, -0.03], [-0.235, 0.03, 0.07], [-0.15, 0.025, 0.155], [0.0, 0.025, 0.185], [0.12, 0.025, 0.17], [0.19, 0.026, 0.135]], 0.027, 0.012),
    catMat(ctx, [[0.17, 0.03, 0.15, 0.055, 0.05, 0.055, 1], [0.05, 0.03, 0.19, 0.03, 0.05, 0.03, 2], [-0.2, 0.04, 0.03, 0.06, 0.06, 0.08, 1]], ids.tail)); sleep.add(tailS);
  const sHead = head(false); sHead.position.set(0.215, 0.066, 0.05); sHead.rotation.set(...HEAD_SLEEP); sleep.add(sHead);
  // sitting up (s30): haunches, upright torso with shoulders + a neck ruff, front legs, tail round the feet, head looking up
  const sit = new THREE.Group(); sit.name = 'cat-sit';
  const tBody = merge([ell(-0.05, 0.085, 0, 0.12, 0.085, 0.13), ell(0.02, 0.17, 0, 0.085, 0.14, 0.095, { rot: [0, 0, -0.32] }), ell(0.065, 0.16, 0, 0.06, 0.09, 0.075),
    ell(0.045, 0.245, 0, 0.06, 0.05, 0.085), ell(0.03, 0.205, 0.05, 0.05, 0.07, 0.042), ell(0.03, 0.205, -0.05, 0.05, 0.07, 0.042),
    tube([[0.085, 0.2, 0.04], [0.1, 0.1, 0.042], [0.105, 0.012, 0.042]], 0.024, 8), tube([[0.085, 0.2, -0.04], [0.1, 0.1, -0.042], [0.105, 0.012, -0.042]], 0.024, 8), ell(0.115, 0.012, 0.042, 0.034, 0.015, 0.026), ell(0.115, 0.012, -0.042, 0.034, 0.015, 0.026)]);
  sit.add(new THREE.Mesh(tBody, catMat(ctx, [[-0.06, 0.24, -0.06, 0.1, 0.14, 0.1, 1], [-0.13, 0.1, 0.07, 0.08, 0.08, 0.09, 2], [-0.02, 0.27, 0.06, 0.06, 0.06, 0.05, 2]], ids.body)));
  const tailT = new THREE.Mesh(taperTube([[-0.15, 0.035, 0.0], [-0.15, 0.02, 0.1], [-0.03, 0.02, 0.15], [0.09, 0.022, 0.11], [0.15, 0.03, 0.07]], 0.025, 0.012),
    catMat(ctx, [[0.14, 0.03, 0.075, 0.05, 0.05, 0.05, 2]], ids.tail)); sit.add(tailT);
  const tHead = head(true); tHead.position.set(0.06, 0.29, 0); sit.add(tHead);
  const root = new THREE.Group(); root.name = 'cat'; root.add(sleep, sit);
  return { root, sleep, sit, sHead, tHead, tailS, tailT };
}

// ---------------------------------------------------------------------------------------------------------------------
function gullFactory(ctx) {
  const { mat } = ctx, idB = mat.nextId(), idW = mat.nextId();
  const white = mat.cel(0xfbfbf8, { id: idB, hiAmt: 0.5, rimI: 0.4, spec: 0.1 }), grey = mat.cel(0xb4bccc, { id: idW, hiAmt: 0.45, side: THREE.DoubleSide });
  const black = mat.cel(0x26262e, { id: idW, side: THREE.DoubleSide, hiAmt: 0.2 }), beakM = mat.cel(0xf2c030, { id: mat.nextId(), hiAmt: 0.5 }), legM = mat.cel(0xe8a090, { id: mat.nextId() }), eyeM = mat.cel(0x101014, { id: 106, ink: false });
  const bodyG = merge([ell(0, 0, 0, 0.075, 0.07, 0.19), ell(0, 0.055, 0.17, 0.052, 0.05, 0.058), ell(0, 0.0, -0.2, 0.05, 0.022, 0.09, { rot: [0.15, 0, 0] })]);
  const shape = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); };
  const innerG = shape([[0, 0.07], [0.27, 0.06], [0.28, -0.03], [0, -0.08]]), outerG = shape([[0, 0.06], [0.2, 0.04], [0.33, 0.0], [0.2, -0.04], [0, -0.03]]), tipG = shape([[0.2, 0.04], [0.33, 0.0], [0.2, -0.04], [0.16, 0.0]]);
  tipG.translate(0, 0.002, 0);
  return () => { const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(new THREE.Mesh(bodyG, white));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 8).rotateX(Math.PI / 2), beakM); beak.position.set(0, 0.045, 0.245); body.add(beak);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), eyeM); e.position.set(s * 0.04, 0.07, 0.2); body.add(e); }
    const legs = new THREE.Group(); for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.09, 6), legM); l.position.set(s * 0.03, -0.1, 0.02); legs.add(l); } body.add(legs);
    const wings = [-1, 1].map(s => { const sh = new THREE.Group(); sh.position.set(s * 0.05, 0.035, 0.02); body.add(sh);
      const inner = new THREE.Mesh(innerG, grey); inner.scale.x = s; sh.add(inner); const el = new THREE.Group(); el.position.x = s * 0.27; sh.add(el);
      const outer = new THREE.Mesh(outerG, grey); outer.scale.x = s; el.add(outer); const tip = new THREE.Mesh(tipG, black); tip.scale.x = s; el.add(tip); return { sh, el, s }; });
    g.userData = { body, wings, legs }; return g; };
}
// wing drawing per mode: 'perch' (folded), 'glide', 'flap' (4 drawings, f = drawing index)
function poseGull(g, mode, f = 0) { const { wings, legs } = g.userData;
  const K = { perch: [[-0.15, 2.6, -1.25, 0.0]], glide: [[0.12, 0, -0.08, 0]], flap: [[0.85, 0, -0.35, 0], [0.15, 0, 0.18, 0], [-0.62, 0, 0.32, 0], [0.05, 0, -0.55, 0]] }[mode];
  const [a1, yaw, a2] = K[f % K.length]; legs.visible = mode === 'perch';
  for (const w of wings) { w.sh.rotation.set(0, mode === 'perch' ? -w.s * 1.35 : 0, w.s * a1); w.el.rotation.set(0, mode === 'perch' ? -w.s * 0.25 : 0, w.s * a2); w.sh.scale.setScalar(mode === 'perch' ? 0.62 : 1); } }

// ---------------------------------------------------------------------------------------------------------------------
function buildFurin(ctx) {
  const { mat } = ctx, g = new THREE.Group(); g.name = 'furin';
  // clear glass: pale see-through cyan with a bright window highlight, the painted goldfish + waves, the inner rim darker
  // (drawn double-sided, so the inside of the bell shows from below like real glass)
  const glassTex = ctx.kit.canvasTex(256, 96, (c, W, H) => { c.fillStyle = '#eefaff'; c.fillRect(0, 0, W, H);
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(160,220,245,0.0)'); gr.addColorStop(0.7, 'rgba(150,215,240,0.35)'); gr.addColorStop(1, 'rgba(90,160,210,0.7)'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(40,120,220,0.9)'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) { c.beginPath(); for (let x = 0; x <= W; x += 4) c.lineTo(x, H * 0.84 - i * 7 + 4 * Math.sin(x / 10 + i * 1.3)); c.stroke(); }
    for (const fx of [36, 120, 204]) { c.fillStyle = '#ec3a26'; c.beginPath(); c.ellipse(fx, H * 0.45, 16, 9, 0.2, 0, 7); c.fill(); c.beginPath(); c.moveTo(fx - 14, H * 0.45); c.lineTo(fx - 30, H * 0.3); c.lineTo(fx - 27, H * 0.62); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(fx + 8, H * 0.41, 2.5, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.fillRect(W * 0.62, H * 0.12, 7, H * 0.55); c.fillRect(W * 0.66, H * 0.2, 3, H * 0.3); });
  const bellG = new THREE.LatheGeometry([[0.0, 0.0], [0.012, -0.002], [0.03, -0.012], [0.042, -0.03], [0.047, -0.048], [0.046, -0.052]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  const bell = new THREE.Mesh(bellG, mat.cel(0xffffff, { id: mat.nextId(), map: glassTex, side: THREE.DoubleSide, hiAmt: 0.5, hiT: 0.55, spec: 0.0, rimI: 0.5, backK: 0.82 }));
  const paper = ctx.kit.canvasTex(64, 320, (c, W, H) => { c.fillStyle = '#fbeef3'; c.fillRect(0, 0, W, H); c.fillStyle = '#d84a5a'; c.font = '700 30px "Yu Mincho", serif'; c.textAlign = 'center';
    ['涼', '風'].forEach((ch, i) => c.fillText(ch, W / 2, 70 + i * 46)); c.fillStyle = 'rgba(60,140,220,0.6)'; c.fillRect(0, H - 30, W, 7); c.fillRect(0, 12, W, 4); });
  // the tanzaku: a long paper strip, segmented so it can bend and flutter (posed by update(), on twos)
  const stripGeo = new THREE.PlaneGeometry(0.06, 0.3, 1, 8).translate(0, -0.15, 0);
  const strip = new THREE.Mesh(stripGeo, mat.cel(0xffffff, { id: mat.nextId(), map: paper, side: THREE.DoubleSide, hiAmt: 0.3 })); strip.userData.base = Float32Array.from(stripGeo.attributes.position.array);
  strip.rotation.y = Math.PI / 4;   // turned 45° so it reads both from along the house (s02) and from the street (s07)
  // the clapper (zetsu): a glass bead hanging just below the rim, where it strikes
  const clap = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8).scale(1, 1.4, 1), mat.cel(0xbfe8f6, { id: mat.nextId(), hiAmt: 0.6 }));
  // the cord hangs from the eave hook (group origin); bell, clapper and the paper strip swing with it
  const CORD = 0.42, cordM = mat.cel(0xd84a4a, { id: 107, ink: false, hiAmt: 0.2 });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, CORD, 5).translate(0, -CORD / 2, 0), cordM);
  const clapCord = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.085, 4).translate(0, -0.0425, 0), cordM);
  const swing = new THREE.Group(), stripG = new THREE.Group(); g.add(swing); swing.add(cord, bell); bell.position.y = -CORD;
  clapCord.position.y = -CORD; swing.add(clapCord); clap.position.y = -CORD - 0.058; swing.add(clap); stripG.position.y = -CORD - 0.085; swing.add(stripG); stripG.add(strip);
  return { g, swing, stripG, strip, cord: CORD };
}

// ---------------------------------------------------------------------------------------------------------------------
function buildLaundry(ctx, pole, pick = [0, 1, 2, 3, 4], yaw = null) {
  const { mat } = ctx, items = [];
  const towel = (a, b, stripes) => ctx.kit.canvasTex(64, 128, (c, W, H) => { c.fillStyle = a; c.fillRect(0, 0, W, H); c.fillStyle = b; for (let i = 0; i < stripes; i++) c.fillRect(0, H * (0.12 + i * 0.8 / stripes), W, H * 0.06); c.fillRect(0, H - 8, W, 4); });
  const all = [{ w: 0.36, h: 0.72, map: towel('#ffffff', '#3a7ad8', 3) }, { w: 0.52, h: 0.62, map: towel('#f8e48a', '#f8e48a', 0), shirt: true }, { w: 0.34, h: 0.6, map: towel('#7ac0f0', '#ffffff', 2) },
    { w: 0.38, h: 0.44, map: towel('#f2706a', '#ffffff', 1), shirt: true }, { w: 0.3, h: 0.55, map: towel('#ffffff', '#f0a0b8', 4) }, { w: 0.44, h: 0.5, map: towel('#ffffff', '#ffffff', 0), shirt: true }];
  const defs = pick.map(i => all[i]), span = pole.x1 - pole.x0;
  defs.forEach((d, i) => { const geo = new THREE.PlaneGeometry(d.w, d.h, 6, 8).translate(0, -d.h / 2, 0);
    const m = new THREE.Mesh(geo, mat.cel(0xffffff, { id: mat.nextId(), map: d.map, side: THREE.DoubleSide, hiAmt: 0.35, hiT: 0.6 }));
    m.position.set(pole.x0 + span * (i + 0.6) / (defs.length + 0.2), pole.y - 0.02, pole.z); m.userData = { base: Float32Array.from(geo.attributes.position.array), w: d.w, h: d.h, ph: i * 1.7 + pick[0] };
    if (yaw) m.rotation.y = yaw[i % yaw.length];   // hung on swivel hangers: turned, so they read from along the house too
    if (d.shirt) { for (const s of [-1, 1]) { const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.18, 2, 2).translate(s * 0.08, -0.09, 0), m.material); sl.position.set(s * d.w / 2, -0.04, 0); sl.rotation.z = s * 0.7; m.add(sl); } }
    items.push(m); });
  // hangers: little hooks over the pole (wire lines)
  return { items, hooks: items.map(m => ({ pts: [[m.position.x, pole.y - 0.02, pole.z], [m.position.x, pole.y + 0.05, pole.z]], r: 0.004 })) };
}
function flutter(m, t, k = 1) { const p = m.geometry.attributes.position, b = m.userData.base, w = m.userData.w, h = m.userData.h;
  for (let i = 0; i < p.count; i++) { const x = b[i * 3], y = b[i * 3 + 1], d = -y / h;   // 0 at the pole -> 1 at the hem
    const wave = Math.sin(t * 7.5 - d * 4.2 + x * 6 + m.userData.ph) * 0.06 + Math.sin(t * 11.3 - d * 6.0 + m.userData.ph * 2) * 0.025;
    p.setXYZ(i, x - d * d * 0.16 * k + wave * d * 0.6 * k, y + d * d * 0.05 * k, b[i * 3 + 2] + wave * d * k * 0.9 + d * 0.05 * k); }
  p.needsUpdate = true; m.geometry.computeVertexNormals(); }

// =====================================================================================================================
export function buildLife(ctx, g, { hero, wires, poleLine }) {
  const { util, onTwos, cues } = ctx;
  // ---- the cat on the pent roof ----
  const cat = buildCat(ctx); g.add(cat.root);
  const pent = hero.pent, catX = pent.x1 - 1.35, k = 0.45, slopeA = Math.atan2(pent.y0 - pent.y1, pent.z1 - pent.z0);
  const catPos = new V3(catX, pent.y0 + (pent.y1 - pent.y0) * k + 0.085, pent.z0 + (pent.z1 - pent.z0) * k);   // (rests on the tile humps)
  cat.root.position.copy(catPos); cat.root.rotation.set(slopeA, 0.35, 0, 'YXZ');
  const ks = 0.74, catSit = new V3(catX - 0.1, pent.y0 + (pent.y1 - pent.y0) * ks + 0.06, pent.z0 + (pent.z1 - pent.z0) * ks);   // at dusk: near the eave edge
  // ---- furin + laundry ----
  const furin = buildFurin(ctx); furin.g.position.set(...hero.furin); furin.g.scale.setScalar(2.4); g.add(furin.g);
  const laundry = buildLaundry(ctx, { x0: hero.balcony.x0 + 0.1, x1: hero.balcony.x1 - 0.1, y: hero.balcony.pole.y, z: hero.balcony.pole.z });
  const winL = buildLaundry(ctx, { x0: hero.winPole.x0 + 0.05, x1: hero.winPole.x1 - 0.1, y: hero.winPole.y, z: hero.winPole.z }, [5, 2, 4], [0.95, -0.75, 1.05]);
  laundry.items.push(...winL.items); laundry.hooks.push(...winL.hooks); laundry.items.forEach(m => g.add(m)); wires.push(...laundry.hooks);
  // ---- gulls: a pool of rigs ----
  const make = gullFactory(ctx), gulls = []; for (let i = 0; i < 22; i++) { const r = make(); r.visible = false; g.add(r); gulls.push(r); }
  // perches on the quay wires in front of the hero house (s07): sample the middle telecom cable between the hero poles
  const NP = 15, perch = []; { const line = poleLine, RJ = ctx.rng(3301); if (line) for (let i = 0; i < NP; i++) { const kk = 0.1 + 0.82 * i / (NP - 1) + (RJ() - 0.5) * 0.04; const j = Math.min(line.length - 2, Math.floor(kk * (line.length - 1))), f = kk * (line.length - 1) - j;
      perch.push(new V3(...line[j]).lerp(new V3(...line[j + 1]), f)); } }
  const R = ctx.rng(3300), gp = gulls.map(() => ({ a: R(), b: R(), c: R(), d: R() }));
  const shadowRoots = [cat.root, furin.g, ...laundry.items];

  function update(t, shot) {
    const id = shot.id, ct = onTwos(t), coast = shot.groups.includes('town');
    // cat: asleep (breathing on twos) until dusk, sitting up watching the sky at dusk
    const dusk = t > 63;
    cat.root.visible = coast && id !== 's07'; cat.sleep.visible = !dusk; cat.sit.visible = dusk;   // (s07 frames the wire, not the cat)
    if (!dusk) { const br = Math.sin(ct * 2 * Math.PI / 2.6); cat.sleep.scale.set(1, 1 + 0.025 * br, 1 + 0.012 * br); cat.sHead.rotation.set(HEAD_SLEEP[0], HEAD_SLEEP[1], HEAD_SLEEP[2] + 0.015 * br);
      cat.tailS.rotation.y = 0.04 * Math.sin(ct * 1.3) * (id === 's02' ? 1 : 0); cat.root.position.copy(catPos); cat.root.rotation.set(slopeA, 0.35, 0, 'YXZ'); }
    else { cat.root.position.copy(catSit); cat.root.rotation.set(0, -Math.PI / 2 + 0.18, -slopeA * 0.95, 'YXZ');
      const look = util.curve([[64.0, 0.45], [64.8, 0.62], [66.0, 0.7], [67.0, 0.66]], ct), turn = util.curve([[64.0, -0.12], [65.4, 0.05], [67, 0.16]], ct);
      cat.tHead.rotation.set(0.12 * Math.sin(ct * 0.9), turn, look); cat.tailT.rotation.y = 0.12 * Math.sin(ct * 2.1); }
    // furin: rings in s02, swinging in s07 until the gulls burst, then dead still
    furin.g.visible = coast;
    { let amp = id === 's02' ? 1 : id === 's07' ? 1 - util.sstep(cues.gulls, cues.gulls + 0.5, ct) : 0.35, gust = 0.6 + 0.4 * Math.sin(ct * 0.9);
      if (id === 's07' && ct > cues.gulls + 0.5) amp = 0;
      furin.swing.rotation.set(0.05 * amp * Math.sin(ct * 3.1), 0, 0.12 * amp * gust * Math.sin(ct * 4.2));
      furin.stripG.rotation.set(0.35 * amp * gust * Math.sin(ct * 4.2 - 0.9) + 0.15 * amp, 0, 0.3 * amp * Math.sin(ct * 3.3 - 0.5));
      // the paper strip bends + ripples in the breeze (on twos); it hangs dead straight once the furin stops
      const sp = furin.strip.geometry.attributes.position, sb = furin.strip.userData.base;
      for (let i = 0; i < sp.count; i++) { const y = sb[i * 3 + 1], dd = -y / 0.3; sp.setXYZ(i, sb[i * 3] + amp * 0.012 * dd * Math.sin(ct * 5.3 - dd * 3), y, sb[i * 3 + 2] + amp * gust * (0.03 * dd * Math.sin(ct * 7.1 - dd * 4.5) + 0.05 * dd * dd)); }
      sp.needsUpdate = true; furin.strip.geometry.computeVertexNormals(); }
    // laundry: flaps on twos in the breeze (only animated when close to the camera: s02, s07, s30)
    const flap = id === 's02' || id === 's07' || id === 's30', wind = id === 's07' && ct > cues.gulls + 0.4 ? 0.25 : 1;
    for (const m of laundry.items) { m.visible = coast; if (flap) flutter(m, ct, wind); }
    // gulls
    for (const r of gulls) { r.visible = false; r.scale.setScalar(1); }
    // s07: the row on the quay telecom cable bursts off seaward over the camera (nearest birds first), wings beating on twos
    if (id === 's07' && perch.length) perch.forEach((p, i) => { const r = gulls[i], q = gp[i], t0 = cues.gulls + 0.028 * (perch.length - 1 - i) + q.a * 0.09; r.visible = true; r.scale.setScalar(1.2);
      // perched across the wire (not along it), body pitched ~30° head up, wings folded, the feet gripping the cable
      if (ct < t0) { r.position.copy(p).add(new V3(0, 0.145, 0)); r.rotation.set(0, (i % 4 === 1 ? Math.PI : 0) + (q.b - 0.5) * 0.8 + 0.08 * Math.sin(ct * 2 + i), 0); poseGull(r, 'perch');
        r.userData.body.rotation.x = -0.52 + 0.05 * Math.sin(ct * 3 + i); r.userData.legs.rotation.x = 0.52 - 0.05 * Math.sin(ct * 3 + i); }
      else { const s = ct - t0, dir = new V3((q.c - 0.5) * 1.3, 0, 0.7 + 0.5 * q.d).normalize();
        r.position.copy(p).add(new V3(0, 0.12 + s * 2.4 + s * s * 2.6, 0)).addScaledVector(dir, s * 3.2 + s * s * 4.2); r.rotation.set(0, Math.atan2(dir.x, dir.z), 0); r.userData.body.rotation.x = -0.55 * Math.min(1, s * 4);
        poseGull(r, s < 0.08 ? 'glide' : 'flap', Math.floor(s * 12) + i); } });
    if (id === 's01' || id === 's14') for (let i = 0; i < 6; i++) { const r = gulls[i], q = gp[i], a = t * (0.25 + 0.1 * q.a) + q.b * 6.28, rr = 30 + q.c * 40;
      r.visible = true; r.position.set(40 + i * 25 + Math.cos(a) * rr, 26 + q.d * 18 + Math.sin(a * 2) * 2, -10 + Math.sin(a) * rr * 0.6); r.rotation.set(0, a + Math.PI, -0.3); r.scale.setScalar(1.6);
      poseGull(r, Math.floor(ct * 12 + i * 5) % 30 < 6 ? 'flap' : 'glide', Math.floor(ct * 12)); }
    if (id === 's15') for (let i = 0; i < 20; i++) { const r = gulls[i], q = gp[i], t0 = 31.7 + q.a * 0.7, s = Math.max(0, ct - t0);
      const a = q.b * Math.PI * 2, p0 = new V3(Math.cos(a) * (40 + q.c * 60), 8 + q.d * 30, 200 + Math.sin(a) * (30 + q.c * 40));
      const dir = new V3(Math.cos(a), 0.45 + q.d * 0.3, Math.sin(a) * 0.6 - 0.5).normalize();
      r.visible = true; r.scale.setScalar(2.2); r.position.copy(p0).addScaledVector(dir, s * 14); r.rotation.set(0, Math.atan2(dir.x, dir.z), 0); r.userData.body.rotation.x = -0.3;
      poseGull(r, s > 0 ? 'flap' : 'glide', Math.floor(ct * 12) + i); }
  }
  return { cat, furin, laundry, gulls, perch, update, shadowRoots, catPos, catSit,
    anchor(name) { if (name === 'cat') return catPos.clone(); if (name === 'catSit') return catSit.clone(); if (name === 'catHead') { const v = new V3(); (cat.sit.visible ? cat.tHead : cat.sHead).getWorldPosition(v); return v; }
      if (name === 'furin') return furin.g.position.clone().add(new V3(0, -(furin.cord + 0.03) * furin.g.scale.y, 0)); return null; } };
}
