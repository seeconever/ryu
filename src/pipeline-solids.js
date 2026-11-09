// RYŪ · collision registry (owner: engine). Departments register what must never interpenetrate; tools/check.mjs
// poses every Nth frame (no render) and reports violations per shot.
//   ctx.solids.add(name, object3D, { kind: 'box' | 'sphere' | 'points', group, pad, groups: ['coast'], points: 300 })
//       box = oriented box from the object's local bounds (all child meshes), sphere = bounding sphere,
//       points = vertex samples (exact surfaces vs the other solid's box). group: solids of one group never test each other
//       (e.g. all parts of the dragon). pad > 0 grows, < 0 shrinks the solid (metres).
//   ctx.solids.allow(a, b, tol)   contact pair: penetration up to tol metres is fine (Clawd sitting on the pier deck)
//   ctx.solids.rest(a, on, { tol, when: (t) => bool })   a must stand on `on` (bottom of a within tol of the top of on)
import * as THREE from 'three';
const V3 = THREE.Vector3;

function localBounds(obj) {
  const box = new THREE.Box3(), inv = new THREE.Matrix4(); obj.updateMatrixWorld(true); inv.copy(obj.matrixWorld).invert();
  obj.traverse(m => { if (!(m.isMesh || m.isInstancedMesh) || m.userData.noSolid) return; const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); box.union(b); });
  return box;
}
function obb(s) {
  const m = s.obj.matrixWorld, b = s.local, c = b.getCenter(new V3()).applyMatrix4(m), h = b.getSize(new V3()).multiplyScalar(0.5);
  const ax = [new V3(), new V3(), new V3()]; m.extractBasis(ax[0], ax[1], ax[2]);
  const he = [h.x * ax[0].length() + s.pad, h.y * ax[1].length() + s.pad, h.z * ax[2].length() + s.pad]; ax.forEach(a => a.normalize());
  return { c, ax, he: he.map(v => Math.max(v, 1e-4)) };
}
// SAT: penetration depth (> 0 overlap) between two OBBs
function obbDepth(A, B) {
  const axes = [...A.ax, ...B.ax]; for (const a of A.ax) for (const b of B.ax) { const x = new V3().crossVectors(a, b); if (x.lengthSq() > 1e-8) axes.push(x.normalize()); }
  const d = new V3().subVectors(B.c, A.c); let min = Infinity;
  for (const L of axes) { const ra = A.he.reduce((s, h, i) => s + h * Math.abs(A.ax[i].dot(L)), 0), rb = B.he.reduce((s, h, i) => s + h * Math.abs(B.ax[i].dot(L)), 0);
    const o = ra + rb - Math.abs(d.dot(L)); if (o <= 0) return o; min = Math.min(min, o); }
  return min;
}
function pointDepth(p, B) { const d = new V3().subVectors(p, B.c); let m = Infinity; for (let i = 0; i < 3; i++) { const o = B.he[i] - Math.abs(d.dot(B.ax[i])); if (o <= 0) return o; m = Math.min(m, o); } return m; }
const visible = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };

export function createSolids() {
  const list = [], allowed = new Map(), rests = [], customs = [];
  const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  const api = {
    list,
    add(name, obj, { kind = 'box', group = name, pad = 0, groups = null, points = 300 } = {}) {
      const s = { name, obj, kind, group, pad, groups, npts: points, local: null, pts: null }; list.push(s); return s; },
    remove(name) { const i = list.findIndex(s => s.name === name); if (i >= 0) list.splice(i, 1); },
    allow(a, b, tol = 0.02) { allowed.set(key(a, b), tol); },
    rest(a, on, { tol = 0.03, when = () => true } = {}) { rests.push({ a, on, tol, when }); },
    // department-side exact tests (segment vs rounded body...): fn(t, activeGroups) -> [{ a, b, depth, rest? }]
    custom(fn) { customs.push(fn); },
    // test the current pose; activeGroups = set groups on screen
    test(t, activeGroups) {
      const live = list.filter(s => visible(s.obj) && (!s.groups || s.groups.some(g => activeGroups.includes(g))));
      for (const s of live) { s.obj.updateMatrixWorld(true); if (!s.local) s.local = localBounds(s.obj); s.box = obb(s);
        if (s.kind === 'points') { if (!s.pts) { s.pts = []; s.obj.traverse(m => { if (!m.isMesh || m.userData.noSolid) return; const p = m.geometry.attributes.position, st = Math.max(1, Math.floor(p.count / s.npts));
            for (let i = 0; i < p.count; i += st) s.pts.push([m, new V3().fromBufferAttribute(p, i)]); }); }
          s.wpts = s.pts.map(([m, p]) => p.clone().applyMatrix4(m.matrixWorld)); } }
      const out = [];
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const A = live[i], B = live[j]; if (A.group === B.group) continue;
        const tol = allowed.get(key(A.name, B.name)) ?? 0.005;
        let depth = obbDepth(A.box, B.box); if (depth <= tol) continue;
        if (A.kind === 'points' || B.kind === 'points') { depth = -1;
          if (A.kind === 'points') for (const p of A.wpts) depth = Math.max(depth, pointDepth(p, B.box));
          if (B.kind === 'points') for (const p of B.wpts) depth = Math.max(depth, pointDepth(p, A.box)); }
        else if (A.kind === 'sphere' || B.kind === 'sphere') { const ra = A.local.getBoundingSphere(new THREE.Sphere()).applyMatrix4(A.obj.matrixWorld), rb = B.local.getBoundingSphere(new THREE.Sphere()).applyMatrix4(B.obj.matrixWorld);
          const sd = ra.radius + rb.radius - ra.center.distanceTo(rb.center); if (A.kind === 'sphere' && B.kind === 'sphere') depth = sd; else depth = Math.min(depth, sd); }
        if (depth > tol) out.push({ a: A.name, b: B.name, depth: +depth.toFixed(4) });
      }
      for (const r of rests) { if (!r.when(t)) continue; const A = live.find(s => s.name === r.a), B = live.find(s => s.name === r.on); if (!A || !B) continue;
        const bot = new THREE.Box3().setFromObject(A.obj).min.y, top = new THREE.Box3().setFromObject(B.obj).max.y, gap = bot - top;
        if (Math.abs(gap) > r.tol) out.push({ a: r.a, b: r.on, rest: gap > 0 ? 'floats' : 'sinks', depth: +Math.abs(gap).toFixed(4) }); }
      for (const fn of customs) out.push(...fn(t, activeGroups));
      return out;
    },
  };
  return api;
}
