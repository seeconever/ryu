// RYŪ · SKY CLOUDS (owner: world) — sculpted cumulus for the painted skies.
// A cloud = a union of spheres ray-traced per pixel inside an instanced box: exact silhouettes from any camera (the giant
// flies through them), true hit depth (z-buffer + data buffer, so the haze and the paint pass treat every lobe as a real
// surface). Painted BG (id 0, paint mask = coverage).
// Design: every tower is built from a designed silhouette (a profile radius along a leaning axis): heavily overlapped
// core masses that never read as balls, then 3 lobe tiers that get smaller toward the edges and the top (cauliflower
// lobes half-buried in the profile, florets on their upper faces, small curls on the crown), a cauliflower or anvil top
// and a flat base. Shading is painted, not physical: ONE hard terminator on a normal blended between the lobe and the
// whole mass (a few large shadow planes, lobes only bend the terminator), low-frequency brush noise, self-shadow from the
// big masses only, the lower body fading into a darker lavender underside, a silver rim toward the light.
//   createCloudSystem(ctx, clouds, opts) -> { mesh, clouds, palette(p), setKey(dir), setHot(pos, color, radius), setOffsets(fn) }
//   cumulusTower(R, o) / cumulusPuff(R, o) -> { spheres: [[x, y, z, r], ...], base, h, scale }
import * as THREE from 'three';

export const MAXS = 200;               // spheres per cloud (texture row width)
const V3 = THREE.Vector3;
const sst = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// ---------------------------------------------------------------------------------------------------------------------
// generators (seeded, deterministic)
// ---------------------------------------------------------------------------------------------------------------------
// next-tier lobes on each parent [x, y, z, r]: the centre stays inside the parent (never a detached ball), facing up and
// away from the cloud axis; size = fraction of the parent radius, out = centre distance (fraction of the parent radius)
function florets(R, S, parents, { n = [1, 2], size = [0.42, 0.55], out = 0.72, up = 0.6, axis = null, minY = -1e9, budget = MAXS }) {
  const res = [];
  for (const p of parents) {
    const k = n[0] + Math.floor(R() * (n[1] - n[0] + 1));
    for (let i = 0; i < k && S.length + res.length < budget; i++) {
      const a = R() * Math.PI * 2, e = (R() - 0.3) * 1.2, d = new V3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
      if (axis) { const o = new V3(p[0] - axis[0], 0, p[2] - axis[1]); if (o.lengthSq() > 1) d.addScaledVector(o.normalize(), 0.75); }
      d.y += up; d.normalize();
      const r = p[3] * (size[0] + (size[1] - size[0]) * R()), c = [p[0] + d.x * p[3] * out, p[1] + d.y * p[3] * out, p[2] + d.z * p[3] * out, r];
      if (c[1] + r * 0.4 < minY) continue;
      res.push(c);
    }
  }
  S.push(...res); return res;
}

