// =====================================================================================================================
// RYŪ · 龍 — engine entry (owner: engine / director). 76 s · 1920x1080 · 24 fps · 1824 frames · 30 shots.
// Every frame is a pure function of film time t (frame f = t * 24): frames render in any order; the render is resumable.
//
// DEPARTMENT MODULE API (src/<team>.js; full notes in docs/ARCHITECTURE.md)
//   export async function create(ctx)  ->  { update(t, shot), afterCamera?(t, shot), dispose(), ...public API }
//     create   build once (load assets, add objects to ctx.sets.<group> or ctx.scene / ctx.overlay). May be async.
//     update   pose everything for film time t. shot = { id, t0, t1, set, owner, lt, d, k, f, groups, look }. Pure: no state
//              carried between calls (frames come in any order). Hide your objects when they are not in the shot.
//     afterCamera  optional: runs after the camera is placed (billboards, screen-facing FX).
//     The returned object is published as ctx.modules.<team> so other departments can use its API (anchors, poses).
//   ctx = { THREE, scene, overlay, sets: { island, shrine, paddies, town, sea, storm, sky } (the engine shows the groups of the
//           current shot's set), camera, mat / materials { cel, bg, fx, overlay, mrt, keepMask, shadeOf, hiOf, nextId, ID },
//           kit (painted sky, cloud cards, glows, shafts, end card), glsl (shared chunks + uniforms), light (LIGHT rig),
//           water { reflection: { texture, matrix, level, on } }, pipeline (addPass('water'|'atmosphere', ...)),
//           shadowRoots (push character roots: they cast the cel shadow), solids (collision registry),
//           onTwos, onThrees, rng(seed), util, cues (CUES), shots (SHOTS), shot (by id), FPS, DURATION, FRAMES,
//           asset(path) -> url, json(path) -> Promise, loadClawd(opts) -> { clawd, toon }, label(text, obj), modules, state, q }
//   Update order: world, sky, ocean, dragon, keeper, fx (audio has no picture). ctx.geo = GEO (src/shots.js).
//
// URL (index.html): ?t=12.5 | ?f=300 | ?shot=s16[@0..1] | ?scale=2 (internal resolution divisor) | ?play=1 | ?labels=1
//   ?cam=x,y,z&at=x,y,z&fov=40 (free debug camera) | ?groups=town,sea (force set groups) | ?dragon=0 (skip a department)
//   ?look={...} (JSON merged over the shot LOOK)
//   ?debug=id|depth|normal|mask|raw (show the main-pass buffers) | ?render=1 (headless: no UI; window.__mc drives frames)
// =====================================================================================================================
import * as THREE from 'three';
import { Pipeline, BASE_LOOK, mergeLook } from './pipeline.js';
import * as MAT from './pipeline-materials.js';
import * as KIT from './pipeline-kit.js';
import * as GLSL from './pipeline-glsl.js';
import * as UT from './pipeline-util.js';
import { createSolids } from './pipeline-solids.js';
import { SHOTS, SHOT, CUES, FPS, DURATION, FRAMES, shotAt, shotTime, GROUPS, GEO } from './shots.js';
import { camFor, lookFor } from './cams/index.js';
import { loadClawd as loadClawdRaw } from './assets/clawd/clawd.js';
import * as world from './world.js';
import * as sky from './sky.js';
import * as ocean from './ocean.js';
import * as dragon from './dragon.js';
import * as keeper from './keeper.js';
import * as fx from './fx.js';
import * as audio from './audio.js';

export const ENGINE_VERSION = 'ryu-engine 1.0 (2026-11-08)';
const MODULES = [['world', world], ['sky', sky], ['ocean', ocean], ['dragon', dragon], ['keeper', keeper], ['fx', fx], ['audio', audio]];
const V3 = THREE.Vector3;
const DISSOLVE = 0.5;   // s29 -> end card dissolve (s)

// asset URLs: inlined data in the single-file player (globalThis.__MC_ASSETS), else relative to the repo root
const ROOT = (() => { try { return new URL('../', import.meta.url); } catch { return new URL('./', location.href); } })();
export const asset = (p) => globalThis.__MC_ASSETS?.[p] ?? new URL(p, ROOT).href;
export const json = (p) => fetch(asset(p)).then(r => { if (!r.ok) throw new Error('asset ' + p + ' ' + r.status); return r.json(); });

