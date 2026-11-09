// RYŪ · engine utilities (owner: engine). Pure helpers, no THREE state.
// Everything in the film is a pure function of time: use these instead of Math.random / accumulated state.

export const FPS = 24;

// Character animation "on twos" (12 drawings/s), water FX "on threes" (8 drawings/s). Camera + light stay on ones.
export const onTwos = (t, fps = FPS) => Math.floor(t * fps / 2 + 1e-6) * 2 / fps;
export const onThrees = (t, fps = FPS) => Math.floor(t * fps / 3 + 1e-6) * 3 / fps;
export const onN = (t, n, fps = FPS) => Math.floor(t * fps / n + 1e-6) * n / fps;

// Seeded xorshift32 -> () => [0, 1). Same seed = same sequence, every frame.
export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
// stateless hash noise (for per-frame jitter that must not depend on call order)
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const hash2 = (a, b) => hash(a * 157.31 + b * 113.97);

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const ease = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
export const easeIn = (k) => { k = clamp(k); return k * k * k; };
export const easeOut = (k) => { k = clamp(k); return 1 - (1 - k) ** 3; };
export const easeIO = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
// keyed curve [[t, v], ...] eased between keys (v may be a number or an array of numbers)
export function curve(keys, t, fn = ease) {
  const mix = (a, b, k) => Array.isArray(a) ? a.map((x, i) => lerp(x, b[i], k)) : lerp(a, b, k);
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b] = keys[i]; return mix(a, b, fn((t - t0) / (t1 - t0))); }
  return keys[keys.length - 1][1];
}
// 0 -> 1 (up seconds) -> hold -> 0 (down seconds), starting to rise at t0 - up
export const bump = (t, t0, up, hold, down) => t < t0 - up ? 0 : t < t0 ? ease((t - t0 + up) / up) : t < t0 + hold ? 1 : t < t0 + hold + down ? 1 - ease((t - t0 - hold) / down) : 0;
// damped spring response to a step at t0 (overshoot for snappy accents): 0 -> 1
export const spring = (t, t0, freq = 3, damp = 0.35) => { if (t <= t0) return 0; const x = t - t0, w = 2 * Math.PI * freq; return 1 - Math.exp(-damp * w * x) * Math.cos(w * Math.sqrt(1 - damp * damp) * x); };
