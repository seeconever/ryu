// RYŪ · 龍 · WORLD (owner: world): the s16 flight over the town. Laundry ripped away, wires snapping, the cat's fur blown flat. Pure of t.
import * as THREE from 'three';

export const RIP_T = 40.75, SNAP_T = 40.92;
const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const WIND = new THREE.Vector3(0.84, 0.42, 0.34).normalize();

export function buildFlight(ctx, g, { life, poleLine }) {
  const { laundry, cat } = life, items = laundry.items, base = items.map(m => ({ p: m.position.clone(), r: m.rotation.y }));
  const R = ctx.rng(3630), seeds = items.map(() => [R(), R(), R(), R()]);
  // ---- snapping wires: cables along the hero pole line, two halves whipping after the break ------------------------------
  const pts = poleLine?.pts?.length >= 2 ? poleLine.pts : [[-8, 10.6, -46], [8, 10.6, -46]];
  const A = new THREE.Vector3(...pts[0]), B = new THREE.Vector3(...pts[pts.length - 1]), NSEG = 28, NW = 4;
  const seg = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0), ctx.mat.bg(0x241f2c, { hiAmt: 0, pig: 0, brush: 0 }), NW * NSEG * 2); seg.name = 'snap-wires'; seg.frustumCulled = false; g.add(seg);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), Yu = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  // point s (0 at the pole, 1 at the broken tip) of half h of wire w at time t
  function wirePoint(out, w, h, s, t) {
    const a = h ? B : A, b = h ? A : B, mid = new THREE.Vector3().lerpVectors(A, B, 0.5), offY = -0.12 * w - 0.05, offZ = 0.1 * w;
    out.lerpVectors(a, mid, s); out.y += offY + (-0.5 * 4 * s * (1 - s)) * 0.6; out.z += offZ;
    const tau = t - SNAP_T - w * 0.05; if (tau > 0) { const whip = 1 - Math.exp(-tau * 3.5), wave = Math.sin(tau * 26 - s * 7 + w + h * 2) * Math.exp(-tau * 2.1) * s;
      out.x += WIND.x * whip * s * 3.5 + wave * 0.9; out.y += -7 * whip * s * s * (h ? 1.2 : 0.8) + Math.abs(wave) * 2.0 + 1.4 * Math.exp(-tau * 7) * s; out.z += WIND.z * whip * s * 2.5 + wave * 0.6; }
    return out;
  }
  function poseWires(t) { let n = 0, v = t >= SNAP_T - 0.5; seg.visible = v; if (!v) return;
    for (let w = 0; w < NW; w++) for (let h = 0; h < 2; h++) for (let i = 0; i < NSEG; i++) { wirePoint(p0, w, h, i / NSEG, t); wirePoint(p1, w, h, (i + 1) / NSEG, t); dir.subVectors(p1, p0); const L = dir.length() || 0.001; q.setFromUnitVectors(Yu, dir.normalize()); m4.compose(p0, q, S.set(0.012, L, 0.012)); seg.setMatrixAt(n++, m4); }
    seg.instanceMatrix.needsUpdate = true; seg.count = n; }

  // ---- the cat's fur: thin triangles streaming along the wind, on twos, on top of a squashed body ----------------------------
  const F = 130, tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.5, 0, 0, 0.5, 0, 1, 0.08, 0], 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
  const fm = ctx.mat.cel(0xffffff, { vertexColors: false, id: ctx.mat.nextId(), side: THREE.DoubleSide, hiAmt: 0, spec: 0, ink: false });
  const fur = new THREE.InstancedMesh(tg, fm, F); fur.name = 'cat-fur'; fur.frustumCulled = false; cat.root.add(fur);
  const RF = ctx.rng(3631), FD = Array.from({ length: F }, (_, i) => { const a = RF() * 6.28, u = RF() * 1.5 - 0.75; return { p: [u * 0.27, 0.05 + RF() * 0.08, Math.cos(a) * 0.15], s: 0.05 + RF() * 0.06, w: 0.004 + RF() * 0.005, c: [0xfaf6ee, 0xe8913a, 0x342c2c, 0xfaf6ee][Math.floor(RF() * 4)], ph: RF() * 6.28 }; });
  FD.forEach((f, i) => fur.setColorAt(i, new THREE.Color(f.c))); fur.instanceColor.needsUpdate = true;
  const wLocal = new THREE.Vector3(), qq = new THREE.Quaternion(), rootI = new THREE.Quaternion();
  function poseFur(t) { const gust = sstep(RIP_T - 0.05, RIP_T + 0.22, t); fur.visible = gust > 0; if (!gust) return;
    const ft = ctx.onTwos(t); cat.root.updateMatrixWorld(); rootI.setFromRotationMatrix(cat.root.matrixWorld).invert(); wLocal.copy(WIND).applyQuaternion(rootI).normalize();
    FD.forEach((f, i) => { const shake = Math.sin(ft * 34 + f.ph); qq.setFromUnitVectors(V.set(1, 0, 0), S.copy(wLocal).add(V.set(0, 0.1 * shake, 0.14 * shake)).normalize());
      m4.compose(p0.set(f.p[0], f.p[1], f.p[2]), qq, p1.set(f.s * gust * (1.2 + 0.4 * shake), f.w * gust, 1)); fur.setMatrixAt(i, m4); });
    fur.instanceMatrix.needsUpdate = true;
  }

  function update(t, shot) {
    if (!shot.groups.includes('town')) return;
    const gust = sstep(RIP_T - 0.25, RIP_T + 0.05, t), ft = ctx.onTwos(t);
    items.forEach((m, i) => { const b = base[i], [a, c, d, e] = seeds[i], rip = RIP_T + a * 0.3, tau = t - rip;
      m.rotation.set(0, b.r, 0); m.position.copy(b.p); m.visible = true;
      if (tau < 0) { m.rotation.x = gust * (1.25 + 0.2 * Math.sin(ft * 30 + i)) ; m.rotation.z = gust * 0.25 * Math.sin(ft * 21 + i * 2); }
      else if (tau > 1.8) m.visible = false;
      else { const k = tau; m.position.addScaledVector(WIND, k * 26 + 14 * k * k); m.position.y += 7 * c * k - 3 * k * k + 1.2 * Math.sin(k * 14 + e * 6); m.position.z += 3 * d * Math.sin(k * 9);
        m.rotation.set(1.3 + k * (6 + 8 * c), b.r + k * (4 + 6 * d), k * (5 + 7 * e)); } });
    poseWires(t); poseFur(t);
    if (t > RIP_T) { const k = sstep(RIP_T, RIP_T + 0.12, t), sh = 1 + 0.03 * Math.sin(ft * 30); cat.sleep.scale.set(1.05, 0.72 * sh, 1.06); cat.sleep.rotation.x = 0.02 * k * Math.sin(ft * 40); }
    else { cat.sleep.rotation.x = 0; }
  }
  return { update, wind: WIND };
}
