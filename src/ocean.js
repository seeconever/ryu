// RYŪ · OCEAN (owner: world) — the sea surface at kilometre scale (coast set), painted BG (id 0).
// Geometry: a polar grid around (0, 0, 30) whose rings grow exponentially (≈1.3 m spacing at the pier and seawall, km at the
// horizon), displaced in the vertex shader by the swell + the bulge (s14) + the splash-down ring wave (s32-s34).
// Look: cobalt open sea -> turquoise shallows by the seawall / headlands / breakwaters, cel swell banding, painted ripple
// dapples (world-anchored, screen-stable size), vertical-smeared mirror reflections (engine reflection pass), sun glitter
// (crisp, kept out of the gouache pass), sky sparkles, whitecaps, foam lace (seawall, rocks, pier piles, boat hulls), the
// boil on the bulge, the breaking crest of the wave. Water animates on threes (ctx.onThrees).
// API (ctx.modules.ocean):
//   height(x, z, t) -> surface height (swell + bulge + wave; t = film time, quantised to threes inside)
//   normal(x, z, t) -> [nx, ny, nz]
//   bulge(t) -> { x, z, r, h, boil }        s14-s15: the bay swells where the giant rises
//   wave(t)  -> { cx, cz, rho, h, hitX(x) } s32-s34: ring wave from the splash-down; hitX(x) = time it reaches the seawall at x
//   breakFX  the seawall break burst group (s33); set ctx.modules.ocean.useBreakFX = false if fx-water draws its own
//   setPiles([[x, z, r], ...]), setBoats([[x, z, halfLen, halfW, yaw], ...])  foam rings (world calls these)
//   surface (the mesh), SEAWALL_Z
import * as THREE from 'three';

const SEAWALL_Z = -42, WALL_TOP_Y = 3.5;
const SPLASH = { x: 0, z: 220 };
// swell components: [dirX, dirZ, wavelength m, amplitude m, phase]
const SW = [[-0.2, -1.0, 46, 0.30, 0.0], [0.38, -1.0, 27, 0.15, 1.7], [-0.62, -0.8, 15.5, 0.075, 4.1], [0.12, -1.0, 8.6, 0.035, 2.3]].map(([x, z, L, A, ph]) => {
  const l = Math.hypot(x, z), k = 2 * Math.PI / L; return [x / l, z / l, k, Math.sqrt(9.81 / k) * k, A, ph]; });
const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// time shaping shared by CPU + GPU (film time -> parameters)
export function bulgeAt(t) { t = -1; const h = 11 * sstep(28.75, 31.35, t) * (1 - sstep(31.7, 33.4, t)); const boil = sstep(28.9, 30.2, t) * (1 - sstep(34.5, 37.0, t));
  const giant = sstep(28.5, 29.4, t) * (1 - sstep(31.3, 32.0, t));   // the colossal shape darkening the water from below
  return { x: SPLASH.x, z: SPLASH.z, r: 90 + 30 * sstep(28.75, 31.5, t), h, boil, giant }; }
const WAVE_T0 = 69.25, WAVE_T1 = 71.8, WAVE_D = SPLASH.z - SEAWALL_Z;   // reaches the seawall (x = 0) at the 'wave' cue
export function waveAt(t) {
  const k = -1;   // the ring wave of the ported sea stays off
  if (k <= 0 || t > 73.6) return { cx: SPLASH.x, cz: SPLASH.z, rho: 0, h: 0, k: 0 };
  const rho = WAVE_D * Math.pow(k, 0.72);
  const h = 3.6 * sstep(0.0, 0.25, k) * (1 - sstep(1.02, 1.3, k)) * (0.6 + 0.4 * Math.min(1, k));   // a real face: ~3.6 m at the wall
  return { cx: SPLASH.x, cz: SPLASH.z, rho, h, k };
}
// time at which the ring reaches the seawall line at x
export const waveHitX = (x) => WAVE_T0 + (WAVE_T1 - WAVE_T0) * Math.pow(Math.hypot(x - SPLASH.x, SEAWALL_Z - SPLASH.z) / WAVE_D, 1 / 0.72);

