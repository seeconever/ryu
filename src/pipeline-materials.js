// RYŪ · materials (owner: engine). Ported from anime-lab/kit + films/27-ame/anime.js, made MRT-aware.
//
//   celMaterial(color, opts)  cel character / prop: 2 hard tones (lit / shade) + crisp highlight band + shaped spec on bevels,
//                             cool lavender-blue shadow tone, anime rim, cast shadow from the character shadow map, INKED
//                             (id 1..99) unless ink: false. hero: true = lit by the character key (LOOK.hero), not the sun.
//   bgMaterial(color, opts)   painted background: same light model, softer terminator, brush + pigment variation, id 0,
//                             paint mask 1 (gets the gouache pass, never inked).
//   fxMaterial(color, opts)   emissive / glow core: HDR colour (k > 1 blooms), id FX, no ink, no paint; additive: true for
//                             glows that must not occlude (data buffer untouched).
//   overlayMaterial(opts)     for the OVERLAY scene (drawn energy, lightning, water FX after paint + ink): additive or over,
//                             soft depth test against the main pass.
//   toonClawd(clawd, opts)    the mascot (src/assets/clawd) as a cel character: body id 7, nubs 8, legs 9, face = flat
//                             unlit inks (no ink lines) tinted by the light on the face.
//   LIGHT                     the shared light rig (sun key, sky/ground ambient, rim, hero key, 8 cel spill points); the
//                             engine sets it from the shot LOOK every frame; departments may add points.
// Colours: hex = sRGB (three converts to linear). Values are tuned for the high-key day grade (pipeline-passes GRADE).
import * as THREE from 'three';
import { NOISE, SHADOW, OVERLAY, U, ID, mrt } from './pipeline-glsl.js';

const V3 = THREE.Vector3, C = (c) => (c instanceof THREE.Color ? c.clone() : new THREE.Color(c));
const MAXP = 8;

