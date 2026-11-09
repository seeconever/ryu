// RYŪ · painted-set kit (owner: engine). Ported from anime-lab/kit/anime.js + films/27-ame (MRT-aware).
//   paintedSky(o)     sky dome: gradient stops by elevation, brush streaks, sun glow, optional cel cloud bands (sky depth, id 0)
//   cloudCard(o)      2.5D matte-painted cumulus card (Y-billboard), cel-lit puffs, silver rim, lavender underside;
//                     alpha-to-coverage (writes depth -> hazed, depth-aware paint, occludes cel objects properly)
//   cloudBank(o)      ring of cloud cards; cloudFloor(o) painted top view sea of clouds
//   starField(o)      twinkling stars (cut the paint mask)
//   glowSource(o)     HDR core (FX id) + additive halo/glow sprites + cel spill point in LIGHT
//   lightShaft(o)     volumetric additive cone (god ray / beam)
//   canvasTex, glowTexture, labelSprite (debug labels), createEndCard (Fable 5.5 brush card + 寓話 hanko + title)
import * as THREE from 'three';
import { NOISE, ID, mrt } from './pipeline-glsl.js';
import { LIGHT, keepMask } from './pipeline-materials.js';
import { rng } from './pipeline-util.js';

const V3 = THREE.Vector3, C = (c) => (c instanceof THREE.Color ? c.clone() : new THREE.Color(c));

export function canvasTex(w, h, draw, { srgb = true, repeat = false, mips = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; if (!mips) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  t.userData.canvas = c; return t;
}
let _GLOW = null;
export function glowTexture() { return _GLOW ||= canvasTex(256, 256, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,255,255,0.6)'); g.addColorStop(0.35, 'rgba(255,255,255,0.16)'); g.addColorStop(0.7, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h); }, { srgb: false }); }
const addBlend = (m) => { m.transparent = true; m.depthWrite = false; m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; return m; };
const cutBlend = (m) => { m.transparent = true; m.depthWrite = false; m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; return m; };
export { addBlend, cutBlend };

// debug label (live preview only: shown when ?labels=1); a sprite that keeps a constant screen size
export function labelSprite(text, { color = '#ffffff', bg = 'rgba(30,30,40,0.7)', px = 22 } = {}) {
  const tex = canvasTex(512, 64, (c, w, h) => { c.font = `600 ${px * 1.6}px system-ui, sans-serif`; const tw = Math.min(w - 8, c.measureText(text).width + 24);
    c.fillStyle = bg; c.fillRect((w - tw) / 2, 6, tw, h - 12); c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2); }, { mips: false });
  const m = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false });
  const s = new THREE.Sprite(m); s.scale.set(0.16, 0.02, 1); s.renderOrder = 999; s.userData.label = true; return s;
}

