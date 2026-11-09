# RYŪ · 龍 — production contract

A 76-second, 24 fps, 1920×1080 anime short (30 shots, 1824 frames) rendered in the browser with three.js (WebGL2),
captured frame by frame with headless Chrome and encoded with ffmpeg. Original story, original designs. No video or image
models, no samples. Series: "Fable 5.5 Anime Lab". Repo-ready: this folder becomes a public GitHub repo at the end.

The engine, tools, town, sea and sky were ported from the earlier Anime Lab film MEGA CLAWD.

## Art direction (take literally)
- **It must look like hand-drawn 2D theatrical anime**, not 3D. Bright, high-key summer blockbuster: deep-blue sky, towering
  white cumulus with lavender shadow sides, emerald hills, cobalt-to-turquoise sea. Drama from scale and speed, never murk.
  The storm is indigo and violet, still readable. The ending is a warm, colourful dusk.
- **Cel anime**: two hard tones + crisp highlight, cool lavender-blue shadows, confident ink with pressure variation,
  gouache painted backgrounds (Kuwahara on BG pixels only), FX drawn like effect cels (flat bands, hard edges).
- **Motion**: the middle of the film is a flight. Speed lines, hard parallax, camera shake on ones, smear shapes on fast
  action, huge things heavy at first and terrifyingly fast once moving. Characters on twos, FX on threes, camera on ones.
- **Every shot has one readable action.** Nothing clips, slides or floats (collision checks are mandatory).

## Story
A blazing summer day on a small green island. On its peak, in a tiny shrine, little Clawd sweeps the stone steps. One leaf
falls on the clean step. He chases it, trips on the rope of the old bronze bell, and the bell rings. The whole forest
ripples like fur. The mountain opens one amber eye: it was a dragon all along, and the shrine stands between its horns. It
rises with Clawd hanging on and takes off, screaming low over rice fields and a seaside town, out over the sea and straight
into a wall of storm. Lightning hits it, it thrashes, it is out of control. Clawd crawls along its brow and scratches it
behind the eye with his broom. The eye softens. The dragon bursts out above the storm into a blinding sea of sunlit cloud,
and Clawd stands on its horn with his nubs up, overjoyed. At dusk it flies home, coils back into the island and closes its
eye. Covered in leaves, Clawd sweeps the steps again. One leaf falls. He sighs, smiles, and sweeps it.

## Designs
- **Clawd**: our mascot (`src/assets/clawd`), toon + ink. Terracotta hue 13-18. A bamboo broom held firmly in his nub.
- **THE DRAGON** (~1.5 km long, head ~90 m): a long serpent body made of the island itself. Overlapping layered rock
  scales in grey-violet and ochre with strata and moss; a cedar forest grows along its spine like fur and bends with the
  motion; waterfalls pour from its jaw like a mane; a moss beard; two antlers of weathered stone wrapped in a thick
  shimenawa rope with white paper shide; huge amber eyes with slit pupils and a cel gloss; four clawed legs with boulders
  in the claws; whiskers of trailing mist. Trees, rocks and water fall off it as it moves. Real sculpted volume, never a
  tube with a texture. The spine is a spline with instanced plates; every frame pure of t.
- **The shrine**: a tiny weathered wooden shrine, stone steps, a vermilion torii, a stone lantern, an old bronze bell on a
  frame with a thick striped rope. It stands on the brow between the horns, and it rides along with the dragon.
- **The world**: a small green island in a bright sea, terraced rice paddies on the mainland, a seaside town (ported from
  MEGA CLAWD: tile roofs, wires, laundry, a calico cat), cumulus, the storm wall. No people anywhere.

## Departments (each owns its files; requests go to the director via the report)
| team | owns | shots |
|---|---|---|
| engine (director) | `index.html`, `src/main.js`, `src/pipeline*.js`, `src/shots.js`, `src/cams/index.js`, `tools/`, `player/`, `package.json`, README | integration, s30 |
| dragon | `src/dragon*.js`, `src/cams/dragon.js` | s09 s11 s12 s14 s21 s23 s24 s26 s27 s28 |
| keeper | `src/keeper*.js`, `src/shrine*.js`, `src/cams/keeper.js` (Clawd, broom, shrine, bell, leaves) | s02 s03 s04 s05 s06 s10 s13 s17 s22 s25 s29 |
| world | `src/world*.js`, `src/ocean*.js`, `src/sky*.js`, `src/cams/world.js` (island, paddies, town, sea, clouds, storm wall) | s01 s07 s08 s15 s16 s18 s19 s20 |
| fx | `src/fx*.js` (falling rock, trees, waterfalls, wind wakes, speed lines, lightning, spray, cloud burst; exposed through `ctx.modules.fx`) | supports all flight shots |
| sound | `src/audio*.js`, `audio.html`, `tools/render-audio.mjs` | whole film |
A shot can contain other teams' assets; the owner sets camera and look, the others deliver through their module API.

