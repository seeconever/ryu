// Film frames -> PNG, resumable, any order, several processes in parallel (chunk locks).
//   node tools/render.mjs [--from 0] [--to 1824] [--chunk 96] [--scale 1] [--fmt png|jpg] [--order seq|shuffle|reverse]
//                         [--step 1] [--out frames] [--team engine]
// Frames: WORK/<out>/chunk_NNNN/f_NNNNN.png; a finished chunk gets chunk_NNNN.ok. Re-running skips finished chunks / files;
// a second process (another port in the team range) takes the chunks the first has not locked. --step 4 = quick draft.
import fs from 'node:fs';
import path from 'node:path';
import { openFilm, opt, WORK, FPS, FRAMES } from './lib.mjs';

const from = +opt('from', 0), to = Math.min(+opt('to', FRAMES), FRAMES), CH = +opt('chunk', 96), step = +opt('step', 1), fmt = opt('fmt', 'png'), order = opt('order', 'seq');
const out = path.resolve(WORK, opt('out', 'frames')); fs.mkdirSync(out, { recursive: true });
const MINB = fmt === 'png' ? 20000 : 8000;
let chunks = []; for (let c = Math.floor(from / CH); c * CH < to; c++) chunks.push(c);
if (order === 'reverse') chunks.reverse();
if (order === 'shuffle') { let s = (process.pid * 2654435761) >>> 0; chunks.sort(() => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s & 1) ? 1 : -1; }); }
const dirOf = (c) => path.join(out, `chunk_${String(c).padStart(4, '0')}`), fileOf = (f) => path.join(dirOf(Math.floor(f / CH)), `f_${String(f).padStart(5, '0')}.${fmt}`);
const todo = chunks.filter(c => !fs.existsSync(dirOf(c) + '.ok'));
if (!todo.length) { console.log('all chunks done'); } else {
  const film = await openFilm({ quiet: false });
  let n = 0, ms = 0;
  for (const c of todo) {
    const lock = dirOf(c) + '.lock';
    try { if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs > 30 * 60e3) fs.rmSync(lock); fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); }
    catch { console.log(`chunk ${c}: locked by another process, skipped`); continue; }
    fs.mkdirSync(dirOf(c), { recursive: true });
    const f0 = Math.max(from, c * CH), f1 = Math.min(to, (c + 1) * CH);
    for (let f = f0; f < f1; f += step) {
      const fp = fileOf(f); if (fs.existsSync(fp) && fs.statSync(fp).size > MINB) continue;
      const t0 = Date.now(), buf = await film.frame(f / FPS, fmt === 'png' ? 'png' : 'jpeg'); fs.writeFileSync(fp + '.tmp', buf); fs.renameSync(fp + '.tmp', fp);
      ms += Date.now() - t0; n++; fs.utimesSync(lock, new Date(), new Date());
      if (n % 24 === 0) console.log(`f${f}  avg ${(ms / n).toFixed(0)} ms/frame  (${n} new)`);
    }
    const complete = f0 === c * CH && f1 === Math.min((c + 1) * CH, FRAMES) && step === 1;
    if (complete) fs.writeFileSync(dirOf(c) + '.ok', new Date().toISOString());
    fs.rmSync(lock, { force: true }); console.log(`chunk ${c} ${complete ? 'ok' : 'partial'}`);
  }
  if (film.errors.length) console.log(`page errors: ${film.errors.length}`);
  await film.close();
  console.log(n ? `rendered ${n} frames, avg ${(ms / n).toFixed(0)} ms/frame` : 'no new frames');
}
let missing = 0; for (let f = from; f < to; f += step) if (!fs.existsSync(fileOf(f))) missing++;
console.log(missing ? `INCOMPLETE: ${missing} frames missing in ${from}-${to}` : `done: frames ${from}-${to} in ${out}`);
