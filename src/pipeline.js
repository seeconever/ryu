// RYŪ · the multi-pass anime pipeline (owner: engine).
//
//   shadow      character-only shadow map (LOOK.shadow: casters = ctx.shadowRoots), painted lighting: cel + bg materials
//               drop to their shade tone inside it
//   reflection  mirrored camera across the water plane (LOOK.water.on) -> ctx.water.reflection {texture, matrix}
//   main (MRT)  colour (a = paint mask) + data (view normal, linear depth, material id), MSAA
//   paint       depth-aware anisotropic Kuwahara + brush strokes + paper on BG pixels only, world-anchored
//   ink         lines on CEL pixels only from silhouette / id / normal edges, pressure noise, thickness by distance
//   water       slot for full-screen passes from departments (addPass('water', ...)); none by default
//   atmosphere  height haze + sun scatter, sea mist, light shafts
//   overlay     the overlay scene (drawn energy, lightning, water FX), soft depth vs the main pass
//   bloom       UnrealBloom on HDR emissives
//   grade       high-key anime grade, flash / fade, paper tooth, grain, sRGB -> output target
//   present     output target(s) -> canvas (crossfade between two outputs for dissolves)
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { U, SKY_DEPTH, ensureMRT } from './pipeline-glsl.js';
import { FSQ_VS, TENSOR_FS, TBLUR_FS, PAINT_FS, INK_FS, ATMOS_FS, GRADE_FS, PRESENT_FS, DEBUG_FS, camUniforms } from './pipeline-passes.js';

const C = (c) => (c instanceof THREE.Color ? c.clone() : new THREE.Color(c));
const V3 = THREE.Vector3;

// Default LOOK (bright high-key summer day). Shot LOOKs override any field (deep-merged).
export const BASE_LOOK = {
  sun: { dir: [0.35, 0.75, 0.55], color: 0xfff6ea, k: 1.0 },
  amb: { sky: 0xb4c4ff, ground: 0x9c8e86, k: 0.95 },
  rim: { dir: [-0.4, 0.3, -0.85], color: 0xfff4e6, k: 1.0 },
  hero: { dir: [-0.45, 0.7, 0.6], color: 0xfff4ea, k: 1.0 },
  haze: { color: 0xc8dcff, density: 0.00035, h0: 0, falloff: 0.0012, max: 0.75, sunScatter: 0.35, sky: 0.25 },
  mist: { k: 0, height: 6, color: 0xe8f0ff },
  shafts: { on: false, pos: null, k: 0.5, decay: 0.965, density: 0.9, thr: 0.75, occ: 0, radius: 0.45, tint: 0xfff0d8 },
  water: { on: false, level: 0, scale: 0.5 },
  shadow: null,                              // { center: [x,y,z], radius, dir?: [x,y,z] (default sun), k, bias }
  paint: { k: 1, radius: 4, q: 8, hard: 1, aniso: 1, stroke: 0.08, strokeLen: 1.6, wobble: 2.0, vary: 0.10, hue: 0.10, paper: 0.05, depthK: 8 },
  ink: { k: 1, width: 2.6, color: 0x2a1a22, min: 0.55, max: 1.6, ref: null, depthThr: 0.02, normThr: 0.6, inner: 0.5, tint: 0.4, press: 0.45 },
  bloom: { strength: 0.45, radius: 0.5, threshold: 1.05 },
  grade: { expo: 1.0, sat: 1.12, knee: 0.8, gamma: 1.0, contrast: 1.04, vignette: 0.12, grain: 0.022, paper: 0.045, halation: 0.12, halThr: 1.0, ca: 0.6,
    lift: 0x020308, shTint: 0xeef0ff, hiTint: 0xfffaf2, halCol: 0xff7040, tint: 0xffffff, flash: 0, flashCol: 0xffffff, fade: 0, fadeCol: 0x000000 },
  background: 0x000000,                     // main-pass clear colour (pixels nothing covers; treated as sky)
  passes: { shadow: true, reflection: true, paint: true, ink: true, atmosphere: true, overlay: true, bloom: true },
};
export function mergeLook(...ls) {
  const out = {};
  for (const l of ls) { if (!l) continue; for (const [k, v] of Object.entries(l)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v.isVector3 || v.isColor) && out[k] && typeof out[k] === 'object') out[k] = mergeLook(out[k], v);
    else out[k] = v; } }
  return out;
}

