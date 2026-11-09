// RYŪ · shared GLSL chunks + the MRT patch (owner: engine).
//
// MAIN PASS = 2 render targets (WebGL2 MRT, MSAA):
//   location 0  colour  RGBA16F: rgb = linear HDR colour, a = PAINT MASK (1 = painted background, 0 = clean cel / FX)
//   location 1  data    RGBA16F: x,y = view-space normal (x > 1.5 = "no normal"), z = linear view depth in metres
//                                (SKY_DEPTH for the sky dome), w = MATERIAL ID
// Material ids: 0 = BG (painted, never inked) | 1..99 = CEL, inked (give parts of one character different ids so lines
// fall at plate boundaries) | 100..199 = CEL without ink (decals, lettering, face parts) | 200+ = FX (no ink, no paint).
// Transparent materials write data = vec4(0): under every blend mode we use (normal, additive, premultiplied) a zero
// source with zero alpha leaves the data buffer untouched, so glows never corrupt depth / ids.
import * as THREE from 'three';

export const SKY_DEPTH = 60000.0;
export const ID = { BG: 0, CEL: 1, NOINK: 100, FX: 200 };

export const NOISE = /* glsl */`
float h13(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1,0)), f.x), mix(h12(i + vec2(0,1)), h12(i + vec2(1,1)), f.x), f.y); }
float fbm2(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
`;

// Shared engine uniforms (one object, referenced by every material / pass; the pipeline updates the values).
export const U = {
  uMrtClip: { value: 0 }, uMrtClipY: { value: 0 },                  // mirror pass: discard below the water plane
  uShadowMap: { value: null }, uShadowVP: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowBias: { value: 0.002 },
  uShadowK: { value: 1 }, uShadowTexel: { value: 1 / 2048 }, uShadowNO: { value: 0.02 },   // NO = normal offset (world units)
  tSceneData: { value: null }, uRes: { value: new THREE.Vector2(1920, 1080) }, uPxScale: { value: 1 },   // uPxScale = res.y / 1080
  uTime: { value: 0 },
};

// Cel shadow lookup (character-only shadow map, painted lighting): 0 = lit, 1 = in cast shadow. Hard edge with a little
// brush break-up.
export const SHADOW = /* glsl */`
uniform sampler2D uShadowMap; uniform mat4 uShadowVP; uniform float uShadowOn, uShadowBias, uShadowK, uShadowTexel, uShadowNO;
float castShadow(vec3 w, vec3 n, float brk){
  if (uShadowOn < 0.5) return 0.0;
  vec4 c = uShadowVP * vec4(w + n * uShadowNO, 1.0); vec3 p = c.xyz / c.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 0.0;
  float s = 0.0, sum = 0.0; float o = uShadowTexel;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) { float wt = (3.0 - abs(float(x))) * (3.0 - abs(float(y)));
    s += wt * step(texture2D(uShadowMap, p.xy + vec2(float(x), float(y)) * o).x, p.z - uShadowBias); sum += wt; }
  // 5x5 tent: the zero level of the shadow edge is a smooth curve, not texel steps, and the threshold still draws one hard cel line
  return smoothstep(0.44 + brk, 0.56 + brk, s / sum) * uShadowK;
}
`;

// Overlay helper: soft depth test against the main pass (FX drawn after paint + ink). viewDepth = -viewPos.z of the FX
// fragment; returns 0..1 visibility (fades over `soft` metres in front of the surface).
export const OVERLAY = /* glsl */`
uniform sampler2D tSceneData; uniform vec2 uRes;
float sceneDepth(){ return texture2D(tSceneData, gl_FragCoord.xy / uRes).z; }
float softDepth(float viewDepth, float soft){ float d = sceneDepth(); return clamp((d - viewDepth) / max(soft, 1e-4), 0.0, 1.0); }
`;

