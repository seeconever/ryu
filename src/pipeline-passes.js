// RYŪ · fullscreen pass shaders (owner: engine): paint (depth-aware anisotropic Kuwahara), ink, atmosphere, grade,
// present. All passes read the main colour (tDiffuse, a = paint mask) and the data buffer (tData: normal.xy, depth, id).
// World reconstruction: P = uCamPos + (uCamR * ndc.x * uTanH.x + uCamU * ndc.y * uTanH.y + uCamF) * viewDepth.
import * as THREE from 'three';
import { NOISE, SKY_DEPTH } from './pipeline-glsl.js';

const SKY = SKY_DEPTH.toFixed(1), SKYH = (SKY_DEPTH * 0.5).toFixed(1);
export const FSQ_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const CAM = /* glsl */`uniform vec3 uCamPos, uCamR, uCamU, uCamF; uniform vec2 uTanH; uniform float uPixA;
vec3 rayDir(vec2 uv){ vec2 n = uv * 2.0 - 1.0; return uCamR * n.x * uTanH.x + uCamU * n.y * uTanH.y + uCamF; }`;
export const camUniforms = () => ({ uCamPos: { value: new THREE.Vector3() }, uCamR: { value: new THREE.Vector3(1, 0, 0) }, uCamU: { value: new THREE.Vector3(0, 1, 0) },
  uCamF: { value: new THREE.Vector3(0, 0, -1) }, uTanH: { value: new THREE.Vector2(1, 1) }, uPixA: { value: 0.001 } });

// ---------------------------------------------------------------------------------------------------------------------
// PAINT: structure tensor -> blur -> anisotropic Kuwahara (Kyprianidis) on BG pixels only, depth-aware (taps from other
// depths / cel pixels get no weight, so painted edges never smear across silhouettes), brush strokes along the structure,
// wobbly edges, pigment value + hue drift, paper fibres. All noise anchored to the world point under the pixel (sky: view
// direction), at a screen-stable size -> the brush texture sticks to the set while the camera moves.
// ---------------------------------------------------------------------------------------------------------------------
export const TENSOR_FS = /* glsl */`uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;
  vec3 T(float x, float y){ vec3 c = texture2D(tDiffuse, vUv + vec2(x, y) / uRes).rgb; return c / (1.0 + c); }
  void main(){ vec3 sx = (T(-1.,-1.) + 2.0 * T(-1.,0.) + T(-1.,1.) - T(1.,-1.) - 2.0 * T(1.,0.) - T(1.,1.)) * 0.25;
    vec3 sy = (T(-1.,-1.) + 2.0 * T(0.,-1.) + T(1.,-1.) - T(-1.,1.) - 2.0 * T(0.,1.) - T(1.,1.)) * 0.25;
    gl_FragColor = vec4(dot(sx, sx), dot(sy, sy), dot(sx, sy), 1.0); }`;
export const TBLUR_FS = /* glsl */`uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
  void main(){ vec4 c = vec4(0.0); float ws = 0.0; for (int i = -6; i <= 6; i++){ float w = exp(-float(i * i) / 18.0); c += texture2D(tDiffuse, vUv + uDir * float(i)) * w; ws += w; } gl_FragColor = c / ws; }`;