// Towering summer cumulus (nyuudougumo). w = base width, h = height (m), lean = axis drift per metre of height,
// crown = cauliflower richness, skirt = base spread, anvil > 0 spreads the top into an anvil shelf, depth = z squash.
export function cumulusTower(R, { x = 0, z = 0, base = 1000, w = 3000, h = 6000, lean = [0, 0], crown = 1, skirt = 1, anvil = 0, depth = 0.85, budget = MAXS } = {}) {
  const S = [], ph = R() * 6.28, top = anvil > 0 ? 0.88 : 0.74;
  const axis = (f) => [x + lean[0] * h * f + Math.sin(f * 4.1 + ph) * w * 0.04, z + lean[1] * h * f];
  // silhouette radius (m) at height fraction f: wide skirt, a billowing column, a dome (or the anvil spread) on top
  const prof = (f) => {
    let r = 0.29 + 0.17 * skirt * (1 - sst(0.0, 0.32, f)) + 0.035 * Math.sin(f * 7.3 + ph) + 0.02 * Math.sin(f * 15.1 + ph * 2);
    if (anvil > 0) r += 0.36 * anvil * sst(0.68, 0.86, f);
    const fd = (f - top) / (1 - top); if (fd > 0) r *= Math.sqrt(Math.max(0, 1 - fd * fd));
    return r * w;
  };
  // tier 1: core masses, rings of overlapping spheres along the axis (2 per level in the column -> an oval section)
  const core = [];
  for (let f = 0.025; f < 0.985;) {
    const pr = prof(f); if (pr < w * 0.07) break;
    const rr = Math.min(pr * 0.74, w * 0.22), d = Math.max(pr - rr * 1.08, rr * 0.3), m = d < rr * 0.45 ? 2 : Math.max(3, Math.round(2 * Math.PI * d / (rr * 1.15)));
    const [ax, az] = axis(f), cy = base + f * h, a0 = R() * 6.28;
    for (let j = 0; j < m; j++) { const a = a0 + j / m * Math.PI * 2; core.push([ax + Math.cos(a) * d, cy + (R() - 0.5) * rr * 0.12, az + Math.sin(a) * d * depth, rr * (0.94 + 0.08 * R())]); }
    f += Math.max(rr * 0.5, w * 0.05) / h;
  }
  S.push(...core);
  // crown: a cauliflower dome of big lobes (or the anvil's lumpy rim) — they carry the silhouette, so they go first
  const crownL = [], pt = prof(top - 0.02), [tx, tz] = axis(top), ty = base + top * h, nc = 5 + Math.floor(R() * 3) + (anvil > 0 ? 3 : 0);
  for (let j = 0; j < nc; j++) {
    const a = j / nc * Math.PI * 2 + R() * 0.5, el = anvil > 0 ? 0.1 + R() * 0.35 : 0.25 + R() * 0.9, Rd = pt * (anvil > 0 ? 0.84 : 0.7), r = Math.min(pt * (anvil > 0 ? 0.3 : 0.4), w * 0.19) * (0.8 + 0.35 * R()) * crown;
    crownL.push([tx + Math.cos(a) * Math.cos(el) * Rd, ty + Math.sin(el) * (1 - top) * h * 0.7, tz + Math.sin(a) * Math.cos(el) * Rd * depth, r]);
  }
  crownL.push([tx, ty + (1 - top) * h * 0.45, tz, Math.min(pt * 0.5, w * 0.22)]);
  S.push(...crownL);
  // tier 2: cauliflower lobes half-buried in the profile surface, smaller toward the top and the base edge
  const t2 = [], n2 = Math.round(30 + 12 * crown);
  for (let i = 0; i < n2 && S.length < budget; i++) {
    const f = 0.06 + (top + 0.02 - 0.06) * Math.pow(R(), 0.8), pr = prof(f); if (pr < w * 0.06) continue;
    const a = R() * Math.PI * 2, [ax, az] = axis(f), dd = pr * 0.84, big = R() < 0.25 ? 1.3 : 1;
    const r = Math.min(pr * (0.28 + 0.14 * R()) * big, w * 0.17) * (1 - 0.25 * f) * (f < 0.12 ? 0.75 : 1);
    const c = [ax + Math.cos(a) * dd, base + f * h + (R() - 0.3) * r * 0.4, az + Math.sin(a) * dd * depth, r];
    if (c[1] + r * 0.3 < base) continue;
    t2.push(c); S.push(c);
  }
  // tier 3 florets (upper faces of the crown + lobes), tier 4 curls on the upper third only
  const ax0 = [x, z], up3 = crownL.concat(t2.slice().sort((a, b) => b[1] - a[1]));
  const t3 = florets(R, S, up3, { n: [1, 2], size: [0.4, 0.54], out: 0.8, up: 0.65, axis: ax0, minY: base, budget });
  florets(R, S, t3.filter(c => c[1] > base + h * 0.45), { n: [0, 1], size: [0.4, 0.5], out: 0.8, up: 0.7, axis: ax0, minY: base, budget });
  return { spheres: S.slice(0, budget), base, h, scale: w * 0.25 };
}