// ---------------------------------------------------------------------------------------------------------------------
// mrt(material, opts): make ANY material (built-in or ShaderMaterial) write the data attachment.
//   id      material id (see ID). Transparent materials write vec4(0) (data untouched).
//   normal  GLSL expression for the VIEW-space normal available in the fragment main (e.g. 'normalize(mat3(viewMatrix) * vN)');
//           default = no normal (normal edges are skipped for this material).
//   sky     write SKY_DEPTH (sky domes, star fields).
// Wraps main() of both shaders; also adds the mirror-pass clip (uMrtClip) so nothing under the water reflects.
// ---------------------------------------------------------------------------------------------------------------------
export function mrt(material, { id = ID.BG, normal = null, sky = false } = {}) {
  if (material.userData.mrt) { material.userData.mrt.u.value = id; return material; }
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
  const u = { value: id };
  material.userData.mrt = { id, u, normal, sky };
  material.onBeforeCompile = function (sh, r) {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(this, sh, r);
    sh.uniforms.uMrtId = u; sh.uniforms.uMrtClip = U.uMrtClip; sh.uniforms.uMrtClipY = U.uMrtClipY;
    // logarithmic depth (renderer option): built-in shaders handle it; our ShaderMaterials get it here
    const ownLog = !sh.fragmentShader.includes('logdepthbuf_fragment');
    sh.vertexShader = sh.vertexShader.replace(/void\s+main\s*\(\s*\)/, 'void _mrtMainV()') + /* glsl */`
      varying vec4 vMrtH;
      ${ownLog ? '#ifdef USE_LOGDEPTHBUF\n varying float vMrtFD, vMrtPersp;\n#endif\n' : ''}
      void main(){ _mrtMainV(); vMrtH = inverse(projectionMatrix) * gl_Position;
        ${ownLog ? '#ifdef USE_LOGDEPTHBUF\n vMrtFD = 1.0 + gl_Position.w; vMrtPersp = projectionMatrix[2][3] == -1.0 ? 1.0 : 0.0;\n#endif\n' : ''}
      }`;
const tr = this.transparent;
    sh.fragmentShader = /* glsl */`layout(location = 1) out highp vec4 gData;
      varying vec4 vMrtH; uniform float uMrtId, uMrtClip, uMrtClipY;
      ${ownLog ? '#ifdef USE_LOGDEPTHBUF\n uniform float logDepthBufFC; varying float vMrtFD, vMrtPersp;\n#endif\n' : ''}
      ` + sh.fragmentShader.replace(/void\s+main\s*\(\s*\)/, 'void _mrtMainF()') + /* glsl */`
      void main(){
        ${ownLog ? '#ifdef USE_LOGDEPTHBUF\n gl_FragDepth = vMrtPersp > 0.5 ? log2(vMrtFD) * logDepthBufFC * 0.5 : gl_FragCoord.z;\n#endif\n' : ''}
        vec3 vMrtVP = vMrtH.xyz / vMrtH.w;
        if (uMrtClip > 0.5 && (transpose(mat3(viewMatrix)) * (vMrtVP - viewMatrix[3].xyz)).y < uMrtClipY) discard;
        _mrtMainF();
        ${tr ? 'gData = vec4(0.0);' : `vec3 mrtN = ${normal || 'vec3(2.0, 0.0, 0.0)'};
        gData = vec4(mrtN.xy, ${sky ? SKY_DEPTH.toFixed(1) : `clamp(-vMrtVP.z, 0.001, ${SKY_DEPTH.toFixed(1)})`}, uMrtId);`}
      }`;
  };
  material.customProgramCacheKey = function () {
    const base = prevKey && prevKey !== THREE.Material.prototype.customProgramCacheKey ? prevKey.call(this) : '';
    return base + '|mrt' + (this.transparent ? 'T' : 'O') + (sky ? 'S' : '') + (normal || '');
  };
  material.needsUpdate = true;
  return material;
}

// Patch the shader source of an (engine) material: fn(shader) edits shader.vertexShader / fragmentShader / uniforms BEFORE
// the MRT wrap; `key` keeps the program cache honest (two materials with the same source but different patches must not
// share a program).
export function patchShader(m, key, fn) {
  const prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) { fn(sh, r); if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(this, sh, r); };
  m.customProgramCacheKey = function () { return (pk && pk !== THREE.Material.prototype.customProgramCacheKey ? pk.call(this) : '') + '|' + key; };
  m.needsUpdate = true; return m;
}

// Make every material under `root` MRT-capable (unknown built-ins become painted BG, transparent ones leave data alone).
export function ensureMRT(root) {
  root.traverse(o => {
    if (!o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) if (!m.userData.mrt) mrt(m, { id: o.isSprite || o.isPoints || o.isLine ? ID.FX : ID.BG });
  });
}