// ---------------------------------------------------------------------------------------------------------------------
export function paintedSky({ stops = [[-0.1, 0xbcd4f0], [0.0, 0xd8ecff], [0.08, 0x9cc8f8], [0.3, 0x4c94ea], [0.7, 0x1e62d0], [1.0, 0x1650bc]], radius = 50000,
  clouds = null, sunGlow = { dir: [0.35, 0.75, 0.55], color: 0xfff2d8, k: 0.6, w: 0.35 }, brush = 0.03 } = {}) {
  const st = stops.slice(0, 6); while (st.length < 6) st.push(st[st.length - 1]);
  const cl = { lit: 0xffffff, mid: 0xdfe4fa, shade: 0xa8acdc, e0: 0.02, e1: 0.25, cover: 0.45, scale: 1.2, stretch: 3, seed: 1, rim: 0xfffaf0, rimK: 0, ...(clouds || {}) };
  const sg = { dir: [0, 0.05, -1], color: 0xffb070, k: 0, w: 0.35, ...(sunGlow || {}) };
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uE: { value: st.map(s => s[0]) }, uC: { value: st.map(s => C(s[1])) }, uCLit: { value: C(cl.lit) }, uCMid: { value: C(cl.mid) }, uCSh: { value: C(cl.shade) },
      uCRim: { value: C(cl.rim).multiplyScalar(cl.rimK) }, uCl: { value: new THREE.Vector4(cl.e0, cl.e1, cl.cover, cl.scale) }, uStretch: { value: cl.stretch }, uSeed: { value: cl.seed },
      uClOn: { value: clouds ? 1 : 0 }, uSunDir: { value: new V3().fromArray(sg.dir).normalize() }, uSunCol: { value: C(sg.color).multiplyScalar(sg.k) }, uSunW: { value: sg.w }, uBrush: { value: brush } },
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */`${NOISE}
      uniform float uE[6]; uniform vec3 uC[6]; uniform vec3 uCLit, uCMid, uCSh, uCRim, uSunCol, uSunDir; uniform vec4 uCl;
      uniform float uStretch, uSeed, uClOn, uSunW, uBrush; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float e = d.y; float az = atan(d.x, -d.z);
        float bs = (n2(vec2(az * 3.0, e * 90.0)) - 0.5) * 0.6 + (n2(vec2(az * 11.0, e * 260.0)) - 0.5) * 0.4;
        float ee = e + bs * uBrush * 0.25; vec3 col = uC[0];
        for (int i = 1; i < 6; i++) col = mix(col, uC[i], smoothstep(uE[i - 1], uE[i], ee));
        col *= 1.0 + bs * uBrush;
        float sd = max(dot(d, uSunDir), 0.0); col += uSunCol * (pow(sd, 8.0 / uSunW) * 0.6 + pow(sd, 64.0) * 0.6);
        if (uClOn > 0.5) {
          vec2 cp = vec2(az * 6.0 * uCl.w, (1.0 / max(e + 0.06, 0.02)) * 0.9 * uCl.w); cp.y *= uStretch; cp += uSeed * 13.1;
          float band = smoothstep(uCl.x - 0.03, uCl.x + 0.03, e) * (1.0 - smoothstep(uCl.y - 0.08, uCl.y, e));
          float c = fbm2(cp * vec2(1.0, 0.35)) + 0.25 * fbm2(cp * vec2(3.0, 1.2) + 4.0);
          float cov = c * band; float thr = 1.0 - uCl.z;
          float m0 = smoothstep(thr - 0.012, thr + 0.012, cov);
          float c2 = fbm2((cp - vec2(0.0, 0.35)) * vec2(1.0, 0.35)) + 0.25 * fbm2((cp - vec2(0.0, 0.35)) * vec2(3.0, 1.2) + 4.0);
          float lit = smoothstep(-0.01, 0.02, (c - c2) + (e - uCl.x) * 0.2);
          float top = smoothstep(thr + 0.06, thr + 0.09, cov);
          vec3 cc = mix(uCSh, uCMid, lit); cc = mix(cc, uCLit, lit * top);
          cc += uCRim * (m0 - smoothstep(thr, thr + 0.03, cov));
          col = mix(col, cc, m0);
        }
        gl_FragColor = vec4(col, 1.0); }` });
  mrt(mat, { id: ID.BG, sky: true });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), mat); m.frustumCulled = false; m.renderOrder = -10; m.raycast = () => {};
  m.onBeforeRender = (r, s, cam) => { m.position.copy(cam.position); m.updateMatrixWorld(); };
  m.userData.noShadow = true;
  return m;
}

export function starField({ count = 1400, radius = 40000, seed = 7, minE = 0.03, size = [1.0, 3.2], bright = 1.4, mask = 0.2 } = {}) {
  const R = rng(seed), pos = [], sz = [], col = [], ph = [];
  for (let i = 0; i < count; i++) { const e = minE + (1 - minE) * Math.pow(R(), 0.8), a = R() * Math.PI * 2, c = Math.sqrt(1 - e * e);
    pos.push(Math.sin(a) * c * radius, e * radius, -Math.cos(a) * c * radius); const big = R() < 0.03;
    sz.push(big ? size[1] * (1.4 + R()) : size[0] + (size[1] - size[0]) * Math.pow(R(), 3)); const w = R(); col.push(0.85 + 0.15 * w, 0.85 + 0.1 * R(), 0.9 + 0.1 * (1 - w)); ph.push(R() * 6.28); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(sz, 1));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
  const mat = cutBlend(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uB: { value: bright }, uMask: { value: mask }, uPx: { value: 1 } },
    vertexShader: /* glsl */`attribute float aSize, aPh; attribute vec3 aCol; uniform float uTime, uPx; varying vec3 vC; varying float vS;
      void main(){ vC = aCol * (0.75 + 0.25 * sin(uTime * (1.5 + fract(aPh * 3.1) * 2.0) + aPh)); vS = aSize;
        vec4 w = modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w * 0.99998; gl_PointSize = aSize * 3.0 * uPx; }`,
    fragmentShader: /* glsl */`uniform float uB, uMask; varying vec3 vC; varying float vS;
      void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 3.0; float a = exp(-r * r * 3.0);
        if (vS > 3.5) a += 0.5 * exp(-abs(q.x) * 40.0) * exp(-abs(q.y) * 5.0) + 0.5 * exp(-abs(q.y) * 40.0) * exp(-abs(q.x) * 5.0);
        gl_FragColor = vec4(vC * uB * (1.0 + a), clamp(a, 0.0, 1.0) * (1.0 - uMask)); }` }));
  mrt(mat, { id: ID.FX });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.renderOrder = -9;
  p.onBeforeRender = (r, s, cam) => { p.position.copy(cam.position); p.updateMatrixWorld(); mat.uniforms.uTime.value = s.userData.time || 0; mat.uniforms.uPx.value = r.getRenderTarget()?.height / 1080 || 1; };
  return p;
}

