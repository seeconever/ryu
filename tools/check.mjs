// QC: page errors, collisions of registered solids (ctx.solids + the keeper's segment vs rounded body tests: broom shaft and head, rope, nubs, legs),
//     luma jumps, blank and duplicate frames.
//   node tools/check.mjs [--team engine] [--from 0] [--to 1824] [--step 2] [--lstep 1] [--scale 4] [--frames frames] [--only s15,s16] [--purity 60]
//     --purity N: N frames across the film are rendered twice, once right after their neighbour and once after a jump across the film; they must match (frames are pure functions of t)
//     collisions: every --step frame is posed (no render) and the solids are tested (penetration > tolerance = violation)
//     luma: with --frames <dir in WORK> (rendered PNGs) ffmpeg measures YAVG + frame difference; otherwise the page renders
//           every --lstep frame at --scale 4 and measures in place. Jumps > 25 tv levels are reported except within 3 frames
//           of the flashes (CUES.impact, CUES.shatter). Blank = flat frame (std < 1.5 levels); dup = identical to the previous.
// Writes WORK/check/report.json; exit code 1 on page errors or collisions.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openFilm, opt, flag, WORK, FPS, FRAMES, workPath, ffmpeg } from './lib.mjs';
import { SHOTS, CUES } from '../src/shots.js';

const only = opt('only') ? opt('only').split(',') : null;
const ranges = only ? SHOTS.filter(s => only.includes(s.id)).map(s => [s.f0, s.f1]) : [[+opt('from', 0), Math.min(+opt('to', FRAMES), FRAMES)]];
const shotOf = (f) => (SHOTS.find(s => f >= s.f0 && f < s.f1) || SHOTS[SHOTS.length - 1]).id;
const flashes = [CUES.impact, CUES.shatter].map(t => Math.round(t * FPS));
const nearFlash = (f) => flashes.some(x => Math.abs(f - x) <= 3);
const report = { team: opt('team', 'engine'), date: new Date().toISOString(), pageErrors: [], collisions: [], luma: null };

const film = await openFilm({ scale: +opt('scale', 4), quiet: true, query: 'grain=0' });
console.log(`page: ${film.info.renderer} | modules ${film.info.modules.join(',')}`);
// 1. collisions
const step = +opt('step', 2);
for (const [a, b] of ranges) { const r = await film.page.evaluate((o) => window.__mc.collide(o), { from: a, to: b, step }); report.solids = r.solids; report.collisions.push(...r.violations); }
console.log(`solids: ${report.solids?.length ?? 0} registered (${(report.solids || []).join(', ')})`);
if (report.collisions.length) for (const v of report.collisions) console.log(`  COLLISION ${v.shot} ${v.pair.join(' x ')}${v.rest ? ' ' + v.rest : ''}: ${v.frames} frames, max ${v.max} m, first f${v.first}`);
else console.log('collisions: none');
// 2. luma / blank / dup
const lumaRows = [];
const framesDir = opt('frames') ? path.resolve(WORK, opt('frames')) : null;
if (framesDir && fs.existsSync(framesDir)) {
  const list = []; for (const [a, b] of ranges) for (let f = a; f < b; f++) { const p = path.join(framesDir, `chunk_${String(Math.floor(f / 96)).padStart(4, '0')}`, `f_${String(f).padStart(5, '0')}.png`); if (fs.existsSync(p)) list.push([f, p]); }
  const lf = workPath('check', 'frames.txt'); fs.writeFileSync(lf, list.map(([, p]) => `file '${p.replace(/\\/g, '/')}'\nduration ${1 / FPS}`).join('\n'));
  const run = (vf) => spawnSync(ffmpeg, ['-v', 'error', '-f', 'concat', '-safe', '0', '-i', lf, '-vf', vf, '-f', 'null', '-'], { maxBuffer: 1 << 28 }).stdout.toString();
  const y = [...run('scale=out_range=tv:out_color_matrix=bt709,format=yuv420p,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-').matchAll(/YAVG=([\d.]+)/g)].map(m => +m[1]);
  const d = [...run('scale=out_range=tv:out_color_matrix=bt709,format=yuv420p,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-').matchAll(/YAVG=([\d.]+)/g)].map(m => +m[1]);
  list.forEach(([f], i) => lumaRows.push({ f, y: y[i], diff: i ? d[i - 1] : null, std: null }));
} else {
  const lstep = +opt('lstep', 1); let prev = null;
  for (const [a, b] of ranges) for (let f = a; f < b; f += lstep) {
    const st = await film.page.evaluate(async (t) => { await window.__mc.renderFrame(t, { fmt: 'jpeg', quality: 0.3 }); return window.__mc.stats(); }, f / FPS);
    const diff = prev && lstep === 1 ? st.thumb.reduce((s, v, i) => s + Math.abs(v - prev[i]), 0) / st.thumb.length : null;
    lumaRows.push({ f, y: st.yavg, std: st.ystd, diff }); prev = st.thumb;
    if (f % 240 === 0) console.log(`  luma f${f} Y ${st.yavg}`);
  }
}
const jumps = [], blank = [], dups = [];
for (let i = 1; i < lumaRows.length; i++) { const A = lumaRows[i - 1], B = lumaRows[i]; if (B.f - A.f !== 1) continue;
  const j = Math.abs(B.y - A.y); if (j > 25 && !nearFlash(B.f) && shotOf(A.f) === shotOf(B.f)) jumps.push({ f: B.f, shot: shotOf(B.f), from: A.y, to: B.y, jump: +j.toFixed(1) });
  if (B.diff != null && B.diff < 0.05) dups.push(B.f); }
