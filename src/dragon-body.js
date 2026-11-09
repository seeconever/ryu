// RYŪ · 龍 · the body (owner: dragon): deforming spine tube, instanced layered rock scales + belly scutes + dorsal fins, cedar forest, four clawed legs. Pure of t.
import * as THREE from 'three';
import { rockMat, cedarGeo, plateGeo, faceted, hash, mergeGeometries, toCreasedNormals } from './dragon-paint.js';
import { BODY_LEN, sstep, clamp, lerp } from './dragon-path.js';
import { onTwos } from './pipeline-util.js';
const V3 = THREE.Vector3;

const N = 250, M = 18;   // rings, sectors
export const radiusAt = (u) => { const uu = clamp(u, 0, 1); return Math.max(3, 47 * Math.pow(1 - Math.pow(uu, 2.3), 0.72) * lerp(0.66, 1, sstep(0, 0.14, uu))); };

export function buildBody(ctx, root, path) {
  const T = ctx.THREE, mat = ctx.mat;
  const group = new T.Group(); group.name = 'dragon-body'; root.add(group);
  // ring state, filled every frame
  const P = [], Tn = [], Up = [], Sd = [], Vel = []; for (let i = 0; i <= N; i++) { P.push(new V3()); Tn.push(new V3()); Up.push(new V3()); Sd.push(new V3()); Vel.push(new V3()); }
  // underlay tube (seen only between the plates): dark lavender rock
  const pos = new Float32Array((N + 1) * (M + 1) * 3), nor = new Float32Array(pos.length), idx = [], g = new T.BufferGeometry();
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setIndex(idx);
  const under = mat.cel(0x6e638c, { id: mat.nextId(), shade: 0x4f4673, spec: 0, brush: 0.2, brushF: 0.5 }), tube = new T.Mesh(g, under); tube.frustumCulled = false; group.add(tube);

  // plates: rows along s, columns around (0 = dorsal)
  const geoA = plateGeo(5, { sides: 8, ledges: 2 }), geoB = plateGeo(19, { sides: 7, ledges: 2 }), geos = [geoA, geoB], plates = [];
  const makeIM = (geo, n, o) => { const im = new T.InstancedMesh(geo.clone(), rockMat(ctx, o), n); im.frustumCulled = false; const seed = new Float32Array(n); for (let i = 0; i < n; i++) seed[i] = hash(i * 1.37 + (o.paintScale || 1)); im.geometry.setAttribute('aSeed', new T.InstancedBufferAttribute(seed, 1)); group.add(im); return im; };
  const rows = 158, cols = 15, items = [];
  for (let r = 0; r < rows; r++) { const s0 = (r + 0.5) / rows; for (let c = 0; c < cols; c++) { const a = ((c + (r % 2) * 0.5) / cols) * Math.PI * 2 - Math.PI; const sn = hash(r * 3.11 + c * 7.7), ab = Math.abs(a), belly = ab > 2.25; items.push({ u: s0 + (sn - 0.5) * 0.002, a: a + (hash(r * 1.9 + c) - 0.5) * 0.08, belly, k: 1.5 + 0.35 * sn, tone: 0.86 + 0.28 * hash(r * 5.3 + c * 2.2), ochre: ab > 1.5 ? 0.26 : 1 }); } }
  const lists = [[], []]; items.forEach((it, i) => lists[i % 2].push(it));
  lists.forEach((list, v) => { const im = makeIM(geos[v], list.length, { base: 0xbab1c9, shade: 0x7c72aa, paintScale: 15, moss: 1.1, ochre: 0.55 }), c = new T.Color(); list.forEach((it, i) => { c.setRGB(it.tone * (it.belly ? 1.18 : 1), it.tone * (it.belly ? 1.02 : 0.99), it.tone * (it.belly ? 0.8 : 1)); im.setColorAt(i, c); }); im.instanceColor.needsUpdate = true; plates.push({ im, list }); });
  // dorsal fins: big standing rock plates
  const FN = 92, fins = new T.InstancedMesh(geoB.clone(), rockMat(ctx, { base: 0xc0b6ce, shade: 0x8378ae, paintScale: 24, moss: 0.9, ochre: 0.5 }), FN); fins.frustumCulled = false; { const seed = new Float32Array(FN); for (let i = 0; i < FN; i++) seed[i] = hash(i * 7.77); fins.geometry.setAttribute('aSeed', new T.InstancedBufferAttribute(seed, 1)); } group.add(fins);
  // cedar forest along the spine
  const CN = 8200, cedarG = cedarGeo(), cedarM = mat.cel(0x55c262, { id: mat.nextId(), shade: 0x1f7f8d, hi: 0x9be073, spec: 0, vertexColors: true, brush: 0.2, brushF: 0.8, hiT: 0.55, hiAmt: 0.75 }), cedars = new T.InstancedMesh(cedarG, cedarM, CN); cedars.frustumCulled = false; group.add(cedars);
  const CD = []; { const c = new T.Color(); for (let i = 0; i < CN; i++) { const s = 0.05 + 0.89 * hash(i * 1.733), a = (hash(i * 2.93) - 0.5) * 2 * lerp(0.74, 0.5, s), h = (9 + 13 * hash(i * 7.31)) * lerp(1, 0.55, Math.pow(s, 3)); CD.push({ u: s, a, h, ph: hash(i * 3.3) * 6.28 }); const g2 = 0.82 + 0.4 * hash(i * 11.7); c.setRGB(g2 * (0.9 + 0.2 * hash(i * 5.5)), g2 * 1.06, g2 * (0.72 + 0.3 * hash(i * 9.3))); cedars.setColorAt(i, c); } cedars.instanceColor.needsUpdate = true; }
  // legs
  const legs = [[0.17, -1], [0.17, 1], [0.61, -1], [0.61, 1]].map(([u, s], i) => makeLeg(ctx, group, u, s, i));

  const dummy = new T.Object3D(), V = new V3(), N0 = new V3(), M4 = new T.Matrix4(), S0 = new V3(), T0 = new V3(), U0 = new V3(), SD0 = new V3(), P0 = new V3(), V0 = new V3(), X0 = new V3();
  const ringAt = (u) => { const x = clamp(u * N, 0, N - 1e-3), i = Math.floor(x), k = x - i; P0.copy(P[i]).lerp(P[i + 1], k); T0.copy(Tn[i]).lerp(Tn[i + 1], k).normalize(); U0.copy(Up[i]).lerp(Up[i + 1], k).normalize(); SD0.copy(Sd[i]).lerp(Sd[i + 1], k).normalize(); V0.copy(Vel[i]).lerp(Vel[i + 1], k); };

  function update(t, shot, headMat) {
    const dt = 1 / 24; const frame = { t: new V3(), u: new V3(), side: new V3(), head: headMat };
    for (let i = 0; i <= N; i++) path.bodyAt(i / N * BODY_LEN, t, P[i], frame), Up[i].copy(frame.u);
    for (let i = 0; i <= N; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(N, i + 1)]; Tn[i].subVectors(a, b).normalize(); Up[i].addScaledVector(Tn[i], -Up[i].dot(Tn[i])).normalize(); Sd[i].crossVectors(Up[i], Tn[i]).normalize(); }
    // velocity (for tree bend) from the previous frame's pose (pure: recomputed)
    const f2 = { t: new V3(), u: new V3(), side: new V3(), head: path.headFrame(t - dt) };
    for (let i = 0; i <= N; i += 5) { path.bodyAt(i / N * BODY_LEN, t - dt, V, f2); Vel[i].subVectors(P[i], V).multiplyScalar(1 / dt); }
    for (let i = 0; i <= N; i++) if (i % 5) { const a = i - i % 5, b = Math.min(N, a + 5), k = (i - a) / (b - a || 1); Vel[i].copy(Vel[a]).lerp(Vel[b], k); }
    // tube
    for (let i = 0; i <= N; i++) { const r = radiusAt(i / N) * 0.96; for (let j = 0; j <= M; j++) { const a = j / M * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = (i * (M + 1) + j) * 3; N0.copy(Up[i]).multiplyScalar(c).addScaledVector(Sd[i], s); pos[k] = P[i].x + N0.x * r; pos[k + 1] = P[i].y + N0.y * r; pos[k + 2] = P[i].z + N0.z * r; nor[k] = N0.x; nor[k + 1] = N0.y; nor[k + 2] = N0.z; } }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    // plates
    for (const { im, list } of plates) { const n = list.length; for (let i = 0; i < n; i++) { const it = list[i]; ringAt(it.u); const r = radiusAt(it.u); if (r < 2.2) { dummy.position.copy(P0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); continue; } const c = Math.cos(it.a), s = Math.sin(it.a); N0.copy(U0).multiplyScalar(c).addScaledVector(SD0, s); const sz = r * it.k * 0.42, lift = r * 0.98 + 0.42 * sz * 0.2;
        X0.crossVectors(T0, N0).normalize(); /* x = n x z(-T) */ M4.makeBasis(X0, N0, S0.copy(T0).negate()); M4.scale(V.set(sz, sz * 0.7, sz * 1.25)); M4.setPosition(P0.x + N0.x * lift, P0.y + N0.y * lift, P0.z + N0.z * lift); im.setMatrixAt(i, M4); } im.instanceMatrix.needsUpdate = true; }
    // dorsal fins
    for (let i = 0; i < FN; i++) { const u = 0.02 + i / FN * 0.96; ringAt(u); const r = radiusAt(u), sz = r * (0.42 + 0.28 * Math.abs(Math.sin(i * 2.31))); M4.makeBasis(SD0, S0.copy(T0).negate(), U0); M4.scale(V.set(sz * 0.8, sz * 0.7, sz * 1.45)); M4.setPosition(P0.x + U0.x * (r + sz * 0.45), P0.y + U0.y * (r + sz * 0.45), P0.z + U0.z * (r + sz * 0.45)); fins.setMatrixAt(i, M4); } fins.instanceMatrix.needsUpdate = true;
    // cedars: lean against the wind of the body's own motion, ripple
    const tw = onTwos(t), rip = sstep(17, 21, tw) * (1 - sstep(25, 30, tw)) * 0.3 + sstep(66, 68, tw) * (1 - sstep(69.5, 71, tw)) * 0.5;
    for (let i = 0; i < CN; i++) { const c = CD[i]; ringAt(c.u); const r = radiusAt(c.u) * 0.97, cs = Math.cos(c.a), sn = Math.sin(c.a); N0.copy(U0).multiplyScalar(cs).addScaledVector(SD0, sn);
      V.copy(V0).multiplyScalar(-0.0016); const L = V.length(); if (L > 0.62) V.multiplyScalar(0.62 / L); const wv = Math.sin(c.u * 34 - tw * 5.2 + c.ph * 0.3) * rip + Math.sin(tw * 3.1 + c.ph) * 0.05; X0.copy(T0).multiplyScalar(wv); V.addScaledVector(X0, 1);
      V.addScaledVector(N0, -V.dot(N0));
      const sh = c.h; X0.crossVectors(N0, SD0).normalize(); S0.crossVectors(N0, X0).normalize();
      // y axis sheared by the lean vector
      M4.makeBasis(S0, N0.clone().addScaledVector(V, 1), X0); M4.scale(dummy.scale.set(sh, sh, sh)); M4.setPosition(P0.x + N0.x * r, P0.y + N0.y * r, P0.z + N0.z * r); cedars.setMatrixAt(i, M4); }
    cedars.instanceMatrix.needsUpdate = true;
    // legs
    for (const l of legs) l.pose(t, tw, { ringAt, get: () => [P0, T0, U0, SD0], radiusAt, flyK: path.flyK(t), speed: V0.length() });
  }
  return { group, update };
}

