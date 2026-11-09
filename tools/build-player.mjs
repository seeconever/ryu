// Single-file offline players: dist/ryu.html (full 1080p internal) + dist/ryu_lite.html (960x540 internal).
// Inlines every ES module reachable from src/main.js + src/ui.js (three.js included; import specifiers rewritten to bare
// keys resolved by a runtime import map of blob: URLs), every file under src/assets (data: URLs) and the soundtrack
// (WORK/audio/soundtrack.m4a from tools/render-audio.mjs).
//   node tools/build-player.mjs [--lite-scale 2] [--no-audio]
import fs from 'node:fs';
import path from 'node:path';
import { REPO, WORK, opt, flag } from './lib.mjs';

const posix = (p) => p.split(path.sep).join('/');
const VEND = path.join(REPO, 'vendor', 'three'), JSM = path.join(VEND, 'examples', 'jsm'), CORE = path.join(VEND, 'build', 'three.module.js');
const keyOf = (abs) => abs === CORE ? 'three' : abs.startsWith(JSM + path.sep) ? 'three/addons/' + posix(path.relative(JSM, abs)) : '@mc/' + posix(path.relative(REPO, abs));
function resolve(spec, from) {
  if (spec === 'three') return CORE;
  if (spec.startsWith('three/addons/')) return path.join(JSM, spec.slice('three/addons/'.length));
  if (spec.startsWith('./') || spec.startsWith('../')) return path.resolve(path.dirname(from), spec);
  return null;
}
const modules = {}, seen = new Set(), RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\2/g;
function visit(abs) {
  if (seen.has(abs)) return; seen.add(abs);
  let src = fs.readFileSync(abs, 'utf8');
  src = src.replace(RE, (m, pre, q, spec) => { const r = resolve(spec, abs); if (!r || !fs.existsSync(r)) return m; visit(r); return `${pre}${q}${keyOf(r)}${q}`; });
  modules[keyOf(abs)] = src;
}
for (const e of ['src/main.js', 'src/ui.js']) visit(path.join(REPO, e));
// guard: UTF-8 text decoded as cp1252 ("Â·", "â€”") must never ship in the player
for (const [k, s] of Object.entries(modules)) if (/Â·|â€|Ã[\u0080-¿]/.test(s)) { console.error(`mojibake in ${k}: save the file as UTF-8`); process.exit(1); }
const assets = {}, MIME = { '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.m4a': 'audio/mp4' };
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (!p.endsWith('.js')) assets[posix(path.relative(REPO, p))] = `data:${MIME[path.extname(p)] || 'application/octet-stream'};base64,` + fs.readFileSync(p).toString('base64'); } })(path.join(REPO, 'src', 'assets'));
const m4a = path.join(WORK, 'audio', 'soundtrack.m4a');
if (!flag('no-audio')) { if (fs.existsSync(m4a)) assets['audio/soundtrack.m4a'] = 'data:audio/mp4;base64,' + fs.readFileSync(m4a).toString('base64'); else console.log('WARNING: no soundtrack (run tools/render-audio.mjs) -> silent player'); }
const tpl = fs.readFileSync(path.join(REPO, 'player', 'player.html'), 'utf8');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
fs.mkdirSync(path.join(REPO, 'dist'), { recursive: true });
for (const [name, scale, title] of [['ryu.html', 1, 'RYŪ · 龍'], ['ryu_lite.html', +opt('lite-scale', 2), 'RYŪ · 龍 (lite)']]) {
  const html = tpl.replace('/*__MODULES__*/', () => json(modules)).replace('/*__ASSETS__*/', () => json(assets)).replace('__SCALE__', String(scale)).replace('__TITLE__', title);
  const out = path.join(REPO, 'dist', name); fs.writeFileSync(out, html, 'utf8');
  console.log(`${posix(path.relative(REPO, out))}: ${(Buffer.byteLength(html, 'utf8') / 1048576).toFixed(2)} MB, ${Object.keys(modules).length} modules, ${Object.keys(assets).length} assets, internal scale ${scale}`);
}
