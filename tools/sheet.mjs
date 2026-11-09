// Contact sheet (ffmpeg xstack + labels).
//   node tools/sheet.mjs --dir <dir> [--match regex] [--cols 4] [--w 640] [--out sheet.jpg]
//   import { makeSheet } from './sheet.mjs'; makeSheet(files, labels, out, { cols, w })
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const FONT = os.platform() === 'win32' ? "fontfile='C\\:/Windows/Fonts/consola.ttf':" : '';
const esc = (s) => String(s).replace(/\\/g, '/').replace(/'/g, '').replace(/:/g, '\\:').replace(/,/g, '\\,');
export function makeSheet(files, labels, out, { cols = 4, w = 640, quality = 3 } = {}) {
  const h = Math.round(w * 9 / 16), fs_ = Math.max(12, Math.round(w / 34));
  const parts = files.map((f, i) => `[${i}:v]scale=${w}:${h}:flags=lanczos,drawbox=x=0:y=0:w=${w}:h=${fs_ + 10}:color=black@0.55:t=fill,drawtext=${FONT}text='${esc(labels[i] ?? path.basename(f))}':x=8:y=5:fontsize=${fs_}:fontcolor=white[v${i}]`);
  const layout = files.map((f, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join('|');
  const fc = parts.join(';') + ';' + files.map((f, i) => `[v${i}]`).join('') + (files.length > 1 ? `xstack=inputs=${files.length}:layout=${layout}:fill=black[out]` : `null[out]`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-v', 'error', ...files.flatMap(f => ['-i', f]), '-filter_complex', fc, '-map', '[out]', '-frames:v', '1', '-q:v', String(quality), out]);
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
  const dir = path.resolve(opt('dir', '.')), re = new RegExp(opt('match', '\\.(jpg|png)$'));
  const files = fs.readdirSync(dir).filter(f => re.test(f) && !/sheet/.test(f)).sort().map(f => path.join(dir, f));
  if (!files.length) { console.error('no images in', dir); process.exit(1); }
  const out = path.resolve(dir, opt('out', 'sheet.jpg'));
  makeSheet(files, files.map(f => path.basename(f).replace(/\.(jpg|png)$/, '')), out, { cols: +opt('cols', 4), w: +opt('w', 640) });
  console.log('sheet ->', out, `(${files.length} images)`);
}
