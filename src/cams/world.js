// RYŪ · 龍 · cameras + looks of the world team (owner: world). See src/cams/index.js for the signature. Cameras on ones.
import { GEO, CUES } from '../shots.js';
const I = GEO.ISLAND;
const lerp = (a, b, k) => a + (b - a) * k, sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); }, ease = (k) => k * k * (3 - 2 * k);
const L3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const mv = (p0, p1, l0, l1, fov0, fov1 = fov0, o = {}) => (lt, d) => { const k = ease(lt / d); return { pos: L3(p0, p1, k), look: L3(l0, l1, k), fov: lerp(fov0, fov1, k), ...o }; };
const head = (st, t) => { const a = st.ctx.modules.dragon?.anchor?.('head', t); return a ? [a.x, a.y, a.z] : null; };
// a hand-held shake on ones: amp in metres, a few Hz (deterministic)
const shake = (t, amp, seed = 0) => [amp * (Math.sin(t * 61.7 + seed) * 0.6 + Math.sin(t * 37.3 + seed * 2) * 0.4), amp * (Math.sin(t * 53.1 + seed * 3) * 0.6 + Math.sin(t * 29.9 + seed) * 0.4), amp * Math.sin(t * 47.3 + seed * 5) * 0.5];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const CAMS = {
  // wide: the island + cumulus + sea, slow push in
  s01: mv([I.x + 1950, 140, I.z + 3550], [I.x + 1700, 118, I.z + 3050], [I.x, 300, I.z], [I.x + 30, 285, I.z], 34, 32),
  // from over the canopy looking up the slope at the peak: the birds burst toward us
  s07: mv([I.x + 520, 232, I.z + 760], [I.x + 500, 244, I.z + 720], [I.x + 120, 300, I.z + 170], [I.x + 125, 320, I.z + 160], 40, 38),
  // wide, the whole mountain from the sea, framed so the ripple rolls toward the camera
  s08: mv([I.x + 1560, 110, I.z + 2460], [I.x + 1460, 100, I.z + 2280], [I.x + 10, 215, I.z], [I.x + 10, 225, I.z], 36, 35),

  // s15: skimming the rice, low and hard, the head filling the top of the frame, rows and the V wake streaming under
  s15: (lt, d, t, st) => { const h = head(st, t) ?? [-3200, 38, -1100], k = lt / d, p = lt < 1.45 ? add(h, [290 - 50 * k, 0, 135 + 30 * Math.sin(lt * 1.4)]) : add(h, [-330, 0, 170 + 20 * Math.sin(lt * 1.4)]), w = st.ctx.modules.world, gy = w?.paddyHeight ? w.paddyHeight(p[0], p[2]) : 24;
    p[1] = gy + (lt < 1.45 ? 13 + 3 * Math.sin(lt * 3.2) : 58 + 6 * Math.sin(lt * 2.2)); const sh = shake(t, 1.2, 1.3), look = lt < 1.45 ? add(h, [-30, -38, -15]) : add(h, [60, -70, -20]); return { pos: add(p, sh), look, fov: 62 - 6 * k, roll: -4 + 3 * Math.sin(lt * 2.1) }; },

  // s16: three hard cuts inside the shot. A: backing over the roofs looking back at the head as it rushes the town. B: hero street, laundry + wires.
  // C: the cat on the pent roof.
  s16: (lt, d, t, st) => { const w = st.ctx.modules.world, H = (x, z) => w?.ground ? w.ground(x, z) : 20;
    if (lt < 1.3) { const k = lt / 1.3, x = lerp(-300, 320, k), z = lerp(-165, -128, k) + 14 * Math.sin(lt * 3), Rf = (ax, az) => w?.roofTop ? w.roofTop(ax, az) : H(ax, az), gy = (Rf(x - 7, z) + Rf(x, z) * 2 + Rf(x + 7, z)) / 4, p = [x, gy + 16 + 6 * (1 - sstep(0, 0.28, lt)), z], h = head(st, t) ?? [-900, 60, -600], l = [lerp(p[0], h[0], 0.6), p[1] + (h[1] - p[1]) * 0.5 - 8, lerp(p[2], h[2], 0.6)];
      return { pos: add(p, shake(t, 0.35, 2.1)), look: l, fov: 56 - 4 * k, roll: 3 * Math.sin(lt * 5) }; }
    if (lt < 2.2) { const b = w?.life?.laundry?.items?.[0]?.position, c = b ? [b.x + 3.1, b.y - 0.55, b.z + 1.05] : [0, 8, -50]; const k = (lt - 1.3) / 0.9;
      return { pos: add([c[0] - 0.4 * k, c[1] + 0.1, c[2] - 0.15 * k], shake(t, 0.012 * (1 + 2 * sstep(1.5, 1.8, lt)), 3.3)), look: b ? [b.x - 0.4, b.y - 0.1, b.z - 0.15] : [0, 7, -40], fov: 38, roll: 2 + 3 * Math.sin(lt * 9) }; }
    const c = w?.life?.catPos, k = (lt - 2.2) / 0.8; return { pos: c ? add([c.x + 0.72, c.y + 0.16, c.z + 0.56 - 0.06 * k], shake(t, 0.008, 4.4)) : [0, 9, -48], look: c ? [c.x, c.y + 0.04, c.z] : [0, 8, -46], fov: 28 - 2 * k, roll: 3 }; },

  // s18: chase the tail across the sea, skimming low. Stacks whip past, the spray wall behind
  s18: (lt, d, t, st) => { const A = (n) => st.ctx.modules.dragon?.anchor?.(n, t)?.toArray?.() ?? [100, 60, 3000], tail = A('tail'), m = A('mid'), p = [tail[0] + 330 + 40 * Math.sin(lt * 1.3), 26 + 4 * Math.sin(lt * 2.3), tail[2] + 120 + 60 * (lt / d)], look = [tail[0] * 0.72 + m[0] * 0.28, tail[1] * 0.7 + m[1] * 0.3, tail[2] * 0.72 + m[2] * 0.28];
    return { pos: add(p, shake(t, 1.4, 5.1)), look, fov: 60, roll: -4 + 3 * Math.sin(lt * 1.7) }; },

  // s19: under the head, the wall ahead filling the frame as it closes
  s19: (lt, d, t, st) => { const h = head(st, t) ?? [0, 200, 8000], k = lt / d, p = add(h, [300, 0, -880 + 90 * k]); p[1] = Math.max(16, h[1] * 0.25 + 20 + 8 * Math.sin(lt * 2.5));
    return { pos: add(p, shake(t, 0.9, 6.2)), look: [h[0] * 0.6 + 40, lerp(1250, 1900, k), GEO.STORM.z], fov: lerp(60, 66, k), roll: 1.5 * Math.sin(lt * 1.4) }; },

  // s20: inside: alongside the coils in the indigo canyon, scud whipping past
  s20: (lt, d, t, st) => { const h = head(st, t) ?? [0, 300, 9500], k = lt / d, p = add(h, [-170 + 40 * Math.sin(lt * 1.2), -20 + 16 * Math.sin(lt * 2), -230 + 60 * k]);
    return { pos: add(p, shake(t, 1.8, 7.7)), look: add(h, [20, 5, 60]), fov: 58, roll: -8 + 7 * Math.sin(lt * 1.5) }; },
};

