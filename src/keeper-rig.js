// RYU keeper rig (owner: keeper) — little Clawd as a posable cel character on top of the mascot (src/assets/clawd).
// Adds what the mascot rig lacks for acting with props, without editing the asset:
//   * leg hips: each leg hangs from a hip pivot (swing fwd/back, fold for sitting, stretch for tiptoe)
//   * nub IK: a nub tip can reach a point (arm yaw / roll + a small slide of the nub root along the body side)
//   * wrist: props held by a nub keep their contact point at the nub tip and choose their own orientation
//     (a spoon pointing at the mouth, a cup kept upright) — contact never breaks, nothing floats.
//   * gaze: eyes(x, y) slides the pupils / shine dots on top of any emotion (looking up at the sky in s08)
// Units: rig-local = mascot units (body width 1, feet at y = 0, face toward +z); world = metres (CLAWD_SCALE 0.5).
// Everything is a pure function of the arguments (frames render in any order).
import * as THREE from 'three';

const V3 = THREE.Vector3, DEG = Math.PI / 180;
const ARM_REST = { L: new V3(-0.46, 0.5, 0), R: new V3(0.46, 0.5, 0) };
export const NUB_REACH = 0.19;            // pivot -> nub tip (rig units)
const NUB_GRIP = 0.17;                    // pivot -> grip point (just inside the rounded tip)
const HIP_Y = 0.23;                       // leg top (rig units)
const SLIDE = { y: 0.12, z: 0.15 };       // how far a nub root may slide along the body side (rig units)

