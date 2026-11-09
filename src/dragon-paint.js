// RYŪ · 龍 · dragon materials + geometry kit (owner: dragon): painted cel rock, cedars, rock plates, surface nets.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
const V3 = THREE.Vector3;
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Cel rock with hand-painted strata + moss + cracks, in hard bands. vP = stable object-space paint coordinate (instance seed offsets it).
export function rockMat(ctx, { base = 0xb6adc6, shade = 0x7d73a8, paintScale = 1, moss = 1, ochre = 0.62, voro = 0, mossBase = 0x8cbb4e, mossShade = 0x4f8f72, ...o } = {}) {
  const m = ctx.mat.cel(base, { id: ctx.mat.nextId(), shade, spec: 0, hiAmt: 0.5, hiT: 0.7, brush: 0.14, brushF: 0.45, recvShadow: true, ...o });
  m.uniforms.uPS = { value: paintScale }; m.uniforms.uOchre = { value: ochre }; m.uniforms.uMoss = { value: moss }; m.uniforms.uVoro = { value: voro };
  m.uniforms.uMossB = { value: new THREE.Color(mossBase) }; m.uniforms.uMossS = { value: new THREE.Color(mossShade) };
  m.vertexShader = m.vertexShader.replace('varying vec3 vN, vW, vO, vIC, vON;', 'attribute float aSeed; uniform float uPS; varying vec3 vP; varying vec3 vN, vW, vO, vIC, vON;')
    .replace('vec4 w = modelMatrix * p;', 'vP = position * uPS + vec3(aSeed * 91.7, aSeed * 37.1, aSeed * 53.3); vec4 w = modelMatrix * p;');
  m.fragmentShader = m.fragmentShader.replace('varying vec3 vN, vW, vO, vIC, vON; varying vec2 vUv;\nvoid main(){', 'uniform float uOchre, uMoss, uVoro; uniform vec3 uMossB, uMossS; varying vec3 vP; varying vec3 vN, vW, vO, vIC, vON; varying vec2 vUv;\n float voroE(vec3 p, out float cell){ vec3 i = floor(p), f = fract(p); float F1 = 8.0, F2 = 8.0; cell = 0.0; for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) { vec3 g = vec3(float(x), float(y), float(z)), id = i + g, o = vec3(h13(id), h13(id + 0.37), h13(id + 0.71)), r = g + o - f; float d = dot(r, r); if (d < F1) { F2 = F1; F1 = d; cell = h13(id + 2.1); } else if (d < F2) F2 = d; } return sqrt(F2) - sqrt(F1); }\nvoid main(){')
    .replace('vec3 base = uBase * vIC, shade = uShade * vIC, hiC = uHi * vIC;', /* glsl */`vec3 base = uBase * vIC, shade = uShade * vIC, hiC = uHi * vIC;
  { vec3 q = vP; float nS = n3(q * vec3(0.05, 0.16, 0.05) + 3.1), st = fract(q.y * 0.13 + nS * 1.2 + 0.5), oc = step(uOchre, st);
    vec3 ocB = vec3(1.22, 1.04, 0.64), ocS = vec3(1.1, 0.92, 0.7); base = mix(base, base * ocB, oc); shade = mix(shade, shade * ocS, oc); hiC = mix(hiC, hiC * ocB, oc);
    if (uVoro > 0.0) { float cell; float ed = voroE(q * uVoro * vec3(1.0, 1.0, 0.72), cell), crk = 1.0 - smoothstep(0.035, 0.08, ed); float tn = 0.88 + 0.24 * step(0.5, cell) + 0.1 * cell; base *= tn; shade *= tn; hiC *= tn; base *= 1.0 - 0.55 * crk; shade *= 1.0 - 0.6 * crk; hiC *= 1.0 - 0.55 * crk; }
    float nM = n3(q * 0.09 + 11.0) * 0.8 + n3(q * 0.3 + 5.0) * 0.2; float upW = max(N.y, 0.0), mo = step(0.74 - upW * 0.26 * uMoss, nM) * step(0.05, uMoss);
    base = mix(base, uMossB * (0.9 + 0.2 * n3(q * 0.7)), mo); shade = mix(shade, uMossS, mo); hiC = mix(hiC, uMossB * 1.3, mo);
    }`);
  m.needsUpdate = true; return m;
}