// ---------------------------------------------------------------------------------------------------------------------
// LIGHT RIG (shared uniforms)
// ---------------------------------------------------------------------------------------------------------------------
const LU = {
  uKeyDir: { value: new V3(0.35, 0.75, 0.55).normalize() }, uKeyCol: { value: new THREE.Color(1, 0.97, 0.92) },
  uSky: { value: new THREE.Color(0.72, 0.78, 1.0) }, uGround: { value: new THREE.Color(0.62, 0.56, 0.52) },
  uRimDir: { value: new V3(-0.4, 0.3, -0.85).normalize() }, uRimCol: { value: new THREE.Color(1, 0.98, 0.94) },
  uHeroDir: { value: new V3(-0.4, 0.7, 0.6).normalize() }, uHeroCol: { value: new THREE.Color(1, 0.97, 0.92) },
  uPPos: { value: Array.from({ length: MAXP }, () => new V3()) }, uPCol: { value: Array.from({ length: MAXP }, () => new THREE.Color(0, 0, 0)) },
  uPRange: { value: new Array(MAXP).fill(1) }, uPN: { value: 0 },
  uFogCol: { value: new THREE.Color(0.8, 0.85, 1) }, uFogNear: { value: 1e7 }, uFogFar: { value: 2e7 }, uFogMax: { value: 0 },
};
export const LIGHT = {
  u: LU, points: [], focus: null,
  set({ sun, amb, rim, hero, fog } = {}) {
    if (sun) { if (sun.dir) LU.uKeyDir.value.fromArray(sun.dir).normalize(); if (sun.color != null) LU.uKeyCol.value.copy(C(sun.color)).multiplyScalar(sun.k ?? 1); }
    if (amb) { if (amb.sky != null) LU.uSky.value.copy(C(amb.sky)).multiplyScalar(amb.k ?? 1); if (amb.ground != null) LU.uGround.value.copy(C(amb.ground)).multiplyScalar(amb.k ?? 1); }
    if (rim) { if (rim.dir) LU.uRimDir.value.fromArray(rim.dir).normalize(); if (rim.color != null) LU.uRimCol.value.copy(C(rim.color)).multiplyScalar(rim.k ?? 1); }
    if (hero) { if (hero.dir) LU.uHeroDir.value.fromArray(hero.dir).normalize(); if (hero.color != null) LU.uHeroCol.value.copy(C(hero.color)).multiplyScalar(hero.k ?? 1); }
    if (fog) { LU.uFogCol.value.copy(C(fog.color ?? 0xcfd8ff)); LU.uFogNear.value = fog.near ?? 1e7; LU.uFogFar.value = fog.far ?? 2e7; LU.uFogMax.value = fog.max ?? 1; }
    return LIGHT;
  },
  // cel spill point: { pos: Vector3 | Object3D, offset?, color, intensity, range, sets?: [group names] }; max 8 used per frame
  addPoint(p) { p.color = C(p.color ?? 0xffffff); p.intensity ??= 1; p.range ??= 5; LIGHT.points.push(p); return p; },
  removePoint(p) { LIGHT.points = LIGHT.points.filter(q => q !== p); },
  update() {
    const w = new V3(); const live = [];
    for (const p of LIGHT.points) { if (!(p.intensity > 0)) continue; if (p.pos.isObject3D) { if (!visibleUp(p.pos)) continue; p.pos.getWorldPosition(w); } else w.copy(p.pos);
      p._w = (p._w || new V3()).copy(w); if (p.offset) p._w.add(p.offset); p.score = LIGHT.focus ? p.intensity * p.range / (p.range + p._w.distanceTo(LIGHT.focus)) : p.intensity; live.push(p); }
    live.sort((a, b) => b.score - a.score).slice(0, MAXP).forEach((p, i) => { LU.uPPos.value[i].copy(p._w); LU.uPCol.value[i].copy(p.color).multiplyScalar(p.intensity); LU.uPRange.value[i] = p.range; });
    LU.uPN.value = Math.min(MAXP, live.length);
  },
  // CPU estimate of the light reaching a point with normal n (tints Clawd's flat face inks)
  lightAt(pos, n, hero = false) {
    const amb = LU.uSky.value.clone().lerp(LU.uGround.value, 0.5 - 0.5 * n.y);
    const kd = hero ? LU.uHeroDir.value : LU.uKeyDir.value, kc = hero ? LU.uHeroCol.value : LU.uKeyCol.value;
    const c = amb.clone().lerp(kc.clone(), THREE.MathUtils.smoothstep(n.dot(kd), -0.05, 0.05));
    for (let i = 0; i < LU.uPN.value; i++) { const L = LU.uPPos.value[i].clone().sub(pos), d = L.length(); L.divideScalar(Math.max(d, 1e-4));
      c.add(LU.uPCol.value[i].clone().multiplyScalar(Math.max(0, 1 - d / LU.uPRange.value[i]) ** 2 * THREE.MathUtils.smoothstep(n.dot(L), -0.05, 0.05))); }
    return c;
  },
};
function visibleUp(o) { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; }

// anime shadow tone: darker, a touch more saturated, hue nudged toward violet, cooled toward lavender-blue
export function shadeOf(base, { dl = 0.6, ds = 1.06, dh = -0.012, cool = 0.35 } = {}) {
  const c = C(base), hsl = {}; c.getHSL(hsl);
  const d = new THREE.Color().setHSL((hsl.h + dh + 1) % 1, Math.min(1, hsl.s * ds), hsl.l * dl);
  return d.multiply(new THREE.Color(1, 1, 1).lerp(new THREE.Color(0.84, 0.86, 1.34), cool));
}
export function hiOf(base, { dh = 0.01, ds = 0.9, dl = 1.2 } = {}) {
  const c = C(base), hsl = {}; c.getHSL(hsl); return new THREE.Color().setHSL((hsl.h + dh + 1) % 1, Math.min(1, hsl.s * ds), Math.min(0.95, hsl.l * dl));
}

// ---------------------------------------------------------------------------------------------------------------------
// TOON CORE (cel + bg)
// ---------------------------------------------------------------------------------------------------------------------
const TOON_VS = /* glsl */`
varying vec3 vN, vW, vO, vIC, vON; varying vec2 vUv;
void main(){
  vec4 p = vec4(position, 1.0); vec3 n = normal; vON = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vIC = instanceColor;
  #else
    vIC = vec3(1.0);
  #endif
  #ifdef USE_COLOR
    vIC *= color;
  #endif
  vec4 w = modelMatrix * p; vW = w.xyz; vO = p.xyz; vUv = uv;
  vN = normalize(transpose(inverse(mat3(modelMatrix))) * n);
  gl_Position = projectionMatrix * viewMatrix * w; }`;

