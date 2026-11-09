// RYŪ · 龍 · KEEPER (owner: keeper). Clawd + broom + shrine + bell + leaves, all pure functions of t, riding the dragon's brow.
// Files: keeper.js (this: acting per shot), keeper-rig.js (nub IK / props), keeper-leaves.js, shrine.js, shrine-sets.js (hero horn s17/s25, brow ridge s22).
// API (ctx.modules.keeper):
//   root            Group (matrixAutoUpdate off), shrine frame: platform top y = 0. Posed from dragon.headFrame(t) * lift (LIFT m above the brow)
//   clawd, toon, broom (Group)
//   toWorld([x,y,z]) -> [x,y,z] world   (use in cams and FX: shrine-local -> world)
//   clawdLocal() / clawdWorld() -> Vector3 (body centre)     broomTip() -> world Vector3
//   anchors: { bell: Vector3, torii, pile, leafStep, ropeAttach(t) }   shrine-local points
//   leaf(t) -> { on, p: [x,y,z] }   the hero leaf, shrine-local   leafPile: { x, z, r, h } the neat pile
//   Hides the dragon's root during the hero close-ups s17 / s22 / s25 (the hero horn and brow ridge replace it there).
import * as THREE from 'three';
import { createRig, placeProp, aimY } from './keeper-rig.js';
import { buildShrine, STEP, stepTop, BELL, bellAngle } from './shrine.js';
import { buildLeaves, PILE, LEAF1, LEAF2 } from './keeper-leaves.js';
import { buildHorn, buildRidge, HORN, hornR, hornTopY, RIDGE, ridgeH, ridgeTop, EYE_TOUCH } from './shrine-sets.js';
import { createContacts, sdRoundBox, BODY } from './keeper-contacts.js';

const T = THREE, V3 = T.Vector3, Q = T.Quaternion, DEG = Math.PI / 180;
const CS = 0.5, LIFT = 1.7;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k, L3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const X = new V3(1, 0, 0), Y = new V3(0, 1, 0), Z = new V3(0, 0, 1);
const qX = (d) => new Q().setFromAxisAngle(X, d * DEG), qY = (d) => new Q().setFromAxisAngle(Y, d * DEG), qZ = (d) => new Q().setFromAxisAngle(Z, d * DEG);
const qYP = (y, p = 0, r = 0) => qY(y).multiply(qX(p)).multiply(qZ(r));
const wave = (t, a, b, c) => Math.sin(t * a) * 0.6 + Math.sin(t * b) * 0.3 + Math.sin(t * c) * 0.1;
const pulse = (t, f, w, seed = 0) => { const p = (t * f + seed) % 1; return p < w ? 1 - Math.abs(p / w * 2 - 1) : 0; };
const blink = (t, seed = 0) => clamp(pulse(t, 0.37, 0.06, seed) * 3);
// quaternion with the body's +y along up and face (+z) as close as possible to face
function qUpFace(up, face) { const y = up.clone().normalize(), z = face.clone().addScaledVector(y, -face.dot(y)).normalize(), x = new V3().crossVectors(y, z).normalize(); return new Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z)); }
const legsRun = (p, a) => ({ FL: { rx: a * Math.sin(p) }, BR: { rx: a * Math.sin(p) }, FR: { rx: -a * Math.sin(p) }, BL: { rx: -a * Math.sin(p) } });

const PS = [0.45, 0, 1.75];    // where he sweeps
const SWEEP_YAW = -18;

