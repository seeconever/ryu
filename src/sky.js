// RYŪ · SKY (owner: world) — painted skies, towering cumulus, the cloud layer, the stratosphere and the Earth.
//   coast  : high-key summer sky (deep ultramarine zenith -> pale cyan horizon, warm toward the sun, sun disc) blending to a
//            warm colourful dusk over 63-66 s; a ring of towering sculpted cumulus (src/sky-clouds.js) over the hills and the
//            sea + fair-weather cumulus; first stars at dusk.
//   sky    : the same sky seen from 0.5-4 km: a field of cumulus whose tops sit at ~2.6-3.6 km (the giant climbs through
//            them, s21), the MASSIF (a cumulus wall the meteor splits in two, s17) and the sea far below.
//   strato / space : local frame, altitude = y. A painted Earth (ocean, cloud fields, haze) under a bright limb band and a
//            deep-blue (strato) / black (space) sky. VISUAL radius R = 1000 km (exaggerated curvature).
// API (ctx.modules.sky):
//   R                         visual Earth radius used by the strato / space domes (m)
//   sunDir()                  coast sun direction [x, y, z] (= the engine's day look)
//   cloudTop                  top of the sky-set cloud field (m)
//   anchor(name) -> Vector3   'massif' (centre of the cumulus wall, sky set), 'massifTop'
//   dusk(t) -> 0..1           day -> dusk blend for the coast (62.6-64.0 s; ocean, cat and cams/world.js follow it)
//   setSplit(k)               0..1: part the massif into two walls (default: driven by time over s17, kept split after)
//   setHot(pos, color, r)     a hot light inside the clouds (the meteor's glow), reset every frame by update()
//   coastClouds / skyClouds   the cloud systems; their painted key is aimed per frame in afterCamera (CLOUD_KEY overrides)
//   s05 / s07: the sky asks ctx.modules.meteor.sky() to draw the far meteor (white streak / orange point) at S05_STREAK /
//   S07_GLOW and paints an orange halo around the s07 point in the dome
import * as THREE from 'three';
import { createCloudSystem, cumulusTower, cumulusPuff, CLOUD_DAY, CLOUD_DUSK, lerpPalette } from './sky-clouds.js';
import { GEO } from './shots.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);
const DAY = { zen: 0x1648c0, hi: 0x2a66dc, mid: 0x5c9ef2, low: 0x9ccdfb, hor: 0xdcf0ff, horSun: 0xf4f8ff, sun: 0xfff4dc, wisp: 0.55 };
const DUSK = { zen: 0x2a2c86, hi: 0x5246a8, mid: 0xa070b8, low: 0xf2967e, hor: 0xf4a6a0, horSun: 0xffd28a, sun: 0xffc070, wisp: 0.8 };
const DUSK_T0 = 63.46, DUSK_T1 = 63.5;
// s05: the streak travels ~100 px down-left over the shot (world directions from the s05 camera, above the massif)
const S05_STREAK = [0.455, 0.71, 0.537], S05_STREAK_END = [0.53, 0.648, 0.522];
// s07: the glowing point (upper left of the frame) creeps ~40 px over the shot, so it reads as something moving
const S07_GLOW = [-0.735, 0.63, -0.253], S07_GLOW_END = [-0.7565, 0.6096, -0.2479], S07_TAIL = [0.716, 0.679, -0.169];   // falls down-left, tail up-right (s07 screen)
// painted cloud key per shot: the towers always show a lit white (dusk: peach-gold) mass, even when the camera faces the sun
const CLOUD_KEY = {};
const slerpDir = (a, b, k) => new V3().fromArray(a).normalize().lerp(new V3().fromArray(b).normalize(), k).normalize().toArray();
const HIGH = { zen: 0x0f3cb4, hi: 0x2058d4, mid: 0x4a90ee, low: 0x9ccaf8, hor: 0xe6f4ff, horSun: 0xfff8ea, sun: 0xfff8e8, wisp: 0.3 };