export const PAINT_FS = /* glsl */`${NOISE} ${CAM}
  uniform sampler2D tDiffuse, tT, tData; uniform vec2 uRes; uniform float uK, uQ, uHard, uRad, uAlpha, uStroke, uStrokeL, uWob, uVary, uHue, uPaper, uDepthK;
  vec3 gP; float gPW;
  float an(vec3 Q, float pxs, float seed){ float L = log2(max(pxs * gPW, 1e-6)), l0 = floor(L), f = L - l0;
    return mix(n3(Q / exp2(l0) + seed), n3(Q / exp2(l0 + 1.0) + seed + 31.7), f); }
  varying vec2 vUv;
  vec3 hueRot(vec3 c, float a){ const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
    const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703); vec3 y = toYIQ * c; float h = atan(y.z, y.y) + a, ch = length(y.yz); return toRGB * vec3(y.x, ch * cos(h), ch * sin(h)); }
  void main(){ vec4 c0 = texture2D(tDiffuse, vUv); float mk = clamp(c0.a, 0.0, 1.0) * uK;
    if (mk < 0.01) { gl_FragColor = c0; return; }
    float D0 = texture2D(tData, vUv).z; if (!(D0 > 1e-3)) D0 = 1e-3; vec3 rd = rayDir(vUv);
    if (D0 > ${SKYH}) { gP = uCamPos + normalize(rd) * 300.0; gPW = 300.0 * uPixA; } else { gP = uCamPos + rd * D0; gPW = length(rd) * D0 * uPixA; }
    vec2 wob = (vec2(an(gP, 23.0, 0.0), an(gP, 23.0, 17.3)) - 0.5) * 2.0 * uWob + (vec2(an(gP, 6.0, 3.0), an(gP, 6.0, 9.0)) - 0.5) * uWob * 0.6;
    vec2 uv = vUv + wob / uRes;
    vec3 g = texture2D(tT, uv).xyz; float E = g.x, G = g.y, F = g.z;
    float dd = sqrt(max((E - G) * (E - G) + 4.0 * F * F, 0.0)); float l1 = 0.5 * (E + G + dd), l2 = 0.5 * (E + G - dd);
    vec2 tv = vec2(l1 - E, -F); vec2 t = length(tv) > 1e-7 ? normalize(tv) : vec2(0.0, 1.0);
    float phi = -atan(t.y, t.x), A = (l1 + l2 > 1e-7) ? (l1 - l2) / (l1 + l2) : 0.0;
    float a = uRad * clamp((uAlpha + A) / uAlpha, 0.1, 2.0), b = uRad * clamp(uAlpha / (uAlpha + A), 0.1, 2.0);
    float cp = cos(phi), sp = sin(phi); mat2 SR = mat2(0.5 / a, 0.0, 0.0, 0.5 / b) * mat2(cp, sp, -sp, cp);
    float mx = sqrt(a * a * cp * cp + b * b * sp * sp), my = sqrt(a * a * sp * sp + b * b * cp * cp);
    vec4 m[8]; vec3 s[8]; for (int k = 0; k < 8; k++){ m[k] = vec4(0.0); s[k] = vec3(0.0); }
    float zeta = 2.0 / uRad, zc = 0.58, sz = sin(zc), eta = (zeta + cos(zc)) / (sz * sz);
    const int R = 10;
    for (int j = -R; j <= R; j++){ if (abs(float(j)) > my) continue;
      for (int i = -R; i <= R; i++){ if (abs(float(i)) > mx) continue;
        vec2 v = SR * vec2(float(i), float(j)); if (dot(v, v) > 0.25) continue;
        vec2 tuv = uv + vec2(float(i), float(j)) / uRes;
        vec4 cs = texture2D(tDiffuse, tuv); float ds = max(texture2D(tData, tuv).z, 1e-3);
        float wsel = clamp(cs.a, 0.0, 1.0) * exp(-abs(log(ds / D0)) * uDepthK);   // BG only, same depth layer
        if (wsel < 0.01) continue;
        vec3 c = cs.rgb / (1.0 + cs.rgb);
        float w[8]; float sum = 0.0, z, vxx, vyy;
        vxx = zeta - eta * v.x * v.x; vyy = zeta - eta * v.y * v.y;
        z = max(0.0, v.y + vxx); w[0] = z * z; z = max(0.0, -v.x + vyy); w[2] = z * z; z = max(0.0, -v.y + vxx); w[4] = z * z; z = max(0.0, v.x + vyy); w[6] = z * z;
        vec2 u = 0.70710678 * vec2(v.x - v.y, v.x + v.y); vxx = zeta - eta * u.x * u.x; vyy = zeta - eta * u.y * u.y;
        z = max(0.0, u.y + vxx); w[1] = z * z; z = max(0.0, -u.x + vyy); w[3] = z * z; z = max(0.0, -u.y + vxx); w[5] = z * z; z = max(0.0, u.x + vyy); w[7] = z * z;
        for (int k = 0; k < 8; k++) sum += w[k];
        float gw = exp(-3.125 * dot(v, v)) / max(sum, 1e-5) * wsel;
        for (int k = 0; k < 8; k++){ float wk = w[k] * gw; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; } } }
    vec4 o = vec4(0.0);
    for (int k = 0; k < 8; k++){ if (m[k].w < 1e-6) continue; vec3 mu = m[k].rgb / m[k].w; vec3 sg = abs(s[k] / m[k].w - mu * mu);
      float sig = sg.r + sg.g + sg.b; float wk = 1.0 / (1.0 + pow(uHard * 1000.0 * sig, 0.5 * uQ)); o += vec4(mu * wk, wk); }
    vec3 pc = o.w > 1e-6 ? o.rgb / o.w : c0.rgb / (1.0 + c0.rgb);
    float stroke, region, vv, hh, fib, pap;
    vec2 sd = (A > 0.15) ? t : normalize(vec2(1.0, 0.35 + 0.6 * (an(gP, 90.0, 5.0) - 0.5)));
    vec3 Dv = (uCamR * sd.x + uCamU * sd.y) * gPW * uStrokeL;
    float acc = 0.0; for (int k = -7; k <= 7; k++) acc += an(gP + Dv * float(k), 2.2, 1.3);
    stroke = (acc / 15.0 - 0.5) * 2.0;
    region = 0.6 + 0.8 * an(gP, 140.0, 2.1);
    vv = an(gP, 160.0, 4.4) * 0.62 + an(gP, 70.0, 6.6) * 0.38 - 0.5; hh = an(gP, 260.0, 11.0) * 0.62 + an(gP, 110.0, 12.5) * 0.38 - 0.5;
    fib = an(gP * vec3(1.0, 0.1, 1.0), 1.4, 21.0) * an(gP * vec3(0.1, 1.0, 0.1), 1.4, 27.0);
    pap = an(gP, 9.0, 33.0) * 0.6 + an(gP, 4.0, 35.0) * 0.4 - 0.5;
    pc *= 1.0 + stroke * uStroke * region;
    pc *= 1.0 + vv * uVary; pc = max(hueRot(pc, hh * uHue), 0.0);
    pc *= 1.0 + (pap * 0.6 + (fib - 0.25) * 0.5) * uPaper;
    pc = clamp(pc, 0.0, 0.97); pc = pc / (vec3(1.0) - pc);   // guard: an inverse tone map of ~1 would make a super-bright pixel (bloom blocks)
    gl_FragColor = vec4(mix(c0.rgb, pc, mk), c0.a); }`;

