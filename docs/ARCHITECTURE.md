# RYŪ · 龍 — architecture

76 s, 24 fps, 1920×1080, 30 shots, 1824 frames. Every frame is a pure function of film time `t` (frame `f` = `t * 24`), so
frames render in any order and the render is resumable. No `Math.random`, no `Date`, no state carried between `update` calls.

Render order: shadow / mirror → main MRT (colour + normal, depth, id) → paint → ink → water → atmosphere → overlay FX → bloom / grade.

## Module API

`src/<team>.js`: `export async function create(ctx)` returns `{ update(t, shot), afterCamera?(t, shot), dispose(), ...public API }`.

- `create` builds once. It may be async. The returned object is published as `ctx.modules.<team>`.
- `update` poses everything for `t`. Hide your objects when they are not in the shot.
- `afterCamera` runs once the camera is placed (billboards, screen-facing FX).
- Update order: `world, sky, ocean, dragon, keeper, fx` (`audio` has no picture). The camera is placed after all updates.

`shot` = `{ id, i, t0, t1, set, env, owner, what, f0, f1, lt, d, k, t, f, groups, look }`.
`set` is what is on screen; `env` is the world behind a close `shrine` shot (s13 island, s17 sea, s22 storm, s25 sky; default island).

## ctx

`THREE, scene, overlay, sets, camera, renderer, pipeline, mat / materials { cel, bg, fx, overlay, mrt, keepMask, shadeOf, hiOf, nextId, ID, CLAWD_PAL, toonClawd },
kit, glsl, light, util, water { reflection }, shadowRoots, solids, onTwos, onThrees, rng(seed), geo (GEO), cues (CUES), shots (SHOTS), shot (by id), shotTime, FPS, DURATION, FRAMES,
asset(path), json(path), loadClawd(opts) -> { clawd, toon }, label(text, obj), modules, state, q, scale, W, H`.

Cameras and looks: `src/cams/<team>.js` exports `CAMS` and `LOOKS`, keyed by shot id, `(lt, d, t, st) => ...` with `st = { shot, k, ctx }`.
A shot resolves to `DEFAULT_CAMS` (`src/cams/index.js`) unless its owner's `CAMS` has it. Looks: `BASE_LOOK` ← `setLook(env, t)` ← team `LOOKS`. A team look can add groups through `show: ['storm']`.

URL: `?t=12.5 | ?f=300 | ?shot=s16[@0..1] | ?scale=2 | ?play=1 | ?labels=1 | ?cam=x,y,z&at=x,y,z&fov=40 | ?groups=town,sea | ?dragon=0 | ?look={...} | ?debug=id|depth|normal|mask|raw | ?render=1`.

## Set groups

`ctx.sets.<group>`, toggled per shot by `shot.groups`:

| group | content | owner |
|---|---|---|
| `island` | the island terrain | world |
| `shrine` | the shrine rig + Clawd; on in every set except the card | keeper |
| `paddies` | the rice plain | world |
| `town` | the ported coast: town, harbour, pier, hills, cat, laundry, wires | world |
| `sea` | ocean + day dome + cumulus (dusk from 63.5) | world |
| `storm` | wall at `GEO.STORM.z`; dome and dark sea only when `env === 'storm'` | world |
| `sky` | high dome + sea of cloud centred on `GEO.SKY` | world |

The dragon lives in `ctx.scene` and hides itself (placeholder: visible for `t` in [20, 70)).

## Geography (`GEO` in `src/shots.js`; metres, y up, sea level 0)

One continuous world. The sun is on the +z side, so looking toward -z gives sunlit faces.

- **Island peak**: `ISLAND` = centre (-3600, 2600), radius 1100, peak y 420, 2.6 km off the rice coast. The sleeping dragon is the island.
- **Shrine on the brow**: rest pose of the brow = (-3600, 420, 2600), forward +z. The shrine stands between the horns and is posed from `dragon.headFrame(t)`.
- **Shrine local frame**: platform top y 0, shrine body z -2.5, steps go down +z from z 2.4, torii z 4.5, bell frame x -2.2, Clawd (0, 0, 1.6).
- **Paddies**: `PADDIES` = centre (-3400, y 24, -1250), 3600 × 1900, on the mainland coast west of the town.
- **Town**: the ported coast, unmoved: pier end at the origin, deck y 2.2, seawall z -42, town climbing toward -z to about z -1000, hills behind it.
- **Sea and storm**: open sea toward +z, storm wall face at z 9500, with a flight corridor |x| < 1600 inside it.
- **Above the storm**: sea of cloud centred at (0, 12500), cloud top y 3300.

Flight path (placeholder keys in `src/dragon.js`): rise over the island → dive toward the mainland → east along the rice plain (s15) → over the town (s16) → south out to sea (s18) → storm (s19-s23) → breakout (s24). There is a cut at 63.5: the dusk segment restarts near the island and lands on the rest pose by 68.5.

## Public APIs in place

- `dragon`: `anchor(name, t)` (`brow, head, eye, jaw, hornL, hornR, tail, mid`), `spine(u, t)`, `headFrame(t)`, `root`.
- `keeper`: `toWorld([x, y, z])`, `clawd`, `toon`, `root`, `broom`.
- `world`: the ported coast API (`ground, coast, life, boats, pier, anchor`) plus `islandHeight(r, a)`.
- `ocean`: `height, normal, surface`. Film 32's bay bulge and ring wave are switched off.
- `sky`: `dusk(t)`, `anchor`, `coastClouds`, `skyClouds`.
- `fx`: empty.

Tools: `snap`, `render` (resumable), `render-audio`, `encode`, `build-player`, `check`, `sheet`, all with `--team <engine|dragon|keeper|world|fx|sound>`. Each team has its port range and `WORK = %LOCALAPPDATA%\Temp\ryu-work\<team>`.