function skyDome(ctx, pal) {
  const { glsl } = ctx;
  const u = { uSunDir: { value: new V3(0.3, 0.62, 0.72).normalize() }, uSunCol: { value: C(pal.sun) }, uSunR: { value: 0.0105 }, uWisp: { value: pal.wisp },
    uZen: { value: C(pal.zen) }, uHi: { value: C(pal.hi) }, uMid: { value: C(pal.mid) }, uLow: { value: C(pal.low) }, uHor: { value: C(pal.hor) }, uHorSun: { value: C(pal.horSun) }, uSunK: { value: 1 },
    uHot: { value: new THREE.Vector4(0, 1, 0, 0) }, uHotCol: { value: C(0xff7a2a) }, uHotTail: { value: new V3(0, 1, 0) } };
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: u,
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */`${glsl.NOISE}
      uniform vec3 uSunDir, uSunCol, uZen, uHi, uMid, uLow, uHor, uHorSun, uHotCol, uHotTail; uniform float uSunR, uWisp, uSunK; uniform vec4 uHot; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float e = d.y;
        float sa = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)) * 0.5 + 0.5, sd = dot(d, uSunDir);
        // brushed banding (seamless: noise on the direction, stretched across elevation)
        float bs = (n3(d * vec3(5.0, 70.0, 5.0)) - 0.5) * 0.6 + (n3(d * vec3(20.0, 240.0, 20.0) + 7.0) - 0.5) * 0.4;
        float ee = e + bs * 0.006;
        vec3 hor = mix(uHor, uHorSun, pow(sa, 4.0) * 0.75 + pow(max(sd, 0.0), 5.0) * 0.5);
        vec3 col = mix(hor, uLow, smoothstep(-0.01, 0.07, ee));
        col = mix(col, uMid, smoothstep(0.05, 0.24, ee)); col = mix(col, uHi, smoothstep(0.2, 0.52, ee)); col = mix(col, uZen, smoothstep(0.48, 0.95, ee));
        col = mix(col, mix(uLow, uHorSun, 0.5), pow(max(sd, 0.0), 14.0) * 0.45 * (1.0 - smoothstep(0.1, 0.5, e)));
        col *= 1.0 + bs * 0.035;
        // high cirrus wisps: long brushed streaks, thin, sun-warmed
        vec2 pp = d.xz / max(e + 0.08, 0.03), wp = vec2(dot(pp, vec2(0.8, 0.6)), dot(pp, vec2(-0.6, 0.8)));   // cirrus plane, wind-stretched
        float w = fbm2(wp * vec2(0.45, 2.2) + 3.0) + 0.3 * fbm2(wp * vec2(1.8, 8.8));
        float wm = smoothstep(0.72, 0.86, w) * smoothstep(0.08, 0.2, e) * (1.0 - smoothstep(0.45, 0.75, e)) * uWisp;
        col = mix(col, mix(vec3(1.0), uHorSun, 0.35) * (0.9 + 0.2 * sa), wm * 0.55);
        // sun: crisp disc + glow
        float a = acos(clamp(sd, -1.0, 1.0));
        col += uSunCol * uSunK * (smoothstep(uSunR * 1.12, uSunR * 0.95, a) * 7.0 + exp(-a * 7.0) * 0.35 + exp(-a * 30.0) * 0.6);
        // a hot point of the sky (the meteor still far away, s07): a wide pale-gold veil (lightens the blue, never muddies it
        // toward magenta), then a smooth warm-orange radial halo, no ring edge
        if (uHot.w > 0.0) { float ha = acos(clamp(dot(d, uHot.xyz), -1.0, 1.0));
          col = mix(col, vec3(1.0, 0.93, 0.8), clamp(exp(-ha * 14.0) * 0.32 * uHot.w, 0.0, 1.0));
          col = mix(col, uHotCol * (1.1 + 1.6 * exp(-ha * 70.0)), clamp((exp(-ha * 42.0) * 0.7 + exp(-ha * 95.0) * 0.4) * uHot.w, 0.0, 0.95));
          // its short burning tail (back along its path): a tapered warm streak with a soft glow, so it reads as moving
          vec3 T = uHotTail, HT = uHot.xyz - T; float sk = clamp(dot(d - T, HT) / max(dot(HT, HT), 1e-8), 0.0, 1.0), dl = length(d - T - HT * sk);
          float tw = mix(0.0008, 0.0048, sk);
          col = mix(col, mix(uHotCol, vec3(1.0, 0.92, 0.65), sk * sk) * (1.1 + sk), clamp((smoothstep(tw, tw * 0.4, dl) + exp(-dl / (tw * 2.5)) * 0.45) * pow(sk, 0.9) * uHot.w, 0.0, 0.97)); }
        gl_FragColor = vec4(col, 1.0); }` });
  glsl.mrt(m, { id: 0, sky: true });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50000, 64, 32), m); dome.frustumCulled = false; dome.renderOrder = -10; dome.raycast = () => {};
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  dome.setHot = (dir, k, col = 0xff7a2a, tail = null) => { if (!dir || !(k > 0)) { u.uHot.value.w = 0; return; } const v = new V3().fromArray(dir).normalize(); u.uHot.value.set(v.x, v.y, v.z, k); u.uHotCol.value.set(col);
    u.uHotTail.value.copy(tail ? new V3().fromArray(tail).normalize() : v); };
  dome.setPal = (p) => { for (const k of ['zen', 'hi', 'mid', 'low', 'hor', 'horSun']) u['u' + k[0].toUpperCase() + k.slice(1)].value.copy(p[k]); u.uSunCol.value.copy(p.sun); u.uWisp.value = p.wisp; };
  return dome;
}
const lerpPal = (a, b, k) => { const o = {}; for (const key of ['zen', 'hi', 'mid', 'low', 'hor', 'horSun', 'sun']) o[key] = C(a[key]).lerp(C(b[key]), k); o.wisp = a.wisp + (b.wisp - a.wisp) * k; return o; };