export function createRig(clawd, { scale = 0.5 } = {}) {
  const N = clawd.nodes, squash = N.squash;
  const arms = { L: N.arm_L, R: N.arm_R };
  for (const a of Object.values(arms)) a.rotation.order = 'YZX';   // yaw (outer) * roll * twist (inner)
  // legs -> hip pivots (the leg mesh hangs below the hip)
  const legs = {};
  for (const k of ['FL', 'FR', 'BL', 'BR']) {
    const m = N['leg_' + k]; if (!m) continue;
    const hip = new THREE.Object3D(); hip.name = 'hip_' + k; hip.position.set(m.position.x, HIP_Y, m.position.z);
    squash.add(hip); hip.add(m); m.position.set(0, m.position.y - HIP_Y, 0); legs[k] = hip;
  }
  const _m = new THREE.Matrix4(), _v = new V3(), _q = new THREE.Quaternion(), _s = new V3();
  const byName = (n) => { let r = null; clawd.root.traverse(o => { if (o.name === n) r = o; }); return r; };
  const eyeParts = Object.fromEntries(['L', 'R'].map(s => [s, { dot: byName(`Clawd_eyeWhite_${s}_dot`), hl: byName(`Clawd_eye_${s}_hl`), hl2: byName(`Clawd_eye_${s}_hl2`) }]));

  const rig = {
    clawd, squash, arms, legs, scale,
    // full pose: { emo, mix, mixT, armL, armR, squash, squashXZ, lean, turn, tilt, blink, lookX, lookY, twitch, gazeX, gazeY,
    //   legs: { FL: { rx, sy }, ... } }
    pose(p = {}) {
      if (p.mix) clawd.setEmotion(p.emo || 'neutral', { mix: p.mix, t: p.mixT ?? 0.5 }); else clawd.setEmotion(p.emo || 'neutral');
      clawd.pose(p); rig.eyes(p.gazeX || 0, p.gazeY || 0);
      for (const s of ['L', 'R']) arms[s].position.copy(ARM_REST[s]);
      for (const [k, hip] of Object.entries(legs)) { const l = p.legs?.[k] || {}; hip.rotation.set((l.rx || 0) * DEG, 0, (l.rz || 0) * DEG); hip.scale.set(1, l.sy ?? 1, 1); }
    },
    // nub tip of side 'L'|'R' -> world point (after pose + root placement). Returns the residual error (m).
    // prefer: rig-local direction the nub should favour; returns { err, tipW, dirW }
    reach(side, targetW, { prefer = null, root = clawd.root } = {}) {
      root.updateMatrixWorld(true);
      const T = squash.worldToLocal(targetW.clone()), rest = ARM_REST[side], sx = side === 'R' ? 1 : -1;
      // nub direction: x component from the lateral distance, the rest from the target's direction around the root
      let dx = (T.x - rest.x) * sx / NUB_REACH; dx = THREE.MathUtils.clamp(dx, -0.15, 1);
      const yz = new THREE.Vector2(T.y - rest.y, T.z - rest.z);
      if (prefer) yz.lerp(new THREE.Vector2(prefer.y, prefer.z).multiplyScalar(yz.length() || 1), 0.35);
      if (yz.lengthSq() < 1e-8) yz.set(0, 1);
      yz.normalize().multiplyScalar(Math.sqrt(Math.max(0, 1 - dx * dx)));
      const d = new V3(dx * sx, yz.x, yz.y).normalize();
      // root slide along the body side so the tip lands on the target
      const P = T.clone().addScaledVector(d, -NUB_REACH);
      P.x = rest.x; P.y = THREE.MathUtils.clamp(P.y, rest.y - SLIDE.y, rest.y + SLIDE.y); P.z = THREE.MathUtils.clamp(P.z, rest.z - SLIDE.z, rest.z + SLIDE.z);
      // re-aim from the clamped root
      const d2 = T.clone().sub(P); if (d2.lengthSq() > 1e-8) { d2.normalize(); if (d2.x * sx < -0.15) { d2.x = -0.15 * sx; d2.normalize(); } d.copy(d2); }
      rig.setArm(side, P, d);
      const tipW = rig.tipWorld(side), err = tipW.distanceTo(targetW);
      return { err, tipW, dirW: rig.dirWorld(side) };
    },
    // explicit arm: root position (rig-local) + nub direction (rig-local unit vector) + twist (deg)
    setArm(side, P, d, twist = 0) {
      const a = arms[side], sx = side === 'R' ? 1 : -1; a.position.copy(P);
      // rest axis = (sx, 0, 0); yaw about y, then roll about z
      const yaw = Math.atan2(-d.z * sx, d.x * sx), h = Math.hypot(d.x, d.z), roll = Math.atan2(d.y, h) * sx;
      a.rotation.set(twist * DEG, yaw, roll, 'YZX');
      a.updateMatrix(); a.updateMatrixWorld(true);
    },
    // arm by angles: yaw (deg, + = forward), roll (deg, + = up), slide [y, z] (rig units)
    armAngles(side, { yaw = 0, roll = 0, slide = null, twist = 0 } = {}) {
      const sx = side === 'R' ? 1 : -1, P = ARM_REST[side].clone(); if (slide) { P.y += slide[0]; P.z += slide[1]; }
      const y = yaw * DEG, r = roll * DEG, d = new V3(sx * Math.cos(r) * Math.cos(y), Math.sin(r), Math.cos(r) * Math.sin(y));
      rig.setArm(side, P, d, twist);
    },
    // keep the grip off the body side: slide the shoulder outward along the side (a held stick needs the room). Pure: follows armAngles.
    clearGrip(side, minX) { const a = arms[side], sx = side === 'R' ? 1 : -1; a.updateMatrixWorld(true); const g = squash.worldToLocal(rig.gripWorld(side)); const miss = minX - g.x * sx; if (miss > 0) { a.position.x += sx * Math.min(miss, 0.12); a.updateMatrix(); a.updateMatrixWorld(true); } },
    tipWorld(side, k = NUB_REACH) { const a = arms[side]; a.updateMatrixWorld(true); return new V3((side === 'R' ? 1 : -1) * k, 0, 0).applyMatrix4(a.matrixWorld); },
    gripWorld(side) { return rig.tipWorld(side, NUB_GRIP); },
    dirWorld(side) { const a = arms[side]; a.updateMatrixWorld(true); a.matrixWorld.decompose(_v, _q, _s); return new V3(side === 'R' ? 1 : -1, 0, 0).applyQuaternion(_q).normalize(); },
    // gaze on top of the emotion (call after pose): pupils of the white "shocked" eyes and the shine dots of the solid eyes
    // slide toward (x, y) -1..1 (y + = up). Absolute (resets every call), so frames stay pure.
    eyes(x = 0, y = 0) {
      for (const s of ['L', 'R']) {
        const dot = eyeParts[s].dot, hl = eyeParts[s].hl, hl2 = eyeParts[s].hl2;
        if (dot) dot.position.set(x * 0.03, y * 0.048, dot.userData.z0 ??= dot.position.z);
        if (hl) { hl.userData.x0 ??= hl.position.x; hl.position.x = hl.userData.x0 + x * 0.012; hl.position.y += y * 0.03; }
        if (hl2) { hl2.userData.x0 ??= hl2.position.x; hl2.position.x = hl2.userData.x0 + x * 0.012; hl2.position.y += y * 0.03; }
      }
    },
    // rig-local point -> world (after the root is placed)
    toWorld(p) { squash.updateMatrixWorld(true); return squash.localToWorld(p.clone()); },
    // lowest leg point (world y) -> used to keep feet on the surface
    feetMinY() { let lo = Infinity; const b = new THREE.Box3(); for (const h of Object.values(legs)) { h.updateMatrixWorld(true); b.setFromObject(h, true); lo = Math.min(lo, b.min.y); } return lo; },
  };
  return rig;
}

// place a prop so that its local point `grip` sits at world point `at`, oriented by a quaternion
export function placeProp(obj, at, quat, grip = new V3()) {
  obj.quaternion.copy(quat); obj.position.copy(at).sub(grip.clone().applyQuaternion(quat)); obj.updateMatrixWorld(true);
}
// quaternion turning local +y toward dir, with local +z as close as possible to `upHint`
export function aimY(dir, upHint = new V3(0, 0, 1)) {
  const y = dir.clone().normalize(), z = upHint.clone().addScaledVector(y, -upHint.dot(y)); if (z.lengthSq() < 1e-6) z.set(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize(); const x = new V3().crossVectors(y, z).normalize(); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
