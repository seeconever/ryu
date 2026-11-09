// RYŪ · 龍 · drawn FX primitives (owner: fx). One dynamic triangle batch in ctx.overlay, rebuilt from t every frame.
// Everything is an effect cel: flat colour, hard antialiased edges, no alpha mush. Modes (per vertex):
//   FLAT   ribbon band, optional white core (lightning, speed lines, rings, rain, smears)
//   WATER  tapering sheet: ragged edge, torn into fingers at the end, 2 tones + white streaks + backlit rim
//   PUFF   cauliflower cel lump: scalloped hard outline, 2 tones, lit rim (dust, spray, cloud burst)
//   DOT    hard disc with a core (motes, drops)
// World batches store camera-relative positions (precision at 12 km from the origin); screen batches use 1080p pixels, centre 0,0.
import * as THREE from 'three';
import { OVERLAY, NOISE, U } from './pipeline-glsl.js';

export const FLAT = 0, WATER = 1, PUFF = 2, DOT = 3;
export const h = (i, k = 0) => { const x = Math.sin(i * 12.9898 + k * 78.233 + 4.1) * 43758.5453; return x - Math.floor(x); };
export const sat = (x) => Math.min(1, Math.max(0, x));
export const sstep = (a, b, x) => { const k = sat((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const lerp = (a, b, k) => a + (b - a) * k;
const CACHE = new Map();
export function col(hex, k = 1) { let c = CACHE.get(hex); if (!c) { const q = new THREE.Color(hex); c = [q.r, q.g, q.b]; CACHE.set(hex, c); } return k === 1 ? c : [c[0] * k, c[1] * k, c[2] * k]; }

const VS = /* glsl */`attribute vec2 aUv; attribute vec4 aA, aB, aP; attribute float aS; varying vec2 vUv; varying vec4 vA, vB, vP; varying float vZ, vS;
void main(){ vUv = aUv; vA = aA; vB = aB; vP = aP; vS = aS;
  #ifdef SCREEN
    vZ = position.z; gl_Position = vec4(position.xy, 0.0, 1.0);
  #else
    vec3 v = mat3(viewMatrix) * position; vZ = -v.z; gl_Position = projectionMatrix * vec4(v, 1.0);
  #endif
}`;
const FS = /* glsl */`${OVERLAY} ${NOISE} uniform vec3 uRim; varying vec2 vUv; varying vec4 vA, vB, vP; varying float vZ, vS;
void main(){
  float m = vB.a, a = 1.0, seed = vP.x; vec3 c = vA.rgb;
  if (m < 0.5) {                         // FLAT: p1 = softness, p2 = core width
    float av = abs(vUv.y), aa = clamp(fwidth(av) * 1.3, 0.01, 0.6);
    a = 1.0 - smoothstep(1.0 - aa, 1.0, av);
    if (vP.y > 0.0) a = mix(a, pow(max(1.0 - av, 0.0), 1.7), vP.y);
    if (vP.z > 0.0) { float k = 1.0 - smoothstep(vP.z - aa, vP.z + aa, av); c = mix(c, vB.rgb, k); }
  } else if (m < 1.5) {                  // WATER: p1 = scroll (on threes), p2 = rim side (+1 / -1, 0 both)
    float u = vUv.x, v = vUv.y, sc = vP.y;
    float rg = (n2(vec2(u * 3.2 + seed * 13.0, seed * 5.0 + sc * 0.4)) - 0.5) * 0.32 * smoothstep(0.0, 0.2, u);
    float e = abs(v) + rg, aa = clamp(fwidth(v) * 1.5, 0.01, 0.5);
    a = 1.0 - smoothstep(1.0 - aa, 1.0, e);
    float f = n2(vec2(v * 3.4 + seed * 17.0, seed + sc * 0.3));
    a *= smoothstep(-0.03, 0.03, f - (u - 0.5) / 0.5 * 1.08);
    float s = n2(vec2(v * 3.2 + seed * 3.0, u * 2.6 - sc * 0.9)), hl = n2(vec2(v * 8.5 + seed * 9.0, u * 3.4 - sc * 1.5));
    c = mix(c, vB.rgb, smoothstep(0.50, 0.53, s));
    c = mix(c, vec3(1.0), smoothstep(0.68, 0.71, hl) * (1.0 - 0.5 * u));
    float rim = smoothstep(0.84 - aa, 0.84 + aa, e), sd = vP.z == 0.0 ? 1.0 : smoothstep(-0.1, 0.1, v * vP.z);
    c = mix(c, uRim, rim * sd);
  } else if (m < 2.5) {                  // PUFF: p1, p2 = light direction in uv
    vec2 p = vUv, L = vP.yz; float r = length(p), ang = atan(p.y, p.x);
    float lob = 5.0 + floor(fract(seed * 7.13) * 5.0), sc = pow(abs(cos(ang * lob * 0.5 + seed * 6.3)), 0.55);
    float e = 0.70 + 0.27 * sc + (n2(p * 3.0 + seed * 19.0) - 0.5) * 0.06, aa = clamp(fwidth(r) * 1.3, 0.005, 0.4);
    a = 1.0 - smoothstep(e - aa, e, r);
    float li = dot(p, L) + 0.22 * (sc - 0.5) + (n2(p * 3.5 + seed * 9.0) - 0.5) * 0.34;
    c = mix(vB.rgb, vA.rgb, smoothstep(-0.05 - aa, -0.05 + aa, li));
    float rr = smoothstep(e - 0.1 - aa, e - 0.1 + aa, r) * smoothstep(0.25, 0.4, dot(p / max(r, 1e-3), L));
    c = mix(c, uRim, rr * 0.85);
  } else {                               // DOT: p2 = core radius
    float r = length(vUv), aa = clamp(fwidth(r) * 1.3, 0.02, 0.5);
    a = 1.0 - smoothstep(1.0 - aa, 1.0, r);
    if (vP.z > 0.0) c = mix(c, vB.rgb, 1.0 - smoothstep(vP.z - aa, vP.z + aa, r));
  }
  a *= vA.a;
  if (vS > 0.0) { float d = sceneDepth(); if (d < 1e-3) d = 1e9; a *= clamp((d - vZ) / vS, 0.0, 1.0); }
  if (a < 0.003) discard;
  gl_FragColor = vec4(c * a, a * vP.w);
}`;

export function celBatch(ctx, { max = 60000, order = 8, screen = false, name = 'fx-cel' } = {}) {
  const P = new Float32Array(max * 3), UV = new Float32Array(max * 2), A = new Float32Array(max * 4), B = new Float32Array(max * 4), PR = new Float32Array(max * 4), SF = new Float32Array(max), IX = new Uint32Array(max * 3);
  const g = new THREE.BufferGeometry(), at = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', at(P, 3)); g.setAttribute('aUv', at(UV, 2)); g.setAttribute('aA', at(A, 4)); g.setAttribute('aB', at(B, 4)); g.setAttribute('aP', at(PR, 4)); g.setAttribute('aS', at(SF, 1)); g.setIndex(at(IX, 1));
  const uRim = { value: new THREE.Color(1.15, 1.13, 1.05) };
  const m = new THREE.ShaderMaterial({ uniforms: { tSceneData: U.tSceneData, uRes: U.uRes, uRim }, vertexShader: VS, fragmentShader: FS, defines: screen ? { SCREEN: '' } : {},
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.name = name; mesh.visible = false; ctx.overlay.add(mesh);
  let nv = 0, ni = 0, cx = 0, cy = 0, cz = 0, fx = 0, fy = 0, fz = 0, pxK = 0, rx = 1, ry = 0, rz = 0, ux = 0, uy = 1, uz = 0;
  function put(x, y, z, u, v, s, c1, c2) {
    const j = nv++; P[j * 3] = x; P[j * 3 + 1] = y; P[j * 3 + 2] = z; UV[j * 2] = u; UV[j * 2 + 1] = v;
    A[j * 4] = c1[0]; A[j * 4 + 1] = c1[1]; A[j * 4 + 2] = c1[2]; A[j * 4 + 3] = s.a ?? 1;
    B[j * 4] = c2[0]; B[j * 4 + 1] = c2[1]; B[j * 4 + 2] = c2[2]; B[j * 4 + 3] = s.mode ?? 0;
    PR[j * 4] = s.seed ?? 0; PR[j * 4 + 1] = s.p1 ?? 0; PR[j * 4 + 2] = s.p2 ?? 0; PR[j * 4 + 3] = s.over ?? 1; SF[j] = s.soft ?? 0;
    return j;
  }
  const quadIdx = (a, b, c, d) => { IX[ni++] = a; IX[ni++] = b; IX[ni++] = c; IX[ni++] = b; IX[ni++] = d; IX[ni++] = c; };
  const hexc = (x, k = 1) => (Array.isArray(x) ? x : col(x ?? 0xffffff, k));
  const api = {
    mesh, get count() { return nv; },
    begin(E, rim) {
      nv = ni = 0; cx = E.cam[0]; cy = E.cam[1]; cz = E.cam[2]; [fx, fy, fz] = E.F; [rx, ry, rz] = E.R; [ux, uy, uz] = E.U; pxK = E.pxK;
      if (rim != null) { const c = col(rim, 1.15); uRim.value.setRGB(c[0], c[1], c[2]); } return api; },
    // world ribbon facing the camera. pts [[x,y,z], ...], w = half width (m) or fn(u). s: { col, col2, a, mode, seed, p1, p2, over, soft (m, 0 = no depth test), px (min half width in 1080p px) }
    line(pts, w, s = {}) {
      const n = pts.length; if (n < 2 || nv + n * 2 > max || ni + n * 6 > max * 3) return; const c1 = hexc(s.col), c2 = hexc(s.col2), base = nv, fw = typeof w === 'function';
      for (let i = 0; i < n; i++) {
        const a = pts[i], p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)], u = i / (n - 1);
        const tx = p1[0] - p0[0], ty = p1[1] - p0[1], tz = p1[2] - p0[2], vx = a[0] - cx, vy = a[1] - cy, vz = a[2] - cz;
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx, l = Math.hypot(sx, sy, sz); if (l < 1e-9) { sx = rx; sy = ry; sz = rz; l = 1; } sx /= l; sy /= l; sz /= l;
        const depth = Math.max(0.05, vx * fx + vy * fy + vz * fz), wd = fw ? w(u) : w, hw = Math.max(wd, wd > 0 && s.px ? s.px * pxK * depth * Math.min(1, wd / (s.wn || 1e-9)) : 0);
        for (const sd of [-1, 1]) put(vx + sx * hw * sd, vy + sy * hw * sd, vz + sz * hw * sd, u, sd, s, c1, c2);
      }
      for (let i = 0; i < n - 1; i++) { const v = base + i * 2; quadIdx(v, v + 1, v + 2, v + 3); }
    },
    // two explicit rails (rings lying on the ground, wake bands). v runs -1 (a) .. 1 (b)
    strip(a, b, s = {}) {
      const n = a.length; if (n < 2 || nv + n * 2 > max || ni + n * 6 > max * 3) return; const c1 = hexc(s.col), c2 = hexc(s.col2), base = nv;
      for (let i = 0; i < n; i++) { const u = i / (n - 1); put(a[i][0] - cx, a[i][1] - cy, a[i][2] - cz, u, -1, s, c1, c2); put(b[i][0] - cx, b[i][1] - cy, b[i][2] - cz, u, 1, s, c1, c2); }
      for (let i = 0; i < n - 1; i++) { const v = base + i * 2; quadIdx(v, v + 1, v + 2, v + 3); }
    },
    // camera-facing quad, uv -1..1. r = radius (m). s.px = minimum radius in px
    quad(p, r, s = {}) {
      if (nv + 4 > max || ni + 6 > max * 3) return; const c1 = hexc(s.col), c2 = hexc(s.col2), vx = p[0] - cx, vy = p[1] - cy, vz = p[2] - cz, depth = Math.max(0.05, vx * fx + vy * fy + vz * fz), R = Math.max(r, (s.px ?? 0) * pxK * depth), base = nv;
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(vx + (rx * x + ux * y) * R, vy + (ry * x + uy * y) * R, vz + (rz * x + uz * y) * R, x, y, s, c1, c2);
      quadIdx(base, base + 1, base + 2, base + 3);
    },
    // screen ribbon: pts [[x, y], ...] in 1080p pixels (centre 0,0), w px or fn(u); s.z = view depth (hidden behind anything nearer, needs s.soft > 0)
    line2(pts, w, s = {}) {
      const n = pts.length; if (n < 2 || nv + n * 2 > max || ni + n * 6 > max * 3) return; const c1 = hexc(s.col), c2 = hexc(s.col2), base = nv, fw = typeof w === 'function', z = s.z ?? 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i], p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)], u = i / (n - 1); let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const hw = fw ? w(u) : w; for (const sd of [-1, 1]) put((a[0] + nx * hw * sd) / 960, (a[1] + ny * hw * sd) / 540, z, u, sd, s, c1, c2);
      }
      for (let i = 0; i < n - 1; i++) { const v = base + i * 2; quadIdx(v, v + 1, v + 2, v + 3); }
    },
    end() { for (const k of ['position', 'aUv', 'aA', 'aB', 'aP', 'aS']) { const a = g.getAttribute(k); a.needsUpdate = true; a.clearUpdateRanges?.(); } g.index.needsUpdate = true; g.setDrawRange(0, ni); mesh.visible = ni > 0; },
    hide() { nv = ni = 0; mesh.visible = false; },
  };
  return api;
}