const TOON_FS = /* glsl */`
${NOISE}
${SHADOW}
uniform vec3 uBase, uShade, uHi, uKeyDir, uKeyCol, uHeroDir, uHeroCol, uSky, uGround, uRimDir, uRimCol, uFill, uGlowCol, uEmis, uFogCol;
uniform float uTerm, uSoft, uHiT, uHiAmt, uBrush, uBrushF, uSpec, uSpecThr, uRimW, uRimI, uGlow, uMask, uAmbK, uKeyK, uPtK, uFlatSpec,
  uAmbLit, uPig, uPigF, uLock, uTrans, uRecv, uFogNear, uFogFar, uFogMax, uHero, uBackK, uCurvS;
uniform vec3 uPPos[${MAXP}]; uniform vec3 uPCol[${MAXP}]; uniform float uPRange[${MAXP}]; uniform int uPN;
#ifdef USE_MAP
uniform sampler2D map; uniform vec2 uMapRep;
#endif
#ifdef USE_EMAP
uniform sampler2D emap;
#endif
#ifdef WET
uniform float uWet, uWetScale, uWetDen; uniform vec4 uWetFace;
#endif
varying vec3 vN, vW, vO, vIC, vON; varying vec2 vUv;
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 KD = uHero > 0.5 ? uHeroDir : uKeyDir, KC = uHero > 0.5 ? uHeroCol : uKeyCol;
  float br = (n3(vO * uBrushF) - 0.5) * uBrush + (n3(vO * uBrushF * 4.3 + 7.1) - 0.5) * uBrush * 0.6;
  vec3 base = uBase * vIC, shade = uShade * vIC, hiC = uHi * vIC;
  #ifdef USE_MAP
    vec4 tx = texture2D(map, vUv * uMapRep); base *= tx.rgb; shade *= tx.rgb; hiC *= tx.rgb;
  #endif
  float nl = dot(N, KD) + br;
  float aa = fwidth(nl) * 0.75;
  float lit = smoothstep(uTerm - uSoft - aa, uTerm + uSoft + aa, nl);
  float cs = uRecv > 0.5 ? castShadow(vW, N, br * 0.5) : 0.0;
  lit *= 1.0 - cs;
  // lit tone = base x key, shadow tone = shade x ambient (both ~1 under neutral light = the exact palette)
  // cel: one flat shade tone (ground bounce only on real undersides); bg: smooth painted hemisphere
  float hy = N.y * 0.5 + 0.5; vec3 amb = mix(uGround, uSky, uMask < 0.5 ? smoothstep(0.22, 0.3, hy) : hy) * uAmbK + uFill;
  vec3 keyL = KC * uKeyK + amb * uAmbLit;
  vec3 col = mix(shade * amb, base * keyL, lit);
  float hb = smoothstep(uHiT - uSoft - aa, uHiT + uSoft + aa, nl) * lit;
  col = mix(col, hiC * keyL, hb * uHiAmt);
  if (!gl_FrontFacing) col *= uBackK;
  // shaped specular: hard-edged highlight where the surface curves (bevels), not on flat faces
  vec3 H = normalize(KD + V); float sp = dot(N, H);
  float curv = clamp(length(fwidth(N)) / max(length(fwidth(vW)), 1e-6) * uCurvS, 0.0, 1.0);
  float sm = smoothstep(uSpecThr, uSpecThr + 0.004, sp + br * 0.01) * mix(1.0, curv, uFlatSpec) * lit;
  col += KC * uKeyK * sm * uSpec;
  for (int i = 0; i < ${MAXP}; i++){ if (i >= uPN) break;
    vec3 L = uPPos[i] - vW; float d = length(L); L /= max(d, 1e-4);
    float a = clamp(1.0 - d / uPRange[i], 0.0, 1.0); a *= a;
    float b = smoothstep(-0.04, 0.06, dot(N, L) + br * 0.5);
    float ab = uMask < 0.5 ? smoothstep(0.08, 0.11, a + br * 0.05) * 0.2 + smoothstep(0.36, 0.39, a + br * 0.05) * 0.35 : a;   // cel: banded spill
    col += mix(base, vec3(dot(base, vec3(0.333))), 0.35) * uPCol[i] * ab * b * uPtK;
    col += base * 1.4 * uPCol[i] * a * smoothstep(0.0, 0.35, -dot(N, L)) * uTrans; }
  col += base * 1.4 * KC * uKeyK * smoothstep(0.0, 0.35, -dot(N, KD)) * uTrans;
  // palette lock (characters): keep the model-sheet hue, let only the value follow the light
  vec3 tone = mix(mix(shade, base, lit), hiC, hb * uHiAmt);
  float lc = dot(col, vec3(0.2126, 0.7152, 0.0722)), lt = max(dot(tone, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  col = mix(col, tone * (lc / lt), uLock);
  float fr = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  float rim = smoothstep(uRimW - 0.04, uRimW + 0.04, fr + br * 0.3) * smoothstep(0.0, 0.25, dot(N, uRimDir));
  col += uRimCol * rim * uRimI * base * 1.6;
  #ifdef WET
    if (uWet > 0.001) {
      col *= 1.0 - 0.07 * uWet;
      vec3 aN = abs(vON); vec2 fc;
      if (aN.y > aN.x && aN.y > aN.z) fc = vO.xz; else if (aN.x > aN.z) fc = vO.zy; else fc = vO.xy;
      vec2 g = fc * uWetScale, gi = floor(g), gf = fract(g) - 0.5;
      float hh = h12(gi + 7.3 + floor(aN.x * 2.0) * 13.0), rs = 0.20 + 0.17 * h12(gi + 9.9);
      vec2 jo = vec2(h12(gi + 1.1), h12(gi + 4.7)) - 0.5;
      vec2 dq = (gf - jo * 0.35) / rs; dq.y *= 0.82 + 0.1 * h12(gi + 2.2);
      float rr = length(dq);
      float onFace = (vON.z > 0.6 && abs(vO.x - uWetFace.x) < uWetFace.z && abs(vO.y - uWetFace.y) < uWetFace.w) ? 0.0 : 1.0;
      float bead = step(1.0 - uWetDen * uWet, hh) * onFace;
      float inB = (1.0 - smoothstep(0.9, 1.0, rr)) * bead;
      vec3 bc = col * 0.80 + col * 0.55 * smoothstep(0.25, 0.9, -dq.y / max(rr, 1e-3)) * smoothstep(0.35, 0.85, rr);
      bc *= 1.0 - 0.45 * smoothstep(0.72, 0.95, rr) * smoothstep(-0.2, 0.6, -dq.y);
      float hl = 1.0 - smoothstep(0.17, 0.22, length(dq - vec2(-0.34, 0.36)));
      bc = mix(bc, vec3(1.15, 1.12, 1.08), hl);
      col = mix(col, bc, inB);
    }
  #endif
  #ifdef GLOW
    float g = clamp(uGlow, 0.0, 2.5);
    vec3 gt = uGlowCol * (0.8 + 0.45 * (1.0 - fr) + 0.12 * n3(vO * 7.0));
    col = mix(col, gt * (0.65 + 0.35 * min(g, 1.5)) + col * 0.25, clamp(g, 0.0, 1.0)) + uGlowCol * max(g - 1.0, 0.0) * 0.45 * (1.0 - fr);
  #endif
  col *= 1.0 + (fbm3(vO * uPigF + 3.7) - 0.5) * uPig;   // gouache pigment variation (backgrounds)
  #ifdef USE_EMAP
    col += texture2D(emap, vUv * uMapRep).rgb * uEmis;
  #else
    col += uEmis;
  #endif
  float fd = length(vW - cameraPosition);
  col = mix(col, uFogCol, clamp(smoothstep(uFogNear, uFogFar, fd), 0.0, uFogMax));
  gl_FragColor = vec4(col, uMask);
}`;