export async function create(ctx) {
  const { sets, mat } = ctx;
  const root = new T.Group(); root.name = 'shrine-rig'; root.matrixAutoUpdate = false; sets.shrine.add(root);
  const shrine = buildShrine(ctx, root), horn = buildHorn(ctx, root), ridge = buildRidge(ctx, root);
  const { clawd, toon } = await ctx.loadClawd({ recvShadow: false });   // his own cast shadow on his nubs and legs was only ever jaggies; the floor still receives it
  const cl = new T.Group(); cl.name = 'clawd'; root.add(cl); cl.add(clawd.root); clawd.root.scale.setScalar(CS);
  const rig = createRig(clawd, { scale: CS });
  ctx.shadowRoots.push(cl);
  const leaves = buildLeaves(ctx, root, clawd.nodes.squash);

  // ---- BROOM: local +y runs tip (y 0) -> handle top; L metres long; bristles fan in the local XY plane
  const broom = new T.Group(); broom.name = 'broom'; root.add(broom);
  const BROOM = { L: 1.12, bristle: 0.26 };
  { const bm = mat.cel(0xd4b676, { id: mat.nextId(), shade: 0x96794a, hi: 0xeed398 }), wm = mat.cel(0xa98a4a, { id: mat.nextId(), shade: 0x6e5a3a, hi: 0xc8ab66 }), dm = mat.cel(0x4a3a30, { id: mat.nextId(), shade: 0x2c2230 });
    const handle = new T.Mesh(new T.CylinderGeometry(0.018, 0.023, BROOM.L - 0.26, 10), wm); handle.position.y = (BROOM.L + 0.26) / 2; broom.add(handle); handle.name = 'broom-handle';
    for (let i = 0; i < 4; i++) { const n = new T.Mesh(new T.TorusGeometry(0.02, 0.004, 6, 12).rotateX(Math.PI / 2), dm); n.position.y = 0.42 + i * 0.17; broom.add(n); n.userData.noSolid = true; }
    const bindA = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.05, 10), dm); bindA.position.y = 0.28; broom.add(bindA); bindA.userData.noSolid = true;
    // bristle mass (flat fan) + some loose twigs
    const fan = new T.Mesh(new T.CylinderGeometry(0.03, 0.105, 0.24, 12, 1, false), bm); fan.position.y = 0.125; fan.scale.z = 0.42; fan.name = 'broom-head'; broom.add(fan);
    for (let i = 0; i < 18; i++) { const u = i / 17 - 0.5, tw = new T.Mesh(new T.CylinderGeometry(0.003, 0.007, 0.31, 5), bm); tw.position.set(u * 0.2, 0.13, Math.sin(i * 2.3) * 0.02); tw.rotation.z = -u * 0.62; broom.add(tw); tw.userData.noSolid = true; }
  }

  // ---- bell ring FX (drawn rings on threes, s06)
  const ringG = new T.Group(); root.add(ringG); const rings = [0, 1, 2].map(i => { const m = new T.Mesh(new T.RingGeometry(0.965, 1, 64), mat.fx(0xfff0c0, { k: 1.25, opacity: 1, side: T.DoubleSide })); m.userData.noSolid = true; ringG.add(m); return m; });

  // solids
  const S = shrine.solids;
  ctx.solids.add('clawd', clawd.nodes.body, { group: 'clawd', pad: -0.02 });
  ctx.solids.add('broom-head', broom.getObjectByName('broom-head'), { group: 'broom' });
  ctx.solids.add('platform', S.platform, { group: 'shrine' }); ctx.solids.add('steps', S.steps, { group: 'shrine' }); ctx.solids.add('honden', S.honden, { group: 'shrine' }); ctx.solids.add('torii', S.torii, { group: 'shrine', kind: 'points' }); ctx.solids.add('lantern', S.lantern, { group: 'shrine' }); ctx.solids.add('bell-frame', S.frame, { group: 'shrine' }); ctx.solids.add('bell', S.bell, { group: 'shrine', pad: -0.02 });
  ctx.solids.allow('dragon-skull', 'torii', 8); ctx.solids.allow('clawd', 'broom-head', 0.03); ctx.solids.allow('clawd', 'platform', 0.14); ctx.solids.allow('broom-head', 'platform', 0.16); ctx.solids.allow('clawd', 'steps', 0.14); ctx.solids.allow('broom-head', 'steps', 0.16);
  ctx.solids.rest('clawd', 'platform', { tol: 0.11, when: (t) => t < 9 });

  const P = new V3(), grip = new V3(), inv = new T.Matrix4(), rigM = new T.Matrix4(), rigI = new T.Matrix4(), SOLE = [[0.082, 0], [-0.082, 0], [0, 0.082], [0, -0.082]];
  // The broom is one straight rigid stick through the grip. Its line must never pass through the rounded body, however the acting aims it: solved here in rig space by
  // turning the line about the grip, by exactly the penetration found along it (continuous in the pose, no pops). A contact with the floor is kept by sliding along the line.
  const MARGIN = 0.024;   // rig units of air between the body and the broom (12 mm)
  function clearBroom(G, d, gy, m2r) {
    let bad = 0;
    for (let it = 0; it < 14; it++) {
      let worst = 0, sw = 0;
      for (let i = 0; i <= 60; i++) { const s = -gy + BROOM.L * i / 60, sr = s * m2r, y = G.y + d.y * sr - 0.52, x = G.x + d.x * sr, z = G.z + d.z * sr, head = s < -gy + 0.26;
        const r = (head ? 0.05 + 0.09 * clamp((-gy + 0.26 - s) / 0.26) : 0.026) * m2r + MARGIN, v = sdRoundBox(x, y, z, BODY.he[0], BODY.he[1], BODY.he[2], BODY.r) - r; if (v < worst) { worst = v; sw = sr; } }
      if (worst >= 0) { bad = 0; break; } bad = -worst;
      if (Math.abs(sw) < 0.04) break;
      d.x += (-worst + 0.002) / sw; d.normalize();   // the grip is on his right side: the line escapes sideways
    }
    return bad;
  }
  function placeBroom(A) {
    const g = rig.gripWorld('R'); grip.copy(g).applyMatrix4(inv);
    rigM.multiplyMatrices(inv, rig.squash.matrixWorld); rigI.copy(rigM).invert();
    const G = grip.clone().applyMatrix4(rigI), k2 = Math.hypot(rigI.elements[0], rigI.elements[1], rigI.elements[2]);
    let dir, gy; const floorY = A.broom.tip && A.broom.tip[1] < 0.02 ? A.broom.tip[1] : null;
    if (A.broom.tip) { const tip = new V3(...A.broom.tip); dir = grip.clone().sub(tip); const d = dir.length(); dir.normalize(); gy = clamp(d, 0.2, BROOM.L - 0.08); }
    else { dir = new V3(...A.broom.dir).normalize(); gy = A.broom.gripY ?? 0.55; }
    for (let pass = 0; pass < 4; pass++) {
      const d = dir.clone().transformDirection(rigI); clearBroom(G, d, gy, k2);
      dir = d.transformDirection(rigM);
      if (pass < 3 && floorY != null && dir.y > 0.08) gy = clamp((grip.y - floorY - 0.024) / dir.y, 0.2, BROOM.L - 0.08);   // the twig tips reach 0.024 past the fan
    }
    // floor brooms: the fan's width stays level, so all its twigs rest on the stone
    const hint = A.broom.hint ? new V3(...A.broom.hint) : (floorY != null || A.broom.level) ? new V3().crossVectors(new V3(0, 1, 0), dir).cross(dir).negate() : new V3(0, 0, 1);
    placeProp(broom, grip, aimY(dir, hint), new V3(0, gy, 0));
  }
  const nubL = () => rig.tipWorld('L', 0.25).applyMatrix4(inv);   // the rope lies against the outer side of the nub, clear of the body

  // ---- ACTING. Clawd on twos: everything below uses ct
  function act(t, ct) {
    if (ct < 9.0) return sweep(ct, ss(8.1, 8.5, ct));
    if (ct < 11.0) return stare(ct);
    if (ct < 13.0) return trip(ct, t);
    if (ct < 22.0) return sit(ct);
    if (ct < 23.5) return edge(ct);
    if (ct >= 42 && ct < 44) return hornHug(ct, t);
    if (ct >= 53.5 && ct < 61) return crawl(ct);
    if (ct >= 61 && ct < 63.5) return hornStand(ct);
    if (ct >= 63.5 && ct < 70) return { ...sweep(70, 1), emo: 'sleepy', blink: 0 };
    if (ct >= 70) return last(ct);
    return hang(ct, t);
  }
  function sweep(ct, stop = 0, emo) {
    const s = 6.2832 * ct / 0.9, S1 = Math.sin(s), C1 = Math.cos(s), yr = SWEEP_YAW * DEG, right = new V3(Math.cos(yr), 0, -Math.sin(yr)), F = new V3(Math.sin(yr), 0, Math.cos(yr));
    const a = 1 - stop, tip = new V3(...PS).addScaledVector(right, 0.58 + 0.24 * S1 * a).addScaledVector(F, 0.42 + 0.06 * C1 * a - stop * 0.12); tip.y = 0.004;
    return { p: PS.slice(), q: qY(SWEEP_YAW + 5 * S1 * a), emo: emo || (stop > 0.5 ? 'smug' : 'happy'), lean: 6 + 3 * Math.abs(S1) * a, turn: 10 * S1 * a, squash: 0.02 * Math.abs(C1) * a, blink: blink(ct, 0.4),
      L: { yaw: lerp(25, 15, stop), roll: lerp(-20, -45, stop) }, Rr: { yaw: 50 + 24 * S1 * a, roll: -22 }, broom: { tip: tip.toArray() }, lookX: stop > 0.5 ? 0.1 : 0.25 * S1 * a, lookY: -0.2 * a };
  }
  function stare(ct) {
    const lt = ct - 9.0, tw = lt > 0.65 ? (Math.floor(ct * 24 / 2) % 3 === 0 ? 1 : 0.35) : 0, up = lt < 0.4 ? 1 : 0, yr = -37 * DEG, right = new V3(Math.cos(yr), 0, -Math.sin(yr)), F = new V3(Math.sin(yr), 0, Math.cos(yr)), tip = new V3(...PS).addScaledVector(right, 0.32).addScaledVector(F, 0.4); tip.y = 0.004;
    return { p: PS.slice(), q: qY(-37), emo: lt > 0.55 ? 'eye_twitch' : 'neutral', lean: 10 + ss(0.4, 0.7, lt) * 8, squash: tw * 0.02, blink: 0, twitch: tw, lookY: -0.45 * (1 - up) + up * 0.45, lookX: -0.2, L: { roll: -30, yaw: 20 }, Rr: { yaw: 40, roll: -18 }, broom: { tip: tip.toArray() } };
  }
  function trip(ct, t) {
    const lt = ct - 11.0, yr = -47 * DEG, F = new V3(Math.sin(yr), 0, Math.cos(yr));
    if (lt < 0.8) { const k = clamp(lt / 0.8), ph = ct * 22; return { p: [lerp(0.95, 0.02, k), 0.015 * Math.abs(Math.sin(ph * 2)), lerp(1.4, 2.1, k)], q: qY(-47), emo: 'determined', lean: 22, squash: 0.03 * Math.cos(ph * 2), legs: legsRun(ph, 58), blink: 0, lookY: -0.25,
        L: { yaw: -35, roll: 20 + 25 * Math.sin(ph) }, Rr: { yaw: 70, roll: 25 + 20 * Math.sin(ph) }, broom: { dir: F.clone().multiplyScalar(0.8).add(Y.clone().multiplyScalar(0.55)).toArray(), gripY: 0.42, level: true } }; }
    const ft = lt - 0.8, TP = [0.02, 0, 2.1], LP = [-0.04, 0, 2.02], air = clamp(ft / 0.22), pit = lerp(22, 92, ss(0, 1, air));
    let pitch = pit, emo = 'surprised', squash = 0, armY = 70, armLr = 60, leg = { FL: { rx: -55 }, FR: { rx: -55 }, BL: { rx: -55 + 25 * (1 - air) }, BR: { rx: -55 + 25 * (1 - air) } };
    if (ft > 0.22) { const b = ft - 0.22; squash = 0.28 * Math.exp(-b * 9) * Math.cos(b * 18); leg = { FL: { rx: -15 }, FR: { rx: -15 }, BL: { rx: -45 - 12 * Math.sin(b * 9) * Math.exp(-b * 4) }, BR: { rx: -45 + 12 * Math.sin(b * 9) * Math.exp(-b * 4) } }; }
    if (ft > 0.65) { emo = 'dizzy'; pitch = lerp(92, 8, ss(0.65, 1.15, ft)); leg = { FL: { rx: -45 }, FR: { rx: -45 }, BL: { rx: -45 }, BR: { rx: -45 } }; armY = lerp(70, 30, ss(0.65, 1.15, ft)); armLr = lerp(60, -10, ss(0.65, 1.15, ft)); }
    const pr = pitch * DEG, xy = ft < 0.22 ? L3(TP, LP, air) : LP, arc = 0.12 * Math.sin(Math.min(1, air) * Math.PI) * (ft < 0.22 ? 1 : 0);
    const tipF = lerp(0.55, 0.3, ss(0.65, 1.15, ft));
    return { p: [xy[0], Math.max(0, 0.14 * Math.sin(pr)) + arc, xy[2]], q: qY(-47).multiply(qX(pitch)), emo, squash, blink: 0, gazeY: ft > 0.65 ? -0.3 : 0, legs: leg,
      L: { yaw: 35, roll: armLr }, Rr: { yaw: armY, roll: armLr }, broom: ft < 0.12 ? { dir: F.clone().multiplyScalar(0.8).add(Y.clone().multiplyScalar(0.6)).toArray(), gripY: 0.42, level: true } : ft < 0.65 ? { tip: [xy[0] + 1.04, 0.004, xy[2] + 0.32] } : { tip: [xy[0] + 0.27 + 0.07, 0.004, xy[2] + 0.22] } };
  }
  function sit(ct) {
    const P0 = [-0.04, 0, 2.02], yr = -47 * DEG, F = new V3(Math.sin(yr), 0, Math.cos(yr)), r = ss(13.2, 13.3, ct) * Math.exp(-Math.max(0, ct - 13.3) * 2.2);
    return { p: P0, q: qY(-47), emo: ct < 13.2 ? 'dizzy' : ct < 15.5 ? 'surprised' : ct < 20.5 ? 'nervous' : 'surprised', lean: 4 - 10 * r, squash: -0.05 * r + 0.06, blink: blink(ct, 0.8), gazeX: ct >= 13.2 && ct < 16 ? -0.55 : 0, gazeY: ct >= 13.2 && ct < 16 ? 0.7 : 0,
      legs: { FL: { rx: -45 }, FR: { rx: -45 }, BL: { rx: -45 }, BR: { rx: -45 } }, L: { yaw: 30, roll: -18 - 30 * r }, Rr: { yaw: 40, roll: -8 + 20 * r }, broom: { tip: [P0[0] + 0.34, 0.004, P0[2] + 0.22] } };
  }
  function edge(ct) {
    const lt = ct - 22.0, k = ease(lt / 1.05), yr = 0, right = new V3(Math.cos(yr), 0, -Math.sin(yr)), p = [-2.6, 0, 2.18], tip = new V3(...p).addScaledVector(right, 0.56); tip.y = 0.004;
    return { p, q: qY(0), emo: lt < 0.4 ? 'nervous' : 'surprised', lean: 28 * k, squash: 0, blink: 0, gazeY: -0.75 * k, L: { yaw: 40, roll: -20 }, Rr: { yaw: 25, roll: -10 }, broom: { tip: tip.toArray() } };
  }
  const WIND = new V3(-0.78, -0.45, -0.44).normalize();
  function hang(ct, t) {
    const s = shrine.ropeAttach(t), L = 2.9, g1 = wave(ct, 9.1, 17.3, 31.1), g2 = wave(ct + 3, 11.3, 23.7, 37.3), dir = WIND.clone().add(new V3(0.08 * g1, 0.14 * g2, 0.06 * g1)).normalize();
    const N = s.clone().addScaledVector(dir, L), up = dir.clone().negate(), cam = new V3(-5.6, 0.5, 0.2), face = cam.clone().sub(N).normalize(), q = qUpFace(up, face);
    const flap = wave(ct, 19, 33, 41), nubLocal = new V3(-0.625, 0.595, 0).multiplyScalar(CS).applyQuaternion(q);
    const stretch = 0.2 + 0.06 * flap;
    return { p: N.clone().sub(nubLocal).toArray(), q, hang: true, plant: false, emo: 'panic', squash: -stretch, sxz: lerp(1.05, 0.9, stretch / 0.26), tilt: 8 * flap, lean: 6 * g2, blink: 0, lookX: 0.2, lookY: 0.15,
      legs: { FL: { rx: 20 + 25 * flap }, FR: { rx: -18 + 22 * g1 }, BL: { rx: 38 + 22 * flap }, BR: { rx: 8 + 26 * g2 } }, L: { yaw: 0, roll: 30 }, Rr: { yaw: -20, roll: 20 + 15 * flap },
      broom: { dir: dir.clone().negate().add(new V3(0.15 * g1, 0.1 * g2, 0.1 * flap)).toArray(), gripY: 0.62 } };
  }
  function hornHug(ct, t) { // emo scream
    const H = HORN.base, y = 3.25, r = hornR(y + 0.26), flap = wave(ct, 21, 37, 47), g = wave(ct, 13.3, 27.1, 41.7), body = [H[0] + 0.02, y, H[2] + r + 0.17];
    return { p: body, q: qYP(14 + 4 * g, 4 * flap, 0), emo: 'panic', squash: -0.14 + 0.05 * flap, sxz: 1.1, tilt: 5 * g, blink: 0, lookX: 0.18, lookY: -0.3,
      legs: { FL: { rx: 22 + 22 * flap }, FR: { rx: -18 + 20 * g }, BL: { rx: -14 + 10 * g }, BR: { rx: -12 + 10 * flap } }, L: { yaw: -55, roll: 22 + 10 * g, slide: [0.05, -0.05] }, Rr: { yaw: -30, roll: 28 + 14 * flap, slide: [0.05, -0.05] }, plant: false,
      broom: { dir: new V3(-0.92, 0.3 + 0.25 * flap, -0.12 + 0.2 * g).toArray(), gripY: 1.06 } };
  }
  const RO = new V3(...RIDGE.origin);
  function crawl(ct) {
    const lt = ct - 53.5, zc = 1.02, x = lerp(1.0, 0.62, ss(0, 1.05, lt)), h = ridgeH(x - 0.1, zc) + 0.012, sc = ct >= 54.55, ph = ct * 12, leg = sc ? 0 : 26, S = Math.sin(ct * 15), c = RIDGE.crease, carry = [c[0] + 0.55, ridgeTop(c[0], c[2]) + 0.1, c[2] + 0.5], rub = [EYE_TOUCH[0] + 0.1 * Math.sin(ct * 26), EYE_TOUCH[1] + 0.05 * Math.sin(ct * 26), EYE_TOUCH[2] + 0.08 * Math.sin(ct * 26)], rb = ss(54.4, 54.7, ct), ridgeTip = L3(carry, rub, rb), tipW = RO.clone().add(new V3(...ridgeTip)), pitch = 32;
    // Clawd lies along +z on the ridge (feet behind him), head up the slope, 3/4 to the camera at -x
    const pr = pitch * DEG, nose = 0.14 * Math.sin(pr);
    return { plant: (px, pz) => RO.y + ridgeTop(px - RO.x, pz - RO.z), p: RO.clone().add(new V3(x, h + nose - 0.09, zc)).toArray(), q: qYP(-78, pitch, 0), emo: sc ? (ct > 55.3 ? 'relief' : 'strain') : 'determined', lean: 0, squash: sc ? 0.05 * S : -0.05 + 0.04 * Math.sin(ph * 2), blink: 0, lookY: 0.2, lookX: sc ? 0.4 : 0.1,
      legs: { FL: { rx: 32 + 0.8 * leg * Math.sin(ph) }, FR: { rx: 32 - 0.8 * leg * Math.sin(ph) }, BL: { rx: 45 - 0.8 * leg * Math.sin(ph) }, BR: { rx: 45 + 0.8 * leg * Math.sin(ph) } }, L: { yaw: 50, roll: 20 + (sc ? 0 : 12 * Math.sin(ph)) }, Rr: { yaw: 72, roll: 8 },
      broom: { tip: tipW.toArray() } };
  }
  function hornStand(ct) {
    const lt = ct - 61, cheer = Math.sin(ct * 15), burst = ss(0, 0.25, lt), rise = ss(0, 0.2, lt);
    return { p: [HORN.base[0], hornTopY, HORN.base[2]], q: qY(8 + 4 * cheer), emo: 'starry', squash: -0.06 * cheer * burst, lean: -6 * rise, tilt: 4 * Math.sin(ct * 8), blink: 0, lookY: 0.2,
      L: { yaw: 6, roll: 56 * rise + 10 * cheer * burst, slide: [0.13 * rise, 0] }, Rr: { yaw: 6, roll: 54 * rise - 10 * cheer * burst, slide: [0.13 * rise, 0] }, plant: () => hornTopY, broom: { dir: [-0.04 - 0.05 * cheer, -1, -0.1], gripY: 1.04, hint: [1, 0, 0.3] } };
  }
  function last(ct) {
    const lt = ct - 70;
    if (ct < 71.05) return { ...sweep(ct, 0, 'gentle') };
    if (ct < 72.2) { const k = ct < 71.6 ? 0 : ss(71.6, 72.0, ct); const b = sweep(71.05, 1);
      return { ...b, emo: ct < 71.55 ? 'neutral' : (ct < 71.85 ? 'relief' : 'gentle'), lookY: ct < 71.6 ? 0.5 * (1 - ss(71.05, 71.6, ct)) - 0.4 * ss(71.1, 71.6, ct) : -0.4, lookX: 0.18, squash: 0.05 * Math.sin(k * Math.PI), lean: 4, blink: 0, turn: 0, gazeY: ct < 71.6 ? 0.4 - 0.6 * ss(71.15, 71.6, ct) : -0.4, gazeX: 0.3 }; }
    return { ...sweep(ct * 1.5 - 35.2, ss(72.85, 73, ct), 'gentle') };
  }
  const ease = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };

  // ---- contacts (segment vs rounded body, reported by tools/check.mjs)
  const ropeRef = { pts: null }, tailRef = { p: null }; let heldRope = false;
  const env = {
    name: () => horn.group.visible ? 'hero-horn' : ridge.group.visible ? 'hero-ridge' : 'floor',
    sd(q) {
      if (horn.group.visible) { const rx = Math.hypot(q.x - HORN.base[0], q.z - HORN.base[2]); if (q.y > hornTopY) return Math.hypot(Math.max(0, rx - HORN.r1), q.y - hornTopY); return rx - hornR(q.y) * 1.04; }
      if (ridge.group.visible) return q.y - RIDGE.origin[1] - ridgeH(q.x - RIDGE.origin[0], q.z - RIDGE.origin[2]);
      if (Math.abs(q.x) < 3.6 && q.z < STEP.z0 && q.z > -4.6) return q.y;
      if (q.z >= STEP.z0 && q.z < STEP.z0 + STEP.run * STEP.n && Math.abs(q.x) < STEP.x) return q.y - stepTop(Math.floor((q.z - STEP.z0) / STEP.run));
      return 1e3;
    },
  };
  ctx.solids.custom(createContacts(ctx, { rig, clawd, broom, BROOM, ropeRef, tailRef, root, isHeld: () => heldRope, env }));

  // ---- ROPE control points (shrine-local) for the current state
  function ropePts(t, ct, A) {
    const s = shrine.ropeAttach(t), pts = [s];
    if (A.hang) { const end = nubL(), dir = end.clone().sub(s).normalize(), side = end.clone().sub(cl.localToWorld(new V3(0, 0.26 / CS, 0)).applyMatrix4(inv)); side.addScaledVector(dir, -side.dot(dir)).normalize(); const f = (k) => { const n = s.clone().lerp(end, k), w = wave(ct + k * 2, 13, 29, 41) * Math.sin(k * Math.PI) * 0.09; n.y += w; n.x += w * 0.6; n.addScaledVector(side, 0.14 * Math.sin(k * Math.PI) * k); return n; }; pts.push(f(0.25), f(0.5), f(0.75), end); pts.push(end.clone().addScaledVector(side, 0.3).addScaledVector(dir, 0.08).add(new V3(0, 0.05 * Math.sin(ct * 27), 0.04 * Math.sin(ct * 19)))); return pts; }
    const flight = t > 25 && t < 64;
    if (flight) { const dir = WIND.clone(), f = (k) => { const n = s.clone().addScaledVector(dir, k * 3.0), w = Math.sin(ct * 21 + k * 7) * 0.13 * k, w2 = Math.sin(ct * 13 + k * 5) * 0.1 * k; n.y += w; n.x += w2; return n; }; pts.push(f(0.25), f(0.5), f(0.75), f(1)); return pts; }
    const tug = ss(11.8, 11.98, t) * (1 - ss(12.05, 13.0, t)), lift = 0.1 * tug, K = ss(11.82, 12.1, t), mix2 = (a, b) => new V3(lerp(a[0], b[0], K), a[1], lerp(a[1 + 1], b[2], K)), b0 = [-2.18, 0.045, 0.72], sway = Math.sin(t * 5.61) * bellAngle(t) * 0.12;
    pts.push(new V3(b0[0], 0.75, b0[2] + sway * 0.6), new V3(...b0), mix2([-1.55, 0.045 + lift * 0.2, 1.55], [-2.0, 0.045, 1.2]), mix2([-0.82, 0.045 + lift * 0.5, 1.98], [-1.7, 0.045, 1.6]), mix2([-0.55, 0.045 + lift, 2.04 + tug * 0.04], [-1.35, 0.045, 1.75]), mix2([-0.36 - tug * 0.22, 0.045 + lift * 1.1, 2.05 + tug * 0.1], [-1.0, 0.045, 1.7]));
    return pts;
  }

  const api = {
    root, clawd, toon, broom, leafPile: PILE, shrine, horn, ridge,
    toWorld(p) { return new T.Vector3(...p).applyMatrix4(root.matrixWorld).toArray(); },
    clawdLocal() { return cl.position.clone().add(new V3(0, 0.26, 0).applyQuaternion(cl.quaternion)); },
    clawdWorld() { return api.clawdLocal().applyMatrix4(root.matrixWorld); },
    broomTip() { return new V3(0, 0, 0).applyMatrix4(broom.matrixWorld); },
    anchors: { bell: new V3(BELL.pivot[0], 1.8, BELL.pivot[2]), torii: new V3(0, 2.8, 4.5), pile: new V3(PILE.x, 0.1, PILE.z), leafStep: new V3(...LEAF1), ropeAttach: (t) => shrine.ropeAttach(t), step: stepTop },
    leaf: (t) => leaves.heroPos(t),
    update(t, shot) {
      root.visible = shot.set !== 'card'; if (!root.visible) return;
      const d = ctx.modules.dragon;
      if (d?.headFrame) root.matrix.copy(d.headFrame(t)).multiply(new T.Matrix4().makeTranslation(0, LIFT, 0)); else root.matrix.makeTranslation(ctx.geo.ISLAND.x, ctx.geo.ISLAND.peak + LIFT, ctx.geo.ISLAND.z);
      root.matrixWorld.copy(root.matrix); root.matrixWorldNeedsUpdate = true; root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
      const id = shot.id, ct = ctx.onTwos(t), closeHorn = id === 's17' || id === 's25', closeRidge = id === 's22';
      shrine.group.visible = !(closeHorn || closeRidge); horn.group.visible = closeHorn; ridge.group.visible = closeRidge;
      if (d?.root && (closeHorn || closeRidge)) d.root.visible = false;
      horn.update(t); shrine.setBell(t);
      const A = act(t, ct);
      cl.position.set(...A.p); cl.quaternion.copy(A.q); cl.updateMatrix();
      rig.pose({ emo: A.emo, mix: A.mix, mixT: A.mixT, squash: A.squash || 0, squashXZ: A.sxz ?? null, lean: A.lean || 0, turn: A.turn || 0, tilt: A.tilt || 0, blink: A.blink || 0, lookX: A.lookX || 0, lookY: A.lookY || 0, twitch: A.twitch || 0, gazeX: A.gazeX || 0, gazeY: A.gazeY || 0, legs: A.legs });
      rig.armAngles('L', A.L); rig.armAngles('R', A.Rr);
      cl.updateMatrixWorld(true); toon.syncFace();
      if (A.plant !== false) { const f = A.plant || ((ct < 23.5 || ct >= 63.5) ? () => 0 : null); if (f) { let lift = 0; for (const h of Object.values(rig.legs)) for (const [x, z] of SOLE) { P.set(x, -0.23, z).applyMatrix4(h.matrixWorld).applyMatrix4(inv); lift = Math.max(lift, f(P.x, P.z) - P.y); } if (lift > 0) { cl.position.y += lift; cl.updateMatrix(); cl.updateMatrixWorld(true); } } }
      rig.clearGrip('R', 0.63);
      placeBroom(A); broom.updateMatrixWorld(true);
      heldRope = !!A.hang; shrine.setRope(ropePts(t, ct, A)); ropeRef.pts = shrine.group.visible ? shrine.ropeSamples() : null; tailRef.p = shrine.group.visible ? shrine.ropeTail() : null;
      leaves.update(t, ct);
      // bell rings s06: three drawn rings expand from the bell, on threes
      const rt = ctx.onThrees(t), on = id === 's06'; ringG.visible = on;
      if (on) rings.forEach((m, i) => { const k = (rt - (13.2 + i * 0.28)) / 1.15; m.visible = k > 0 && k < 1; if (m.visible) { const R0 = 0.5 + k * 6.5; m.scale.setScalar(R0); m.position.set(BELL.pivot[0], 1.7, BELL.pivot[2]); } });
    },
    afterCamera() { if (ringG.visible) rings.forEach(m => m.lookAt(ctx.camera.position)); },
    dispose() { root.removeFromParent(); },
  };
  return api;
}