export class Pipeline {
  constructor(renderer, { width = 1920, height = 1080, samples = 4, shadowSize = 2048 } = {}) {
    this.r = renderer; this.samples = samples; this.slots = { water: [], atmosphere: [] };
    this.fsq = new FullScreenQuad(null);
    const SM = (fs, u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: FSQ_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
    this.cam = camUniforms();
    const common = () => ({ tDiffuse: { value: null }, tData: { value: null }, uRes: { value: new THREE.Vector2() }, ...this.cam });
    this.tensor = SM(TENSOR_FS, { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2() } });
    this.tblur = SM(TBLUR_FS, { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.paint = SM(PAINT_FS, { ...common(), tT: { value: null }, uK: { value: 1 }, uQ: { value: 8 }, uHard: { value: 1 }, uRad: { value: 4 }, uAlpha: { value: 1 },
      uStroke: { value: 0.08 }, uStrokeL: { value: 1.6 }, uWob: { value: 2 }, uVary: { value: 0.1 }, uHue: { value: 0.1 }, uPaper: { value: 0.05 }, uDepthK: { value: 8 } });
    this.ink = SM(INK_FS, { ...common(), uW: { value: 2.2 }, uK: { value: 1 }, uMinW: { value: 0.55 }, uMaxW: { value: 1.6 }, uRefD: { value: 10 }, uDepthThr: { value: 0.02 },
      uNormThr: { value: 0.6 }, uInner: { value: 0.5 }, uTint: { value: 0.45 }, uPress: { value: 0.6 }, uPxS: { value: 1 }, uInk: { value: new THREE.Color() } });
    this.atmos = SM(ATMOS_FS, { ...common(), uTime: { value: 0 }, uHazeCol: { value: new THREE.Color() }, uSunDir: { value: new V3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
      uHazeD: { value: 0 }, uHazeH0: { value: 0 }, uHazeHK: { value: 0 }, uHazeMax: { value: 0.8 }, uSunScat: { value: 0 }, uSkyHaze: { value: 0 },
      uMist: { value: 0 }, uMistH: { value: 6 }, uMistCol: { value: new THREE.Color() },
      uLight: { value: new THREE.Vector2(0.5, 0.5) }, uRaysOn: { value: 0 }, uRaysK: { value: 0.5 }, uRaysDecay: { value: 0.965 }, uRaysDen: { value: 0.9 }, uRaysThr: { value: 0.75 },
      uRaysOcc: { value: 0 }, uRaysRad: { value: 0.45 }, uAsp: { value: 16 / 9 }, uRaysTint: { value: new THREE.Color() } });
    this.grade = SM(GRADE_FS, { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2() }, ...this.cam, uExpo: { value: 1 }, uSat: { value: 1.1 }, uKnee: { value: 0.8 },
      uHal: { value: 0.1 }, uHalThr: { value: 1 }, uCA: { value: 0.6 }, uVig: { value: 0.12 }, uGrain: { value: 0.02 }, uPaper: { value: 0.04 }, uGamma: { value: 1 }, uSeed: { value: 0 },
      uFlash: { value: 0 }, uFade: { value: 0 }, uPxS: { value: 1 }, uContrast: { value: 1 }, uHalCol: { value: new THREE.Color() }, uLift: { value: new THREE.Color() },
      uShTint: { value: new THREE.Color() }, uHiTint: { value: new THREE.Color() }, uFadeCol: { value: new THREE.Color() }, uTint: { value: new THREE.Color(1, 1, 1) }, uFlashCol: { value: new THREE.Color(1, 1, 1) } });
    this.presentM = SM(PRESENT_FS, { tA: { value: null }, tB: { value: null }, uMix: { value: 0 } });
    this.debugM = SM(DEBUG_FS, { tDiffuse: { value: null }, tData: { value: null }, uMode: { value: 0 } }); this.debug = null;   // 'id' | 'depth' | 'normal' | 'mask' | 'raw'
    // shadow map
    this.shadowRT = new THREE.WebGLRenderTarget(shadowSize, shadowSize, { depthBuffer: true });
    this.shadowRT.depthTexture = new THREE.DepthTexture(shadowSize, shadowSize); this.shadowRT.depthTexture.type = THREE.UnsignedIntType;
    this.shadowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100); this.shadowCam.layers.set(30);
    this.shadowMat = new THREE.MeshBasicMaterial({ colorWrite: false });
    this.mirrorCam = new THREE.PerspectiveCamera();
    this.reflection = { texture: null, matrix: new THREE.Matrix4(), level: 0, on: false };
    this.setSize(width, height);
  }

  setSize(w, h) {
    this.w = w; this.h = h; this.pxs = h / 1080;
    for (const k of ['mrt', 'rtA', 'rtB', 'rtT1', 'rtT2', 'outA', 'outB', 'reflRT']) this[k]?.dispose();
    this.mrt = new THREE.WebGLMultipleRenderTargets(w, h, 2, { type: THREE.HalfFloatType, samples: this.samples });
    this.mrt.texture[1].minFilter = this.mrt.texture[1].magFilter = THREE.NearestFilter;
    const RT = (ww = w, hh = h, o = {}) => new THREE.WebGLRenderTarget(ww, hh, { type: THREE.HalfFloatType, depthBuffer: false, ...o });
    this.rtA = RT(); this.rtB = RT(); this.rtT1 = RT(); this.rtT2 = RT();
    this.outA = RT(w, h, { type: THREE.UnsignedByteType }); this.outB = RT(w, h, { type: THREE.UnsignedByteType });
    this.reflRT = RT(Math.round(w / 2), Math.round(h / 2), { depthBuffer: true, samples: 2 });
    this.reflection.texture = this.reflRT.texture;
    this.bloom?.dispose(); this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.5, 1.05);
    for (const m of [this.tensor, this.paint, this.ink, this.atmos, this.grade]) m.uniforms.uRes.value.set(w, h);
    U.uRes.value.set(w, h); U.uPxScale.value = this.pxs; U.tSceneData.value = this.mrt.texture[1];
  }