for (const r of lumaRows) if ((r.std != null && r.std < 1.5) || r.y < 17) blank.push(r.f);
// dup runs: on twos every other frame repeats for characters, but the camera moves on ones -> runs of >= 3 identical frames
const runs = []; let run = [];
for (const f of dups) { if (run.length && f !== run[run.length - 1] + 1) { if (run.length >= 2) runs.push(run); run = []; } run.push(f); } if (run.length >= 2) runs.push(run);
report.luma = { frames: lumaRows.length, ymin: Math.min(...lumaRows.map(r => r.y)), ymax: Math.max(...lumaRows.map(r => r.y)), jumps, blank, dupFrames: dups.length,
  frozenRuns: runs.map(r => ({ from: r[0] - 1, to: r[r.length - 1], shot: shotOf(r[0]) })) };
// 3. purity of t
if (opt('purity')) { const n = +opt('purity'); report.purity = []; const thumb = async (f) => (await film.page.evaluate(async (t) => { await window.__mc.renderFrame(t, { fmt: 'jpeg', quality: 0.3 }); return window.__mc.stats().thumb; }, f / FPS));
  for (let i = 0; i < n; i++) { const f = Math.floor(i * FRAMES / n) + 3; await thumb(Math.max(0, f - 1)); const A = await thumb(f); await thumb((f + 911) % FRAMES); const B = await thumb(f); const d = A.reduce((s, v, k) => s + Math.abs(v - B[k]), 0) / A.length; if (d > 0.35) report.purity.push({ f, shot: shotOf(f), diff: +d.toFixed(2) }); }
  console.log(`purity: ${n} frames rendered twice, order-dependent: ${report.purity.length ? report.purity.map(p => `f${p.f}(${p.shot}) ${p.diff}`).join(', ') : 'none'}`); }
report.pageErrors = film.errors;
await film.close();
fs.writeFileSync(workPath('check', 'report.json'), JSON.stringify(report, null, 1));
fs.writeFileSync(workPath('check', 'luma.txt'), lumaRows.map(r => `${r.f} ${shotOf(r.f)} ${r.y} ${r.diff ?? ''}`).join('\n'));
console.log(`luma: ${lumaRows.length} frames, Y ${report.luma.ymin}-${report.luma.ymax} (tv), jumps > 25: ${jumps.length ? jumps.map(j => `f${j.f}(${j.shot}) ${j.jump}`).join(', ') : 'none'}`);
console.log(`blank frames: ${blank.length ? blank.join(',') : 'none'} | identical-to-previous: ${dups.length} | frozen runs (>=3 frames): ${report.luma.frozenRuns.length ? report.luma.frozenRuns.map(r => `${r.shot} f${r.from}-${r.to}`).join(', ') : 'none'}`);
console.log(`page errors: ${report.pageErrors.length}`); console.log('report ->', workPath('check', 'report.json'));
process.exitCode = report.pageErrors.length || report.collisions.length || report.purity?.length ? 1 : 0;