function toonCore(color, { mask = 0, id = ID.CEL, shade = null, hi = null, cool = 0.35, term = 0.0, soft = 0.012, hiT = 0.78, hiAmt = 0.55, brush = 0.08, brushF = 3.0,
  spec = 0.35, specThr = 0.975, flatSpec = 1, rimW = 0.62, rimI = 0.0, ambK = 1, keyK = 1, ptK = 1, fill = 0x000000, ambLit = 0.12, pig = 0, pigF = 0.6, lock = 0,
  trans = 0, hero = false, recvShadow = true, glow = false, glowColor = 0xffa040, emissive = 0x000000, emisK = 1, map = null, emap = null, side = THREE.FrontSide,
  transparent = false, wet = false, vertexColors = false, backK = 1, fog = false, bevel = 0.1 } = {}) {
  const uni = { ...LU, ...pickShadowU(),
    uBase: { value: C(color) }, uShade: { value: shade != null ? C(shade) : shadeOf(color, { cool }) }, uHi: { value: hi != null ? C(hi) : hiOf(color) },
    uTerm: { value: term }, uSoft: { value: soft }, uHiT: { value: hiT }, uHiAmt: { value: hiAmt }, uBrush: { value: brush }, uBrushF: { value: brushF },
    uSpec: { value: spec }, uSpecThr: { value: specThr }, uFlatSpec: { value: flatSpec }, uRimW: { value: rimW }, uRimI: { value: rimI },
    uAmbK: { value: ambK }, uKeyK: { value: keyK }, uPtK: { value: ptK }, uFill: { value: C(fill) }, uMask: { value: mask }, uHero: { value: hero ? 1 : 0 },
    uGlow: { value: 0 }, uGlowCol: { value: C(glowColor) }, uEmis: { value: C(emissive).multiplyScalar(emisK) }, uAmbLit: { value: ambLit }, uPig: { value: pig },
    uPigF: { value: pigF }, uLock: { value: lock }, uTrans: { value: trans }, uRecv: { value: recvShadow ? 1 : 0 }, uBackK: { value: backK }, uCurvS: { value: 2 * bevel } };
  if (!fog) { uni.uFogMax = { value: 0 }; }
  const defines = {}; if (glow) defines.GLOW = '';
  if (wet) { defines.WET = ''; Object.assign(uni, { uWet: { value: 0 }, uWetScale: { value: 13 }, uWetDen: { value: 0.32 }, uWetFace: { value: new THREE.Vector4(0, 0, 0.37, 0.27) } }); }
  if (map) { defines.USE_MAP = ''; uni.map = { value: map }; uni.uMapRep = { value: map.repeat }; } if (emap) { defines.USE_EMAP = ''; uni.emap = { value: emap }; }
  const m = new THREE.ShaderMaterial({ uniforms: uni, defines, vertexShader: TOON_VS, fragmentShader: TOON_FS, side, transparent });
  m.extensions = { derivatives: true }; m.vertexColors = vertexColors; m.userData.toon = true;
  return mrt(m, { id, normal: 'normalize(mat3(viewMatrix) * (gl_FrontFacing ? vN : -vN))' });
}
const pickShadowU = () => ({ uShadowMap: U.uShadowMap, uShadowVP: U.uShadowVP, uShadowOn: U.uShadowOn, uShadowBias: U.uShadowBias, uShadowK: U.uShadowK,
  uShadowTexel: U.uShadowTexel, uShadowNO: U.uShadowNO });