// Fair-weather cumulus: a flat-based heap (w wide, h tall): 2-4 core masses, a central dome, lobes on the upper half,
// florets on the lobes.
export function cumulusPuff(R, { x = 0, z = 0, base = 900, w = 900, h = 500, budget = 64 } = {}) {
  if (h > w * 0.75) return cumulusTower(R, { x, z, base, w: Math.max(w, h * 0.7), h, skirt: 0.6, crown: 0.8, budget: Math.max(budget, 96) });   // tall: a small tower
  const S = [], nCore = 2 + Math.floor(R() * 3);
  for (let i = 0; i < nCore; i++) { const f = nCore === 1 ? 0 : i / (nCore - 1) - 0.5, r = w * (0.24 - 0.1 * Math.abs(f)) * (0.9 + 0.2 * R());
    S.push([x + f * w * 0.56, base + r * 0.32, z + (R() - 0.5) * w * 0.12, r]); }
  const rd = Math.min(h * 0.42, w * 0.2); S.push([x + (R() - 0.5) * w * 0.18, base + h - rd * 1.3, z, rd]);
  // the cauliflower top: lobes centred ON an ellipsoid shell over the heap (they carry the silhouette, none dominates)
  const t2 = [], n2 = 7 + Math.floor(R() * 4);
  for (let i = 0; i < n2; i++) { const a = (i / (n2 - 1) - 0.5) * Math.PI * 0.9 + (R() - 0.5) * 0.25, b = (R() - 0.5) * 1.4;
    const c = [x + Math.sin(a) * w * 0.38, base + Math.cos(a) * h * 0.78, z + Math.sin(b) * w * 0.16, w * (0.12 + 0.07 * R()) * (1 - 0.3 * Math.abs(Math.sin(a)))];
    t2.push(c); S.push(c); }
  const t3 = florets(R, S, t2, { n: [1, 2], size: [0.42, 0.55], out: 0.72, up: 0.7, axis: [x, z], minY: base, budget });
  florets(R, S, t3.filter((_, i) => i % 2 === 0), { n: [0, 1], size: [0.4, 0.5], out: 0.74, up: 0.8, axis: [x, z], minY: base, budget });
  return { spheres: S.slice(0, budget), base, h, scale: w * 0.22 };
}

// ---------------------------------------------------------------------------------------------------------------------
// the ray-traced cloud material + instanced boxes
// ---------------------------------------------------------------------------------------------------------------------
const VS = /* glsl */`
attribute vec4 aInfo; attribute float aScale; uniform vec2 uRes;
varying vec3 vW; flat varying vec4 vInfo; flat varying float vPxA, vScale;
void main(){
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vInfo = aInfo; vScale = aScale;
  vPxA = 2.0 / (projectionMatrix[1][1] * uRes.y);
  gl_Position = projectionMatrix * viewMatrix * w; }`;