// ---- 2.5D painted cloud cards ----
const CARD_N = 28;
function cumulusPuffs(R, aspect, { tall = 0.7, flat = 0.22 } = {}) {
  const P = []; const nb = 5 + Math.floor(R() * 4);
  for (let i = 0; i < nb; i++) { const x = aspect * (0.12 + 0.76 * (i + 0.5) / nb + (R() - 0.5) * 0.08); P.push([x, flat + 0.04 + R() * 0.05, (0.11 + R() * 0.07) * Math.min(aspect, 2.2)]); }
  const nm = 4 + Math.floor(R() * 5);
  for (let i = 0; i < nm; i++) { const x = aspect * (0.25 + 0.5 * R()); P.push([x, flat + 0.18 + tall * 0.28 * R(), (0.12 + R() * 0.1) * Math.min(aspect, 2.2)]); }
  const nt = 2 + Math.floor(R() * 5 * tall);
  for (let i = 0; i < nt; i++) { const x = aspect * (0.33 + 0.34 * R()); P.push([x, flat + 0.38 + tall * 0.4 * R(), (0.06 + R() * 0.07) * Math.min(aspect, 2.2)]); }
  return P.slice(0, CARD_N);
}
// High-key cumulus: white lit tops, lavender shade sides, cool underside. light = world direction toward the sun.
export function cloudCard({ w = 200, h = 100, seed = 1, lit = 0xffffff, mid = 0xe4e6fa, shade = 0xa9acdc, under = 0x8f94cc, rim = 0xffffff, rimK = 0.5,
  tall = 0.7, flat = 0.22, wisp = 1.0, erode = 1.0, light = null } = {}) {
  const R = rng(seed), aspect = w / h, P = cumulusPuffs(R, aspect, { tall, flat }); while (P.length < CARD_N) P.push([0, 0, 0]);
  const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, alphaToCoverage: true,
    uniforms: { uP: { value: P.map(p => new V3(...p)) }, uN: { value: P.filter(p => p[2] > 0).length }, uAsp: { value: aspect }, uL: { value: new V3(0, 1, 0.3) },
      uLit: { value: C(lit) }, uMid: { value: C(mid) }, uSh: { value: C(shade) }, uUnder: { value: C(under) }, uRim: { value: C(rim).multiplyScalar(rimK) }, uFlat: { value: flat },
      uWisp: { value: wisp }, uErode: { value: erode }, uSeed: { value: seed * 7.13 % 50 }, uKeyCol: LIGHT.u.uKeyCol, uSky: LIGHT.u.uSky },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`${NOISE}
      uniform vec3 uP[${CARD_N}]; uniform int uN; uniform float uAsp, uFlat, uWisp, uErode, uSeed; uniform vec3 uL, uLit, uMid, uSh, uUnder, uRim, uKeyCol, uSky; varying vec2 vUv;
      void main(){ vec2 p = vec2(vUv.x * uAsp, vUv.y);
        float s = 0.0, best = -9.0; vec3 bc = vec3(0.5, 0.5, 1.0);
        for (int i = 0; i < ${CARD_N}; i++){ if (i >= uN) break; vec3 c = uP[i]; float k = 1.0 - length(p - c.xy) / c.z; s += exp(k * 10.0); if (k > best) { best = k; bc = c; } }
        float d = log(max(s, 1e-6)) / 10.0;
        float er = ((fbm2(p * vec2(7.0, 6.0) + uSeed) - 0.5) * 0.22 + (n2(p * 38.0 + uSeed) - 0.5) * 0.07) * uErode;
        float wisp = (fbm2(vec2(p.x * 5.0, p.y * 26.0) + uSeed) - 0.5) * 0.10 * uWisp;
        float base = smoothstep(uFlat - 0.05, uFlat + 0.07, p.y + wisp);
        float D = d + er; float cov = smoothstep(0.0, 0.035, D) * mix(0.25, 1.0, base);
        cov *= smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) * smoothstep(1.0, 0.97, vUv.y);
        if (cov < 0.05) discard;
        vec2 q = (p - bc.xy) / bc.z; float l2 = dot(q, q); vec3 n = normalize(vec3(q, sqrt(max(1.0 - l2, 0.0)) + 0.15));
        float br = (fbm2(p * 9.0 + uSeed * 2.0) - 0.5) * 0.35;
        float nl = dot(n, normalize(uL)) + br;
        vec3 col = mix(uSh * uSky, uMid * mix(uSky, uKeyCol, 0.6), smoothstep(-0.12, -0.04, nl)); col = mix(col, uLit * uKeyCol, smoothstep(0.32, 0.4, nl));
        float edge = 1.0 - smoothstep(0.0, 0.09, D); col += uRim * uKeyCol * edge * smoothstep(0.0, 0.3, dot(n.xy, normalize(uL.xy + 1e-4)));
        col = mix(col, uUnder * uSky, (1.0 - smoothstep(uFlat - 0.02, uFlat + 0.22, p.y)) * 0.75);
        col *= 1.0 + (fbm2(p * 3.0 + uSeed * 3.0) - 0.5) * 0.12;
        gl_FragColor = vec4(col, cov); }` });
  mrt(mat, { id: ID.BG });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2 - h * flat * 0.6, 0), mat); m.renderOrder = -5; m.raycast = () => {};
  const qi = new THREE.Quaternion();
  m.onBeforeRender = (r, sc, cam) => { m.rotation.set(0, Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z), 0); m.updateMatrixWorld();
    qi.copy(m.quaternion).invert(); mat.uniforms.uL.value.copy(light || LIGHT.u.uKeyDir.value).applyQuaternion(qi); };
  return m;
}
// a field of cards (sizes grow with distance so the horizon stays dense)
export function cloudBank({ center = new V3(), y = 1500, rMin = 2000, rMax = 30000, count = 60, seed = 3, size = [600, 3000], light = null, avoid = [], ...cardOpts } = {}) {
  const R = rng(seed), g = new THREE.Group(); g.name = 'cloudBank';
  for (let i = 0; i < count; i++) { const a = R() * Math.PI * 2, r = rMin + (rMax - rMin) * Math.pow(R(), 0.8), x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const k = r / rMax, w = size[0] + (size[1] - size[0]) * (0.3 + 0.7 * k) * (0.6 + 0.8 * R()), h = w * (0.35 + 0.25 * R());
    const c = cloudCard({ w, h, seed: seed * 100 + i, tall: 0.3 + 0.9 * R(), light, ...cardOpts }); c.position.set(x, y, z); g.add(c); }
  return g;
}
export function cloudFloor({ y = 0, size = 60000, scale = 0.0012, lit = 0xffffff, mid = 0xdfe2f8, shade = 0xa0a4d8, light = new V3(0.3, 1, 0.4), seed = 2 } = {}) {
  const mat = new THREE.ShaderMaterial({ uniforms: { uS: { value: scale }, uLit: { value: C(lit) }, uMid: { value: C(mid) }, uSh: { value: C(shade) }, uL: { value: light.clone().normalize() },
    uSeed: { value: seed }, uKeyCol: LIGHT.u.uKeyCol, uSky: LIGHT.u.uSky },
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`${NOISE} uniform float uS, uSeed; uniform vec3 uLit, uMid, uSh, uL, uKeyCol, uSky; varying vec3 vW;
      float H(vec2 p){ return fbm2(p) + 0.5 * fbm2(p * 2.7 + 5.0); }
      void main(){ vec2 p = vW.xz * uS + uSeed; float e = 0.04; float h = H(p), hx = H(p + vec2(e, 0.0)), hz = H(p + vec2(0.0, e));
        vec3 n = normalize(vec3(-(hx - h) / e, 0.35, -(hz - h) / e)); float nl = dot(n, uL) + (n2(p * 30.0) - 0.5) * 0.15;
        vec3 col = mix(uSh * uSky, uMid, smoothstep(0.05, 0.12, nl)); col = mix(col, uLit * uKeyCol, smoothstep(0.45, 0.52, nl) * smoothstep(0.55, 0.75, h));
        col *= 0.88 + 0.24 * smoothstep(0.3, 0.8, h);
        gl_FragColor = vec4(col, 1.0); }` });
  mrt(mat, { id: ID.BG, normal: 'vec3(0.0, 0.0, 1.0)' });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat); m.position.y = y; return m;
}