// Cedar: stacked jagged tiers, apex 1 at +y (trunk base at the origin), radius ~0.28. Vertex colour darkens the tier undersides.
export function cedarGeo() {
  const pos = [], col = [], idx = [], tiers = 4, segs = 7;
  for (let t = 0; t < tiers; t++) { const y0 = 0.12 + t * 0.2, y1 = y0 + 0.36, r0 = 0.3 * (1 - t * 0.19), base = pos.length / 3, c = 0.78 + 0.08 * t;
    for (let i = 0; i < segs; i++) { const a = i / segs * Math.PI * 2 + t * 0.7, r = r0 * (1 + 0.14 * Math.sin(i * 3.7 + t)); pos.push(Math.cos(a) * r, y0 + 0.04 * Math.sin(i * 2.3 + t), Math.sin(a) * r); col.push(c, c, c); }
    pos.push(0, y1, 0); col.push(1, 1, 1);
    for (let i = 0; i < segs; i++) { const n = (i + 1) % segs; idx.push(base + n, base + i, base + segs); }
    pos.push(0, y0 + 0.02, 0); col.push(c * 0.7, c * 0.7, c * 0.7);
    for (let i = 0; i < segs; i++) { const n = (i + 1) % segs; idx.push(base + i, base + n, base + segs + 1); } }
  const b = pos.length / 3; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; pos.push(Math.cos(a) * 0.05, -0.2, Math.sin(a) * 0.05, Math.cos(a) * 0.04, 0.3, Math.sin(a) * 0.04); col.push(0.45, 0.42, 0.45, 0.45, 0.42, 0.45); }
  for (let i = 0; i < 5; i++) { const n = (i + 1) % 5; idx.push(b + i * 2, b + i * 2 + 1, b + n * 2, b + n * 2, b + i * 2 + 1, b + n * 2 + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
}
// Rock scale plate: irregular polygon, two stacked strata (layered rock), thick bevelled edge, lifted tail end. Size ~ unit square in x/z, thickness 0.2.
export function plateGeo(seed, { sides = 8, ledges = 2 } = {}) {
  const parts = [];
  for (let L = 0; L < ledges; L++) { const k = 1 - L * 0.22 - hash(seed + L) * 0.05, th = 0.13 + 0.02 * L, y0 = -0.08 + L * 0.13, pts = [];
    for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + 0.3, j = 0.82 + 0.28 * hash(seed + i * 1.7 + L * 3.3); pts.push([Math.cos(a) * 0.5 * j * k, Math.sin(a) * 0.5 * j * k * 1.25]); }
    const pos = [], push = (x, y, z) => pos.push(x, y, z), shrink = 0.86;
    for (let i = 0; i < sides; i++) { const n = (i + 1) % sides, a = pts[i], b = pts[n], ax = a[0], az = a[1] + L * 0.05, bx = b[0], bz = b[1] + L * 0.05;
      push(ax, y0 + th, az); push(bx, y0 + th, bz); push(0, y0 + th + 0.03, L * 0.05);   // top
      push(ax, y0, az); push(bx, y0 - 0.02, bz); push(bx, y0 + th, bz); push(ax, y0, az); push(bx, y0 + th, bz); push(ax, y0 + th, az); }   // walls
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); parts.push(g); }
  const g = mergeGeometries(parts); g.computeVertexNormals(); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.2 * Math.max(0, p.getZ(i) + 0.15) * 0.65 - 0.12 * p.getX(i) * p.getX(i));   // tail edge lifts, plate bows
  return toCreasedNormals(g, 0.55);
}