const FS = (NOISE) => /* glsl */`
${NOISE}
uniform highp sampler2D uSph; uniform vec3 uCKey, uKeyCol, uSky;
uniform vec3 uLit, uMid, uShade, uDeep, uUnder, uRim; uniform float uTerm, uRimK, uAoK, uMacro;
uniform vec4 uHot; uniform vec3 uHotCol;
varying vec3 vW; flat varying vec4 vInfo; flat varying float vPxA, vScale;
vec3 gCN = vec3(0.0, 0.0, 1.0); vec3 gCVP = vec3(0.0, 0.0, -1.0);
void main(){
  vec3 ro = cameraPosition, rd = normalize(vW - ro);
  int row = int(vInfo.x + 0.5), n = int(vInfo.y + 0.5); float baseY = vInfo.z, Hc = max(vInfo.w, 1.0), sc = max(vScale, 1.0);
  float tB = 1e20, cov = 0.0, eB = 0.0, tE = 0.0; int iB = -1, iE = -1; bool fl = false; vec4 sB = vec4(0.0), sE = vec4(0.0);
  for (int i = 0; i < ${MAXS}; i++){ if (i >= n) break;
    vec4 s = texelFetch(uSph, ivec2(i, row), 0);
    vec3 oc = ro - s.xyz; float b = dot(oc, rd), c = dot(oc, oc) - s.w * s.w;
    float tc = -b; if (tc < 0.0 && c > 0.0) continue;
    float d = sqrt(max(dot(oc, oc) - b * b, 0.0));
    float cv = clamp((s.w - d) / max(tc * vPxA, 1e-3) + 0.5, 0.0, 1.0);
    float h = b * b - c;
    if (h < 0.0) { if (cv > eB && ro.y + rd.y * tc > baseY) { eB = cv; iE = i; sE = s; tE = tc; } continue; }
    float sq = sqrt(h), t0 = max(-b - sq, 0.0), t1 = -b + sq; bool f = false;
    if (ro.y + rd.y * t0 < baseY) { if (rd.y <= 0.0) continue; float tp = (baseY - ro.y) / rd.y; if (tp > t1) continue; t0 = tp; f = true;
      vec3 q = ro + rd * tp; float rc = sqrt(max(s.w * s.w - (baseY - s.y) * (baseY - s.y), 0.0)); cv = clamp((rc - length(q.xz - s.xz)) / max(tp * vPxA, 1e-3) + 0.5, 0.0, 1.0); }
    cov = max(cov, cv);
    if (t0 < tB) { tB = t0; iB = i; sB = s; fl = f; }
  }
  vec3 P, N; vec4 S;
  if (iB >= 0) { P = ro + rd * tB; S = sB; N = fl ? vec3(0.0, -1.0, 0.0) : (P - S.xyz) / S.w; }
  else { if (eB < 0.03) discard; P = ro + rd * tE; S = sE; N = normalize(P - S.xyz); cov = eB; fl = false; }
  vec3 L = normalize(uCKey);
  // brush noise at the scale of the whole cloud (large painted planes) + a fine stroke only along the terminator
  float bL = fbm3(P / (sc * 1.15) + vInfo.x * 3.7) - 0.5, bS = n3(P / (sc * 0.2) + 5.0) - 0.5;
  // normals: tight soft union (the lobes) + broad union over the masses (the planes); self-shadow from the big masses only
  vec3 P0 = P + N * S.w * 0.015, nT = vec3(0.0), nM = vec3(0.0); float sh = 0.0, ao = 0.0;
  for (int i = 0; i < ${MAXS}; i++){ if (i >= n) break;
    vec4 s = texelFetch(uSph, ivec2(i, row), 0);
    vec3 v = s.xyz - P0; float d2 = dot(v, v), dv = sqrt(d2), r2 = s.w * s.w, gap = max(dv - s.w, 0.0); vec3 u = v / max(dv, 1e-3);
    nT -= exp(-gap / s.w * 7.0) * s.w * u;
    nM -= exp(-gap / (sc * 0.6)) * r2 * u;
    if (d2 <= r2) continue;
    if (s.w > sc * 0.42) { float b = dot(v, L); if (b > 0.0) sh = max(sh, smoothstep(-0.15, 0.15, (b * b - (d2 - r2)) / r2 + bL * 0.6)); }
    ao += max(dot(N, v), 0.0) * inversesqrt(d2) * r2 / d2;
  }
  vec3 Nt = fl ? vec3(0.0, -1.0, 0.0) : normalize(mix(N, normalize(nT), 0.7));
  vec3 Nm = fl ? vec3(0.0, -1.0, 0.0) : normalize(nM);
  vec3 Ns = normalize(mix(Nt, Nm, uMacro));
  float yk = (P.y - baseY) / Hc;
  // toward the base the terminator climbs the lobes (no straight ledge): the lower body sinks into the underside tone
  float low = 1.0 - smoothstep(0.0, 0.22, yk);
  float nl = dot(Ns, L) + bL * 0.16 + bS * 0.025 - low * low * mix(0.2, 0.75, smoothstep(900.0, 3500.0, Hc));   // (small puffs keep lit sides)
  float aa = fwidth(nl) * 0.8 + 0.003;
  float lit = smoothstep(uTerm - aa, uTerm + aa, nl) * (1.0 - sh) * (fl ? 0.0 : 1.0);
  float hi = smoothstep(uTerm + 0.36 - aa, uTerm + 0.36 + aa, nl + bL * 0.1) * lit;
  float crev = smoothstep(0.8, 0.95, ao * uAoK + bL * 0.25);
  vec3 shade = mix(uShade, uDeep, clamp(smoothstep(-0.2, -0.75, dot(Nm, L)) * 0.45 + crev * 0.3, 0.0, 1.0));
  shade = mix(shade, uUnder, clamp(max(low * low, smoothstep(-0.1, -0.75, Ns.y)) * 0.85, 0.0, 1.0)) * uSky;
  vec3 litC = mix(uMid, uLit, hi) * uKeyCol; litC = mix(litC, mix(uMid, uShade, 0.3) * uKeyCol, crev * 0.35);
  vec3 col = mix(shade, litC, lit);
  float fr = 1.0 - abs(dot(Ns, rd)), back = smoothstep(-0.3, 0.7, dot(rd, L));
  float rw = 0.8 - 0.1 * clamp(uRimK - 1.0, 0.0, 1.0);   // a strong rim (backlit dusk) is also a wider silver lining
  col += uRim * uKeyCol * smoothstep(rw, 0.9, fr + bS * 0.06) * (0.25 + 0.75 * back) * uRimK * (fl ? 0.0 : 1.0) * (1.0 - low) * (0.4 + 0.6 * smoothstep(-0.2, 0.3, dot(Ns, L)));
  if (uHot.w > 0.0) { vec3 hv = uHot.xyz - P; float hd = length(hv); float hk = max(dot(Ns, hv / hd), 0.0) * clamp(1.0 - hd / uHot.w, 0.0, 1.0);
    col = mix(col, uHotCol * (0.6 + 1.2 * hk), smoothstep(0.03, 0.12, hk + bL * 0.05) * min(1.0, hk * 3.0 + 0.3)); }
  col *= 1.0 + bL * 0.05;
  gl_FragColor = vec4(col, cov);
  vec4 vp = viewMatrix * vec4(P, 1.0); gCVP = vp.xyz; gCN = normalize(mat3(viewMatrix) * Ns);
  #ifdef USE_LOGDEPTHBUF
    gl_FragDepth = log2(1.0 + max(-vp.z, 1e-3)) * logDepthBufFC * 0.5;
  #endif
}`;

