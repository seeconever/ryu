// RYŪ · shared tool helpers: static server on the repo + GPU Chromium (Playwright), WORK dir, ports per team.
//   --team engine|dragon|keeper|world|fx|sound  (or env MC_TEAM): picks the port range (CONTRACT.md) and WORK subdir
//   WORK = env MC_WORK, else %LOCALAPPDATA%\Temp\ryu-work\<team> on Windows, else <repo>/WORK/<team>
//   CHROME = path to a Chrome/Chromium binary (optional; default = Playwright's Chromium)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const args = process.argv.slice(2);
export const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
export const flag = (k) => args.includes('--' + k);
export const positional = () => { const out = []; for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) { if (i + 1 < args.length && !args[i + 1].startsWith('--') && !BOOL.has(args[i].slice(2))) i++; continue; } out.push(args[i]); } return out; };
const BOOL = new Set(['allow-sw', 'all', 'png', 'jpg', 'keep', 'measure', 'no-sheet', 'headed', 'shuffle', 'reverse', 'skip-render', 'skip-audio', 'skip-encode', 'skip-player', 'quick']);
export const TEAM = opt('team', process.env.MC_TEAM || 'engine');
const PORTS = { engine: 9000, dragon: 9010, keeper: 9020, world: 9030, fx: 9040, sound: 9050 };
if (!(TEAM in PORTS)) throw new Error('unknown --team ' + TEAM);
export const WORK = process.env.MC_WORK || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'ryu-work', TEAM) : path.join(REPO, 'WORK', TEAM));
export const workPath = (...p) => { const f = path.resolve(WORK, ...p); fs.mkdirSync(path.dirname(f), { recursive: true }); return f; };
export const FPS = 24, FRAMES = 1824, DURATION = 76;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.css': 'text/css' };

async function listen(server) {
  const base = +opt('port', PORTS[TEAM]);
  for (let p = base; p < (opt('port') ? base + 1 : PORTS[TEAM] + 10); p++) {
    const ok = await new Promise(res => { server.once('error', () => res(false)); server.listen(p, '127.0.0.1', () => res(true)); });
    if (ok) return p;
  }
  throw new Error(`no free port in ${PORTS[TEAM]}-${PORTS[TEAM] + 9} (team ${TEAM})`);
}
export async function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    const p = path.resolve(REPO, rel || 'index.html');
    if (!p.startsWith(REPO) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(res);
  });
  const port = await listen(server);
  return { server, port, url: `http://127.0.0.1:${port}/`, close: () => new Promise(r => server.close(r)) };
}

export async function browser() {
  const { chromium } = await import('playwright');
  const gpu = os.platform() === 'win32' ? ['--use-angle=d3d11'] : ['--use-angle=default'];
  return chromium.launch({ headless: !flag('headed'), executablePath: process.env.CHROME || undefined, args: ['--enable-gpu', '--ignore-gpu-blocklist', ...gpu, '--disable-renderer-backgrounding'] });
}

// open the film page headless. query: extra URL params (e.g. 'cam=0,5,10&at=0,0,0'). Returns { page, info, frame(t, fmt), close }
export async function openFilm({ scale = +opt('scale', 1), query = '', viewport = null, file = 'index.html', quiet = false } = {}) {
  const srv = await serve(), br = await browser();
  const W = Math.round(1920 / scale), H = Math.round(1080 / scale);
  const page = await br.newPage({ viewport: viewport || { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('[pageerror]', e.message); });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|ReadPixels/.test(t)) || /^\[(film|engine)\]/.test(t)) { if (m.type() === 'error') errors.push(t); if (!quiet) console.log('[page]', m.type(), t.slice(0, 500)); } });
  const t0 = Date.now(), q = `render=1&scale=${scale}${query ? '&' + query.replace(/^[?&]/, '') : ''}`;
  await page.goto(`${srv.url}${file}?${q}`, { timeout: 300000 });
  await page.waitForFunction(() => window.__mc && (window.__mc.error || (window.__mc.renderFrame && window.__mc.ready)), null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__mc.error); if (err) { console.error('[boot]', err); await br.close(); await srv.close(); process.exit(3); }
  await page.evaluate(() => window.__mc.ready);
  const info = await page.evaluate(() => window.__mc.info());
  if (!quiet) console.log(`renderer: ${info.renderer} | ${info.w}x${info.h} | modules: ${info.modules.join(',')} | load ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (/swiftshader|llvmpipe|basic render|software/i.test(info.renderer) && !flag('allow-sw')) { console.error('ABORT: software renderer (use --allow-sw to force)'); await br.close(); await srv.close(); process.exit(2); }
  async function frame(t, fmt = 'png', quality = 0.92) {
    const url = await page.evaluate(({ t, fmt, quality }) => window.__mc.renderFrame(t, { fmt, quality }), { t, fmt, quality });
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  }
  return { page, info, frame, errors, srv, close: async () => { await br.close(); await srv.close(); } };
}

// parse a time spec: number seconds, 'f:300', 's:s16' (mid), 's:s16@0' / '@1' / '@0.25'
export function frameOf(spec, shots) {
  if (spec.startsWith('f:')) return +spec.slice(2);
  if (spec.startsWith('t:')) return Math.round(+spec.slice(2) * FPS);
  if (spec.startsWith('s:')) { const [id, k] = spec.slice(2).split('@'); const s = shots.find(x => x.id === id); if (!s) throw new Error('unknown shot ' + id);
    return s.f0 + Math.round((k != null ? +k : 0.5) * (s.f1 - 1 - s.f0)); }
  return Math.round(+spec * FPS);
}
export const ffmpeg = process.env.FFMPEG || 'ffmpeg';