const H_GLSL = /* glsl */`
uniform float uT; uniform vec4 uBulge; uniform vec4 uWave; uniform float uBoil;
const vec4 SWA = vec4(${SW.map(s => s[0].toFixed(5)).join(',')}), SWB = vec4(${SW.map(s => s[1].toFixed(5)).join(',')});
const vec4 SWK = vec4(${SW.map(s => s[2].toFixed(5)).join(',')}), SWW = vec4(${SW.map(s => s[3].toFixed(5)).join(',')});
const vec4 SWAMP = vec4(${SW.map(s => s[4].toFixed(4)).join(',')}), SWPH = vec4(${SW.map(s => s[5].toFixed(3)).join(',')});
float swellAmp(vec2 p){ return mix(0.42, 1.0, smoothstep(-40.0, 400.0, p.y)) * (1.0 - smoothstep(2500.0, 6000.0, length(p - vec2(0.0, 30.0)))); }
float swell(vec2 p, float t){ vec4 ph = (SWA * p.x + SWB * p.y) * SWK - SWW * t + SWPH; vec4 s = sin(ph);
  return dot(SWAMP, s + 0.18 * (s * s - 0.5)) * swellAmp(p); }
float bulgeH(vec2 p){ if (uBulge.w <= 0.0) return 0.0; float d = length(p - uBulge.xy) / uBulge.z; float k = max(0.0, 1.0 - d * d); return uBulge.w * k * k; }
float waveH(vec2 p){ if (uWave.w <= 0.0) return 0.0; float s = length(p - uWave.xy) - uWave.z; float x = s / (s > 0.0 ? 4.6 : 17.0); float c = cosh(clamp(x, -9.0, 9.0));
  float h = uWave.w / (c * c) - 0.22 * uWave.w * exp(-pow((s + 34.0) / 13.0, 2.0)); return h * smoothstep(${SEAWALL_Z - 1}.0, ${SEAWALL_Z + 5}.0, p.y); }
float seaH(vec2 p, float t){ return swell(p, t) + bulgeH(p) + waveH(p); }
`;
function swellJS(x, z, t) {
  const amp = (0.42 + 0.58 * sstep(-40, 400, z)) * (1 - sstep(2500, 6000, Math.hypot(x, z - 30)));
  let h = 0; for (const [dx, dz, k, w, A, ph] of SW) { const s = Math.sin((dx * x + dz * z) * k - w * t + ph); h += A * (s + 0.18 * (s * s - 0.5)); }
  return h * amp;
}
function heightJS(x, z, ft) {
  let h = swellJS(x, z, ft);
  const b = bulgeAt(ft); if (b.h > 0) { const d = Math.hypot(x - b.x, z - b.z) / b.r, k = Math.max(0, 1 - d * d); h += b.h * k * k; }
  const w = waveAt(ft); if (w.h > 0) { const s = Math.hypot(x - w.cx, z - w.cz) - w.rho, xx = Math.max(-9, Math.min(9, s / (s > 0 ? 4.6 : 17))), c = Math.cosh(xx);
    h += (w.h / (c * c) - 0.22 * w.h * Math.exp(-(((s + 34) / 13) ** 2))) * sstep(SEAWALL_Z - 1, SEAWALL_Z + 5, z); }
  return h;
}

