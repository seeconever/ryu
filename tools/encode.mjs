// Frames + soundtrack -> MP4: H.264 High, yuv420p, BT.709 (matrix + tags, tv range), 24 fps CFR, AAC 192k, faststart.
//   node tools/encode.mjs [--frames frames] [--fmt png] [--crf 16] [--preset slow] [--audio audio/soundtrack.wav] [--out ryu.mp4]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { opt, flag, WORK, FPS, FRAMES, ffmpeg } from './lib.mjs';

const dir = path.resolve(WORK, opt('frames', 'frames')), fmt = opt('fmt', 'png'), CH = +opt('chunk', 96), N = +opt('to', FRAMES);
const audio = path.resolve(WORK, opt('audio', 'audio/soundtrack.wav')), out = path.resolve(WORK, opt('out', 'ryu.mp4'));
const flat = path.join(WORK, '_encode_flat'); fs.rmSync(flat, { recursive: true, force: true }); fs.mkdirSync(flat, { recursive: true });
let missing = 0;
for (let f = 0; f < N; f++) { const src = path.join(dir, `chunk_${String(Math.floor(f / CH)).padStart(4, '0')}`, `f_${String(f).padStart(5, '0')}.${fmt}`);
  if (!fs.existsSync(src)) { missing++; continue; } const dst = path.join(flat, `f_${String(f).padStart(5, '0')}.${fmt}`); try { fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); } }
if (missing) { console.error(`missing ${missing} frames in ${dir} (run tools/render.mjs)`); process.exit(1); }
const hasAudio = fs.existsSync(audio) && !flag('no-audio');
execFileSync(ffmpeg, ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(flat, `f_%05d.${fmt}`), ...(hasAudio ? ['-i', audio] : []),
  '-vf', 'scale=1920:1080:out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', opt('preset', 'slow'), '-crf', opt('crf', '16'), '-tune', 'animation',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', String(FPS),
  ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest'] : []), '-movflags', '+faststart', '-frames:v', String(N), out], { stdio: 'inherit' });
fs.rmSync(flat, { recursive: true, force: true });
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,pix_fmt,color_space,color_primaries,color_transfer,nb_frames', '-of', 'csv=p=0', out]).toString().trim().replace(/\r?\n/g, ' | ');
console.log(`mp4 -> ${out} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB) ${hasAudio ? '' : '[no audio]'}\n${probe}`);
