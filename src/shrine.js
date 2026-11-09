// RYŪ · 龍 · THE SHRINE (owner: keeper). Platform, stone steps, honden, vermilion torii, lantern, bell frame, swinging bell, striped rope.
// Local frame (metres): platform top y = 0, x -3.6..3.6, z -4.6..2.4; steps go down +z from z 2.4 (rise 0.2, run 0.5, width 3);
// honden at z -2.5, torii z 4.5, lantern (2.6, 0, 1.6), bell frame x -2.2 z 0.4 (bell pivot y 2.62). Everything is a pure function of t.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const T = THREE, V3 = T.Vector3;
export const STEP = { x: 1.5, z0: 2.4, run: 0.5, rise: 0.2, n: 7 };
export const stepTop = (i) => -STEP.rise * (i + 1);                    // top of step i (0 = first below the platform)
export const BELL = { pivot: [-2.2, 2.62, 0.4], len: 1.08 };           // pivot; distance pivot -> rope attachment
function R(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const ss = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// bell swing angle (rad, about x): yanked by the rope at the trip, DONG at CUES.bell (13.2) at full swing, long decay, wind tilt in flight
export function bellAngle(t) {
  let a = 0;
  if (t > 11.8) { const w = 5.61, A = t < 13.2 ? 0.62 * ss(11.8, 13.2, t) : 0.62 * Math.exp(-(t - 13.2) / 2.0); a = A * Math.sin(w * (t - 11.8)); }
  if (t > 23.5 && t < 64) { const f = ss(23.5, 26, t) * (1 - ss(62, 64, t)); a -= f * (0.42 + 0.16 * Math.sin(t * 7.3) + 0.09 * Math.sin(t * 17.1)); }
  return a;
}

function paint(g, c) {   // non-indexed + vertex colour
  const n = g.index ? g.toNonIndexed() : g, col = c instanceof T.Color ? c : new T.Color(c), N = n.attributes.position.count, a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  n.setAttribute('color', new T.BufferAttribute(a, 3)); if (!n.attributes.uv) n.setAttribute('uv', new T.BufferAttribute(new Float32Array(N * 2), 2)); return n;
}
const mix = (c, o, k) => new T.Color(c).lerp(new T.Color(o), k);
function box(w, h, d, x, y, z, c, { rx = 0, ry = 0, rz = 0 } = {}) { return paint(new T.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z), c); }
function cyl(r0, r1, h, x, y, z, c, { seg = 12, rx = 0, rz = 0 } = {}) { return paint(new T.CylinderGeometry(r0, r1, h, seg).rotateX(rx).rotateZ(rz).translate(x, y, z), c); }
// a curved beam along x: box warped so its ends lift (torii kasagi)
function beam(w, h, d, x, y, z, c, lift = 0.16) { const g = new T.BoxGeometry(w, h, d, 24, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (w / 2); p.setY(i, p.getY(i) + lift * u * u * u * u); } p.needsUpdate = true; g.computeVertexNormals(); return paint(g.translate(x, y, z), c); }
// gable roof: curved profile extruded along z; apex at y = h, eaves at -half..half
function gable(wid, dep, h, x, y, z, c, thick = 0.14) {
  const s = new T.Shape(), N = 18, pts = []; for (let i = 0; i <= N; i++) { const u = i / N * 2 - 1, f = Math.pow(1 - Math.abs(u), 1.45); pts.push([u * wid / 2, h * f]); }
  pts.forEach(([a, b], i) => i ? s.lineTo(a, b) : s.moveTo(a, b));
  for (let i = N; i >= 0; i--) { const [a, b] = pts[i]; s.lineTo(a, b - thick); }
  const g = new T.ExtrudeGeometry(s, { depth: dep, bevelEnabled: false, curveSegments: 4 }); return paint(g.translate(x, y, z - dep / 2), c);
}

