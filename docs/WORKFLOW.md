# How RYŪ was made

RYŪ was built by agent teams in Claude Code, with Fable 5.5 as the model, organised like a small animation studio: one
director, an engine port, five departments, then one pass after a person watched the draft. Everything they shared lived
in files: the production bible ([CONTRACT.md](../CONTRACT.md)), the engine manual ([ARCHITECTURE.md](ARCHITECTURE.md)), one
status log per team (internal working notes, not part of this repo) and the module API at the top of every source file.

```
director ── CONTRACT.md (story, designs, art direction, 30 shots, ownership, quality gates)
   │
   ├─ 1. engine port ── pipeline, tools, module API, placeholders; the film plays end to end
   │
   ├─ 2. five departments in parallel ── dragon · keeper · world · fx · sound
   │
   ├─ 3. director integration ── geography, contacts, looks across cuts, draft render
   │
   └─ 4. human review → one fix-and-final pass ── bugs, weak shots, final render, player, docs
```

There was no separate art-director round in this film: the review was a person watching the draft.

## 1. Engine port

One agent ported the foundation from the earlier Anime Lab film MEGA CLAWD: the repo skeleton and vendored three.js r160,
the multi-pass anime pipeline, the cel / paint / FX materials, `src/shots.js` (30 shots + the story cues), the camera and
look registry, a placeholder module per department, and the tools (snap, render, render-audio, encode, build-player, check,
sheet). Clawd is the series' ready-made mascot (`clawd.glb` + its emotion library, copied into `src/assets/clawd`), and the
town, sea and sky came with the port.

## 2. Five departments in parallel

| team | owns | shots |
|---|---|---|
| dragon | `src/dragon*.js`, `src/cams/dragon.js` | s09 s11 s12 s14 s21 s23 s24 s26 s27 s28 |
| keeper | `src/keeper*.js`, `src/shrine*.js`, `src/cams/keeper.js` | s02 s03 s04 s05 s06 s10 s13 s17 s22 s25 s29 |
| world | `src/world*.js`, `src/ocean*.js`, `src/sky*.js`, `src/cams/world.js` | s01 s07 s08 s15 s16 s18 s19 s20 |
| fx | `src/fx*.js` | drawn FX for every flight shot |
| sound | `src/audio*.js`, `audio.html`, `tools/render-audio.mjs` | the whole film |

Each team worked in its own port range and work folder, rendered stills of its shots at full resolution, looked at them,
ran the collision and luma check and kept its status section current so the work could resume after a usage limit.

## 3. Director integration

One agent joined the departments into one film: the shrine riding the dragon's brow, cross-team contacts, the soundtrack
against the picture cues, the end card. Then a first full-film check and a draft render.

## 4. Human review, one fix-and-final pass

A person watched the draft and sent a list. The worst of it was a screenshot of s10: the broom shaft going straight
through Clawd's body and out of the top of his head, jagged stair-steps on his nubs and legs, and odd ringed eyes with
wobbly edges. One agent took the list to the end:

- **The clipping was invisible to the tools.** The solids were boxes; a broom shaft through a rounded body never
  registered. `src/keeper-contacts.js` now tests the shaft, the bristles, the rope, the nubs and the legs as segments
  against the rounded body and the set on every frame, and the broom is solved so its line cannot pass through him. The
  legs folded into the body and the rope ran under him are gone too. 0 hits on all 1824 frames.
- **The jaggies were the shadow map.** Clawd's self-shadow came from a 12 m map in close-ups, about 9 pixels per texel.
  Clawd no longer receives his own cast shadow; the map is now fitted tightly around him, with a 5×5 tent filter on the
  floor shadow.
- **The specks around his eyes were MSAA.** The face inks wrote a different material id, and mixed rim pixels of the data
  buffer drew broken ink. The inks now write the body's id and normal, so the ink pass sees plain body.
- **A pure-function bug was hiding in the look of the whole film.** A shot in the storm flashed the dragon black, and
  that code had snapshotted every colour uniform of its materials on the first frame, including the shared light rig,
  and restored them every frame. So the render took its light from frame 0: the storm was lit like noon and the dusk
  shots came out pale. It looked fine in single stills, and it was found by rendering the film sequentially and logging
  the uniforms. `tools/check.mjs --purity` now renders sample frames after a far-away frame and fails on any difference.
- The weak shots on the list: the eye became a drawn iris and slit in an almond of real lids (and a shut lid with a
  seam), the bolt strike a black silhouette against a white-out, the flight shots got S-curved bodies and legs with a
  pose, the town pass got the dragon in frame, s24 opens on the break through the cloud.

| phase | agents |
|---|---|
| engine port | 1 |
| departments | 5 |
| director integration | 1 |
| fix-and-final pass | 1 |
| **total** | **8** |

## 5. Render and ship

The final was rendered frame by frame in headless Chromium: about 0.21 s per frame at 1080p on an RTX 2060 (PNG included),
one process, about 7 minutes for all 1824 frames. Every rendered frame was then checked: 0 page errors, 0 collisions (29 box solids plus the segment vs rounded body tests), no blank or frozen frames, no luma jump above 25 tv levels inside a shot, and 60 sampled frames identical when rendered after a far-away frame. The frames were
encoded with ffmpeg (H.264 High, BT.709, 24 fps, AAC, faststart) and the film was packed into the single-file players in
`dist/`. `npm run build` repeats the whole chain.

## What was hard

- **A clean collision report meant nothing until the test matched the shape.** The draft passed its check while the
  broom went through his head. Test the geometry you actually see.
- **Stills lied about the render.** The pale dusk only appeared in a sequential render, because the bug was about which
  frame came first. Compare a sequential render against isolated stills before trusting either.
- **Showing a draft to a person found what no agent had flagged.**