export async function create(ctx) {
  const { sets, glsl, light } = ctx;
  // ---- geometry: exponential polar grid ----
  const NR = 500, NS = 448, A = 8, B = 0.0176, CX = 0, CZ = 30;
  const pos = new Float32Array((NR * NS + 1) * 3); pos.set([CX, 0, CZ], 0);
  for (let i = 1; i <= NR; i++) { const r = A * (Math.exp(B * i) - 1); for (let j = 0; j < NS; j++) { const a = j / NS * Math.PI * 2, o = (1 + (i - 1) * NS + j) * 3;
    pos[o] = CX + Math.cos(a) * r; pos[o + 1] = 0; pos[o + 2] = CZ + Math.sin(a) * r; } }
  const idx = []; for (let j = 0; j < NS; j++) idx.push(0, 1 + (j + 1) % NS, 1 + j);
  for (let i = 1; i < NR; i++) for (let j = 0; j < NS; j++) { const a = 1 + (i - 1) * NS + j, b = 1 + (i - 1) * NS + (j + 1) % NS, c = a + NS, d = b + NS; idx.push(a, b, d, a, d, c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(CX, 0, CZ), 1e6);

  const refl = ctx.water.reflection, U = glsl.U, C = (h) => new THREE.Color(h);
  const uni = {
    uT: { value: 0 }, uBulge: { value: new THREE.Vector4() }, uWave: { value: new THREE.Vector4() }, uBoil: { value: 0 }, uBreak: { value: 0 }, uWaveK: { value: 0 }, uWaveT: { value: 0 }, uGiant: { value: 0 },
    uRefl: { value: refl.texture }, uReflVP: { value: refl.matrix }, uReflOn: { value: 0 }, uPxA: { value: 0.0008 }, uDusk: { value: 0 },
    uDeep: { value: C(0x145cc8) }, uMid: { value: C(0x1f86e0) }, uShallow: { value: C(0x2cd0cc) }, uLight: { value: C(0x9fe0ff) }, uDark: { value: C(0x0a2c86) },
    uFoam: { value: C(0xfafdff) }, uHorz: { value: C(0xbcdcff) },
    uPiles: { value: Array.from({ length: 40 }, () => new THREE.Vector3()) }, uNP: { value: 0 },
    uBoats: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) }, uBoatW: { value: Array.from({ length: 12 }, () => 0) }, uNB: { value: 0 },
    uKeyDir: light.u.uKeyDir, uKeyCol: light.u.uKeyCol, uSky: light.u.uSky, uGlit: { value: new THREE.Vector3(0.3, 0.25, 0.72).normalize() },
    uShadowMap: U.uShadowMap, uShadowVP: U.uShadowVP, uShadowOn: U.uShadowOn, uShadowBias: U.uShadowBias, uShadowK: U.uShadowK, uShadowTexel: U.uShadowTexel, uShadowNO: U.uShadowNO,
  };
  const m = new THREE.ShaderMaterial({ uniforms: uni,
    vertexShader: /* glsl */`${H_GLSL} varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); w.y += seaH(w.xz, uT); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`${glsl.NOISE} ${glsl.SHADOW} ${H_GLSL}
      uniform sampler2D uRefl; uniform mat4 uReflVP; uniform float uReflOn, uPxA, uDusk, uBreak, uWaveK, uWaveT, uGiant;
      uniform vec3 uDeep, uMid, uShallow, uLight, uDark, uFoam, uHorz, uKeyDir, uKeyCol, uSky, uGlit;
      uniform vec3 uPiles[40]; uniform int uNP; uniform vec4 uBoats[12]; uniform float uBoatW[12]; uniform int uNB;
      varying vec3 vW; vec3 gN = vec3(0.0, 1.0, 0.0);
      float smax(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(a, b, h) + k * h * (1.0 - h); }
      // signed distance-ish to land (> 0 on land), same field as world.ground (seawall, headlands, breakwaters)
      float landF(vec2 p){ float f0 = -(p.y + 42.0);
        vec2 l = (p - vec2(-900.0, 260.0)) / vec2(520.0, 560.0); float fl = 520.0 * (1.0 - length(l));
        vec2 r = (p - vec2(820.0, 160.0)) / vec2(460.0, 420.0); float fr = 440.0 * (1.0 - length(r));
        float f = smax(smax(f0, fl, 60.0), fr, 60.0);
        // breakwaters (harbour, right): segments, 4 m half width
        vec2 a0 = vec2(300.0, -42.0), a1 = vec2(300.0, 100.0), a2 = vec2(175.0, 112.0), b0 = vec2(112.0, -42.0), b1 = vec2(112.0, 38.0);
        vec2 pa = p - a0, ba = a1 - a0; float d1 = length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
        pa = p - a1; ba = a2 - a1; d1 = min(d1, length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
        pa = p - b0; ba = b1 - b0; d1 = min(d1, length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
        f = max(f, 5.0 - d1);
        // RYŪ: the island (GEO.ISLAND): turquoise shallows + shore foam around it
        vec2 ip = p - vec2(-3600.0, 2600.0); float ia = atan(ip.y, ip.x);
        return smax(f, 1072.0 + 18.0 * sin(ia * 3.0 + 1.2) + 10.0 * sin(ia * 7.0) - length(ip), 40.0); }
      // world-anchored noise at a screen-stable size: px = target size in pixels
      float lod(vec2 p, float pw, float px, float seed){ float L = log2(max(pw * px, 1e-4)), l0 = floor(L), f = L - l0;
        return mix(n2(p / exp2(l0) + seed), n2(p / exp2(l0 + 1.0) + seed + 17.3), f); }
      float lodF(vec2 p, float pw, float px, float seed){ return lod(p, pw, px, seed) * 0.62 + lod(p * 2.13 + 3.1, pw, px * 0.5, seed + 5.0) * 0.38; }
      void main(){
        vec3 V = cameraPosition - vW; float dist = length(V); V /= dist; float pw = dist * uPxA / max(abs(V.y), 0.08);
        vec2 p = vW.xz; float t = uT;
        float e = max(0.25, pw * 1.5); float h0 = seaH(p, t);
        vec3 Ns = normalize(vec3(-(seaH(p + vec2(e, 0.0), t) - h0) / e, 1.0, -(seaH(p + vec2(0.0, e), t) - h0) / e));
        // ripple field (two drifting layers, on threes via uT), fades with the footprint
        vec2 q = vec2(p.x * 0.55, p.y);
        float r1 = lodF(q + vec2(t * 0.35, t * 0.9), pw, 13.0, 1.0), r2 = lodF(q * 1.7 - vec2(t * 0.6, -t * 0.5), pw, 7.0, 9.0);
        float rp = r1 * 0.65 + r2 * 0.35;
        float eR = 0.6; vec3 Nr = normalize(Ns + vec3((lodF(q + vec2(eR, 0.0) + vec2(t * 0.35, t * 0.9), pw, 13.0, 1.0) - r1) * 0.9, 0.0, (lodF(q + vec2(0.0, eR) + vec2(t * 0.35, t * 0.9), pw, 13.0, 1.0) - r1) * 0.9));
        float lf = landF(p), sd = -lf;   // sd = distance to the shore (m)
        float deep = smoothstep(8.0, 150.0, sd);
        vec3 base = mix(uShallow, uMid, deep); base = mix(base, uDeep, smoothstep(160.0, 1400.0, sd));
        // cel banding: facets turned to the viewer reflect the bright sky (light), the others show the body colour (dark)
        float fac = dot(Ns, normalize(V + vec3(0.0, 0.9, 0.0)));
        // painted water: soft dark troughs + thin light dashes along the swell crests (ridged noise, elongated along x)
        float rg = 1.0 - abs(2.0 * lodF(vec2(p.x * 0.3, p.y * 1.35) + vec2(t * 0.25, t * 0.75), pw, 16.0, 3.0) - 1.0);
        float bandL = smoothstep(0.93, 0.955, rg + (fac - 0.985) * 3.0 + (r2 - 0.5) * 0.1), bandD = smoothstep(0.36, 0.32, rp + (fac - 0.985) * 4.0);
        vec3 col = base;
        col = mix(col, mix(base, uDark, 0.32), bandD * 0.45);
        col = mix(col, mix(base, uLight, 0.5), bandL * (0.7 - 0.25 * smoothstep(300.0, 3000.0, dist)));
        // the swell at km scale: long crests rolling into the bay (noise-warped), a darker trough band + a thin light crest
        // line per crest; the wavelength doubles with the pixel footprint so the stripes stay ~16 px apart (the classic
        // painted sea: stripes tightening toward the horizon), never aliasing
        float swL = log2(max(1.0, pw * 16.0 / 60.0)), swl0 = floor(swL), swf = swL - swl0, swC = 0.0, swT = 0.0;
        for (int o = 0; o < 2; o++) { float lam = 60.0 * exp2(swl0 + float(o)), wo = o == 0 ? 1.0 - swf : swf;
          float ph = dot(p, vec2(-0.196, -0.981)) / lam + n2(p / (lam * 9.0)) * 1.6 + n2(p / (lam * 2.6) + 7.0) * 0.45 - t * 0.9 * 60.0 / lam;
          float sb = fract(ph), along = smoothstep(0.25, 0.55, n2(vec2(dot(p, vec2(0.981, -0.196)) / (lam * 3.0), ph * 0.5) + 11.0));
          swC += wo * smoothstep(0.0, 0.05, sb) * smoothstep(0.13, 0.06, sb) * along; swT += wo * smoothstep(0.3, 0.5, sb) * smoothstep(0.98, 0.78, sb); }
        float swK = smoothstep(4.0, 30.0, sd);
        col = mix(col, mix(base, uDark, 0.4), swT * 0.32 * swK);
        col = mix(col, mix(base, uLight, 0.7), swC * 0.75 * swK);
        // lit by the sky / key a little (two-tone water, not physically shaded)
        col *= mix(vec3(0.82), uSky * 0.55 + uKeyCol * 0.45, 0.7);
        // cast shadow of characters / props on the water
        float cs = castShadow(vW, vec3(0.0, 1.0, 0.0), (rp - 0.5) * 0.3); col = mix(col, col * vec3(0.55, 0.6, 0.85), cs * 0.85);
        // mirror reflection (vertical smear), fresnel weighted
        float fr = pow(1.0 - clamp(dot(Nr, V), 0.0, 1.0), 4.0);
        if (uReflOn > 0.5) { vec3 rsum = vec3(0.0); vec2 off = (Nr.xz - Ns.xz) * 0.05 * (1.0 - smoothstep(30.0, 2000.0, dist)) + Ns.xz * 0.02;
          vec4 rc = uReflVP * vec4(vW.x, 0.0, vW.z, 1.0); vec2 ruv = rc.xy / rc.w * 0.5 + 0.5 + off;
          for (int k = 0; k < 6; k++) rsum += texture2D(uRefl, clamp(ruv + vec2(0.0015 * float(k - 3), -0.007 * float(k)), 0.001, 0.999)).rgb;
          rsum /= 6.0; rsum = mix(rsum, rsum * base * 2.2, 0.35);
          // fade out where the mirrored view leaves the reflection texture (no stretched edge ghosts)
          float re = smoothstep(0.0, 0.07, ruv.x) * smoothstep(1.0, 0.93, ruv.x) * smoothstep(0.0, 0.07, ruv.y) * smoothstep(1.0, 0.93, ruv.y);
          col = mix(col, rsum, re * clamp(0.04 + 0.22 * fr, 0.0, 0.22) * (1.0 - 0.4 * smoothstep(0.6, 1.0, dot(rsum, vec3(0.33))))); }
        else col = mix(col, uHorz * uSky, clamp(0.1 + 0.6 * fr, 0.0, 0.7));
        // whitecaps: short white dashes riding the swell crests in the open bay, screen-stable (~10 px, stretched along the
        // crests) so the paint pass cannot smear them (they are kept out of it through the alpha mask below)
        float wc = lod(vec2(p.x * 0.3, p.y) + vec2(t * 0.2, t * 0.5), pw, 7.0, 21.0);
        float caps = smoothstep(0.8, 0.83, wc + swC * 0.12) * smoothstep(90.0, 300.0, sd) * (0.35 + 0.65 * smoothstep(0.55, 0.7, r1)) * (1.0 - smoothstep(4000.0, 15000.0, dist)) * 0.95;
        // foam: shore lace, pier piles, boat hulls
        float fn = lod(p * 1.3 + vec2(t * 0.8, -t * 0.5), pw, 6.0, 33.0);
        float shoreF = smoothstep(2.2 + 2.5 * fn, 0.0, sd) + smoothstep(0.05, 0.0, abs(sd - 6.0 - 3.0 * fn) - 0.5) * smoothstep(0.45, 0.6, fn) * 0.85;
        float pf = 0.0; for (int i = 0; i < 40; i++){ if (i >= uNP) break; vec3 pl = uPiles[i]; float d = length(p - pl.xy) - pl.z; pf = max(pf, smoothstep(0.28 + 0.12 * fn, 0.04, d) * (d > -0.05 ? 1.0 : 0.0)); }
        float bf = 0.0; for (int i = 0; i < 12; i++){ if (i >= uNB) break; vec4 b = uBoats[i]; float cy = cos(uBoatW[i]), sy = sin(uBoatW[i]);
          vec2 lp = vec2(cy * (p.x - b.x) - sy * (p.y - b.y), sy * (p.x - b.x) + cy * (p.y - b.y)); float ed = length(lp / vec2(b.w, b.z));
          bf = max(bf, smoothstep(1.32 + 0.12 * fn, 1.02, ed) * step(0.98, ed) * smoothstep(0.25, 0.55, fn)); }
        float foam = max(shoreF, max(pf, bf));
        // the bulge: lifted turquoise dome, foam rings at its foot, the boil on top
        if (uBulge.w > 0.0 || uBoil > 0.0 || uGiant > 0.0) { float bd = length(p - uBulge.xy) / uBulge.z;
          float dome = (1.0 - smoothstep(0.55, 1.05, bd)) * smoothstep(0.0, 1.5, uBulge.w);
          float sil = (1.0 - smoothstep(0.35 + (r1 - 0.5) * 0.15, 0.75, bd)) * uGiant;
          col = mix(col, mix(uShallow, uLight, 0.25) * 1.08, dome * 0.75 * (1.0 - sil * 0.7));
          col = mix(col, uDark * 0.55, sil * 0.62);
          float bn = lodF(p * 0.7 + vec2(0.0, t * 1.6), pw, 18.0, 41.0);
          float boil = smoothstep(0.58, 0.61, bn + 0.18 * (1.0 - bd)) * (1.0 - smoothstep(0.85, 1.1, bd)) * uBoil;
          // foam rings at the foot broken into lace + streaks (no flat ellipse decal): jagged ring lines, torn by noise
          vec2 dq = p - uBulge.xy; float ang = atan(dq.y, dq.x), lacen = n2(vec2(ang * 9.0, bd * 6.0 - t * 0.5)) * 0.6 + n2(p * 0.35 + t * 0.4) * 0.4;
          float rings = smoothstep(0.0, 0.025, abs(fract(bd * 2.2 - t * 0.6 + (lacen - 0.5) * 0.5) - 0.5) - 0.44) * smoothstep(0.82, 1.0, bd) * (1.0 - smoothstep(1.2, 1.75, bd)) * uBoil * smoothstep(0.48, 0.6, lacen);
          foam = max(foam, max(boil, rings)); }
        // the ring wave: translucent turquoise face, foam crest, white water behind once it breaks
        if (uWave.w > 0.0) { float s = length(p - uWave.xy) - uWave.z; float hw = waveH(p) / max(uWave.w, 1e-3), wn = n2(p * 0.3 + uT * 0.4) - 0.5;
          // the face toward the shore: dark blue at its foot, lighter + translucent turquoise toward the crest; the back slope
          // turquoise; a dark curl shadow line under the lip
          float face = smoothstep(-0.5, 1.0, s) * smoothstep(0.06, 0.25, hw);
          col = mix(col, mix(uDark, uDeep, 0.35), face * 0.85);                                                       // dark face
          col = mix(col, mix(uDeep, uMid, 0.7), face * smoothstep(0.5 + wn * 0.1, 0.56 + wn * 0.1, hw) * 0.9);     // its lit upper half (2 tones)
          col = mix(col, mix(uShallow, uLight, 0.12) * 1.12, smoothstep(0.82, 0.88, hw + wn * 0.06) * smoothstep(-3.0, -0.5, s) * smoothstep(3.0, 1.0, s));   // thin translucent crest
          col = mix(col, mix(col, uMid, 0.35), smoothstep(0.2, 0.6, hw) * (1.0 - face) * smoothstep(-8.0, -2.0, s));   // the back slope, a touch lighter
          float curl = smoothstep(0.62, 0.68, hw + wn * 0.06) * smoothstep(0.8, 0.74, hw + wn * 0.06) * smoothstep(0.3, 1.0, s);
          col = mix(col, uDark * 0.55, curl * 0.75);                                                                 // shadow under the curling lip
          float crest = smoothstep(0.86 - 0.04 * uWaveK, 0.93, hw + (n2(p * 0.45 + uT * 0.6) - 0.5) * 0.14) * smoothstep(-5.0, -2.5, s);   // the foam crest
          // the white water behind the crest: world-scale lace streaked along the run of the wave (not screen-sized blotches)
          vec2 rd = normalize(p - uWave.xy); vec2 qs = vec2(dot(p, vec2(-rd.y, rd.x)), dot(p, rd));
          float wl = n2(vec2(qs.x * 0.55, qs.y * 0.12 - uT * 0.9)) * 0.65 + n2(vec2(qs.x * 1.6, qs.y * 0.4) + 11.0) * 0.35;
          float wake = smoothstep(-3.0, -10.0, s) * smoothstep(-55.0, -20.0, s) * smoothstep(0.64, 0.68, wl + 0.04 * uWaveK) * uWaveK * (1.0 - smoothstep(0.98, 1.08, uWaveT));
          foam = max(foam, max(crest, wake)); }
        // backwash after the break (races along the wall with the hit): a solid white apron at the wall, a broken foam front
        // running out to sea, lace streaked along the outflow between them, thinning as it spreads
        if (uBreak > 0.0) { float hit = ${WAVE_T0.toFixed(3)} + ${(WAVE_T1 - WAVE_T0).toFixed(3)} * pow(length(vec2(p.x - ${SPLASH.x.toFixed(1)}, ${(SEAWALL_Z - SPLASH.z).toFixed(1)})) / ${WAVE_D.toFixed(1)}, ${(1 / 0.72).toFixed(4)});
          float kb = clamp((uT - hit) / 2.2, 0.0, 1.0), dW = p.y - ${SEAWALL_Z.toFixed(1)};
          if (kb > 0.0) { float reach = 4.0 + 34.0 * (1.0 - pow(1.0 - kb, 2.0)), fl = n2(vec2(p.x * 0.5, p.y * 0.11 - uT * 0.8)) * 0.65 + n2(vec2(p.x * 1.5, p.y * 0.35) + 23.0) * 0.35;
            float apron = smoothstep(2.5 + 3.0 * fn + 3.0 * kb, 0.5, dW) * (1.0 - 0.5 * kb);
            float front = smoothstep(2.2, 0.0, abs(dW - reach + (fn - 0.5) * 5.0)) * smoothstep(0.35, 0.5, fn) * (1.0 - 0.6 * kb);
            // lace = veins of ridged noise streaked along the outflow (thick by the wall, thinning to threads offshore)
            float rl = 1.0 - abs(2.0 * fl - 1.0), lt = mix(0.62, 0.84, dW / reach) + 0.05 * kb;
            float lace = step(dW, reach) * smoothstep(lt, lt + 0.04, rl);
            foam = max(foam, max(apron, max(front, lace * 0.92)) * smoothstep(-175.0, -120.0, -abs(p.x)) * (1.0 - 0.5 * smoothstep(73.0, 75.5, uT))); } }
        foam = max(foam, caps);
        vec3 fc = uFoam * mix(vec3(0.92), mix(uSky, uKeyCol, 0.55), 0.45); fc = mix(fc, fc * vec3(0.74, 0.8, 0.98), smoothstep(0.4, 0.2, fn) * 0.5);
        col = mix(col, fc, foam);
        // glitter: crisp sun sparkles + sky sparkles near the camera (on threes, cell-hashed)
        // (the glitter path follows a painted glitter key: the sun's azimuth, its elevation held low, so a high summer sun
        // still lays a path of sparkles toward the horizon under it)
        vec3 Rv = reflect(-V, Nr); float sg = dot(Rv, normalize(uGlit)), lowSun = smoothstep(0.0, 0.25, 1.0 - abs(uGlit.y));
        vec2 gc = floor(p / max(pw * 5.0, 0.05)); float hsh = h12(gc + floor(t * 8.0) * 3.7);
        float sun = smoothstep(0.9984 - 0.0045 * lowSun, 0.9993 - 0.0012 * lowSun, sg + (rp - 0.5) * 0.006) * step(0.74, hsh) * (1.0 - foam);
        // sky glints on the crest lines out to ~2.5 km (the glittering sea of the wide shots)
        float skyS = step(0.965, hsh) * max(bandL, swC * swK) * (1.0 - smoothstep(900.0, 2600.0, dist)) * 0.9;
        float spark = max(sun, skyS);
        col = mix(col, uKeyCol * (sun > skyS ? 3.2 : 1.7), spark);
        gN = Nr;
        // RYŪ: the sea darkens to indigo under the storm wall (s18-s19)
        float stormSea = smoothstep(3200.0, 8800.0, vW.z) * (1.0 - uDusk);
        col = mix(col, col * vec3(0.3, 0.3, 0.62) + vec3(0.015, 0.015, 0.06), stormSea);
        gl_FragColor = vec4(col, clamp(1.0 - spark - foam * 0.35 - caps * 0.6 - swC * swK * 0.45, 0.0, 1.0)); }` });
  glsl.mrt(m, { id: 0, normal: 'normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0))' });
  const sea = new THREE.Mesh(geo, m); sea.name = 'ocean'; sea.userData.noReflect = true; sea.renderOrder = -4; sea.frustumCulled = false;
  sets.sea.add(sea);

  // ---- the break (s32-s34): cel white water. A curtain bursting up the seawall where the ring hits (racing along the
  //      wall from the pier outward), crowned with lumpy spray that arcs over the quay, + splashes along the pier as the
  //      crest slams under its deck. One instanced mesh (on threes), inked foam with a cool blue shade.
  const foamM = ctx.mat.cel(0xfbfdff, { id: ctx.mat.nextId(), shade: 0xa9c4e8, hiAmt: 0.55, hiT: 0.55, rimI: 0.25, spec: 0.0, lock: 0.75 });
  const blobG = new THREE.IcosahedronGeometry(1, 2); { const pp = blobG.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); const k = 1 + 0.14 * Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.2) + 0.06 * Math.sin(v.y * 11 + v.x * 7); v.multiplyScalar(k); pp.setXYZ(i, v.x, v.y, v.z); } blobG.computeVertexNormals(); }
  const BL = [];   // [kind, x, z, size, hFrac, lag, dx, dz, back]
  { const R = ctx.rng(3303);
    for (let x = -170; x <= 170; x += 3.4) { const near = 1 - Math.min(1, Math.abs(x) / 170), H = 7 + 11 * near * near + 3 * R();
      for (let j = 0; j < 4; j++) BL.push([0, x + (R() - 0.5) * 3, SEAWALL_Z + 0.8 + R() * 2.2, (2.4 + 2.0 * R()) * (0.8 + 0.4 * near) * (1 + 0.25 * j), H * (0.18 + 0.27 * j + 0.08 * R()), 0.05 * j + R() * 0.08, (R() - 0.5) * 3, -(0.5 + R() * 3.5) * j / 3, R()]); }
    for (let z = -40; z <= 0; z += 1.5) for (const s of [-1, 1]) for (let j = 0; j < 2; j++) BL.push([1, s * (1.9 + R() * 1.2), z + R() * 1.4, 0.7 + R() * 0.7, 2.5 + 3.5 * R(), R() * 0.1, s * R() * 1.5, (R() - 0.5), R()]); }
  const breakFX = new THREE.InstancedMesh(blobG, foamM, BL.length); breakFX.name = 'ocean-break'; breakFX.frustumCulled = false; sets.sea.add(breakFX);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  const crestAt = (z) => WAVE_T0 + (WAVE_T1 - WAVE_T0) * Math.pow((SPLASH.z - z) / WAVE_D, 1 / 0.72);   // ring passes the pier at z
  function poseBreak(ft) {
    let live = 0;
    BL.forEach(([kind, x, z, size, hf, lag, dx, dz, r], i) => {
      const t0 = (kind === 0 ? waveHitX(x) : crestAt(z)) + lag, dur = kind === 0 ? 2.1 : 1.3, k = (ft - t0) / dur;
      if (k <= 0 || k >= 1) { _m.makeScale(0, 0, 0); breakFX.setMatrixAt(i, _m); return; }
      live++;
      const up = 1 - Math.pow(1 - Math.min(1, k / 0.42), 3), fall = Math.max(0, (k - 0.42) / 0.58);
      const y = (kind === 0 ? WALL_TOP_Y : 0.6) + hf * up - hf * 0.95 * fall * fall;
      _p.set(x + dx * k, y, z + dz * k * (kind === 0 ? 2.2 : 1));
      const s = size * (0.35 + 0.9 * Math.min(1, k * 2.4)) * (1 - 0.55 * fall * fall);
      _s.set(s * (1.05 + 0.25 * r), s * (0.95 + 0.25 * (1 - k)), s * (1 - 0.15 * r)); _q.setFromEuler(_e.set(r * 3, r * 7 + k, r * 5));
      _m.compose(_p, _q, _s); breakFX.setMatrixAt(i, _m);
    });
    breakFX.instanceMatrix.needsUpdate = true; return live;
  }

  const piles = [], boats = [];
  const api = {
    surface: sea, SEAWALL_Z, breakFX, useBreakFX: true,
    height: (x, z, t) => heightJS(x, z, ctx.onThrees(t)),
    normal(x, z, t) { const ft = ctx.onThrees(t), e = 0.4, h = heightJS(x, z, ft), n = new THREE.Vector3(-(heightJS(x + e, z, ft) - h) / e, 1, -(heightJS(x, z + e, ft) - h) / e).normalize(); return [n.x, n.y, n.z]; },
    bulge: (t) => bulgeAt(ctx.onThrees(t)),
    wave: (t) => ({ ...waveAt(ctx.onThrees(t)), hitX: waveHitX }),
    setPiles(list) { piles.length = 0; piles.push(...list.slice(0, 40)); },
    setBoats(list) { boats.length = 0; boats.push(...list.slice(0, 12)); },
    update(t, shot) {
      const ft = ctx.onThrees(t), on = shot.groups.includes('sea');
      uni.uT.value = ft;
      { const s = shot.look.sun.dir, hl = Math.hypot(s[0], s[2]) || 1, el = Math.min(Math.atan2(s[1], hl), 0.24);   // the painted glitter key
        uni.uGlit.value.set(s[0] / hl * Math.cos(el), Math.sin(el), s[2] / hl * Math.cos(el)); }
      uni.uReflOn.value = shot.look.water?.on && shot.look.passes.reflection ? 1 : 0; uni.uRefl.value = ctx.water.reflection.texture;
      uni.uDusk.value = ctx.modules.sky?.dusk ? ctx.modules.sky.dusk(t) : ctx.util.sstep(62.6, 64, t);
      const dk = uni.uDusk.value;
      uni.uDeep.value.copy(C(0x145cc8).lerp(C(0x2a2a8a), dk)); uni.uMid.value.copy(C(0x1f86e0).lerp(C(0x4a4aa8), dk)); uni.uShallow.value.copy(C(0x2cd0cc).lerp(C(0x5a8ab8), dk));
      uni.uLight.value.copy(C(0x9fe0ff).lerp(C(0xffc0a0), dk)); uni.uDark.value.copy(C(0x0a2c86).lerp(C(0x231f6a), dk)); uni.uHorz.value.copy(C(0xbcdcff).lerp(C(0x8a5a92), dk));
      const b = bulgeAt(ft); uni.uBulge.value.set(b.x, b.z, b.r, b.h); uni.uBoil.value = b.boil; uni.uGiant.value = b.giant;
      const w = waveAt(ft); uni.uWave.value.set(w.cx, w.cz, w.rho, w.h); uni.uWaveK.value = ctx.util.sstep(0.6, 1.0, w.k); uni.uWaveT.value = w.k;
      uni.uBreak.value = 0;
      uni.uNP.value = piles.length; piles.forEach((p, i) => uni.uPiles.value[i].set(p[0], p[1], p[2]));
      uni.uNB.value = boats.length; boats.forEach((q, i) => { uni.uBoats.value[i].set(q[0], q[1], q[2], q[3]); uni.uBoatW.value[i] = q[4]; });
      // the break: lobes rise when the ring reaches their spot, then fall back (on threes)
      const show = false;
      breakFX.visible = show && poseBreak(ft) > 0;
    },
    afterCamera() { const c = ctx.camera; uni.uPxA.value = 2 * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2) / (ctx.H || 1080); },
    dispose() { sea.removeFromParent(); breakFX.removeFromParent(); },
  };
  return api;
}