## Shots (seconds; frame = round(t*24))
| id | time | set | what happens |
|---|---|---|---|
| s01 | 0.0–3.0 | island | wide: a green island peak in a bright sea, towering cumulus, slow push in |
| s02 | 3.0–5.5 | shrine | the tiny shrine on the peak, cicadas, heat shimmer, the torii against the sky |
| s03 | 5.5–9.0 | shrine | Clawd sweeps the stone steps with his broom, proud of a neat pile of leaves |
| s04 | 9.0–11.0 | shrine | macro: one leaf drifts down and lands on the clean step; his eye twitches |
| s05 | 11.0–13.0 | shrine | he hurries after it, trips on the striped rope of the bell |
| s06 | 13.0–15.0 | shrine | the bell swings: DONG; a drawn ring of sound rolls out over the island |
| s07 | 15.0–17.0 | island | birds burst from the forest; the leaf pile trembles |
| s08 | 17.0–20.0 | island | wide: the whole forest ripples down the mountain like fur |
| s09 | 20.0–22.0 | island | CU rock face: a huge amber eye opens, trees sliding off the lid |
| s10 | 22.0–23.5 | shrine | Clawd slowly looks over the edge, eyes wide |
| s11 | 23.5–28.5 | island | THE RISE: slopes crack, coils pull out of the earth, the head lifts with the shrine between the horns; waterfalls pour off |
| s12 | 28.5–31.0 | paddies | low angle from the fields: the colossal head against the sun, rocks raining down |
| s13 | 31.0–33.0 | shrine | Clawd dangling from the bell rope, wind flattening him, broom still in his nub |
| s14 | 33.0–36.0 | island | TAKE-OFF: the dragon dives off the island, the body whipping after it |
| s15 | 36.0–39.0 | paddies | skimming the rice fields, a wake of wind flattening the paddies in a V |
| s16 | 39.0–42.0 | town | low over tile roofs, laundry ripped away, wires snapping, the cat's fur blown flat |
| s17 | 42.0–44.0 | shrine | POV along the horn: the world screaming past, Clawd screaming |
| s18 | 44.0–47.0 | sea | out over the sea, the tail tearing a wall of spray |
| s19 | 47.0–49.5 | sea | ahead, a towering indigo storm wall; the dragon goes straight in |
| s20 | 49.5–52.0 | storm | inside: rain, walls of cloud, lightning branching around the coils |
| s21 | 52.0–53.5 | storm | a bolt strikes the head; it roars and thrashes, out of control |
| s22 | 53.5–56.0 | shrine | Clawd crawls along the brow in the rain and scratches behind the eye with the broom |
| s23 | 56.0–57.5 | storm | CU the amber eye: the slit pupil widens, it softens |
| s24 | 57.5–61.0 | sky | BREAKOUT: it bursts up through the storm top into a blinding sunlit sea of cloud, spiralling |
| s25 | 61.0–63.5 | shrine | Clawd stands on the horn, nubs up, overjoyed, the broom raised |
| s26 | 63.5–66.0 | sky | dusk: the dragon glides home, gold on every scale |
| s27 | 66.0–68.5 | island | it coils back into the island, the forest settles |
| s28 | 68.5–70.0 | island | the great eye closes; moss and trees slide back |
| s29 | 70.0–73.0 | shrine | Clawd, covered in leaves, sweeps; one leaf falls at 71.6; he sighs, smiles, sweeps it |
| s30 | 73.0–76.0 | card | end card: "Fable 5.5" brush lettering, red 寓話 seal, title RYŪ 龍 |

CUES: leaf 9.4, trip 11.8, bell 13.2, birds 15.0, ripple 17.2, eye 20.5, rise 23.5, takeoff 33.0, paddies 36.0, town 39.0,
sea 44.0, storm 47.0, strike 52.0, scratch 54.6, soften 56.3, breakout 58.0, peak 61.0, home 63.5, settle 66.0, close 68.6,
lastleaf 71.6, card 73.0.

## Engine
Ported from MEGA CLAWD: shadow / mirror → main MRT (colour + normal, depth, id) → paint → ink → water → atmosphere → overlay FX →
bloom / grade. Module API `create(ctx) -> { update(t, shot), afterCamera?, dispose }`, `ctx.modules.<team>`. Every frame is a
pure function of t. Tools: snap, render (resumable), render-audio, encode, build-player, check, sheet.
WORK = `%LOCALAPPDATA%\Temp\ryu-work\<team>`. Ports: engine 9000-9009, dragon 9010-9019, keeper 9020-9029, world 9030-9039,
fx 9040-9049, sound 9050-9059.

## Quality gates (every team, before reporting)
- Stills of your shots (start / middle / end) at full res, looked at, compared with `anime-lab/ref/*.jpg`.
- Collision check: nothing passes through Clawd, the broom, the shrine, the dragon's own body.
- Clawd: ink visible, 2 hard tones + highlight, terracotta hue 13-18, face readable.
- Luma jumps ≤ 25 tv levels per frame except ramped lightning (2-3 frames).
- Keep `docs/status/<team>.md` current so work can resume after a limit.