// faceted boulder: convex hull of random points (real planar facets, not a noisy sphere). Non-indexed, flat normals.
export function hullGeo(seed, n = 12, sx = 1, sy = 0.8, sz = 1.1) {
  const v = []; for (let i = 0; i < n; i++) { const a = h(i, seed) * Math.PI * 2, y = h(i + 50, seed) * 2 - 1, r = Math.sqrt(1 - y * y), k = 0.7 + 0.3 * h(i + 90, seed); v.push([Math.cos(a) * r * k * sx, y * k * sy, Math.sin(a) * r * k * sz]); }
  const pos = [], nor = [], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let N = cross(sub(v[j], v[i]), sub(v[k], v[i])); const l = Math.hypot(...N); if (l < 1e-6) continue; N = N.map(x => x / l); const d = dot(N, v[i]); let s = 0, ok = true;
    for (let q = 0; q < n && ok; q++) { if (q === i || q === j || q === k) continue; const e = dot(N, v[q]) - d; if (Math.abs(e) < 1e-6) continue; if (s === 0) s = Math.sign(e); else if (Math.sign(e) !== s) ok = false; }
    if (!ok) continue; let a = v[i], b = v[j], c = v[k]; if (s > 0) { N = N.map(x => -x); [b, c] = [c, b]; }
    pos.push(...a, ...b, ...c); nor.push(...N, ...N, ...N);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}

// drawn cedar, height 1, base at y 0, vertex colours (trunk / two foliage tones), faceted
export function cedarGeo() {
  const parts = [], addCone = (r0, r1, y0, y1, seg, c, twist) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, false, twist).toNonIndexed(); g.translate(0, (y0 + y1) / 2, 0); g.computeVertexNormals(); const n = g.getAttribute('position').count, cc = new Float32Array(n * 3), q = col(c); for (let i = 0; i < n; i++) cc.set(q, i * 3); g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); parts.push(g); };
  addCone(0.035, 0.022, 0, 0.3, 5, 0x6a4a3a, 0.2);
  addCone(0.2, 0.01, 0.16, 0.56, 6, 0x2f7a52, 0.1); addCone(0.165, 0.008, 0.38, 0.76, 6, 0x37895a, 0.7); addCone(0.12, 0.004, 0.6, 1, 5, 0x429a63, 1.3);
  const total = parts.reduce((s, g) => s + g.getAttribute('position').count, 0), pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), cc = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0; for (const g of parts) { pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3); cc.set(g.getAttribute('color').array, o * 3); o += g.getAttribute('position').count; }
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); G.setAttribute('color', new THREE.BufferAttribute(cc, 3)); G.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return G;
}