// ---------------------------------------------------------------------------------------------------------------------
// INK: hand-inked lines on CEL pixels only (ids 1..99). Silhouette = a neighbour much farther than the local surface slope
// predicts (drawn on the near side only, full width); inner lines = id change between two inked parts or a normal crease
// (both sides, uInner x width). Width in px at 1080p, scaled by distance (focus distance uRefD -> 1x), pressure noise
// anchored to the world, ink colour = dark ink mixed with a darkened local colour.
// ---------------------------------------------------------------------------------------------------------------------
export const INK_FS = /* glsl */`${NOISE} ${CAM}
  uniform sampler2D tDiffuse, tData; uniform vec2 uRes; uniform float uW, uK, uMinW, uMaxW, uRefD, uDepthThr, uNormThr, uInner, uTint, uPress, uPxS;
  uniform vec3 uInk; varying vec2 vUv;
  bool inkable(float id){ return id > 0.5 && id < 99.5; }
  bool integ(float id){ return abs(id - floor(id + 0.5)) < 0.02; }
  vec3 nrm(vec2 xy){ return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy)))); }
  void main(){
    vec4 c0 = texture2D(tDiffuse, vUv); vec4 d0 = texture2D(tData, vUv);
    if (uK <= 0.0 || !inkable(d0.w)) { gl_FragColor = c0; return; }
    float D0 = d0.z; if (!(D0 > 1e-3)) D0 = 1e-3; vec3 rd = rayDir(vUv); vec3 P = uCamPos + rd * D0; float pw = max(length(rd) * D0 * uPixA, 1e-6);
    float pn = n3(P / (pw * 40.0)) * 0.65 + n3(P / (pw * 11.0) + 7.0) * 0.35;
    float press = mix(1.0, 0.5 + 1.0 * pn, uPress);
    float wOut = uW * uPxS * clamp(pow(uRefD / D0, 0.3), uMinW, uMaxW) * press;
    float wIn = wOut * uInner;
    bool hasN = d0.x < 1.5; vec3 n0 = nrm(d0.xy);
    float nz = max(abs(n0.z), 0.12), slope = hasN ? sqrt(max(0.0, 1.0 - nz * nz)) / nz : 2.5;
    float Rmax = min(ceil(wOut + 1.0), 7.0);
    float best = 99.0, bw = 1.0;
    for (int k = 0; k < 8; k++){
      float ang = float(k) * 0.7853982; vec2 dir = vec2(cos(ang), sin(ang));
      for (int s = 1; s <= 7; s++){ float fs = float(s); if (fs > Rmax) break;
        vec4 d1 = texture2D(tData, vUv + dir * fs / uRes);
        float expD = pw * fs * (slope * 1.6 + 0.6) + D0 * uDepthThr;
        bool sil = d1.z - D0 > expD;
        bool idE = abs(d1.w - d0.w) > 0.2 && inkable(d1.w) && abs(d1.z - D0) < expD * 2.0;   // MSAA-mixed rim pixels of an id plate still belong to the line: requiring whole ids broke it into dashes
        bool nE = false;
        // MSAA averages the data buffer at the rim of decals and id plates (face inks on the body...): a mixed pixel's "normal" is garbage, never an edge
        if (hasN && d1.x < 1.5 && integ(d0.w) && integ(d1.w) && abs(d1.z - D0) < expD) nE = dot(n0, nrm(d1.xy)) < uNormThr;
        if (sil) { if (fs - 0.5 < best) { best = fs - 0.5; bw = wOut; } break; }
        if ((idE || nE) && fs <= wIn + 1.0) { if (fs - 0.5 < best) { best = fs - 0.5; bw = wIn; } break; }
      }
    }
    float cov = 1.0 - smoothstep(bw - 0.6, bw + 0.6, best);
    vec3 ink = mix(uInk, c0.rgb * 0.16, uTint);
    gl_FragColor = vec4(mix(c0.rgb, ink, cov * uK), c0.a);
  }`;