// surface nets of an SDF (d < 0 inside): returns BufferGeometry (indexed, smooth gradient normals)
export function surfaceNets(f, lo, hi, h) {
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const V = new Float32Array(nx * ny * nz), id = (i, j, k) => i + j * nx + k * nx * ny;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[id(i, j, k)] = f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
  const cell = new Int32Array(nx * ny * nz).fill(-1), pos = [], tris = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], E = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { let m = 0; const g = C.map((c, q) => { const v = V[id(i + c[0], j + c[1], k + c[2])]; if (v < 0) m |= 1 << q; return v; }); if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0; for (const [a, b] of E) { const va = g[a], vb = g[b]; if ((va < 0) === (vb < 0)) continue; const u = va / (va - vb), ca = C[a], cb = C[b]; sx += ca[0] + (cb[0] - ca[0]) * u; sy += ca[1] + (cb[1] - ca[1]) * u; sz += ca[2] + (cb[2] - ca[2]) * u; n++; }
    cell[id(i, j, k)] = pos.length / 3; pos.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h); }
  const quad = (a, b, c, d) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; tris.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const c = V[id(i, j, k)], o = c < 0;
    if (o !== (V[id(i + 1, j, k)] < 0)) quad(cell[id(i, j - 1, k - 1)], cell[id(i, j, k - 1)], cell[id(i, j, k)], cell[id(i, j - 1, k)]);
    if (o !== (V[id(i, j + 1, k)] < 0)) quad(cell[id(i - 1, j, k - 1)], cell[id(i, j, k - 1)], cell[id(i, j, k)], cell[id(i - 1, j, k)]);
    if (o !== (V[id(i, j, k + 1)] < 0)) quad(cell[id(i - 1, j - 1, k)], cell[id(i, j - 1, k)], cell[id(i, j, k)], cell[id(i - 1, j, k)]); }
  // winding from the gradient
  const grad = (x, y, z, e = 0.5) => [f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)];
  for (let t = 0; t < tris.length; t += 3) { const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]], A = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], B = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], Cc = [pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]];
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]], n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const g = grad((A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3, (A[2] + B[2] + Cc[2]) / 3); if (n[0] * g[0] + n[1] * g[1] + n[2] * g[2] < 0) { tris[t + 1] = c; tris[t + 2] = b; } }
  const nor = new Float32Array(pos.length); for (let i = 0; i < pos.length / 3; i++) { const g = grad(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], 0.8), l = Math.hypot(...g) || 1; nor[i * 3] = g[0] / l; nor[i * 3 + 1] = g[1] / l; nor[i * 3 + 2] = g[2] / l; }
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); G.setIndex(tris); return G;
}

// faceted tube through a polyline: [[x,y,z]..], radii per point; hard rock facets
export function faceted(poly, radii, { sides = 6, jitter = 0.18, seed = 1 } = {}) {
  const pos = [], T = new V3(), a = new V3(), b = new V3(), P = poly.map(p => new V3(...p)), n = P.length, rings = [];
  let ref = new V3(0.3, 1, 0.2).normalize();
  for (let i = 0; i < n; i++) { T.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize(); a.crossVectors(T, ref).normalize(); b.crossVectors(a, T).normalize(); ref.copy(b); const R = [];
    for (let j = 0; j < sides; j++) { const ang = j / sides * Math.PI * 2 + i * 0.4, r = radii[i] * (1 + jitter * (hash(seed + i * 7.1 + j * 13.3) - 0.5) * 2); R.push(P[i].clone().addScaledVector(a, Math.cos(ang) * r).addScaledVector(b, Math.sin(ang) * r)); } rings.push(R); }
  const tri = (p, q, r) => pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) { const k = (j + 1) % sides, A = rings[i][j], B = rings[i][k], C = rings[i + 1][k], D = rings[i + 1][j]; tri(A, D, C); tri(A, C, B); }
  const c0 = P[0], c1 = P[n - 1]; for (let j = 0; j < sides; j++) { const k = (j + 1) % sides; tri(c0, rings[0][j], rings[0][k]); tri(c1, rings[n - 1][k], rings[n - 1][j]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
export { mergeGeometries, toCreasedNormals };