let _autoId = 10;
// next inked id (cycles 10..89; ids 1..9 are reserved: 7 Clawd body, 8 nubs, 9 legs)
export const nextId = () => { const i = _autoId; _autoId = _autoId >= 89 ? 10 : _autoId + 1; return i; };

export function celMaterial(color = 0xbbbbbb, opts = {}) {
  const { ink = true, id = null, ...o } = opts;
  return toonCore(color, { mask: 0, id: ink ? (id ?? ID.CEL) : (id ?? ID.NOINK), rimI: 0.35, ...o });
}
export function bgMaterial(color = 0xbbbbbb, opts = {}) {
  return toonCore(color, { mask: 1, id: ID.BG, soft: 0.04, brush: 0.22, brushF: 2.5, pig: 0.2, hiAmt: 0.25, hiT: 0.8, spec: 0, rimI: 0, cool: 0.45, ambLit: 0.2, ...opts });
}

// ---------------------------------------------------------------------------------------------------------------------
// FX + OVERLAY
// ---------------------------------------------------------------------------------------------------------------------
const FX_VS = /* glsl */`varying vec2 vUv; varying vec3 vNw, vW; void main(){ vUv = uv; vec4 p = vec4(position, 1.0); vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
  #endif
  vec4 w = modelMatrix * p; vW = w.xyz; vNw = normalize(mat3(modelMatrix) * n); gl_Position = projectionMatrix * viewMatrix * w; }`;