export function buildShrine(ctx, parent) {
  const { mat } = ctx, group = new T.Group(); group.name = 'shrine'; parent.add(group);
  const rnd = R(3607), V = (m) => { const o = m.clone(); return o; };
  const vm = (o = {}) => mat.cel(0xffffff, { id: mat.nextId(), vertexColors: true, ...o });
  const stoneM = vm({ shade: 0x9a97ae }), woodM = vm({ shade: 0x8a83a0 }), redM = vm({ shade: 0xb48aa0 }), roofM = vm({ shade: 0x8d8ba8 }), bronzeM = vm({ shade: 0x80839a }), ropeWhite = 0xf2e8d6;
  const addMerged = (list, m, name) => { const g = mergeGeometries(list, false); g.computeBoundingBox(); const o = new T.Mesh(g, m); o.name = name; group.add(o); return o; };
  const STONE = () => mix(0xc8c1b1, 0xa89f8e, rnd()), MOSS = 0x7fa24a;

  // ---- ROCK MOUND (bg paint: the shrine's knoll, feathers into the dragon's brow)
  const Mh = (x, z) => { const dx = Math.max(0, Math.abs(x) - 3.75), dz = z > 0 ? Math.max(0, z - 2.5) * 0.45 : Math.max(0, -z - 4.75), r = Math.hypot(dx, dz);
    const n = 0.16 * Math.sin(x * 2.3 + z * 1.1) + 0.09 * Math.sin(x * 5.1 - z * 3.3) + 0.05 * Math.sin(x * 11 + z * 9); return -0.42 - Math.pow(r, 1.4) * 0.62 + n * Math.min(1, r * 0.6) - (z > 2.5 ? (z - 2.5) * 0.36 : 0); };
  { const g = new T.PlaneGeometry(26, 26, 90, 90).rotateX(-Math.PI / 2), p = g.attributes.position, c = new Float32Array(p.count * 3), col = new T.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = Mh(x, z); p.setY(i, y); const r = Math.hypot(Math.max(0, Math.abs(x) - 3.7), Math.max(0, Math.abs(z + 1.1) - 3.6)), m = 0.5 + 0.5 * Math.sin(x * 3.1 + 1.3 * Math.sin(z * 2.2)) + 0.2 * Math.sin(z * 7 + x);
      col.set(m > 0.6 ? 0x6f9a48 : m > 0.25 ? 0x8fae56 : 0x9b9486); if (r < 0.5 && m < 0.4) col.set(0x867f74); if (y < -3.6) col.lerp(new T.Color(0x57743f), 0.5); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, mat.bg(0xffffff, { vertexColors: true, side: T.DoubleSide })); m.name = 'knoll'; m.userData.noSolid = true; group.add(m); }

  // ---- PLATFORM: curb + flagstones (top = y 0)
  const plat = [box(7.5, 0.5, 7.3, 0, -0.34, -1.1, 0x8e8878)];
  for (let j = 0; j < 10; j++) { const z0 = -4.6 + j * 0.7, off = j % 2 ? 0.45 : 0; for (let i = -1; i < 9; i++) { const x0 = -3.6 + i * 0.9 + off, x1 = Math.min(3.6, x0 + 0.9), xa = Math.max(-3.6, x0); if (x1 - xa < 0.15) continue;
      const h = 0.16, top = -0.003 - rnd() * 0.012; plat.push(box(x1 - xa - 0.03, h, 0.67, (xa + x1) / 2, top - h / 2, z0 + 0.35, STONE())); } }
  // moss clumps hugging the curb (small blobs, never flat slabs)
  const blob = (x, z, r) => { const g = new T.SphereGeometry(r, 7, 5); g.scale(1, 0.34, 1); g.translate(x, 0.012, z); return paint(g, mix(0x7fa24a, 0x5f8a3e, rnd())); };
  for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1, x0 = side * (3.32 + rnd() * 0.2), z0 = -4.3 + rnd() * 6.4; for (let k = 0; k < 4; k++) plat.push(blob(x0 + (rnd() - 0.5) * 0.2, z0 + (rnd() - 0.5) * 0.2, 0.012 + rnd() * 0.022)); }
  const platform = addMerged(plat, stoneM, 'platform');

  // ---- STONE STEPS
  const st = []; for (let i = 0; i < STEP.n; i++) { const z = STEP.z0 + STEP.run * i + STEP.run / 2, h = 0.2, y = stepTop(i);
    st.push(box(STEP.x * 2 - i * 0.06, h, STEP.run - 0.02, 0, y - h / 2, z, STONE())); st.push(box(STEP.x * 2 + 0.3, 0.8, STEP.run, 0, y - h - 0.4, z, 0x8e8878));
    }
  const steps = addMerged(st, stoneM, 'steps');

  // ---- HONDEN (shrine body) at z -2.5
  const WOOD = (k = 0.5) => mix(0x8f6b4a, 0x6b4d36, k), bd = [];
  bd.push(box(3.1, 0.3, 2.3, 0, 0.15, -2.6, 0x7e7a6e));                         // stone footing
  for (let i = 0; i < 12; i++) { const u = i / 11; bd.push(box(0.27, 1.9, 2.32, -1.42 + u * 2.84, 1.25, -2.6, WOOD(rnd()))); }  // plank walls
  bd.push(box(3.3, 0.14, 2.5, 0, 0.32, -2.6, WOOD(0.9))); bd.push(box(3.3, 0.2, 2.5, 0, 2.3, -2.6, WOOD(0.75)));
  for (const s of [-1, 1]) for (const z of [-3.7, -1.5]) bd.push(box(0.18, 2.2, 0.18, s * 1.5, 1.2, z, WOOD(0.2)));   // posts
  // door: dark panel + lattice
  bd.push(box(1.5, 1.5, 0.05, 0, 1.15, -1.42, 0x3e2d27)); for (let i = 0; i < 7; i++) bd.push(box(0.05, 1.5, 0.07, -0.66 + i * 0.22, 1.15, -1.39, WOOD(0.1))); for (let j = 0; j < 5; j++) bd.push(box(1.5, 0.05, 0.07, 0, 0.55 + j * 0.3, -1.39, WOOD(0.1)));
  // porch
  bd.push(box(3.6, 0.1, 0.9, 0, 0.52, -1.0, WOOD(0.3))); for (const s of [-1, 1]) bd.push(box(0.14, 0.52, 0.14, s * 1.65, 0.26, -0.65, WOOD(0.8)));
  const bodyM = addMerged(bd, woodM, 'honden');
  const rf = [gable(4.7, 3.9, 1.1, 0, 2.4, -2.6, mix(0x6e8478, 0x566659, 0.3)), box(0.26, 0.2, 3.9, 0, 3.54, -2.6, 0x4c4a48)];
  for (let i = -1; i <= 1; i++) rf.push(cyl(0.08, 0.08, 0.9, 0, 3.65, -2.6 + i * 1.1, 0x8a6b45, { rz: Math.PI / 2 }));         // katsuogi logs
  for (const z of [-4.5, -0.7]) for (const s of [-1, 1]) rf.push(box(0.1, 0.9, 0.06, s * 0.25, 3.95, z, 0x7a5a3e, { rz: -s * 0.55 }));     // chigi
  const roofMesh = addMerged(rf, roofM, 'roof');

  // ---- TORII
  const tr = []; for (const s of [-1, 1]) { tr.push(cyl(0.14, 0.17, 4.9, s * 1.66, 0.75, 4.5, 0xe1472c)); tr.push(cyl(0.21, 0.21, 0.5, s * 1.66, -1.3, 4.5, 0x2e2a2e, { seg: 12 })); tr.push(cyl(0.16, 0.16, 0.1, s * 1.66, 0.9, 4.5, 0x2e2a2e)); }
  tr.push(box(4.2, 0.24, 0.26, 0, 2.5, 4.5, 0xe1472c)); tr.push(beam(4.9, 0.2, 0.42, 0, 3.32, 4.5, 0xe1472c, 0.2)); tr.push(beam(5.2, 0.1, 0.5, 0, 3.47, 4.5, 0x2e2a2e, 0.26));
  tr.push(box(0.5, 0.75, 0.1, 0, 2.95, 4.48, 0x2e2a2e)); tr.push(box(0.36, 0.6, 0.11, 0, 2.95, 4.48, 0xd3a54a));
  const torii = addMerged(tr, redM, 'torii');

  // ---- STONE LANTERN at (2.6, 0, 1.6)
  const ln = [cyl(0.3, 0.36, 0.16, 2.6, 0.08, 1.6, 0xa39c8c, { seg: 8 }), cyl(0.1, 0.14, 0.75, 2.6, 0.52, 1.6, 0xb8b1a1, { seg: 8 }), cyl(0.3, 0.2, 0.12, 2.6, 0.95, 1.6, 0xa39c8c, { seg: 6 }), cyl(0.22, 0.22, 0.34, 2.6, 1.18, 1.6, 0xc4bdad, { seg: 6 }),
    cyl(0.05, 0.42, 0.26, 2.6, 1.48, 1.6, 0xa39c8c, { seg: 6 }), cyl(0.04, 0.09, 0.12, 2.6, 1.66, 1.6, 0x8e8878, { seg: 6 })];
  for (let i = 0; i < 3; i++) { const a = i * 2.09 + 0.5; ln.push(box(0.14, 0.2, 0.02, 2.6 + Math.cos(a) * 0.2, 1.18, 1.6 + Math.sin(a) * 0.2, 0x3a3030, { ry: -a + Math.PI / 2 })); }
  const lantern = addMerged(ln, stoneM, 'lantern');

  // ---- BELL FRAME
  const X = BELL.pivot[0], Z = BELL.pivot[2], fr = [];
  for (const s of [-1, 1]) { fr.push(box(0.18, 3.0, 0.18, X + s * 0.8, 1.5, Z, WOOD(0.35))); fr.push(box(0.5, 0.14, 0.5, X + s * 0.8, 0.07, Z, 0x8e8878)); fr.push(box(0.14, 0.14, 0.9, X + s * 0.8, 1.05, Z, WOOD(0.55))); }
  fr.push(box(2.1, 0.22, 0.26, X, 2.86, Z, WOOD(0.55))); fr.push(box(1.82, 0.14, 0.2, X, 2.62 + 0.12, Z, WOOD(0.8)));
  fr.push(gable(2.7, 1.3, 0.55, X, 3.02, Z, mix(0x6e8478, 0x566659, 0.5), 0.1));
  const frame = addMerged(fr, woodM, 'bell-frame');

  // ---- BELL (pivot group, hanging -y; swings about x)
  const bell = new T.Group(); bell.name = 'bell'; bell.position.set(...BELL.pivot); group.add(bell);
  const prof = [[0, -0.13], [0.2, -0.15], [0.27, -0.26], [0.29, -0.52], [0.31, -0.72], [0.35, -0.88], [0.41, -0.97], [0.4, -1.0], [0.37, -1.0], [0.33, -0.93], [0.3, -0.9], [0, -0.9]].map(([r, y]) => new T.Vector2(r, y));
  const bellL = [paint(new T.LatheGeometry(prof, 28), 0x6c8a6e), paint(new T.TorusGeometry(0.075, 0.022, 8, 16).translate(0, -0.04, 0), 0x4d5f50)];
  for (const [y, r, c] of [[-0.45, 0.292, 0x8fa97e], [-0.72, 0.317, 0x8fa97e], [-0.8, 0.327, 0xb6a35a]]) bellL.push(paint(new T.TorusGeometry(r, 0.012, 6, 28).rotateX(Math.PI / 2).translate(0, y, 0), c));
  for (let j = 0; j < 3; j++) for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + j * 0.26, y = -0.27 - j * 0.07, r = 0.275 + j * 0.008; bellL.push(paint(new T.SphereGeometry(0.018, 8, 6).translate(Math.cos(a) * r, y, Math.sin(a) * r), 0xa8b58a)); }
  bellL.push(paint(new T.CircleGeometry(0.075, 18).rotateY(0).translate(0, -0.66, 0.322), 0xc7a95a));
  const bellMesh = new T.Mesh(mergeGeometries(bellL, false), bronzeM); bellMesh.name = 'bell-mesh'; bell.add(bellMesh);
  const clapper = new T.Mesh(mergeGeometries([paint(new T.SphereGeometry(0.07, 12, 10).translate(0, -1.0, 0), 0x3e4a42), paint(new T.CylinderGeometry(0.018, 0.018, 0.34, 8).translate(0, -0.84, 0), 0x3e4a42)], false), bronzeM); clapper.name = 'clapper'; clapper.userData.noSolid = true; bell.add(clapper);

  // ---- ROPE: tube rebuilt per frame, red / white twist from a map
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g2 = cv.getContext('2d'); g2.fillStyle = '#f4ead8'; g2.fillRect(0, 0, 128, 128); g2.fillStyle = '#d93a2b';
  for (let i = -128; i < 256; i += 64) { g2.beginPath(); g2.moveTo(i, 0); g2.lineTo(i + 32, 0); g2.lineTo(i + 32 + 128, 128); g2.lineTo(i + 128, 128); g2.closePath(); g2.fill(); }
  const map = new T.CanvasTexture(cv); map.wrapS = map.wrapT = T.RepeatWrapping; map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
  const RN = 90, RM = 10, RAD = 0.04, rp = new Float32Array((RN + 1) * (RM + 1) * 3), rn = new Float32Array(rp.length), ru = new Float32Array((RN + 1) * (RM + 1) * 2), ri = [];
  for (let i = 0; i < RN; i++) for (let j = 0; j < RM; j++) { const a = i * (RM + 1) + j, b = a + RM + 1; ri.push(a, b, a + 1, b, b + 1, a + 1); }
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3)); rg.setAttribute('normal', new T.BufferAttribute(rn, 3)); rg.setAttribute('uv', new T.BufferAttribute(ru, 2)); rg.setIndex(ri);
  const rope = new T.Mesh(rg, mat.cel(0xffffff, { id: mat.nextId(), map, shade: 0xa8a0c0 })); rope.name = 'rope'; rope.frustumCulled = false; rope.userData.noSolid = true; group.add(rope);
  // knotted frayed tail
  const tailKnot = new T.Mesh(new T.SphereGeometry(0.058, 12, 10), mat.cel(ropeWhite, { id: mat.nextId(), shade: 0xb0a8c4 })); tailKnot.userData.noSolid = true; group.add(tailKnot);
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), up = new V3(0, 1, 0);
  function setRope(pts) {   // pts: control points in shrine-local space (array of Vector3)
    const c = new T.CatmullRomCurve3(pts, false, 'centripetal'), L = c.getLength(); let prev = null;
    for (let i = 0; i <= RN; i++) { const k = i / RN, p = c.getPointAt(k), t = c.getTangentAt(k).normalize();
      if (prev) _a.copy(prev).addScaledVector(t, -prev.dot(t)).normalize(); else _a.copy(Math.abs(t.y) > 0.9 ? _d.set(1, 0, 0) : up).cross(t).normalize();   // parallel transport: no reference-axis flip, so the tube never kinks where the rope turns vertical
      _b.crossVectors(t, _a).normalize(); prev = _a.clone();
      for (let j = 0; j <= RM; j++) { const a = j / RM * Math.PI * 2, s = Math.sin(a), co = Math.cos(a); _c.copy(_a).multiplyScalar(co).addScaledVector(_b, s); const idx = (i * (RM + 1) + j) * 3;
        rp[idx] = p.x + _c.x * RAD; rp[idx + 1] = p.y + _c.y * RAD; rp[idx + 2] = p.z + _c.z * RAD; rn[idx] = _c.x; rn[idx + 1] = _c.y; rn[idx + 2] = _c.z;
        const u2 = i * (RM + 1) * 2 + j * 2; ru[u2] = j / RM; ru[u2 + 1] = k * L * 3.0; } }
    rg.attributes.position.needsUpdate = rg.attributes.normal.needsUpdate = rg.attributes.uv.needsUpdate = true;
    tailKnot.position.copy(pts[pts.length - 1]);
  }

  function setBell(t) { bell.rotation.x = bellAngle(t); bell.updateMatrix(); }
  // rope attachment under the bell, shrine-local
  const ropeAttach = (t) => new V3(0, -BELL.len, 0).applyAxisAngle(new V3(1, 0, 0), bellAngle(t)).add(new V3(...BELL.pivot));

  const solids = { platform, steps, honden: bodyM, roof: roofMesh, torii, lantern, frame, bell: bellMesh };
  const ropeSamples = () => { const out = []; for (let i = 0; i <= RN; i++) { const c = (i * (RM + 1) + 0) * 3, o = ((i * (RM + 1) + Math.round(RM / 2)) * 3); out.push(new V3((rp[c] + rp[o]) / 2, (rp[c + 1] + rp[o + 1]) / 2, (rp[c + 2] + rp[o + 2]) / 2)); } return out; };
  const ropeTail = () => tailKnot.position.clone();
  return { group, bell, bellMesh, rope, solids, setBell, setRope, ropeAttach, mound: Mh, ropeSamples, ropeTail };
}
