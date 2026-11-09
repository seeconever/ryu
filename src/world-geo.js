// RYŪ · WORLD geometry helpers (owner: world).
//   Builder        accumulates flat-shaded triangles (position, normal, uv, vertex colour) under a transform stack, then
//                  geometry() -> one BufferGeometry (one draw call per material for a whole town).
//   wireGeometry   polylines -> camera-facing ribbons with a minimum on-screen width (power lines, antennas, whiskers)
//   wireMaterial   the ribbon shader: flat ink colour, id 100 (no paint, no ink pass), so 1-px lines stay crisp
//   catenary       sagging cable between two points
//   lathe / tube   small helpers for round props (piles, poles, bollards, the furin bell)
import * as THREE from 'three';

const V3 = THREE.Vector3;

export class Builder {
  constructor() { this.P = []; this.N = []; this.UV = []; this.C = []; this.m = new THREE.Matrix4(); this.nm = new THREE.Matrix3(); this.stack = []; this.col = new THREE.Color(1, 1, 1); }
  push(m) { this.stack.push(this.m.clone()); this.m.multiply(m); this.nm.getNormalMatrix(this.m); return this; }
  pop() { this.m.copy(this.stack.pop()); this.nm.getNormalMatrix(this.m); return this; }
  at(x, y, z, ry = 0, s = 1) { return this.push(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), ry), new V3(s, s, s))); }
  color(c) { this.col = c instanceof THREE.Color ? c : new THREE.Color(c); return this; }
  // triangle (local points), optional uvs; flat normal
  tri(a, b, c, uva = [0, 0], uvb = [1, 0], uvc = [0, 1], col = this.col) {
    const A = new V3(...a).applyMatrix4(this.m), B = new V3(...b).applyMatrix4(this.m), Cc = new V3(...c).applyMatrix4(this.m);
    const n = new V3().subVectors(B, A).cross(new V3().subVectors(Cc, A)).normalize();
    for (const [p, uv] of [[A, uva], [B, uvb], [Cc, uvc]]) { this.P.push(p.x, p.y, p.z); this.N.push(n.x, n.y, n.z); this.UV.push(uv[0], uv[1]); this.C.push(col.r, col.g, col.b); }
    return this;
  }
  // quad a b c d counter-clockwise seen from the front; uv = [[u,v] x4]
  quad(a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], col = this.col) { this.tri(a, b, c, uv[0], uv[1], uv[2], col); this.tri(a, c, d, uv[0], uv[2], uv[3], col); return this; }
  // axis-aligned box (local frame), uvs in metres / uvScale (world-scaled texture coordinates per face)
  box(cx, cy, cz, sx, sy, sz, { col = this.col, uv = 1, faces = 'all', uvO = [0, 0] } = {}) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, su = 1 / (Array.isArray(uv) ? uv[0] : uv), sv = 1 / (Array.isArray(uv) ? uv[1] : uv);
    const f = faces === 'all' ? 'pxnxpynypznz' : faces;
    const U = (a, b, w, h) => [[a * su + uvO[0], b * sv + uvO[1]], [(a + w) * su + uvO[0], b * sv + uvO[1]], [(a + w) * su + uvO[0], (b + h) * sv + uvO[1]], [a * su + uvO[0], (b + h) * sv + uvO[1]]];
    if (f.includes('pz')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], U(x0, y0, sx, sy), col);
    if (f.includes('nz')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], U(-x1, y0, sx, sy), col);
    if (f.includes('px')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], U(-z1, y0, sz, sy), col);
    if (f.includes('nx')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], U(z0, y0, sz, sy), col);
    if (f.includes('py')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], U(x0, -z1, sx, sz), col);
    if (f.includes('ny')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], U(x0, z0, sx, sz), col);
    return this;
  }
  // vertical cylinder / cone frustum (local), n sides, smooth-ish (flat facets), caps optional
  cyl(cx, cy, cz, r0, r1, h, { n = 10, col = this.col, cap = true, uv = 1 } = {}) {
    for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const p = (a, r, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      this.quad(p(a1, r0, cy), p(a0, r0, cy), p(a0, r1, cy + h), p(a1, r1, cy + h), [[a1 * r0 / uv, cy / uv], [a0 * r0 / uv, cy / uv], [a0 * r1 / uv, (cy + h) / uv], [a1 * r1 / uv, (cy + h) / uv]], col);
      if (cap && r1 > 0) this.tri([cx, cy + h, cz], p(a1, r1, cy + h), p(a0, r1, cy + h), [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], col); }
    return this;
  }
  // tube along a polyline of points (local), radius r, n sides
  tube(pts, r, { n = 6, col = this.col } = {}) {
    for (let i = 0; i < pts.length - 1; i++) { const a = new V3(...pts[i]), b = new V3(...pts[i + 1]), d = b.clone().sub(a).normalize();
      const s = Math.abs(d.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0), u = new V3().crossVectors(d, s).normalize(), v = new V3().crossVectors(d, u);
      for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, o0 = u.clone().multiplyScalar(Math.cos(a0) * r).addScaledVector(v, Math.sin(a0) * r), o1 = u.clone().multiplyScalar(Math.cos(a1) * r).addScaledVector(v, Math.sin(a1) * r);
        this.quad(a.clone().add(o0).toArray(), a.clone().add(o1).toArray(), b.clone().add(o1).toArray(), b.clone().add(o0).toArray(), undefined, col); } }
    return this;
  }
  get count() { return this.P.length / 3; }
  geometry() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.computeBoundingSphere(); return g; }
}

