// RYŪ · WORLD department (owner: world) — the seaside town, harbour, pier, hills and the animals.
// Files: world-terrain.js (coast field, ground, land, forest) · world-town.js (houses, poles + wires, shrine, school,
// fish market, ground map) · world-hero.js (the detailed house on the quay) · world-harbor.js (seawall, breakwaters,
// tetrapods, lighthouses, pier, boats) · world-life.js (cat, gulls, furin, laundry) · world-geo.js (builders, wires).
// The sea is src/ocean.js, the skies src/sky.js (+ sky-clouds.js), cameras + looks src/cams/world.js.
//
// Geography (metres, y up, sea level 0; docs/ARCHITECTURE.md): pier end at the origin, deck top
// y = 2.2, the pier runs to the seawall face at z = -42 (wall top 3.5, quay road 3.4, z -52..-45), the town climbs the slope
// toward -z (shrine torii at (-210, ~64, -390)), green hills ~1 km back, wooded headlands left (-900, 260) and right
// (820, 160) close the bay, the harbour + breakwaters + lighthouses on the right (x 112..300).
//
// API (ctx.modules.world):
//   ground(x, z) -> terrain height        coast(x, z) -> { f0, fl, fr, f } (f > 0 = land)
//   pier = { deckY, x0, x1, z0, z1, end: [x, y, z], bollards: [[x, y, z] x2] (cup sits at y + 0.41), ladder: { x, z, top, bottom, rungs },
//            pilings: [[x, z, r], ...] }
//   life = { cat, furin, laundry, gulls, catPos } (world-life.js rigs)
//   boats = [{ root, x, z, yaw, L, W }]   (posed on the swell every frame; registered as solids 'boat<i>')
//   anchor(name) -> Vector3: 'cat' | 'catHead' | 'furin' | 'vending' | 'torii' | 'heroHouse' | 'pierEnd' | 'ladderTop' | 'seawall'
//   hero = { YG, pent, balcony, roof, ... } (the cat's house on the quay)
//   gulls (rig pool; s01 / s07 / s14 / s15 are animated here)
// RYŪ additions:
//   islandHeight(r, a), islandGround(x, z)    island terrain height (polar around GEO.ISLAND / world coordinates)
//   paddyHeight(x, z)                         terraced plain height (s12, s15; valley floor ~y 12-25 along the flight line)
//   island = { mesh, forest (InstancedMesh, ripples 15.0 / 17.2-19.8 / 66.4), birds }, paddies, flight
//   RIP_T, SNAP_T                             laundry rips / wires snap (40.46 / 40.6), in film seconds
import * as THREE from 'three';
import { ground, coast, buildTerrain, buildTrees, SEAWALL_Z } from './world-terrain.js';
import { buildTown, buildPoles, buildShrine, paintGroundMap, TOWN, HERO, SHRINE } from './world-town.js';
import { buildHero } from './world-hero.js';
import { buildHarbour, buildPier, buildBoats, PIER } from './world-harbor.js';
import { buildLife } from './world-life.js';
import { wireGeometry, wireMaterial } from './world-geo.js';
import { buildIsland, buildSeaRocks, islandHeight, islandGround } from './world-island.js';
import { buildPaddies, paddyHeight } from './world-paddies.js';
import { buildFlight, RIP_T, SNAP_T } from './world-flight.js';