function makeLeg(ctx, parent, u, s, idx) {
  const T = ctx.THREE, mat = ctx.mat, rockM = rockMat(ctx, { base: 0xb8afca, shade: 0x7a70a8, moss: 0.7, ochre: 0.55 });
  const J = (name) => { const g = new T.Group(); g.name = name; return g; }, shoulder = J('sh'), elbow = J('el'), wrist = J('wr'); parent.add(shoulder); shoulder.add(elbow); elbow.add(wrist);
  const up = 120, lo = 110, sid = s;
  const part = (poly, radii, o = {}) => { const m = new T.Mesh(toCreasedNormals(faceted(poly, radii, { sides: 7, seed: idx * 3 + 1, ...o }), 0.5), rockM); return m; };
  shoulder.add(part([[0, 0, 0], [0, -up * 0.5, 4], [0, -up, 0]], [34, 26, 18]));
  const ps = new T.Mesh(new T.IcosahedronGeometry(38, 1), rockM); ps.scale.set(1.1, 0.8, 1.25); shoulder.add(ps);
  elbow.position.set(0, -up, 0); elbow.add(part([[0, 0, 0], [0, -lo * 0.5, -3], [0, -lo, 0]], [18, 15, 12]));
  wrist.position.set(0, -lo, 0);
  const paw = new T.Mesh(new T.IcosahedronGeometry(17, 1), rockM); paw.scale.set(1.2, 0.8, 1.4); wrist.add(paw);
  const clawM = mat.cel(0xe9dfc6, { id: mat.nextId(), shade: 0x9b90b6, spec: 0 });
  for (let i = 0; i < 4; i++) { const a = (i - 1.5) * 0.62; const claw = new T.Group(); claw.position.set(Math.sin(a) * 14, -4, Math.cos(a) * 14); claw.rotation.y = a; const c0 = new V3(0, 0, 0), poly = [[0, 0, 0], [0, -14, 8], [0, -30, 8], [0, -44, -2]]; const g = faceted(poly, [6.5, 5, 3.2, 0.4], { sides: 5, seed: idx + i }); claw.add(new T.Mesh(g, clawM)); wrist.add(claw); }
  // the boulder it clutches
  const rg = new T.IcosahedronGeometry(1, 1); { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.8 + 0.3 * hash(p.getX(i) * 4.1 + p.getY(i) * 7.3 + p.getZ(i) * 3.7 + idx); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } rg.computeVertexNormals(); } const boulder = new T.Mesh(toCreasedNormals(rg, 0.6), rockM); boulder.position.set(0, -24, 2); boulder.scale.setScalar(21); wrist.add(boulder);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), Eu = new T.Euler(), Z = new V3();
  return { pose(t, tw, env) {
    env.ringAt(u); const [P, Tn, Up, Sd] = env.get(), r = env.radiusAt(u); const X = Sd.clone().multiplyScalar(s), offs = Up.clone().multiplyScalar(-r * 0.28).addScaledVector(X, r * 0.92);
    // shoulder frame: y = down the leg (-Up), z = forward T; x = side
    Z.crossVectors(X.clone().negate(), Up).normalize();
    M4.makeBasis(Sd, Up, Tn); shoulder.position.copy(P).add(offs); Q.setFromRotationMatrix(M4); shoulder.quaternion.copy(Q);
    const fly = env.flyK, ph = tw * 2.1 + idx * 1.7, swim = Math.sin(ph) * 0.12 * fly;
    // reaching at rest. In flight a real pose: the front pair thrown forward and spread with the claws open, the back pair raking behind. x-rotation swings the leg forward/back around the body side
    const front = u < 0.4, armX = lerp(0.65, (front ? -0.72 : 0.95) + swim, fly), armZ = lerp(0.12, (front ? 0.95 : 0.8) + Math.sin(ph * 0.7) * 0.1, fly), elbX = lerp(-1.25, (front ? -0.55 : 0.75) + swim * 0.6, fly), wrX = lerp(-0.1, front ? 0.5 : 0.35, fly);
    shoulder.scale.setScalar(lerp(1, 1.12, fly)); shoulder.rotateZ(s * armZ); shoulder.rotateX(armX); elbow.rotation.x = elbX; wrist.rotation.x = wrX;
  } };
}