  // departments: addPass('water' | 'atmosphere', { material (ShaderMaterial using tDiffuse/tData/uRes + cam uniforms), enabled?(look) })
  addPass(slot, p) { if (!this.slots[slot]) throw new Error('pipeline: unknown slot ' + slot); for (const [k, v] of Object.entries({ tData: { value: null }, uRes: { value: new THREE.Vector2() }, ...this.cam }))
    p.material.uniforms[k] ??= v; this.slots[slot].push(p); return p; }

  _quad(mat, target) { this.fsq.material = mat; this.r.setRenderTarget(target); this.fsq.render(this.r); }

  _camUniforms(camera) {
    const c = this.cam; camera.updateMatrixWorld(); camera.getWorldPosition(c.uCamPos.value);
    c.uCamR.value.setFromMatrixColumn(camera.matrixWorld, 0).normalize(); c.uCamU.value.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    c.uCamF.value.setFromMatrixColumn(camera.matrixWorld, 2).normalize().negate();
    const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2); c.uTanH.value.set(ty * camera.aspect, ty); c.uPixA.value = 2 * ty / this.h;
  }

  _shadow(scene, camera, look, roots) {
    const s = look.shadow; U.uShadowOn.value = 0;
    if (!s || !look.passes.shadow || !roots.length) return;
    // center may be a function: evaluated here, after every module has posed this frame (LOOKs run before the pose)
    const r = s.radius ?? 5, ctr = new V3().fromArray((typeof s.center === 'function' ? s.center() : s.center) ?? [0, 0, 0]), dir = new V3().fromArray(s.dir ?? look.sun.dir).normalize();
    const reach = Math.max(8 * r, 14);   // low sun: the caster is tight but its shadow runs far along the floor
    const sc = this.shadowCam; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.01 * r; sc.far = reach + 4 * r;
    sc.position.copy(ctr).addScaledVector(dir, 4 * r); sc.up.set(0, 1, 0); if (Math.abs(dir.y) > 0.99) sc.up.set(0, 0, 1); sc.lookAt(ctr); sc.updateProjectionMatrix(); sc.updateMatrixWorld();
    for (const root of roots) root.traverse(o => { if (o.isMesh || o.isInstancedMesh) o.layers.enable(30); });
    const r0 = this.r, ov = scene.overrideMaterial, bg = scene.background; scene.overrideMaterial = this.shadowMat; scene.background = null;
    r0.setRenderTarget(this.shadowRT); r0.setClearColor(0xffffff, 1); r0.clear(true, true, false); r0.render(scene, sc);
    scene.overrideMaterial = ov; scene.background = bg;
    U.uShadowMap.value = this.shadowRT.depthTexture; U.uShadowVP.value.multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse);
    U.uShadowOn.value = 1; U.uShadowK.value = s.k ?? 1; U.uShadowBias.value = s.bias ?? 0.0012; const ts = this.shadowRT.width;
    U.uShadowTexel.value = 1 / ts; U.uShadowNO.value = 2 * r / ts * 1.5;
  }

  _reflect(scene, camera, look) {
    const w = look.water; this.reflection.on = false;
    if (!w?.on || !look.passes.reflection) return;
    const L = w.level ?? 0, mc = this.mirrorCam; mc.copy(camera);
    const p = camera.getWorldPosition(new V3()), fwd = new V3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())), up = new V3(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    const tgt = p.clone().add(fwd); p.y = 2 * L - p.y; tgt.y = 2 * L - tgt.y; up.y = -up.y;
    mc.position.copy(p); mc.up.copy(up); mc.lookAt(tgt); mc.updateMatrixWorld(); mc.updateProjectionMatrix();
    const hidden = []; scene.traverse(o => { if (o.userData.noReflect && o.visible) { o.visible = false; hidden.push(o); } });
    U.uMrtClip.value = 1; U.uMrtClipY.value = L - 0.02;
    const r0 = this.r; r0.setRenderTarget(this.reflRT); r0.setClearColor(0x000000, 1); r0.clear(); r0.render(scene, mc);
    U.uMrtClip.value = 0; hidden.forEach(o => o.visible = true);
    this.reflection.matrix.multiplyMatrices(mc.projectionMatrix, mc.matrixWorldInverse); this.reflection.level = L; this.reflection.on = true;
  }

  _setLook(look, t) {
    const P = this.paint.uniforms, I = this.ink.uniforms, A = this.atmos.uniforms, G = this.grade.uniforms, pa = look.paint, ik = look.ink, gr = look.grade;
    const pxs = this.pxs;
    P.uK.value = pa.k; P.uRad.value = Math.min(8, pa.radius * pxs); P.uQ.value = pa.q; P.uHard.value = pa.hard; P.uAlpha.value = pa.aniso; P.uStroke.value = pa.stroke;
    P.uStrokeL.value = pa.strokeLen; P.uWob.value = pa.wobble * pxs; P.uVary.value = pa.vary; P.uHue.value = pa.hue; P.uPaper.value = pa.paper; P.uDepthK.value = pa.depthK;
    I.uK.value = ik.k; I.uW.value = ik.width; I.uPxS.value = pxs; I.uMinW.value = ik.min; I.uMaxW.value = ik.max; I.uRefD.value = ik.ref ?? 10; I.uDepthThr.value = ik.depthThr;
    I.uNormThr.value = ik.normThr; I.uInner.value = ik.inner; I.uTint.value = ik.tint; I.uPress.value = ik.press; I.uInk.value.copy(C(ik.color));
    const hz = look.haze, sd = new V3().fromArray(look.sun.dir).normalize();
    A.uTime.value = t; A.uHazeCol.value.copy(C(hz.color)); A.uSunDir.value.copy(sd); A.uSunCol.value.copy(C(look.sun.color)).multiplyScalar(look.sun.k ?? 1);
    A.uHazeD.value = hz.density; A.uHazeH0.value = hz.h0; A.uHazeHK.value = hz.falloff; A.uHazeMax.value = hz.max; A.uSunScat.value = hz.sunScatter; A.uSkyHaze.value = hz.sky ?? 0;
    A.uMist.value = look.mist.k; A.uMistH.value = look.mist.height; A.uMistCol.value.copy(C(look.mist.color));
    const sh = look.shafts; A.uRaysOn.value = sh.on ? 1 : 0; A.uRaysK.value = sh.k; A.uRaysDecay.value = sh.decay; A.uRaysDen.value = sh.density; A.uRaysThr.value = sh.thr;
    A.uRaysOcc.value = sh.occ; A.uRaysRad.value = sh.radius; A.uRaysTint.value.copy(C(sh.tint)); A.uAsp.value = this.w / this.h;
    G.uExpo.value = gr.expo; G.uSat.value = gr.sat; G.uKnee.value = gr.knee; G.uGamma.value = gr.gamma; G.uContrast.value = gr.contrast; G.uVig.value = gr.vignette; G.uGrain.value = this.noGrain ? 0 : gr.grain;
    G.uPaper.value = gr.paper; G.uHal.value = gr.halation; G.uHalThr.value = gr.halThr; G.uCA.value = gr.ca; G.uLift.value.copy(C(gr.lift)); G.uShTint.value.copy(C(gr.shTint));
    G.uHiTint.value.copy(C(gr.hiTint)); G.uHalCol.value.copy(C(gr.halCol)); G.uTint.value.copy(C(gr.tint)); G.uFlash.value = gr.flash; G.uFlashCol.value.copy(C(gr.flashCol));
    G.uFade.value = gr.fade; G.uFadeCol.value.copy(C(gr.fadeCol)); G.uPxS.value = pxs; G.uSeed.value = Math.round(t * 24) % 997;
    const b = look.bloom; this.bloom.strength = b.strength; this.bloom.radius = b.radius; this.bloom.threshold = b.threshold;
  }

  // Render one frame of `scene` (+ `overlay`) through the whole chain into `target` (default outA). look = merged LOOK.
  render({ scene, overlay = null, camera, look, t = 0, target = this.outA, shadowRoots = [] }) {
    const r = this.r, ps = look.passes; U.uTime.value = t;
    ensureMRT(scene);
    camera.updateMatrixWorld(); this._camUniforms(camera); this._setLook(look, t);
    if (look.ink.ref == null) this.ink.uniforms.uRefD.value = look._focus ?? 10;
    const prevAuto = r.autoClear; r.autoClear = false;
    this._shadow(scene, camera, look, shadowRoots);
    this._reflect(scene, camera, look);
    // main MRT
    r.setRenderTarget(this.mrt); r.setClearColor(C(look.background ?? 0), 1); r.clear(true, true, true);
    const gl = r.getContext(); gl.clearBufferfv(gl.COLOR, 1, new Float32Array([2, 0, SKY_DEPTH, 0]));
    r.render(scene, camera);
    const col = this.mrt.texture[0], data = this.mrt.texture[1]; U.tSceneData.value = data;
    if (this.debug) { const D = this.debugM.uniforms; D.tDiffuse.value = col; D.tData.value = data; D.uMode.value = { id: 1, depth: 2, normal: 3, mask: 4, raw: 5 }[this.debug] || 5;
      this._quad(this.debugM, target); r.autoClear = prevAuto; return target; }
    let read = col, write = this.rtA;
    const swap = () => { const nr = write.texture; write = write === this.rtA ? this.rtB : this.rtA; read = nr; };
    const full = (m) => { m.uniforms.tDiffuse.value = read; if (m.uniforms.tData) m.uniforms.tData.value = data; this._quad(m, write); swap(); };
    if (ps.paint && look.paint.k > 0) {
      this.tensor.uniforms.tDiffuse.value = read; this._quad(this.tensor, this.rtT1);
      this.tblur.uniforms.tDiffuse.value = this.rtT1.texture; this.tblur.uniforms.uDir.value.set(1 / this.w, 0); this._quad(this.tblur, this.rtT2);
      this.tblur.uniforms.tDiffuse.value = this.rtT2.texture; this.tblur.uniforms.uDir.value.set(0, 1 / this.h); this._quad(this.tblur, this.rtT1);
      this.paint.uniforms.tT.value = this.rtT1.texture; full(this.paint);
    }
    if (ps.ink && look.ink.k > 0) full(this.ink);
    for (const p of this.slots.water) if (!p.enabled || p.enabled(look)) { p.update?.(look, t); full(p.material); }
    if (ps.atmosphere) {
      const sh = look.shafts; if (sh.on && sh.pos) { const q = new V3().fromArray(sh.pos).project(camera); this.atmos.uniforms.uLight.value.set((q.x + 1) / 2, (q.y + 1) / 2); }
      full(this.atmos);
    }
    for (const p of this.slots.atmosphere) if (!p.enabled || p.enabled(look)) { p.update?.(look, t); full(p.material); }
    // the last result must live in a render target we can draw onto (overlay, bloom)
    let cur = read === this.rtA.texture ? this.rtA : read === this.rtB.texture ? this.rtB : null;
    if (!cur) { this.presentM.uniforms.tA.value = read; this.presentM.uniforms.uMix.value = 0; this._quad(this.presentM, write); cur = write; }
    if (overlay && ps.overlay) { r.setRenderTarget(cur); r.render(overlay, camera); }
    if (ps.bloom && look.bloom.strength > 0) this.bloom.render(r, null, cur, 0, false);
    this.grade.uniforms.tDiffuse.value = cur.texture; this._quad(this.grade, target);
    r.autoClear = prevAuto;
    return target;
  }

  present(a = this.outA, b = null, k = 0) {
    this.presentM.uniforms.tA.value = a.texture; this.presentM.uniforms.tB.value = (b || a).texture; this.presentM.uniforms.uMix.value = b ? k : 0;
    this._quad(this.presentM, null);
  }
}