export async function boot({ canvas = null, scale = 1, query = new URLSearchParams(location.search), samples = 4 } = {}) {
  const W = Math.round(1920 / scale), H = Math.round(1080 / scale);
  const renderer = new THREE.WebGLRenderer({ canvas: canvas || undefined, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance',
    logarithmicDepthBuffer: true, alpha: false });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  const pipeline = new Pipeline(renderer, { width: W, height: H, samples });
  if (query.has('debug')) pipeline.debug = query.get('debug');
  if (query.get('grain') === '0') pipeline.noGrain = true;   // QC: deterministic, grain-free frames (dup detection)
  const scene = new THREE.Scene(), overlay = new THREE.Scene();
  const sets = {}; for (const g of GROUPS) { sets[g] = new THREE.Group(); sets[g].name = 'set:' + g; scene.add(sets[g]); }
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 40000);
  const solids = createSolids();
  const labels = [];
  const ctx = {
    THREE, scene, overlay, sets, layers: { scene, overlay, sets }, camera, renderer, pipeline,
    mat: null, materials: null, kit: KIT, glsl: GLSL, light: MAT.LIGHT, util: UT,
    water: { reflection: pipeline.reflection },
    shadowRoots: [], solids,
    onTwos: UT.onTwos, onThrees: UT.onThrees, rng: UT.rng,
    geo: GEO, cues: CUES, shots: SHOTS, shot: SHOT, shotTime, FPS, DURATION, FRAMES,
    asset, json, modules: {}, state: {}, q: query, scale, W, H,
    async loadClawd({ toon = true, ...opts } = {}) {
      const names = (await json('src/assets/clawd/emotions/index.json')).emotions, data = { index: { emotions: names } };
      await Promise.all(names.map(async n => { data[n] = await json(`src/assets/clawd/emotions/${n}.json`); }));
      const clawd = await loadClawdRaw(asset('src/assets/clawd/clawd.glb'), { emotionsData: data });
      return { clawd, toon: toon ? MAT.toonClawd(clawd, opts) : null };
    },
    label(text, obj, { y = 1 } = {}) { if (query.get('labels') !== '1') return null; const s = KIT.labelSprite(text); overlay.add(s); labels.push({ s, obj, y }); return s; },
  };
  ctx.mat = ctx.materials = { cel: MAT.celMaterial, bg: MAT.bgMaterial, fx: MAT.fxMaterial, overlay: MAT.overlayMaterial, mrt: GLSL.mrt, keepMask: MAT.keepMask,
    shadeOf: MAT.shadeOf, hiOf: MAT.hiOf, nextId: MAT.nextId, ID: GLSL.ID, CLAWD_PAL: MAT.CLAWD_PAL, toonClawd: MAT.toonClawd };

  // departments
  const active = [];
  for (const [name, mod] of MODULES) {
    if (query.get(name) === '0' || !mod.create) continue;
    try { const api = await mod.create(ctx); ctx.modules[name] = api; active.push({ name, api }); }
    catch (e) { console.error(`[film] module ${name} failed in create():`, e); throw e; }
  }
  const END = KIT.createEndCard({ width: W, height: H, scale: 0.95 * H / 1080, title: 'RYŪ', titleJP: '龍' });
  const CARD_LOOK = mergeLook(BASE_LOOK, KIT.END_CARD_LOOK);

  // debug camera from the URL
  const dbgCam = query.has('cam') ? (() => { const p = query.get('cam').split(',').map(Number), a = (query.get('at') || '0,0,0').split(',').map(Number);
    return { pos: p, look: a, fov: +(query.get('fov') || 40), near: query.has('near') ? +query.get('near') : undefined, far: query.has('far') ? +query.get('far') : undefined }; })() : null;
  const forceGroups = query.has('groups') ? query.get('groups').split(',') : null;
  const dbgLook = query.has('look') ? JSON.parse(query.get('look')) : null;   // ?look={"shafts":{"on":true}} merged last (debug / lookdev)

  function applyCam(c) {
    camera.position.fromArray(c.pos); camera.up.set(0, 1, 0); camera.lookAt(new V3().fromArray(c.look));
    if (c.roll) camera.rotateZ(THREE.MathUtils.degToRad(c.roll));
    camera.fov = c.fov ?? 40; camera.aspect = W / H;
    const dist = new V3().fromArray(c.pos).distanceTo(new V3().fromArray(c.look));
    camera.near = c.near ?? THREE.MathUtils.clamp(dist * 0.01, 0.02, 2); camera.far = c.far ?? 60000;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    return dist;
  }

  // pose the world for film time t (no render). shotOverride: render a shot past its end (dissolves)
  function pose(t, shotOverride = null) {
    const shot = shotOverride || shotAt(t), lt = t - shot.t0, d = shot.t1 - shot.t0;
    const lk = lookFor(shot, t, ctx), look = mergeLook(BASE_LOOK, lk.set, lk.shot, dbgLook);
    const groups = forceGroups || [...shot.groups, ...(look.show || [])];
    const st = { ...shot, lt, d, k: lt / d, t, f: Math.round(t * FPS), groups, look };
    ctx.state = st;
    for (const g of GROUPS) sets[g].visible = groups.includes(g);
    MAT.LIGHT.set(look);
    scene.userData.time = t;
    for (const m of active) m.api.update?.(t, st);
    const cam = dbgCam || camFor(shot, t, ctx);
    look._focus = applyCam(cam);
    MAT.LIGHT.focus = new V3().fromArray(cam.look);
    scene.updateMatrixWorld(true);
    MAT.LIGHT.update();
    for (const m of active) m.api.afterCamera?.(t, st);
    for (const l of labels) { const v = l.obj && (() => { for (let q = l.obj; q; q = q.parent) if (!q.visible) return false; return true; })();
      l.s.visible = !!v; if (v) { l.obj.getWorldPosition(l.s.position); const bb = new THREE.Box3().setFromObject(l.obj); l.s.position.y = bb.max.y + (bb.max.y - bb.min.y) * 0.08 * l.y; } }
    return st;
  }

  let last = null;
  function render(t) {
    const shot = shotAt(t);
    if (shot.set === 'card') {
      const ct = t - shot.t0; END.draw(ct * Math.max(1, END.duration / (shot.t1 - shot.t0 - 0.15)));   // the title must be fully in before the last frame
      pipeline.render({ scene: END.scene, camera: END.camera, look: CARD_LOOK, t, target: pipeline.outA });
      if (ct < DISSOLVE) { const st = pose(t, SHOT.s29); pipeline.render({ scene, overlay, camera, look: st.look, t, target: pipeline.outB, shadowRoots: ctx.shadowRoots });
        pipeline.present(pipeline.outB, pipeline.outA, UT.ease((ct + 1 / FPS) / (DISSOLVE + 1 / FPS))); }
      else pipeline.present(pipeline.outA);
      ctx.state = { ...shot, t, lt: ct, d: shot.t1 - shot.t0, f: Math.round(t * FPS), groups: [], look: CARD_LOOK };
    } else {
      const st = pose(t);
      pipeline.render({ scene, overlay, camera, look: st.look, t, target: pipeline.outA, shadowRoots: ctx.shadowRoots });
      pipeline.present(pipeline.outA);
    }
    last = t; return renderer.domElement;
  }

  // luma statistics of the last presented frame (tv levels, BT.709) + a 32x18 thumbnail for dup detection
  const sc = document.createElement('canvas'); sc.width = 32; sc.height = 18; const sx = sc.getContext('2d', { willReadFrequently: true });
  function stats() {
    sx.drawImage(renderer.domElement, 0, 0, 32, 18); const d = sx.getImageData(0, 0, 32, 18).data; let s = 0, s2 = 0; const th = [];
    for (let i = 0; i < d.length; i += 4) { const y = 16 + 219 * (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; s += y; s2 += y * y; th.push(Math.round(y)); }
    const n = d.length / 4, m = s / n; return { yavg: +m.toFixed(2), ystd: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(2), thumb: th };
  }

  const api = {
    ctx, pipeline, renderer, canvas: renderer.domElement, W, H, scale, pose, render, stats, SHOTS, CUES, FPS, FRAMES, DURATION,
    info() { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), engine: ENGINE_VERSION, frames: FRAMES, fps: FPS, w: W, h: H, scale,
        modules: active.map(m => m.name) }; },
    async renderFrame(t, { fmt = 'png', quality = 0.92 } = {}) { render(t); return renderer.domElement.toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', quality); },
    // collision report over [from, to) frames (pose only)
    collide({ from = 0, to = FRAMES, step = 2 } = {}) {
      const res = {};
      for (let f = from; f < to; f += step) { const t = f / FPS, st = pose(t); if (st.set === 'card') continue;
        for (const v of solids.test(t, st.groups)) { const k = `${st.id} ${v.a} x ${v.b}${v.rest ? ' (' + v.rest + ')' : ''}`; const r = res[k] ||= { shot: st.id, pair: [v.a, v.b], rest: v.rest || null, frames: 0, max: 0, first: f };
          r.frames++; r.max = Math.max(r.max, v.depth); } }
      return { solids: solids.list.map(s => s.name), violations: Object.values(res) };
    },
    // compile every shader up front: one frame per set (avoids multi-second stalls at the first frame of each set)
    warm() { const seen = new Set(); for (const s of SHOTS) { if (seen.has(s.set)) continue; seen.add(s.set); render((s.f0 + 1) / FPS); } },
    measureClawd() { const b = ctx.modules.keeper?.toon?.bodyMesh; for (let o = b; o; o = o.parent) if (!o.visible) return null; return b ? MAT.measureBody(renderer.domElement, camera, b) : null; },
    get last() { return last; },
  };
  return api;
}