// Earth seen from the stratosphere / space: analytic sphere (visual radius R). Painted, saturated: deep-blue ocean with
// current streaks, a coastline (island chain, shallows), cloud systems (cumulus fields + one spiral storm in view of s22),
// and crisp limb bands (white line, cyan, deep blue) instead of an airbrushed glow.
function earthDome(ctx, R, { zen, mid, limb, hot, space }) {
  const { glsl } = ctx;
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uR: { value: R }, uSun: { value: new V3(0.5, 0.35, 0.8).normalize() }, uZen: { value: C(zen) }, uMidC: { value: C(mid) }, uLimb: { value: C(limb) }, uHot: { value: C(hot) },
      uSpace: { value: space }, uOcean: { value: C(0x0d3aa6) }, uOcean2: { value: C(0x1d62cc) }, uShallow: { value: C(0x2aa6c8) }, uLand: { value: C(0x4f8a46) }, uLand2: { value: C(0xb89a64) },
      uCyan: { value: C(0x6ad4ff) }, uCloud: { value: C(0xffffff) }, uCloudSh: { value: C(0x9aa4e0) }, uNight: { value: C(0x0c1436) },
      uStorm: { value: new V3(-0.09, 0.993, -0.07).normalize() } },
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */`${glsl.NOISE}
      uniform float uR, uSpace; uniform vec3 uSun, uZen, uMidC, uLimb, uHot, uOcean, uOcean2, uShallow, uLand, uLand2, uCyan, uCloud, uCloudSh, uNight, uStorm; varying vec3 vD;
      // cloud systems (~40 km) broken into cumulus fields (~8 km) and puffs (~2 km), plus a spiral storm
      float clouds(vec3 p){
        float c = fbm3(p * 24.0) * 0.55 + fbm3(p * 110.0 + 4.0) * 0.3 + fbm3(p * 480.0 + 9.0) * 0.15;
        vec3 q = p - uStorm * dot(p, uStorm); vec3 ta = normalize(cross(uStorm, vec3(0.0, 0.0, 1.0))), tb = cross(uStorm, ta);
        vec2 l = vec2(dot(q, ta), dot(q, tb)) / 0.034; float r = length(l), a = atan(l.y, l.x);
        float arms = sin(a * 2.0 + log(max(r, 0.02)) * 5.0) * 0.5 + 0.5;
        float storm = (smoothstep(1.0, 0.35, r) * (0.45 + 0.55 * arms) + smoothstep(0.18, 0.08, r) * 0.6) * (1.0 - smoothstep(0.03, 0.0, r) * 0.9);
        return max(c, 0.42 + storm * 0.3 + (fbm3(p * 300.0) - 0.5) * 0.08 * storm); }
      void main(){ vec3 d = normalize(vD); vec3 o = cameraPosition + vec3(0.0, uR, 0.0); float r0 = length(o); vec3 up = o / r0;
        float hc = -sqrt(max(0.0, 1.0 - uR * uR / (r0 * r0))), e = dot(d, up), above = e - hc, k = above / (1.0 - hc);
        float sa = dot(normalize(d - up * e + 1e-5), normalize(uSun - up * dot(uSun, up) + 1e-5)) * 0.5 + 0.5;
        float bn = n3(d * 90.0) - 0.5;
        // sky over the limb: crisp painted bands (white line, cyan, deep blue) on the zenith colour + a faint airglow
        vec3 col = mix(uMidC, uZen, smoothstep(0.08, mix(0.5, 0.3, uSpace), k));
        col = mix(col, mix(uMidC, uCyan, 0.35), smoothstep(0.072, 0.064, above + bn * 0.003));
        col = mix(col, uCyan, smoothstep(0.028, 0.023, above + bn * 0.002));
        col = mix(col, uLimb, smoothstep(0.0085, 0.0065, above));
        col += uHot * exp(-max(above, 0.0) * mix(60.0, 200.0, uSpace)) * 0.12 * (0.7 + 0.5 * sa);
        float b = dot(o, d), c = r0 * r0 - uR * uR, disc = b * b - c;
        if (disc > 0.0 && -b - sqrt(disc) > 0.0) {
          vec3 p = normalize(o + d * (-b - sqrt(disc)));
          float below = -above, lit = smoothstep(-0.08, 0.12, dot(p, uSun));
          // ocean: deep saturated blue, painted current streaks
          vec3 s = mix(uOcean, uOcean2, smoothstep(0.4, 0.75, fbm3(p * vec3(40.0, 40.0, 120.0))) * 0.7);
          // coastline hint: an island chain with shallows
          float ln = fbm3(p * 16.0 + 2.0) * 0.75 + fbm3(p * 90.0 + 7.0) * 0.25;
          s = mix(s, uShallow, smoothstep(0.585, 0.615, ln) * 0.8);
          s = mix(s, mix(uLand, uLand2, smoothstep(0.45, 0.6, fbm3(p * 200.0))), smoothstep(0.618, 0.624, ln));
          // clouds: two flat tones split by a hard terminator on the slope toward the sun
          float cv = clouds(p), e1 = 0.002, cvx = clouds(p + vec3(e1, 0.0, 0.0)), cvz = clouds(p + vec3(0.0, 0.0, e1));
          float cm = smoothstep(0.52, 0.535, cv + (n3(p * 1800.0) - 0.5) * 0.015);
          vec3 tg = normalize(cross(p, vec3(0.0, 1.0, 0.0)) + 1e-5); float slope = dot(vec2(cvx - cv, cvz - cv), normalize(vec2(dot(uSun, tg), dot(uSun, cross(tg, p))) + 1e-5));
          vec3 cc = mix(uCloudSh, uCloud, smoothstep(-0.001, 0.0015, -slope + (cv - 0.6) * 0.02));
          s = mix(s, cc, cm);
          s = mix(uNight, s, lit);
          // the atmosphere over the surface near the limb: a deep-blue haze band, then the cyan rim (crisp edges)
          s = mix(s, mix(uOcean2, uCyan, 0.25), smoothstep(0.05, 0.04, below + bn * 0.003) * 0.55);
          s = mix(s, uCyan, smoothstep(0.014, 0.01, below) * 0.85);
          col = s; }
        gl_FragColor = vec4(col, 1.0); }` });
  glsl.mrt(m, { id: 0, sky: true });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50000, 96, 48), m); dome.frustumCulled = false; dome.renderOrder = -10; dome.raycast = () => {};
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  return dome;
}