// sagging cable from a to b (sag in metres at mid span), n segments
export function catenary(a, b, sag, n = 16) { const out = []; for (let i = 0; i <= n; i++) { const k = i / n; out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - sag * 4 * k * (1 - k), a[2] + (b[2] - a[2]) * k]); } return out; }

// polylines -> ribbon geometry (expanded in the vertex shader to face the camera)
export function wireGeometry(lines, { radius = 0.012 } = {}) {
  const P = [], T = [], S = [], R = [], I = []; let base = 0;
  for (const l of lines) { const pts = l.pts || l, r = l.r ?? radius;
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      for (const s of [-1, 1]) { P.push(...pts[i]); T.push(...t); S.push(s); R.push(r); } }
    for (let i = 0; i < pts.length - 1; i++) { const q = base + i * 2; I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    base += pts.length * 2; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aTan', new THREE.Float32BufferAttribute(T, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(S, 1)); g.setAttribute('aRad', new THREE.Float32BufferAttribute(R, 1)); g.setIndex(I); g.computeBoundingSphere(); return g;
}
export function wireMaterial(ctx, { color = 0x2a2834, minPx = 1.1, id = 100 } = {}) {
  const m = new THREE.ShaderMaterial({ side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(color) }, uFar: { value: new THREE.Color(0x8a90a8) }, uMinPx: { value: minPx }, uRes: ctx.glsl.U.uRes, uKeyCol: ctx.light.u.uKeyCol, uSky: ctx.light.u.uSky,
      uFade: { value: new THREE.Vector2(70, 240) } },
    // distant wires thin out, lighten toward the haze and vanish (a web of 1-px ink lines would grey the whole town)
    vertexShader: /* glsl */`attribute vec3 aTan; attribute float aSide, aRad; uniform float uMinPx; uniform vec2 uRes, uFade; varying float vF;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec3 T = normalize(mat3(modelMatrix) * aTan + 1e-6); vec3 V = cameraPosition - w.xyz; float d = length(V);
        vec3 B = normalize(cross(T, V / d) + 1e-6); float pxa = 2.0 / (projectionMatrix[1][1] * uRes.y); vF = smoothstep(uFade.x, uFade.y, d);
        float hw = max(aRad, mix(uMinPx, 0.55, vF) * 0.5 * d * pxa) * (1.0 - step(uFade.y * 1.25, d));
        w.xyz += B * aSide * hw; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform vec3 uCol, uFar, uKeyCol, uSky; varying float vF; void main(){ gl_FragColor = vec4(mix(uCol, uFar, vF * 0.85) * mix(uSky, uKeyCol, 0.5), 0.0); }` });
  return ctx.mat.mrt(m, { id });
}

// small lathe (profile [[r, y], ...] around y), returns BufferGeometry with smooth normals
export function lathe(profile, n = 24) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), n); }

// paint a deterministic canvas texture (sRGB), repeat wrapping
export function tex(ctx, w, h, draw, { repeat = true } = {}) { const t = ctx.kit.canvasTex(w, h, draw, { repeat }); return t; }