// lit = white face, mid = lit faces turning away, shade = lavender shadow side, deep = far side of the mass, under = base
export const CLOUD_DAY = { lit: 0xffffff, mid: 0xf1f0fa, shade: 0xc5c6ee, deep: 0xa9a8de, under: 0xa8acdc, rim: 0xffffff, term: -0.08, rimK: 0.7, aoK: 1.0, macro: 0.4 };
export const CLOUD_DUSK = { lit: 0xffdcae, mid: 0xffb49a, shade: 0x9a86d4, deep: 0x6e5cb4, under: 0x8a6cb8, rim: 0xffe6a8, term: -0.12, rimK: 1.3, aoK: 1.0, macro: 0.4 };

export function createCloudSystem(ctx, clouds, { name = 'clouds', palette = CLOUD_DAY } = {}) {
  const { glsl, light } = ctx, rows = clouds.length;
  const data = new Float32Array(MAXS * rows * 4);
  const tex = new THREE.DataTexture(data, MAXS, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const info = new Float32Array(rows * 4), scl = new Float32Array(rows);
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4)); geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scl, 1));
  const C = (h) => new THREE.Color(h);
  const u = { uSph: { value: tex }, uRes: glsl.U.uRes, uCKey: { value: new V3(0.3, 0.62, 0.72).normalize() }, uKeyCol: light.u.uKeyCol, uSky: light.u.uSky,
    uLit: { value: C(palette.lit) }, uMid: { value: C(palette.mid) }, uShade: { value: C(palette.shade) }, uDeep: { value: C(palette.deep) }, uUnder: { value: C(palette.under) },
    uRim: { value: C(palette.rim) }, uTerm: { value: palette.term }, uRimK: { value: palette.rimK }, uAoK: { value: palette.aoK }, uMacro: { value: palette.macro ?? 0.55 },
    uHot: { value: new THREE.Vector4(0, 0, 0, 0) }, uHotCol: { value: C(0xff8a3a) } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS(glsl.NOISE), side: THREE.BackSide, alphaToCoverage: true });
  mat.extensions = { derivatives: true };
  // data depth = the lobe hit (the normal expression is spliced into the MRT writer: it also rebinds the view position)
  glsl.mrt(mat, { id: 0, normal: 'gCN; vMrtVP = gCVP' });
  const mesh = new THREE.InstancedMesh(geo, mat, rows); mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = -6; mesh.raycast = () => {};
  mesh.userData.noShadow = true;
  const m4 = new THREE.Matrix4(), base = clouds.map(c => c.spheres.map(s => s.slice()));
  function write(offsetFn = null) {
    clouds.forEach((c, row) => {
      const bb = new THREE.Box3(), sp = c.spheres, n = Math.min(sp.length, MAXS);
      for (let i = 0; i < n; i++) { let [x, y, z, r] = base[row][i]; if (offsetFn) { const o = offsetFn(row, x, y, z, r); if (o) { x += o[0]; y += o[1]; z += o[2]; } }
        data.set([x, y, z, r], (row * MAXS + i) * 4); bb.expandByPoint(new V3(x - r, Math.max(y - r, c.base), z - r)); bb.expandByPoint(new V3(x + r, y + r, z + r)); }
      const ctr = bb.getCenter(new V3()), sz = bb.getSize(new V3()).multiplyScalar(1.02).addScalar(2);
      m4.compose(ctr, new THREE.Quaternion(), sz); mesh.setMatrixAt(row, m4);
      info.set([row, n, c.base, c.h ?? (bb.max.y - c.base)], row * 4); scl[row] = c.scale ?? (bb.max.x - bb.min.x) * 0.25;
      c.box = bb; });
    tex.needsUpdate = true; mesh.instanceMatrix.needsUpdate = true; geo.attributes.aInfo.needsUpdate = true; geo.attributes.aScale.needsUpdate = true;
  }
  write();
  return {
    mesh, clouds, material: mat,
    palette(p) { for (const k of ['lit', 'mid', 'shade', 'deep', 'under', 'rim']) u['u' + k[0].toUpperCase() + k.slice(1)].value.copy(p[k] instanceof THREE.Color ? p[k] : C(p[k]));
      u.uTerm.value = p.term; u.uRimK.value = p.rimK; u.uAoK.value = p.aoK ?? 1; u.uMacro.value = p.macro ?? 0.55; },
    // the cloud key light (a painted key: the sky may aim it per shot so the towers always show a lit white mass)
    setKey(dir) { u.uCKey.value.set(dir[0] ?? dir.x, dir[1] ?? dir.y, dir[2] ?? dir.z).normalize(); },
    setHot(pos = null, color = 0xff8a3a, radius = 0) { if (!pos || !(radius > 0)) { u.uHot.value.set(0, 0, 0, 0); return; } u.uHot.value.set(pos[0] ?? pos.x, pos[1] ?? pos.y, pos[2] ?? pos.z, radius); u.uHotCol.value.copy(C(color)); },
    // re-place lobes: fn(row, x, y, z, r) -> [dx, dy, dz] | null  (null fn = rest pose)
    setOffsets(fn) { write(fn); },
  };
}

// lerp two palettes (k = 0 day, 1 dusk)
export function lerpPalette(a, b, k) {
  const C = (h) => new THREE.Color(h), out = {};
  for (const key of ['lit', 'mid', 'shade', 'deep', 'under', 'rim']) out[key] = C(a[key]).lerp(C(b[key]), k);
  for (const key of ['term', 'rimK', 'aoK', 'macro']) out[key] = (a[key] ?? 0.55) + ((b[key] ?? 0.55) - (a[key] ?? 0.55)) * k;
  return out;
}
