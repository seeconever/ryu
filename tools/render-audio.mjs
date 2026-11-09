// Soundtrack: audio.html (src/audio.js on an OfflineAudioContext, mastered by src/audio-master.js) ->
// WORK/audio/soundtrack.wav (48 kHz stereo float) + soundtrack.m4a (AAC 192k, for the single-file player) + report.json.
// Prints the analysis we "listen" with (loudness per section and shot, the breakout margin, the phone check, band gains at
// every hit, spectrum, cue onsets vs the cues as played, harsh top > 9 kHz, clicks) and re-measures the WAV and the AAC
// with ffmpeg's EBU R128 meter.
// Owner: sound (engine keeps it working).
//   node tools/render-audio.mjs [--team sound] [--sr 48000] [--sheet docs/team-sound.jpg] [--quiet] [--verify]
//   --verify renders the graph a second time and prints the largest raw sample difference (determinism check)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { serve, browser, workPath, opt, flag, ffmpeg, REPO } from './lib.mjs';

const sr = +opt('sr', 48000), sheet = opt('sheet'), quiet = flag('quiet'), verify = flag('verify'), srv = await serve(), br = await browser();
const page = await br.newPage({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.log('[pageerror]', e.message); process.exitCode = 3; });
page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
await page.goto(srv.url + 'audio.html'); await page.waitForFunction(() => window.audioReady, null, { timeout: 60000 });
const t0 = Date.now(), r = await page.evaluate(([sr, verify]) => window.renderSoundtrack(sr, { verify }), [sr, verify]);
if (sheet) { await page.evaluate(() => window.drawSheet()); const out = path.resolve(REPO, sheet); fs.mkdirSync(path.dirname(out), { recursive: true }); await page.locator('#sheet').screenshot({ path: out, type: 'jpeg', quality: 88 }); console.log('sheet ->', out); }
await br.close(); await srv.close();