// practical glow: HDR core (FX id, no ink) + additive halo + glow sprites + cel spill point
export function glowSource({ color = 0xffb066, intensity = 1, core = 0.12, coreK = 6, halo = 0.9, haloK = 0.5, glow = 3.2, glowK = 0.18, spill = 1.6, range = 8, coreGeo = null } = {}) {
  const col = C(color), g = new THREE.Group(); g.name = 'glowSource';
  const coreMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(coreK) });
  coreMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = 0.0;'); };
  coreMat.customProgramCacheKey = () => 'glowCore'; mrt(coreMat, { id: ID.FX });
  const coreMesh = new THREE.Mesh(coreGeo || new THREE.SphereGeometry(core, 20, 14), coreMat); g.add(coreMesh);
  const sp = (k, s) => { const m = addBlend(new THREE.SpriteMaterial({ map: glowTexture(), color: col.clone().multiplyScalar(k), depthTest: true })); const o = new THREE.Sprite(m); o.scale.setScalar(s); g.add(o); return o; };
  const haloS = sp(haloK, halo), glowS = sp(glowK, glow);
  const point = LIGHT.addPoint({ pos: g, color: col, intensity: spill, range });
  const base = { coreK, haloK, glowK, spill };
  g.userData = { core: coreMesh, halo: haloS, glowSprite: glowS, point, color: col };
  g.set = (k) => { coreMat.color.copy(col).multiplyScalar(base.coreK * k); haloS.material.color.copy(col).multiplyScalar(base.haloK * k);
    glowS.material.color.copy(col).multiplyScalar(base.glowK * k); point.intensity = base.spill * k; coreMesh.visible = haloS.visible = glowS.visible = k > 0.001; return g; };
  g.update = (camera, nudge = 0.15) => { const wp = g.getWorldPosition(new V3()), d = camera.position.clone().sub(wp).normalize().multiplyScalar(nudge);
    const inv = g.parent ? g.parent.getWorldQuaternion(new THREE.Quaternion()).invert() : new THREE.Quaternion(); d.applyQuaternion(inv);
    haloS.position.copy(d); glowS.position.copy(d).multiplyScalar(2); };
  g.set(intensity); return g;
}