export function fxMaterial(color = 0xffffff, { k = 2.0, additive = false, opacity = 1, map = null, fresnel = 0, side = THREE.FrontSide, depthWrite = null } = {}) {
  const m = new THREE.ShaderMaterial({ side, transparent: additive || opacity < 1,
    uniforms: { uCol: { value: C(color) }, uK: { value: k }, uOp: { value: opacity }, uFres: { value: fresnel }, map: { value: map } },
    defines: map ? { USE_MAP: '' } : {}, vertexShader: FX_VS,
    fragmentShader: /* glsl */`uniform vec3 uCol; uniform float uK, uOp, uFres; varying vec2 vUv; varying vec3 vNw, vW;
      #ifdef USE_MAP
      uniform sampler2D map;
      #endif
      void main(){ vec3 c = uCol * uK; float a = uOp;
        #ifdef USE_MAP
          vec4 t = texture2D(map, vUv); c *= t.rgb; a *= t.a;
        #endif
        if (uFres > 0.0) { float f = abs(dot(normalize(vNw), normalize(cameraPosition - vW))); c *= mix(1.0, 0.35 + 0.65 * f, uFres); }
        gl_FragColor = vec4(c, a); }` });
  if (additive) { m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneFactor;
    m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; m.depthWrite = false; }
  if (depthWrite != null) m.depthWrite = depthWrite;
  m.userData.fx = true;
  return mrt(m, { id: ID.FX });
}
// Colour alpha of a transparent "over" material would raise the paint mask; this keeps the destination alpha (mask).
export function keepMask(m) { m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; m.transparent = true; m.depthWrite = false; return m; }