const FLASH_LOOK = (t, st) => { const f = st.ctx.modules.sky?.flashK?.(t) ?? 0; return { grade: { expo: 1 + 0.2 * f, flash: 0.08 * f, flashCol: 0xd8d0ff } }; };
export const LOOKS = {
  s01: () => ({ haze: { density: 0.00003, max: 0.25 } }),
  s08: () => ({ haze: { density: 0.00003, max: 0.25 } }),
  s15: () => ({ haze: { density: 0.00004, max: 0.3 }, ink: { min: 0.6 } }),
  // s16: the three hard cuts inside the shot stay within the luma rule (street and cat are brighter than the roofs)
  s16: (lt) => ({ grade: lt < 1.3 ? { expo: 1.1 } : lt < 2.2 ? { expo: 0.91, tint: 0xf8f8f8 } : { expo: 0.86, tint: 0xeeeeee } }),
  s18: () => ({ haze: { density: 0.00003, max: 0.25 } }),
  s19: () => ({ haze: { color: 0x5a58ae, density: 0.00004, falloff: 0.0006, max: 0.28, sunScatter: 0.1 } }),
  s20: (lt, d, t, st) => ({ ...FLASH_LOOK(t, st), haze: { color: 0x3a3590, density: 0.00012, h0: 0, falloff: 0, max: 0.5, sunScatter: 0.1, sky: 0.3 } }),
};