// ---------------------------------------------------------------------------------------------------------------------
// ATMOSPHERE: height haze (aerial perspective, brighter toward the sun), low sea mist, light shafts (screen-space radial
// rays from a world position, only bright sky / light pixels feed them unless uRaysOcc > 0).
// ---------------------------------------------------------------------------------------------------------------------
export const ATMOS_FS = /* glsl */`${NOISE} ${CAM}
  uniform sampler2D tDiffuse, tData; uniform vec2 uRes; uniform float uTime;
  uniform vec3 uHazeCol, uSunDir, uSunCol; uniform float uHazeD, uHazeH0, uHazeHK, uHazeMax, uSunScat, uSkyHaze;
  uniform float uMist, uMistH; uniform vec3 uMistCol;
  uniform vec2 uLight; uniform float uRaysOn, uRaysK, uRaysDecay, uRaysDen, uRaysThr, uRaysOcc, uRaysRad, uAsp; uniform vec3 uRaysTint;
  varying vec2 vUv;
  void main(){
    vec4 c0 = texture2D(tDiffuse, vUv); float D = texture2D(tData, vUv).z; if (!(D > 1e-3)) D = 1e-3; bool sky = D > ${SKYH};
    vec3 rd = rayDir(vUv), dir = normalize(rd); float dist = length(rd) * D;
    vec3 col = c0.rgb;
    float sunF = pow(max(dot(dir, uSunDir), 0.0), 6.0) * uSunScat;
    vec3 hc = uHazeCol + uSunCol * sunF;
    if (!sky) {
      float y0 = uCamPos.y - uHazeH0, dy = dir.y * dist, k = uHazeHK, avg = 1.0;
      if (k > 0.0) { float e0 = exp(clamp(-y0 * k, -30.0, 20.0)); float x = dy * k; avg = e0 * (abs(x) > 1e-4 ? (1.0 - exp(clamp(-x, -30.0, 30.0))) / x : 1.0); }
      float f = clamp(1.0 - exp(-max(uHazeD * dist * avg, 0.0)), 0.0, uHazeMax);
      col = mix(col, hc, f);
      if (uMist > 0.0) { vec3 P = uCamPos + rd * D; float hm = exp(-max(P.y, 0.0) / max(uMistH, 0.01));
        float mn = fbm2(P.xz * 0.02 + vec2(uTime * 0.05, uTime * 0.02)); float fm = (1.0 - exp(-dist * 0.002 * uMist)) * hm * (0.5 + mn);
        col = mix(col, uMistCol + uSunCol * sunF * 0.5, clamp(fm, 0.0, 0.8)); }
    } else {
      col = mix(col, hc, uSkyHaze * pow(1.0 - abs(dir.y), 8.0));
    }
    if (uRaysOn > 0.5) {
      const int N = 64; vec2 d = (vUv - uLight) * uRaysDen / float(N); vec2 uv = vUv - d * h12(gl_FragCoord.xy); float ill = 1.0; vec3 acc = vec3(0.0);
      for (int i = 0; i < N; i++){ uv -= d; vec3 s = texture2D(tDiffuse, uv).rgb; float sd = texture2D(tData, uv).z; float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
        float occ = sd > ${SKYH} ? 1.0 : uRaysOcc;
        float m = 1.0 - smoothstep(0.0, uRaysRad, length((uv - uLight) * vec2(uAsp, 1.0)));
        acc += s * (max(l - uRaysThr, 0.0) / max(l, 1e-4)) * m * ill * occ; ill *= uRaysDecay; }
      col += acc * uRaysTint * uRaysK / float(N) * 4.0;
    }
    col = clamp(col, 0.0, 256.0); if (any(isnan(col))) col = vec3(0.0);
    gl_FragColor = vec4(col, c0.a);
  }`;