export async function create(ctx) {
  const { THREE: T, kit, sets, glsl, util, rng } = ctx;
  // ---- coast: sky dome + towering cumulus ring + fair-weather cumulus + dusk stars -------------------------------------
  const coastSky = skyDome(ctx, DAY); sets.sea.add(coastSky);
  const R1 = rng(3201), coastClouds = [];
  // [x, z, w, h, lean, anvil]: an asymmetric sky — over the sea (s14, s30) one massive anvil tower + smaller ones
  const towers = [[-5200, -14500, 5600, 8800, [0.05, 0.02], 0], [2600, -11500, 4200, 6400, [-0.04, 0.0], 0], [9500, -16500, 5200, 7800, [0.03, -0.02], 0], [-12500, -9000, 3800, 5200, [0.06, 0.0], 0],
    [-9800, 19500, 4000, 5200, [0.02, 0.0], 0], [4200, 22500, 8800, 11800, [-0.03, 0.02], 0.55], [13500, 13500, 4600, 6400, [0.04, 0.0], 0], [-17000, 5000, 4200, 6200, [0.0, 0.0], 0],
    [17500, -3000, 4400, 5800, [-0.05, 0.0], 0], [-2000, -24000, 6000, 9000, [0.02, 0.0], 0], [-3600, 15000, 2600, 3000, [0.0, 0.0], 0], [1500, 17000, 3400, 3300, [0.02, 0.0], 0]];
  for (const [x, z, w, h, lean, anvil] of towers) coastClouds.push(cumulusTower(R1, { x, z, base: 1000 + R1() * 400, w, h, lean, anvil }));
  for (let i = 0; i < 26; i++) { const a = R1() * Math.PI * 2, r = 2600 + Math.pow(R1(), 0.7) * 9000, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 500 + R1() * 1300; coastClouds.push(cumulusPuff(R1, { x, z, base: 850 + R1() * 300, w, h: w * (0.45 + 0.35 * R1()) })); }
  const coastCS = createCloudSystem(ctx, coastClouds, { name: 'coast-cumulus' }); sets.sea.add(coastCS.mesh);
  const stars = kit.starField({ count: 900, radius: 42000, seed: 32, minE: 0.18, size: [0.8, 2.6], bright: 1.2, mask: 0.2 }); stars.visible = false; sets.sea.add(stars);

  // ---- sky set: cumulus field around the climb + the massif + the sea far below -----------------------------------------
  const skySky = skyDome(ctx, HIGH); sets.sky.add(skySky);
  const R2 = rng(3202), skyClouds = [];
  const MASSIF = { x: 3200, z: 9500, base: 1400, w: 7600, h: 8600 };
  skyClouds.push(cumulusTower(R2, { x: MASSIF.x, z: MASSIF.z, base: MASSIF.base, w: MASSIF.w, h: MASSIF.h, lean: [-0.02, 0.0], crown: 1.1 }));
  skyClouds.push(cumulusTower(R2, { x: MASSIF.x - 4800, z: MASSIF.z + 2500, base: 1400, w: 4600, h: 6200, lean: [0.03, 0] }));
  skyClouds.push(cumulusTower(R2, { x: MASSIF.x + 5200, z: MASSIF.z + 1800, base: 1400, w: 5000, h: 6800, lean: [-0.03, 0] }));
  const far = [[-9000, 14000, 6000, 8000], [14000, 6000, 5200, 7000], [-14000, -6000, 5600, 7400], [6000, -15000, 6400, 8600], [-4000, -13000, 4800, 6000], [16000, -9000, 5000, 6400]];
  for (const [x, z, w, h] of far) skyClouds.push(cumulusTower(R2, { x, z, base: 1400 + R2() * 200, w, h }));
  const CLOUD_TOP = 3300;
  for (let i = 0; i < 44; i++) { const a = R2() * Math.PI * 2, r = 350 + Math.pow(R2(), 0.75) * 6500, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 600 + R2() * 1500, h = (CLOUD_TOP - 1500) * (0.55 + 0.6 * R2());
    if (Math.hypot(x - MASSIF.x, z - MASSIF.z) < 4800 || Math.hypot(x + 7200, z + 2400) < 3600) continue;   // (clear of the massif and of the s05 camera)
    skyClouds.push(w > 1500 && R2() < 0.4 ? cumulusTower(R2, { x, z, base: 1500, w, h: Math.min(h * 1.5, 1820), budget: 110 }) : cumulusPuff(R2, { x, z, base: 1500, w, h, budget: 72 })); }
  for (const c of skyClouds) for (const s of c.spheres) { s[0] += GEO.SKY.x; s[2] += GEO.SKY.z; }   // the shader ray-traces the spheres in world space: offset the data, never the mesh
  const skyCS = createCloudSystem(ctx, skyClouds, { name: 'sky-cumulus' }); sets.sky.add(skyCS.mesh);
  const seaFar = new T.Mesh(new T.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2), ctx.mat.bg(0x1d5cc0, { pig: 0.25, brush: 0.1, hiAmt: 0 }));
  sets.sky.add(seaFar);

  // ---- strato + space -------------------------------------------------------------------------------------------------
  const R = 1000000;

  // ---- storm placeholder (world team): a dome, a wall of indigo cloud at GEO.STORM.z, a dark sea --------------------------
  // the wall is two cloud systems: the dark indigo face, and a thin sunlit lavender crown high above it
  const CLOUD_STORM = { lit: 0x8a80d4, mid: 0x564da8, shade: 0x2d2880, deep: 0x181450, under: 0x181450, rim: 0xc0baff, term: -0.12, rimK: 0.7, aoK: 1.1, macro: 0.6 };
  const CLOUD_CROWN = { lit: 0xf4eeff, mid: 0xb9b0ea, shade: 0x6660b4, deep: 0x3a3488, under: 0x3a3488, rim: 0xffffff, term: -0.08, rimK: 0.8, aoK: 1.0, macro: 0.4 };
  const CLOUD_INNER = { lit: 0x8c82d8, mid: 0x5e56b4, shade: 0x38328c, deep: 0x1f1b62, under: 0x201c66, rim: 0xb4aef0, term: -0.1, rimK: 0.6, aoK: 1.1, macro: 0.6 };
  const STORM = { zen: 0x14123f, hi: 0x1c1a58, mid: 0x28246e, low: 0x38348a, hor: 0x4a46a0, horSun: 0x5a56ac, sun: 0xb8b8e8, wisp: 0.05 };
  const stormSky = skyDome(ctx, STORM); sets.storm.add(stormSky);
  const R3 = rng(3604), stormClouds = [], Z = GEO.STORM.z;
  // the face: tall overlapping towers across the whole horizon (no sky between them), an anvil overhang high up
  for (let i = -13; i <= 13; i++) { if (Math.abs(i) < 1) continue; const x = (Math.abs(i) === 1 ? i * 3700 : i * 2300 + Math.sign(i) * 1400) + (R3() - 0.5) * 700, z = Z + 1000 + 500 * (i % 2) + R3() * 700;
    stormClouds.push(cumulusTower(R3, { x, z, base: 80, w: 3900 + R3() * 1300, h: 10500 + R3() * 3500, lean: [(R3() - 0.5) * 0.06, -0.02], anvil: i % 3 === 0 ? 0.5 : 0, budget: 110 })); }
  stormClouds.push(cumulusTower(R3, { x: 0, z: 17500, base: 200, w: 7000, h: 11000, budget: 110 }));
  // interior canyon (|x| 500-2600 either side of the corridor), and scud columns close enough to whip past
  for (let z = 9700; z < 15000; z += 780) for (const s of [-1, 1]) { const w = 1200 + R3() * 1100; stormClouds.push(cumulusTower(R3, { x: s * (w * 0.55 + 620 + R3() * 700), z: z + R3() * 300, base: 40, w, h: 4200 + R3() * 3000, budget: 80 })); }
  const stormCS = createCloudSystem(ctx, stormClouds, { name: 'storm-wall', palette: CLOUD_STORM }); sets.storm.add(stormCS.mesh);
  const innerClouds = [];
  for (let i = 0; i < 70; i++) { const z = 8700 + i * 95 + R3() * 60, y = 120 + R3() * 1500, w = 240 + R3() * 520; const s = i % 2 ? 1 : -1, x = (s > 0 ? 260 : -340) + s * (w * 0.55 + Math.pow(R3(), 1.5) * 560);
    innerClouds.push(cumulusPuff(R3, { x, z, base: y, w, h: w * (0.7 + 0.4 * R3()), budget: 44 })); }
  for (let i = 0; i < 40; i++) { const z = 8600 + R3() * 6200, x = (R3() - 0.5) * 4200, w = 900 + R3() * 1300; innerClouds.push(cumulusPuff(R3, { x, z, base: 2300 + R3() * 700, w, h: w * 0.5, budget: 56 })); }   // ceiling
  const innerCS = createCloudSystem(ctx, innerClouds, { name: 'storm-inner', palette: CLOUD_INNER }); sets.storm.add(innerCS.mesh);
  // the centre of the face closes the corridor (outside views only: hidden once the camera is inside the storm)
  const faceClouds = [cumulusTower(R3, { x: 0, z: Z + 2900, base: 60, w: 6800, h: 12500, budget: 130 }), cumulusTower(R3, { x: 1400, z: Z + 1500, base: 60, w: 3000, h: 8000, budget: 90 }), cumulusTower(R3, { x: -1500, z: Z + 1300, base: 60, w: 3000, h: 9000, budget: 90 })];
  const faceCS = createCloudSystem(ctx, faceClouds, { name: 'storm-face', palette: CLOUD_STORM }); sets.storm.add(faceCS.mesh);
  const R3b = rng(3605), crownClouds = [];
  for (let i = -6; i <= 6; i++) crownClouds.push(cumulusTower(R3b, { x: i * 4400 + (R3b() - 0.5) * 1400, z: Z + 1200 + R3b() * 900, base: 9200 + R3b() * 1600, w: 3600 + R3b() * 2600, h: 2600 + R3b() * 1800, budget: 70, crown: 1.2 }));
  const crownCS = createCloudSystem(ctx, crownClouds, { name: 'storm-crown', palette: CLOUD_CROWN }); sets.storm.add(crownCS.mesh);
  // behind the face: a dark sheet that keeps the sky out of the gaps between the towers (seen from the sea only)
  const wallBack = new T.Mesh(new T.PlaneGeometry(70000, 13000), ctx.mat.bg(0x1a1860, { pig: 0.2, brush: 0.12, hiAmt: 0, soft: 0.2 })); wallBack.position.set(0, 6400, Z + 900); wallBack.material.side = T.DoubleSide; wallBack.name = 'storm-back'; sets.storm.add(wallBack);
  const stormSea = new T.Mesh(new T.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2), ctx.mat.bg(0x17174f, { pig: 0.25, brush: 0.1, hiAmt: 0 })); sets.storm.add(stormSea);

  // rain (overlay, screen-space, on twos): three layers of hard slanted strokes, lavender. Environment 'storm' only.
  const rain = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: { uT: { value: 0 }, uK: { value: 0 }, uRes: { value: new T.Vector2(ctx.W, ctx.H) } }, transparent: true, depthTest: false, depthWrite: false,
    blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.SrcAlphaFactor, blendDst: T.OneMinusSrcAlphaFactor,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`uniform float uT, uK; uniform vec2 uRes;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      float layer(vec2 uv, float cols, float slant, float speed, float len, float width, float seed){ vec2 p = uv; p.x += p.y * slant; float cx = p.x * cols, id = floor(cx), f = cx - id;
        float h = hash(id + seed), y = p.y * 3.0 + uT * speed * (0.8 + 0.5 * h) + h * 17.0, cell = fract(y); float vis = step(0.45, hash(id * 2.3 + seed + floor(y)));
        float x = abs(f - 0.5 - (h - 0.5) * 0.3) * 2.0; return vis * smoothstep(width, width * 0.5, x) * smoothstep(0.0, 0.05, cell) * smoothstep(len, len * 0.7, cell); }
      void main(){ vec2 uv = gl_FragCoord.xy / uRes.y; float a = layer(uv, 34.0, 0.32, 7.0, 0.55, 0.16, 1.0) * 0.5 + layer(uv * 1.4 + 0.2, 62.0, 0.4, 11.0, 0.42, 0.14, 7.0) * 0.28 + layer(uv * 2.1 + 0.5, 110.0, 0.46, 16.0, 0.34, 0.14, 13.0) * 0.16;
        gl_FragColor = vec4(0.82, 0.8, 1.0, a * uK); }` }));
  rain.frustumCulled = false; rain.renderOrder = 900; rain.name = 'rain'; rain.visible = false; ctx.overlay.add(rain);
  // a flash inside the cloud (ramped over 3 frames); fx/lightning can call api.flash(pos, k) on top of the built-in s20 flashes
  // the sky flash follows fx.flash exactly: no separate timers (0..1 normalised against the strike peak)
  const flashK = (t) => Math.min(1, (ctx.modules.fx?.flash?.(t) ?? 0) / 0.34);

  // ---- the sea of cloud above the storm (sky set, s24-s25; hidden at dusk): dense carpet of cumulus + a white deck ----------
  const R4 = rng(3606), carpetClouds = [];
  for (let i = 0; i < 460; i++) { const a = R4() * Math.PI * 2, r = 500 + Math.pow(R4(), 0.55) * 14000, x = Math.cos(a) * r, z = Math.sin(a) * r, w = 1100 + R4() * 2200; carpetClouds.push(cumulusPuff(R4, { x, z, base: 2250 + R4() * 200, w, h: 620 + R4() * 300, budget: 44 })); }
  for (const c of carpetClouds) for (const s of c.spheres) { s[0] += GEO.SKY.x; s[2] += GEO.SKY.z; }
  const carpetCS = createCloudSystem(ctx, carpetClouds, { name: 'cloud-sea', palette: CLOUD_DAY }); sets.sky.add(carpetCS.mesh);
  const deck = new T.Mesh(new T.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2), ctx.mat.bg(0xd0d8f6, { pig: 0.2, brush: 0.14, hiAmt: 0.05 })); deck.position.set(GEO.SKY.x, 2380, GEO.SKY.z); deck.name = 'cloud-deck'; sets.sky.add(deck);
  const seaDay = C(0x1d5cc0), seaDusk = C(0x9a5e88);

  // ---- state ----------------------------------------------------------------------------------------------------------
  let split = 0, splitOverride = null, flashOverride = null;
  const massifRow = 0, massifCx = MASSIF.x;
  const splitFn = (k) => k > 0 ? (row, x, y) => row === massifRow ? [Math.sign(x - massifCx + 1e-3) * k * 1900 * (0.55 + 0.45 * util.sstep(MASSIF.base, MASSIF.base + MASSIF.h, y)), 0, 0] : null : null;
  const api = {
    R, cloudTop: CLOUD_TOP, coastClouds: coastCS, skyClouds: skyCS, MASSIF,
    sunDir: () => [0.3, 0.62, 0.72],
    anchor(name) {
      if (name === 'massif') return new V3(MASSIF.x + GEO.SKY.x, MASSIF.base + MASSIF.h * 0.45, MASSIF.z + GEO.SKY.z);
      if (name === 'massifTop') return new V3(MASSIF.x + GEO.SKY.x, MASSIF.base + MASSIF.h, MASSIF.z + GEO.SKY.z);
      return new V3();
    },
    setSplit(k) { splitOverride = k; },
    setHot(pos, color = 0xff8a3a, radius = 6000) { skyCS.setHot(pos, color, radius); },
    flash(pos, k = 1, color = 0xd8d2ff, radius = 3000) { flashOverride = k; innerCS.setHot(pos, color, radius * k); stormCS.setHot(pos, color, radius * k * 1.3); },   // storm lightning glow (call from fx update)
    flashK, stormClouds: stormCS,
    // day -> dusk (complete by s30's first frame: the strato shots s22-s29 hide the change)
    dusk: (t) => util.sstep(DUSK_T0, DUSK_T1, t),
    update(t, shot) {
      const g = shot.groups, dusk = api.dusk(t);
      stormSky.visible = stormSea.visible = shot.env === 'storm';
      wallBack.visible = faceCS.mesh.visible = shot.env !== 'storm'; crownCS.mesh.visible = shot.env !== 'storm'; innerCS.mesh.visible = shot.env === 'storm';
      rain.visible = shot.env === 'storm'; rain.material.uniforms.uT.value = ctx.onTwos(t); rain.material.uniforms.uK.value = shot.look.rainK ?? 1;
      if (shot.env === 'storm' && flashOverride == null) { const hk = flashK(t), h = ctx.modules.dragon?.anchor?.('head', t); if (hk > 0.01 && h) { const hot = [h.x + 300, h.y + 300, h.z + 500]; innerCS.setHot(hot, 0xcfc8ff, 2400 * hk); stormCS.setHot(hot, 0xcfc8ff, 3200 * hk); } else { innerCS.setHot(null); stormCS.setHot(null); } }
      flashOverride = null;
      splitOverride = null; skyCS.setHot(null); coastSky.setHot(null);
      const sun = new V3().fromArray(shot.look.sun.dir).normalize();
      // the far meteor before it arrives: s05 a tiny white streak high above the massif, s07 one point of the sky glows orange
      // (the meteor department draws the streak / point at our direction; the sky adds the orange halo around it)
      // dusk flight (s26): the sky set borrows the coast dusk (sea, cumulus, dome): the sets.sea group is forced on
      const duskSky = g.includes('sky') && dusk > 0.01; if (duskSky) ctx.sets.sea.visible = true;
      skySky.visible = seaFar.visible = skyCS.mesh.visible = deck.visible = carpetCS.mesh.visible = !duskSky;
      if (g.includes('sea') || duskSky) {
        coastSky.setPal(lerpPal(DAY, DUSK, dusk)); coastSky.material.uniforms.uSunDir.value.copy(sun);
        coastCS.palette(lerpPalette(CLOUD_DAY, CLOUD_DUSK, dusk));
        stars.visible = dusk > 0.05; stars.material.uniforms.uB.value = 1.1 * util.sstep(0.3, 1, dusk);
      }
      if (g.includes('sky')) {
        skySky.setPal(lerpPal(HIGH, DUSK, dusk)); skySky.material.uniforms.uSunDir.value.copy(sun);
        skyCS.palette(lerpPalette(CLOUD_DAY, CLOUD_DUSK, dusk));
        carpetCS.mesh.visible = deck.visible = dusk < 0.01;
        seaFar.material.uniforms.uBase.value.copy(seaDay).lerp(seaDusk, dusk); seaFar.material.uniforms.uShade.value.copy(seaFar.material.uniforms.uBase.value).multiplyScalar(0.8);
      }
    },
    afterCamera(t, shot) {
      // the painted cloud key: from the sun's side of the frame, above and slightly behind the camera, so every tower shows
      // ~60 % lit white (dusk: peach-gold) mass and ~40 % lavender shadow (CLOUD_KEY overrides per shot)
      { const cam = ctx.camera, Rv = new V3(), U = new V3(), F = new V3(); cam.matrixWorld.extractBasis(Rv, U, F);   // F = toward the camera
        Rv.y = 0; Rv.normalize(); const sun = new V3().fromArray(shot.look.sun.dir), side = sun.dot(Rv) < -0.05 ? -1 : 1;
        const key = CLOUD_KEY[shot.id] ?? Rv.multiplyScalar(side * 0.62).add(new V3(0, 0.66, 0)).addScaledVector(new V3(F.x, 0, F.z).normalize(), 0.3).normalize().toArray();
        coastCS.setKey(key); skyCS.setKey(key); stormCS.setKey(key); faceCS.setKey(key); innerCS.setKey(key); crownCS.setKey([0.25, 0.8, -0.5]); carpetCS.setKey([0.62, 0.42, 0.55]); }
      if (deck.visible && ctx.camera.position.y < 2340) deck.visible = false;   // the deck is a floor: only from above
      // a split requested by another department during its update (after ours) is applied here, before the render
      if (splitOverride != null && shot.groups.includes('sky') && splitOverride !== split) { split = splitOverride; skyCS.setOffsets(splitFn(split)); }
    },
    dispose() {},
  };
  return api;
}