export async function create(ctx) {
  const { THREE: T, sets } = ctx;
  const g = new T.Group(); g.name = 'world'; sets.town.add(g);
  const island = buildIsland(ctx, sets.island), paddies = buildPaddies(ctx, sets.paddies); buildSeaRocks(ctx, sets.sea);
  const V3 = T.Vector3;
  // town first (the ground map needs the house lots), then the land under it
  const town = buildTown(ctx, g);
  const poles = buildPoles(ctx, g, { wires: town.wires, houses: town.houses });
  const shrine = buildShrine(ctx, g);
  const hero = buildHero(ctx, g, { textures: town.textures });
  town.houses.push({ x: HERO.x, z: HERO.zf - HERO.d / 2, w: HERO.w, d: HERO.d, y: hero.YG, top: hero.roof.yr });
  const map = paintGroundMap(ctx, { houses: town.houses });
  const terrain = buildTerrain(ctx, g, { town: { ...TOWN, map } });
  const R = ctx.rng(3310), garden = [];
  for (const h of town.houses) if (R() < 0.36) { const x = h.x + (R() - 0.5) * h.w * 1.6, z = h.z - h.d * 0.7 - R() * 3, s = 2.2 + R() * 2.2; garden.push([x, ground(x, z) + s * 0.6, z, s, s * 0.85, Math.floor(R() * 5)]); }
  // the shrine grove (kept off the stone stair and the torii at its foot)
  for (let i = 0; i < 90; i++) { const a = R() * Math.PI * 2, r = 8 + R() * 55, x = SHRINE.x + Math.cos(a) * r, z = SHRINE.z - 8 + Math.sin(a) * r * 0.7; if (Math.abs(x - SHRINE.x) < 9 && z > SHRINE.z - 14) continue;
    const s = 6 + R() * 5; garden.push([x, ground(x, z) + s * 0.5, z, s, s * 1.1, 4]); }
  const trees = buildTrees(ctx, g, { avoid: [[SHRINE.x, SHRINE.z + 20, 30]], extra: garden });
  const harbour = buildHarbour(ctx, g);
  const pier = buildPier(ctx, g);
  const boats = buildBoats(ctx, g);
  for (const b of boats) town.wires.push({ pts: b.lampPts, r: 0.01, boat: b });
  const life = buildLife(ctx, g, { hero, wires: town.wires, poleLine: poles.heroSpan });
  // wires: static ones in one mesh; the boat lamp lines follow their boats
  const wm = wireMaterial(ctx);
  const staticW = town.wires.filter(w => !w.boat && !w.far), wires = new T.Mesh(wireGeometry(staticW), wm); wires.name = 'wires'; wires.frustumCulled = false; g.add(wires);
  // back-lane wires: hidden when the camera is far from the town (a wide shot reads them at the wrong scale)
  const farWires = new T.Mesh(wireGeometry(town.wires.filter(w => w.far)), wm); farWires.name = 'wires-far'; farWires.frustumCulled = false; g.add(farWires);
  for (const b of boats) { const m = new T.Mesh(wireGeometry([{ pts: b.lampPts, r: 0.01 }]), wm); b.body.add(m); }
  // the hero block + animals cast the cel shadow in the close shots (LOOK.shadow set by src/cams/world.js)
  ctx.shadowRoots.push(hero.group, hero.vend, ...life.shadowRoots);
  const pileList = pier.piles.map(([x, z, r]) => [x, z, r]);
  const flight = buildFlight(ctx, g, { life, poleLine: poles.heroSpan });

  // top of the roofs under (x, z), else terrain (s16 camera: skims the tiles)
  const roofTop = (x, z) => { let y = ground(x, z); for (const h of town.houses) { const dx = Math.abs(x - h.x), dz = Math.abs(z - h.z); if (dx < h.w * 0.62 && dz < h.d * 0.62 && h.top > y) y = h.top; } return y; };
  const api = {
    roofTop, ground, coast, islandHeight, islandGround, paddyHeight, island, paddies, flight, RIP_T, SNAP_T, hero, boats, gulls: life.gulls, life, town, SEAWALL_Z,
    pier: { deckY: PIER.deckY, x0: PIER.x0, x1: PIER.x1, z0: PIER.z0, z1: PIER.z1, end: [0, PIER.deckY, 0], bollards: PIER.bollards, ladder: PIER.ladder, pilings: pileList },
    anchor(name) {
      const a = life.anchor(name); if (a) return a;
      if (name === 'vending') return hero.vend.getWorldPosition(new V3());
      if (name === 'torii') return new V3(...shrine.torii);
      if (name === 'heroHouse') return new V3(HERO.x, hero.YG, HERO.zf - HERO.d / 2);
      if (name === 'pierEnd') return new V3(0, PIER.deckY, 0);
      if (name === 'ladderTop') return new V3(PIER.ladder.x, PIER.deckY, PIER.ladder.z);
      if (name === 'seawall') return new V3(0, 3.5, SEAWALL_Z);
      return new V3();
    },
    update(t, shot) {
      island.update(t, shot); paddies.update(t, shot);
      const coastOn = shot.groups.includes('town'); if (!coastOn) return;
      // boats ride the swell (on threes via ocean.height); hull foam rings go to the ocean shader
      const oc = ctx.modules.ocean, foam = [];
      // while the bay bulges (s14-s15) the surge from it rolls the moored boats hard (±7°, on threes with the water)
      const surge = ctx.util.sstep(28.9, 29.5, t) * (1 - ctx.util.sstep(33.5, 35.5, t));
      for (const b of boats) { const h = (x, z) => oc?.height ? oc.height(x, z, t) : 0, cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
        const fx = sy * b.L * 0.4, fz = cy * b.L * 0.4, sx = cy * b.W * 0.45, sz = -sy * b.W * 0.45;
        const hc = h(b.x, b.z), hf = h(b.x + fx, b.z + fz), hb = h(b.x - fx, b.z - fz), hl = h(b.x - sx, b.z - sz), hr = h(b.x + sx, b.z + sz);
        const ft = ctx.onThrees(t), rock = 0.012 * Math.sin(ft * 1.7 + b.phase) + surge * 0.12 * Math.sin(ft * 3.4 + b.phase), pitch = surge * 0.035 * Math.sin(ft * 3.4 + b.phase - 1.2);
        b.root.position.set(b.x, (hc * 2 + hf + hb) / 4 - 0.12 + surge * 0.25 * Math.sin(ft * 3.4 + b.phase + 0.8), b.z);
        b.body.rotation.set(Math.atan2(hb - hf, b.L * 0.8) + pitch, 0, Math.atan2(hr - hl, b.W * 0.9) + rock, 'XYZ');
        b.flag.rotation.y = 0.3 * Math.sin(ctx.onTwos(t) * 5 + b.phase);
        foam.push([b.x, b.z, b.L * 0.52, b.W * 0.55, b.yaw]); }
      oc?.setBoats?.(foam); oc?.setPiles?.(pileList);
      trees.setDusk(ctx.modules.sky?.dusk ? ctx.modules.sky.dusk(t) : 0);
      life.update(t, shot); flight.update(t, shot);
    },
    afterCamera(t, shot) { if (!shot.groups.includes('town')) return; const cp = ctx.camera.position;
      pier.setLOD(cp); farWires.visible = Math.hypot(cp.x, cp.y - 20, cp.z + 200) < 330; },
    dispose() { g.removeFromParent(); },
  };
  return api;
}