// ---------------------------------------------------------------------------------------------------------------------
// GRADE: high-key anime grade. halation, chromatic softness, exposure, soft knee, saturation, split tone (cool lavender
// shadows / warm highs), lift, vignette, paper tooth anchored to the camera direction, film grain, flash (impact white),
// fade (to colour), manual sRGB out.
// ---------------------------------------------------------------------------------------------------------------------
export const GRADE_FS = /* glsl */`${NOISE} ${CAM}
  uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uExpo, uSat, uKnee, uHal, uHalThr, uCA, uVig, uGrain, uPaper, uGamma, uSeed, uFlash, uFade, uPxS, uContrast;
  uniform vec3 uHalCol, uLift, uShTint, uHiTint, uFadeCol, uTint, uFlashCol; varying vec2 vUv;
  vec3 knee(vec3 c){ vec3 k = vec3(uKnee); return mix(c, k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k))), step(k, c)); }
  vec3 srgb(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main(){ vec2 q = vUv - 0.5; vec2 ca = q * uCA * uPxS / uRes * 2.0 * length(q * 2.0);
    vec3 c = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);
    if (uHal > 0.0) { vec3 h = vec3(0.0); for (int i = 0; i < 12; i++){ float a = float(i) * 0.5236; vec2 o = vec2(cos(a), sin(a)) * uPxS;
        vec3 s1 = texture2D(tDiffuse, vUv + o * 4.0 / uRes).rgb, s2 = texture2D(tDiffuse, vUv + o * 10.0 / uRes).rgb;
        h += max(s1 - uHalThr, 0.0) * 0.6 + max(s2 - uHalThr, 0.0) * 0.4; }
      c += dot(h / 12.0, vec3(0.3, 0.5, 0.2)) * uHalCol * uHal; }
    c *= uTint * uExpo; c = knee(max(c, 0.0));
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, uSat), 0.0);
    c *= mix(uShTint, uHiTint, smoothstep(0.05, 0.6, l)); c += uLift * (1.0 - smoothstep(0.0, 0.4, l));
    c = max(mix(vec3(0.18), c, uContrast), 0.0);
    c = pow(max(c, 0.0), vec3(uGamma));
    c *= 1.0 - uVig * smoothstep(0.15, 0.85, length(q * vec2(1.0, 0.8)) * 1.25);
    vec3 dir = normalize(rayDir(vUv)); float fp = 1.0 / max(uPixA, 1e-5);
    float paper = (n3(dir * fp / 6.0) - 0.5) * 0.7 + (n3(dir * fp / 1.4 * vec3(1.0, 0.12, 1.0)) * n3(dir * fp / 1.4 * vec3(0.12, 1.0, 0.12)) - 0.25) * 0.6;
    c *= 1.0 + paper * uPaper;
    c = mix(c, uFlashCol, clamp(uFlash, 0.0, 1.0));
    c = mix(c, uFadeCol, clamp(uFade, 0.0, 1.0));
    vec3 o = srgb(c);
    float gr = (h12(gl_FragCoord.xy + uSeed * 17.0) + h12(gl_FragCoord.xy * 1.37 + uSeed * 31.0) - 1.0);
    o += gr * uGrain * (0.6 + 0.8 * (1.0 - abs(l - 0.45) * 1.6));
    gl_FragColor = vec4(o, 1.0); }`;