const L = new Float32Array(Buffer.from(r.L, 'base64').buffer.slice(0)), R = new Float32Array(Buffer.from(r.R, 'base64').buffer.slice(0)), n = L.length;
const b = Buffer.alloc(44 + n * 8);
b.write('RIFF', 0); b.writeUInt32LE(36 + n * 8, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(2, 22);
b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 8, 28); b.writeUInt16LE(8, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * 8, 40);
for (let i = 0; i < n; i++) { b.writeFloatLE(L[i], 44 + i * 8); b.writeFloatLE(R[i], 48 + i * 8); }
const wav = workPath('audio', 'soundtrack.wav'), m4a = workPath('audio', 'soundtrack.m4a');
fs.writeFileSync(wav, b);
fs.writeFileSync(workPath('audio', 'report.json'), JSON.stringify({ master: r.master, ms: r.ms, ...r.report }, null, 1));
console.log(`soundtrack.wav ${(n / sr).toFixed(2)} s, sample peak ${(20 * Math.log10(Math.max(r.peak, 1e-9))).toFixed(2)} dBFS, ${Date.now() - t0} ms (graph ${r.ms.graph}, render ${r.ms.render}, master ${r.ms.master}, analyze ${r.ms.analyze}) -> ${wav}`);
if (r.peak > 1) console.log('WARNING: clipping (peak > 0 dBFS)');
if (verify) console.log(`determinism: second render, largest raw difference ${r.verifyDb} dBFS (${r.verifyDb === -Infinity ? 'bit-identical' : r.verifyDb === null || r.verifyDb > -70 ? 'WARNING: not deterministic' : 'float32 mixer rounding only'})`);
execFileSync(ffmpeg, ['-y', '-v', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', m4a]);
console.log('soundtrack.m4a ->', m4a, `${(fs.statSync(m4a).size / 1024).toFixed(0)} KB`);

// independent check with ffmpeg's EBU R128 meter (WAV and the encoded AAC)
const ebur = (f) => { const s = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', f, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '', sum = s.slice(s.lastIndexOf('Summary:'));
  return { I: +(/I:\s+(-?[\d.]+) LUFS/.exec(sum) || [])[1], LRA: +(/LRA:\s+(-?[\d.]+) LU/.exec(sum) || [])[1], TP: +(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum) || [])[1] }; };
const ew = ebur(wav), ea = ebur(m4a), m = r.master;
console.log(`master: raw ${m.rawI} LUFS, gain ${m.gainDb} dB, soft clip max ${m.clipDb} dB (${m.clipOvers} 4x-samples), limiter max GR ${m.maxGR} dB (ceiling ${m.ceilUsed}) -> ${m.I} LUFS, ${m.tp} dBTP`);
console.log(`ffmpeg ebur128: WAV ${ew.I} LUFS, TP ${ew.TP} dBTP, LRA ${ew.LRA} | AAC ${ea.I} LUFS, TP ${ea.TP} dBTP`);
if (ew.TP > -1.5 || ea.TP > -1.5) console.log('WARNING: true peak above -1.5 dBTP');
if (Math.abs(ew.I + 14) > 0.5) console.log('WARNING: integrated loudness off -14 LUFS');
const rep = r.report; if (!rep || quiet) process.exit();
console.log(`loudest momentary: ${rep.peaksM.map(p => `${p.M}@${p.t}`).join(' ')} | short-term max ${rep.maxS.S} (window ${rep.maxS.from}-${rep.maxS.t} s) | true peak ${rep.tp} dBTP @ ${rep.tpAt} s`);
console.log('section       LUFS   ' + Object.keys(Object.values(rep.spectrum)[0]).map(k => k.padStart(7)).join(''));
for (const [k, v] of Object.entries(rep.spectrum)) console.log(k.padEnd(13) + String(rep.sectionLufs[k]).padStart(6) + '  ' + Object.values(v).map(x => String(x).padStart(7)).join(''));
console.log('shots (LUFS / max momentary / TP / limiter GR / soft clip dB):');
for (let i = 0; i < rep.shots.length; i += 6) console.log('  ' + rep.shots.slice(i, i + 6).map(s => `${s.id} ${s.lufs}/${s.maxM}/${s.tp}/${s.gr}/${s.clip}`.padEnd(30)).join(''));
console.log('cue onsets (ms vs cue, rise dB): ' + Object.entries(rep.onsets).map(([k, o]) => `${k} ${o.dms > 0 ? '+' : ''}${o.dms}(${o.riseDb})`).join(', '));
if (rep.margin) console.log(`breakout margin: ${rep.margin.impactM} LUFS @ ${rep.margin.at} vs next loudest ${rep.margin.nextM} @ ${rep.margin.nextAt} -> ${rep.margin.lu} LU (target >= 3)`);
if (rep.phone) { const ph = Object.entries(rep.phone), top = ph.reduce((a, b) => (b[1].db > a[1].db ? b : a));
  console.log(`phone (mono, HPF 350 Hz 4th order, max RMS 400 ms, dBFS): loudest ${top[0]} ${top[1].db}@${top[1].t}`);
  for (let i = 0; i < ph.length; i += 9) console.log('  ' + ph.slice(i, i + 9).map(([k, v]) => `${k} ${v.db}`.padEnd(12)).join('')); }
if (rep.bands) { console.log('band gains at hits (lo/mid/hi dB over 60 ms; * = a needed band rises < 3 dB):');
  for (let i = 0; i < rep.bands.length; i += 4) console.log('  ' + rep.bands.slice(i, i + 4).map(b => `${b.weak.length ? '*' : ' '}${b.name}@${b.t} ${b.lo}/${b.mid}/${b.hi}`.padEnd(40)).join('')); }
if (rep.synced && Object.keys(rep.synced).length) console.log('picture sync (CUES -> as played): ' + Object.entries(rep.synced).map(([k, [a, b]]) => `${k} ${a} -> ${b}`).join(', '));
if (rep.hiss) { const h = rep.hiss, sh = Object.entries(h.shots), dx = sh.reduce((a, b) => (b[1].dx > a[1].dx ? b : a));
  console.log(`harsh top (> 9 kHz, 10 ms windows, limit ${h.limit} dBFS): loudest ${h.top.map(p => `${p.db}@${p.t}`).join(' ')} | largest sample step ${dx[1].dx} (${dx[0]})${h.over.length ? ' | WARNING over the limit: ' + h.over.join(', ') : ''}`);
  for (let i = 0; i < sh.length; i += 9) console.log('  ' + sh.slice(i, i + 9).map(([k, v]) => `${k} ${v.db}/${v.dx}`.padEnd(17)).join('')); }
console.log(`clicks (single-sample transients): ${rep.clicks.length}${rep.clicks.length ? ' first: ' + rep.clicks.slice(0, 8).map(c => `${c.t}${c.ch} x${c.ratio}`).join(' ') : ''} | DC ${rep.dc.join(' ')} | edges ${rep.edges.first} ${rep.edges.last}`);