// Volumetric shaft: open cone from `from` (radius r0) to `to` (radius r1). Additive, soft view-dependent edges, drifting streaks.
export function lightShaft({ from = new V3(), to = new V3(0, 0, -10), r0 = 0.1, r1 = 2, color = 0xffd9a0, intensity = 0.6, fall = 1.4, edge = 1.6, streak = 0.5, segs = 48 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, segs, 32, true); geo.translate(0, 0.5, 0); geo.rotateX(-Math.PI / 2);
  const mat = addBlend(new THREE.ShaderMaterial({ side: THREE.DoubleSide,
    uniforms: { uCol: { value: C(color) }, uI: { value: intensity }, uFall: { value: fall }, uEdge: { value: edge }, uStreak: { value: streak }, uTime: { value: 0 }, uR0: { value: r0 }, uR1: { value: r1 }, uLen: { value: 1 } },
    vertexShader: /* glsl */`uniform float uR0, uR1, uLen; varying float vV, vA; varying vec3 vW, vNw;
      void main(){ float v = -position.z; vV = v; vA = atan(position.y, position.x);
        float r = mix(uR0, uR1, v); vec3 p = vec3(position.xy * r, -v * uLen);
        vec3 n = normalize(vec3(position.xy, (uR1 - uR0) / uLen));
        vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; vNw = normalize(mat3(modelMatrix) * n); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`${NOISE} uniform vec3 uCol; uniform float uI, uFall, uEdge, uStreak, uTime; varying float vV, vA; varying vec3 vW, vNw;
      void main(){ vec3 V = normalize(cameraPosition - vW); float e = pow(clamp(abs(dot(normalize(vNw), V)), 0.0, 1.0), uEdge);
        float v = clamp(vV, 0.0, 1.0);
        float s = 1.0 - uStreak + uStreak * (0.55 * n2(vec2(vA * 7.0, v * 3.0 - uTime * 0.25)) + 0.45 * n2(vec2(vA * 19.0, v * 9.0 + uTime * 0.1)));
        float f = pow(1.0 - v, uFall) * smoothstep(0.0, 0.04, v);
        float near = smoothstep(0.5, 3.0, length(cameraPosition - vW));
        gl_FragColor = vec4(uCol * uI * e * s * f * near, 1.0); }` }));
  mrt(mat, { id: ID.FX });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 5; m.raycast = () => {};
  m.aim = (a, b, ra = r0, rb = r1) => { m.position.copy(a); const L = a.distanceTo(b); mat.uniforms.uLen.value = L; mat.uniforms.uR0.value = ra; mat.uniforms.uR1.value = rb;
    m.lookAt(b); m.rotateY(Math.PI); m.updateMatrixWorld(); return m; };
  m.aim(from, to); return m;
}

// =====================================================================================================================
// END CARD — "Fable 5.5" broad-nib brush lettering drawn stroke by stroke + red hanko 寓話 + title EN / JP (from the kit)
// =====================================================================================================================
const FABLE_STROKES = [
  { p: [[118, 60], [113, 110], [104, 175], [94, 252]], w: 1.0 }, { p: [[66, 66], [110, 58], [160, 52], [214, 40]], w: 0.85 }, { p: [[92, 150], [124, 147], [166, 141]], w: 0.75 },
  { p: [[302, 166], [284, 145], [250, 146], [224, 178], [221, 222], [240, 250], [270, 240], [296, 200]], w: 0.85 }, { p: [[306, 146], [300, 196], [301, 236], [322, 252]], w: 0.9 },
  { p: [[376, 40], [368, 120], [360, 196], [355, 250]], w: 1.0 }, { p: [[361, 196], [388, 156], [424, 158], [432, 202], [413, 240], [377, 252], [357, 242]], w: 0.85 },
  { p: [[484, 38], [476, 128], [469, 206], [478, 244], [500, 250]], w: 0.95 },
  { p: [[528, 204], [566, 198], [592, 178], [582, 151], [550, 148], [522, 176], [516, 220], [534, 248], [570, 252], [602, 232]], w: 0.85 },
  { p: [[726, 60], [760, 57], [806, 52]], w: 0.8 }, { p: [[727, 62], [721, 102], [714, 142], [742, 131], [781, 137], [806, 170], [800, 220], [768, 250], [727, 251], [700, 233]], w: 1.0 },
  { p: [[842, 238], [849, 246]], w: 1.5, dot: true },
  { p: [[896, 60], [930, 57], [976, 52]], w: 0.8 }, { p: [[897, 62], [891, 102], [884, 142], [912, 131], [951, 137], [976, 170], [970, 220], [938, 250], [897, 251], [870, 233]], w: 1.0 },
];
function catmull(pts, step = 1.2) {
  const out = []; const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) { const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]; const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.ceil(L / step));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); } }
  out.push(pts[pts.length - 1].slice()); return out;
}
export function brushLettering({ strokes = FABLE_STROKES, x0 = 0, y0 = 0, scale = 1, shear = 0.16, width = 26, nibA = -0.62, ink = [26, 18, 14], dur = 2.6, gap = 0.07, seed = 5 } = {}) {
  const R = rng(seed), S = strokes.map(s => { const pts = catmull(s.p.map(([x, y]) => [x0 + (x + (250 - y) * shear) * scale, y0 + y * scale]), 1.0);
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return { ...s, pts, L, seedB: Array.from({ length: 22 }, () => R()) }; });
  const tot = S.reduce((a, s) => a + Math.pow(s.L + 40, 0.75), 0), avail = dur - gap * (S.length - 1); let t = 0;
  for (const s of S) { s.t0 = t; s.d = avail * Math.pow(s.L + 40, 0.75) / tot; t += s.d + gap; }
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const ss = THREE.MathUtils.smoothstep;
  function drawStroke(c, s, f) {
    const n = s.pts.length, upto = Math.floor(n * Math.min(1, f)), NB = 18, W = width * scale * s.w;
    if (s.dot) { if (f <= 0) return; const [x, y] = s.pts[0], r = W * 0.75 * Math.min(1, f * 2); c.fillStyle = `rgba(${ink},0.92)`; c.beginPath(); c.ellipse(x + 2, y, r * 1.1, r * 0.95, -0.5, 0, Math.PI * 2); c.fill(); return; }
    for (let b = 0; b < NB; b++) { const o = b / (NB - 1) - 0.5, sb = s.seedB[b % 22]; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = W / NB * 2.1 * (0.7 + 0.6 * sb);
      let prev = null;
      for (let i = 1; i < upto; i++) { const u = i / (n - 1), p = s.pts[i], q = s.pts[i - 1];
        const press = ss(u, 0, 0.07) * (1 - 0.72 * ss(u, 0.62, 1.0)) * (0.92 + 0.08 * Math.sin(u * 9 + sb * 6)) + 0.12 * (1 - ss(u, 0, 0.12));
        const dx = p[0] - q[0], dy = p[1] - q[1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
        const nib = 0.3 + 0.85 * Math.abs(Math.sin(Math.atan2(dy, dx) - nibA)), w = W * press * nib;
        const dry = 0.08 + 0.55 * ss(u, 0.7, 1.0) * (0.4 + Math.abs(o) * 1.6) + 0.3 * Math.abs(o) * Math.abs(o);
        const gapOn = hash(b + sb * 10, Math.floor(i / (5 + sb * 6))) < dry, a = 0.9 - 0.2 * u, pt = [p[0] + nx * o * w, p[1] + ny * o * w];
        if (!gapOn && prev) { c.strokeStyle = `rgba(${ink},${a.toFixed(3)})`; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(pt[0], pt[1]); c.stroke(); }
        prev = pt; } }
  }
  return { strokes: S, duration: t - gap, draw(c, time) { for (const s of S) { if (time <= s.t0) break; drawStroke(c, s, (time - s.t0) / s.d); } } };
}
export function drawHanko(c, { x, y, size = 96, text = '寓話', color = '#c1272d', alpha = 1, rot = -0.04, seed = 9, font = '"Yu Mincho", "MS Mincho", "Noto Serif JP", serif' } = {}) {
  const R = rng(seed), s = size, off = document.createElement('canvas'); off.width = off.height = Math.ceil(s * 1.3); const o = off.getContext('2d'), m = s * 0.15;
  o.fillStyle = color; o.beginPath(); const N = 40; for (let i = 0; i <= N * 4; i++) { const k = i / N, side = Math.floor(k) % 4, f = k - Math.floor(k), j = (R() - 0.5) * s * 0.025;
    const pts = [[m + f * s, m + j], [m + s + j, m + f * s], [m + s - f * s, m + s + j], [m + j, m + s - f * s]][side]; if (i === 0) o.moveTo(...pts); else o.lineTo(...pts); } o.closePath(); o.fill();
  o.globalCompositeOperation = 'destination-out'; o.lineWidth = s * 0.035; o.strokeStyle = '#000'; o.strokeRect(m + s * 0.08, m + s * 0.08, s * 0.84, s * 0.84);
  o.font = `700 ${s * 0.38}px ${font}`; o.textAlign = 'center'; o.textBaseline = 'middle'; [...text].forEach((t, i) => o.fillText(t, m + s / 2, m + s * (0.29 + 0.43 * i)));
  for (let i = 0; i < 260; i++) { o.globalAlpha = 0.3 + 0.7 * R(); o.beginPath(); o.arc(m + R() * s, m + R() * s, R() * s * 0.012 + 0.3, 0, Math.PI * 2); o.fill(); }
  o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(rot); c.drawImage(off, -off.width / 2, -off.height / 2); c.restore();
}
// End card: draw(t) paints the card canvas for card-time t; scene/camera render it through the pipeline (END_CARD_LOOK).
export function createEndCard({ width = 1920, height = 1080, title = 'RYŪ', titleJP = '龍', paper = 0xF1E6CF, scale = 0.95 } = {}) {
  const cw = width, ch = height, canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch; const c = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const W = 1000 * scale, x0 = (cw - W) / 2 - 30 * scale, y0 = ch * 0.5 - 175 * scale - 40;
  const lettering = brushLettering({ x0, y0, scale });
  const tSeal = lettering.duration + 0.25, tTitle = tSeal + 0.45, duration = tTitle + 1.2;
  const pc = C(paper).convertLinearToSRGB(), base = `rgb(${Math.round(pc.r * 255)},${Math.round(pc.g * 255)},${Math.round(pc.b * 255)})`;
  const paperLayer = document.createElement('canvas'); paperLayer.width = cw; paperLayer.height = ch; { const p = paperLayer.getContext('2d'); const R = rng(4);
    p.fillStyle = base; p.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 2600; i++) { p.strokeStyle = `rgba(${R() < 0.5 ? '120,90,60' : '255,250,240'},${(0.03 + 0.05 * R()).toFixed(3)})`; p.lineWidth = 0.6 + R() * 1.2; const x = R() * cw, y = R() * ch, a = R() * Math.PI, l = 6 + R() * 26;
      p.beginPath(); p.moveTo(x, y); p.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); p.stroke(); }
    const g = p.createRadialGradient(cw / 2, ch / 2, ch * 0.3, cw / 2, ch / 2, ch * 0.95); g.addColorStop(0, 'rgba(90,60,30,0)'); g.addColorStop(1, 'rgba(90,60,30,0.22)'); p.fillStyle = g; p.fillRect(0, 0, cw, ch); }
  function draw(t) {
    c.clearRect(0, 0, cw, ch); c.drawImage(paperLayer, 0, 0); lettering.draw(c, t);
    if (t > tSeal) { const k = Math.min(1, (t - tSeal) / 0.18), pop = 1 + 0.35 * (1 - k) * (1 - k);
      drawHanko(c, { x: x0 + 1020 * scale + 70 * scale, y: y0 + 105 * scale, size: 92 * scale * pop, alpha: Math.min(1, k * 1.4) }); }
    if (t > tTitle) { const a = Math.min(1, (t - tTitle) / 0.6); c.save(); c.globalAlpha = a * 0.85; c.fillStyle = 'rgb(40,28,22)'; c.textBaseline = 'middle';
      const ty = y0 + 330 * scale, gapW = 46 * scale;
      c.font = `600 ${38 * scale}px Georgia, "Times New Roman", serif`; const wEn = c.measureText(title).width;
      c.font = `600 ${38 * scale}px "Yu Mincho", "MS Mincho", serif`; const wJp = c.measureText(titleJP).width + 12;
      let x = cw / 2 - (wEn + wJp + gapW) / 2; c.textAlign = 'left';
      c.font = `600 ${38 * scale}px Georgia, "Times New Roman", serif`; c.fillText(title, x, ty); x += wEn;
      c.fillRect(x + gapW * 0.3, ty, gapW * 0.4, 1.6 * scale); x += gapW;
      c.font = `600 ${38 * scale}px "Yu Mincho", "MS Mincho", serif`; c.fillText(titleJP, x + 6, ty); c.restore(); }
    tex.needsUpdate = true;
  }
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, cw / ch, 0.1, 10);
  const mat = new THREE.ShaderMaterial({ uniforms: { t: { value: tex } }, depthTest: false, depthWrite: false,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 0.0); }` });
  mrt(mat, { id: ID.FX });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); q.frustumCulled = false; scene.add(q);
  return { scene, camera, canvas, texture: tex, draw, duration, tSeal, tTitle, lettering };
}
// grade for the end card: paper must stay paper (no paint / ink / atmosphere / bloom)
export const END_CARD_LOOK = { passes: { shadow: false, reflection: false, paint: false, ink: false, atmosphere: false, overlay: false, bloom: false },
  grade: { expo: 1.0, sat: 1.0, knee: 0.9, contrast: 1.0, vignette: 0.1, grain: 0.02, paper: 0.0, halation: 0.0, ca: 0.3, lift: 0x000000, shTint: 0xffffff, hiTint: 0xffffff } };
export { keepMask };