export const PRESENT_FS = /* glsl */`uniform sampler2D tA, tB; uniform float uMix; varying vec2 vUv;
  void main(){ vec3 a = texture2D(tA, vUv).rgb; if (uMix > 0.0) a = mix(a, texture2D(tB, vUv).rgb, uMix); gl_FragColor = vec4(a, 1.0); }`;

// DEBUG views of the main pass (?debug=id|depth|normal|mask|raw): what the paint / ink passes see.
export const DEBUG_FS = /* glsl */`uniform sampler2D tDiffuse, tData; uniform int uMode; varying vec2 vUv;
  vec3 hcol(float id){ return fract(vec3(0.31, 0.57, 0.83) * id * 7.13 + 0.2) * 0.8 + 0.2; }
  void main(){ vec4 c = texture2D(tDiffuse, vUv), d = texture2D(tData, vUv); vec3 o;
    if (uMode == 1) o = d.w < 0.5 ? vec3(0.08) : d.w < 99.5 ? hcol(d.w) : d.w < 199.5 ? vec3(0.9, 0.9, 1.0) : vec3(1.0, 0.6, 0.1);
    else if (uMode == 2) o = vec3(d.z > ${SKYH} ? 0.0 : 1.0 - log2(1.0 + d.z) / 16.0);
    else if (uMode == 3) o = d.x > 1.5 ? vec3(0.0) : vec3(d.xy * 0.5 + 0.5, 1.0);
    else if (uMode == 4) o = vec3(c.a);
    else o = pow(c.rgb / (1.0 + c.rgb), vec3(1.0 / 2.2));
    gl_FragColor = vec4(o, 1.0); }`;