// Overlay (drawn FX): sprite/mesh material with soft depth vs the main pass. color x k (HDR), map alpha, additive by default.
export function overlayMaterial({ color = 0xffffff, k = 1.5, map = null, additive = true, soft = 1.0, opacity = 1, side = THREE.DoubleSide } = {}) {
  const m = new THREE.ShaderMaterial({ side, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { tSceneData: U.tSceneData, uRes: U.uRes, uCol: { value: C(color) }, uK: { value: k }, uSoft: { value: soft }, uOp: { value: opacity }, map: { value: map } },
    defines: map ? { USE_MAP: '' } : {},
    vertexShader: /* glsl */`varying vec2 vUv; varying float vZ; void main(){ vUv = uv; vec4 p = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        p = instanceMatrix * p;
      #endif
      vec4 mv = viewMatrix * modelMatrix * p; vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`${OVERLAY} uniform vec3 uCol; uniform float uK, uSoft, uOp; varying vec2 vUv; varying float vZ;
      #ifdef USE_MAP
      uniform sampler2D map;
      #endif
      void main(){ float a = uOp * softDepth(vZ, uSoft); vec3 c = uCol * uK;
        #ifdef USE_MAP
          vec4 t = texture2D(map, vUv); c *= t.rgb; a *= t.a;
        #endif
        if (a < 0.002) discard; gl_FragColor = vec4(c, a); }` });
  m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// CLAWD (mascot) -> cel character. Palette from mascot/model-sheet.jpg (body D97757 = hue 15).
// ---------------------------------------------------------------------------------------------------------------------
export const CLAWD_PAL = { body: 0xD97757, shade: 0xA9533B, hi: 0xF3A584, faceInk: 0x24140F, glow: 0xFF8A3A };
export function toonClawd(clawd, { body = CLAWD_PAL.body, shade = CLAWD_PAL.shade, hi = CLAWD_PAL.hi, hero = true, lock = 0.55, term = 0.06, hiT = 0.66, hiAmt = 0.85,
  spec = 0.5, rimW = 0.55, rimI = 0.6, fill = 0x1a1420, ambLit = 0.1, glowColor = CLAWD_PAL.glow, recvShadow = true } = {}) {
  const root = clawd.root, M = clawd.materials || {};
  const mk = (id) => toonCore(body, { mask: 0, id, shade, hi, cool: 0, term, soft: 0.01, hiT, hiAmt, brush: 0.05, brushF: 3, spec, specThr: 0.975, rimW, rimI, fill, ambLit,
    lock, hero, glow: true, glowColor, wet: true, recvShadow });
  const mats = { body: mk(7), arm: mk(8), leg: mk(9) };
  const tint = { value: new THREE.Color(1, 1, 1) }, faceN = { value: new V3(0, 0, 1) };
  const flat = (hex) => { const m = new THREE.MeshBasicMaterial({ color: C(hex), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    m.onBeforeCompile = (sh) => { sh.uniforms.uTint = tint; sh.uniforms.uFaceN = faceN; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uTint, uFaceN;\nvoid main() {')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb *= uTint; gl_FragColor.a = 0.0;'); };
    m.customProgramCacheKey = () => 'clawdFace';
    // the inks write the body's id and the body's normal: to the ink pass the face is plain body, so MSAA-mixed rim pixels cannot draw specks around the eyes
    return mrt(m, { id: 7, normal: 'normalize(mat3(viewMatrix) * uFaceN)' }); };
  const face = { clawd_ink: flat(CLAWD_PAL.faceInk), clawd_shine: flat(0xffffff), clawd_blush: flat(0xF08A7A), clawd_heart: flat(0xE2466A), clawd_water: flat(0xA8DDF4),
    clawd_white: flat(0xFFF8F0), clawd_mouth: flat(0x5A1E18), clawd_tongue: flat(0xEC6F78), clawd_tongue_line: flat(0xB8424E) };
  const byMat = new Map(Object.entries(M).map(([k, v]) => [v, k]));
  const meshes = [];
  root.traverse(o => { if (!o.isMesh) return; const name = byMat.get(o.material) || o.material?.name; o.castShadow = o.receiveShadow = false;
    if (name === 'clawd_body') { const part = /arm|nub/i.test(o.name) ? 'arm' : /leg|foot/i.test(o.name) ? 'leg' : 'body'; o.material = mats[part]; meshes.push(o); }
    else if (face[name]) o.material = face[name]; });
  const bodyMesh = clawd.nodes?.body || meshes.find(m => /body/i.test(m.name)) || meshes[0];
  const all = Object.values(mats);
  const faceNode = clawd.nodes?.face, _p = new V3(), _n = new V3(), _q = new THREE.Quaternion();
  if (bodyMesh?.geometry) { bodyMesh.geometry.computeBoundingBox(); const bb = bodyMesh.geometry.boundingBox, c = bb.getCenter(new V3()), sx = bb.max.x - bb.min.x;
    for (const m of all) m.uniforms.uWetFace.value.set(c.x, c.y + 0.02 * sx, 0.37 * sx, 0.29 * sx); }
  const api = { materials: mats, face, meshes, bodyMesh, glow: 0,
    setGlow(k, color = null) { api.glow = k; for (const m of all) { m.uniforms.uGlow.value = k; if (color != null) m.uniforms.uGlowCol.value.copy(C(color)); } },
    setWet(k) { for (const m of all) m.uniforms.uWet.value = k; },
    // keep the data-buffer normal of the face inks on the body's front (call after the pose)
    syncFace() { if (faceNode) { faceNode.getWorldQuaternion(_q); faceN.value.set(0, 0, 1).applyQuaternion(_q); } },
    // per frame after LIGHT.update(): face inks follow the light on the face (never brighter than 1.0)
    update() {
      if (!faceNode) return; faceNode.getWorldPosition(_p); faceNode.getWorldQuaternion(_q); _n.set(0, 0, 1).applyQuaternion(_q);
      const L = LIGHT.lightAt(_p, _n, hero).add(mats.body.uniforms.uFill.value); const mx = Math.max(L.r, L.g, L.b, 1e-4);
      tint.value.copy(L).multiplyScalar(Math.min(1, mx) / mx).lerp(new THREE.Color(1, 1, 1).multiplyScalar(Math.min(1, mx)), 0.45);
      tint.value.lerp(new THREE.Color(1, 0.86, 0.7), Math.min(1, api.glow) * 0.8);
    } };
  return api;
}

// Measure Clawd's rendered body hue / sat / val from a canvas (area samples of the body mesh, face plate excluded).
export function measureBody(canvas, camera, mesh, n = 600) {
  const g = mesh.geometry, pos = g.getAttribute('position'), nor = g.getAttribute('normal'), idx = g.index;
  if (!mesh.userData._samples) { let s = 77; const R = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const tri = (i) => idx ? [idx.getX(i * 3), idx.getX(i * 3 + 1), idx.getX(i * 3 + 2)] : [i * 3, i * 3 + 1, i * 3 + 2];
    const nT = (idx ? idx.count : pos.count) / 3, A = [], T = []; let acc = 0; const a = new V3(), b = new V3(), c = new V3();
    for (let i = 0; i < nT; i++) { const t = tri(i); a.fromBufferAttribute(pos, t[0]); b.fromBufferAttribute(pos, t[1]); c.fromBufferAttribute(pos, t[2]); acc += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2; A.push(acc); T.push(t); }
    const out = []; for (let k = 0; k < n; k++) { const r = R() * acc; let lo = 0, hi = A.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m] < r) lo = m + 1; else hi = m; }
      const t = T[lo]; let u = R(), v = R(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const p = new V3().fromBufferAttribute(pos, t[0]).multiplyScalar(1 - u - v).addScaledVector(new V3().fromBufferAttribute(pos, t[1]), u).addScaledVector(new V3().fromBufferAttribute(pos, t[2]), v);
      const nn = new V3().fromBufferAttribute(nor, t[0]).multiplyScalar(1 - u - v).addScaledVector(new V3().fromBufferAttribute(nor, t[1]), u).addScaledVector(new V3().fromBufferAttribute(nor, t[2]), v).normalize();
      out.push({ p, n: nn }); } mesh.userData._samples = out; }
  const c2 = document.createElement('canvas'); c2.width = canvas.width; c2.height = canvas.height; const x = c2.getContext('2d'); x.drawImage(canvas, 0, 0);
  const W = canvas.width, H = canvas.height, data = x.getImageData(0, 0, W, H).data, hs = [], ss = [], vs = [];
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  g.computeBoundingBox(); const bb = g.boundingBox, cy = (bb.min.y + bb.max.y) / 2, sx = bb.max.x - bb.min.x;
  for (const s of mesh.userData._samples) {
    if (s.n.z > 0.6 && Math.abs(s.p.x) < 0.36 * sx && s.p.y - cy > -0.26 * sx && s.p.y - cy < 0.3 * sx) continue;
    const w = s.p.clone().applyMatrix4(mesh.matrixWorld), nn = s.n.clone().applyMatrix3(nm).normalize();
    if (nn.dot(camera.position.clone().sub(w).normalize()) < 0.25) continue;
    const q = w.clone().project(camera); if (Math.abs(q.x) > 0.98 || Math.abs(q.y) > 0.98 || q.z > 1) continue;
    const i = (Math.round((1 - q.y) / 2 * H) * W + Math.round((q.x + 1) / 2 * W)) * 4;
    const r = data[i] / 255, gg = data[i + 1] / 255, b = data[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); if (mx < 0.08) continue;
    let h = 0; if (mx > mn) { if (mx === r) h = 60 * (((gg - b) / (mx - mn)) % 6); else if (mx === gg) h = 60 * ((b - r) / (mx - mn) + 2); else h = 60 * ((r - gg) / (mx - mn) + 4); }
    if (h < 0) h += 360; hs.push(h > 180 ? h - 360 : h); ss.push((mx - mn) / mx); vs.push(mx); }
  const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s.length ? +s[Math.floor(s.length / 2)].toFixed(3) : null; };
  return { n: hs.length, hue: med(hs), sat: med(ss), val: med(vs) };
}
