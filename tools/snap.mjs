// Stills for review.
//   node tools/snap.mjs [--team pilot] [--scale 1] [--out <dir>] [--sheet name] [--fmt jpg|png] [--measure] SPEC...
// SPEC: s:s16 (middle of the shot) | s:s16@0 (first frame) | s:s16@1 (last) | s:s16@0.3 | t:41.2 | f:300 | 12.5
//       all (middle of every shot) | all3 (first / middle / last of every shot)
//       "q:cam=0,60,300&at=0,60,0&fov=35&t=10=name:mycam" (free camera / any URL params; one page load per distinct query)
// Output: WORK/snap (or --out, relative to the repo) as <shot>_<frame>.jpg; --sheet name writes a labelled contact sheet.
import fs from 'node:fs';
import path from 'node:path';
import { openFilm, opt, flag, positional, WORK, REPO, FPS, frameOf } from './lib.mjs';
import { makeSheet } from './sheet.mjs';
import { SHOTS } from '../src/shots.js';

const specs = positional(); if (!specs.length) { console.log('usage: node tools/snap.mjs [--scale 1] [--out dir] [--sheet name] s:s16 t:41 f:300 all ...'); process.exit(1); }
const fmt = opt('fmt', 'jpg'), out = opt('out') ? path.resolve(REPO, opt('out')) : path.join(WORK, 'snap'); fs.mkdirSync(out, { recursive: true });
const jobs = [];   // { query, f, name }
for (const sp of specs) {
  if (sp === 'all') { for (const s of SHOTS) jobs.push({ query: '', f: frameOf(`s:${s.id}`, SHOTS) }); continue; }
  if (sp === 'all3') { for (const s of SHOTS) for (const k of [0, 0.5, 1]) jobs.push({ query: '', f: frameOf(`s:${s.id}@${k}`, SHOTS) }); continue; }
  if (sp.startsWith('q:')) { const body = sp.slice(2), [q, name] = body.split('=name:'), p = new URLSearchParams(q);
    const t = p.has('t') ? +p.get('t') : 0; p.delete('t'); jobs.push({ query: p.toString(), f: Math.round(t * FPS), name: name || 'q' + jobs.length }); continue; }
  jobs.push({ query: '', f: frameOf(sp, SHOTS) });
}
const byQuery = new Map(); for (const j of jobs) { if (!byQuery.has(j.query)) byQuery.set(j.query, []); byQuery.get(j.query).push(j); }
const files = [], labels = [];
for (const [query, list] of byQuery) {
  const film = await openFilm({ query });
  for (const j of list) {
    const t = j.f / FPS, s = SHOTS.find(x => j.f >= x.f0 && j.f < x.f1) || SHOTS[SHOTS.length - 1], t0 = Date.now();
    const buf = await film.frame(t, fmt === 'png' ? 'png' : 'jpeg');
    const name = (j.name || `${s.id}_f${String(j.f).padStart(4, '0')}`) + '.' + fmt, file = path.join(out, name);
    fs.writeFileSync(file, buf); files.push(file); labels.push(`${j.name ? j.name + ' ' : ''}${s.id} ${s.owner} f${j.f} ${t.toFixed(2)}s`);
    let extra = '';
    if (flag('measure')) { const m = await film.page.evaluate(() => window.__mc.measureClawd()); if (m) extra = ` clawd hue ${m.hue} sat ${m.sat} val ${m.val} (n ${m.n})`; }
    const st = await film.page.evaluate(() => window.__mc.stats()); extra += ` Y ${st.yavg}`;
    console.log(`${name}  ${Date.now() - t0} ms  ${(buf.length / 1024).toFixed(0)} KB${extra}`);
  }
  if (film.errors.length) console.log(`page errors: ${film.errors.length}`);
  await film.close();
}
if (opt('sheet')) { const sh = makeSheet(files, labels, path.join(out, opt('sheet') + '.jpg'), { cols: +opt('cols', files.length > 9 ? 6 : 3), w: +opt('w', files.length > 9 ? 480 : 640) }); console.log('sheet ->', sh); }
