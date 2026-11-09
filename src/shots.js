// RYŪ · 龍 · story beats + shot list (owner: engine). Single source of truth for picture, sound and QC.
// Times in seconds; frame = round(t * 24). Frame f shows film time f / 24. 30 shots, 76.0 s, 1824 frames.
export const FPS = 24, DURATION = 76.0, FRAMES = Math.round(DURATION * FPS);

// Story beats (sound + FX sync). Names are stable: departments key their timing off these.
export const CUES = {
  leaf: 9.4,        // the leaf lands on the clean step (s04)
  trip: 11.8,       // Clawd trips on the bell rope (s05)
  bell: 13.2,       // DONG (s06)
  birds: 15.0,      // birds burst from the forest (s07)
  ripple: 17.2,     // the forest ripples like fur (s08)
  eye: 20.5,        // the amber eye opens (s09)
  rise: 23.5,       // the dragon rises (s11)
  takeoff: 33.0,    // dives off the island (s14 starts just after)
  paddies: 36.0,    // skims the rice fields (s15)
  town: 39.0,       // low over the town (s16)
  sea: 44.0,        // out over the sea (s18)
  storm: 47.0,      // the storm wall (s19)
  strike: 52.0,     // lightning hits the head (s21)
  scratch: 54.6,    // Clawd scratches behind the eye (s22)
  soften: 56.3,     // the pupil widens (s23)
  breakout: 58.0,   // bursts through the storm top (s24); the music's downbeat, the head breaks the deck just before it
  peak: 61.0,       // Clawd on the horn, nubs up (s25)
  home: 63.5,       // dusk, gliding home (s26)
  settle: 66.0,     // coils back into the island (s27)
  close: 68.6,      // the eye closes (s28)
  lastleaf: 71.6,   // one more leaf (s29)
  card: 73.0,       // end card (s30)
};

// One world, metres, y up, sea level 0. Town = the ported coast (pier end at the origin, town climbs toward -z).
// The dragon's rest pose: brow (shrine base) = (ISLAND.x, ISLAND.peak, ISLAND.z), looking +z. Full notes: docs/ARCHITECTURE.md
export const GEO = {
  ISLAND: { x: -3600, z: 2600, R: 1100, peak: 420 },    // the sleeping dragon, 2.6 km off the rice coast
  PADDIES: { x: -3400, y: 24, z: -1250, w: 3600, d: 1900 },   // the terraced rice plain, west of the town along the coast
  TOWN: { x: 0, z: 0 },                                 // pier end (the ported coast; the town itself z -45..-1000)
  STORM: { z: 9500 },                                   // storm wall face (front), interior beyond it
  SKY: { x: 0, z: 12500, cloudTop: 3300 },              // above the storm: the sea of cloud is centred here
};

// Visibility groups the engine toggles. Department content goes into ctx.sets.<group>.
//   sea = ocean + day dome + cumulus. shrine = the keeper's shrine rig (rides the dragon, always on).
export const GROUPS = ['island', 'shrine', 'paddies', 'town', 'sea', 'storm', 'sky'];
export const SET_GROUPS = { island: ['island', 'shrine', 'sea'], shrine: ['shrine'], paddies: ['paddies', 'shrine', 'sea'], town: ['town', 'shrine', 'sea'],
  sea: ['shrine', 'sea'], storm: ['shrine', 'storm'], sky: ['shrine', 'sky'], card: [] };
const SHOT_ENV = { s13: 'island', s17: 'sea', s22: 'storm', s25: 'sky' };   // the world behind a close shrine shot (default island)
const SHOT_EXTRA = { s19: ['storm'], s18: ['storm'] };                       // extra groups (the wall is visible from the sea)

// id, t0, t1, set, owner, what (CONTRACT.md). set = what is on screen; env = the world behind a close 'shrine' shot.
export const SHOTS = [
  ['s01', 0.0, 3.0, 'island', 'world', 'wide: a green island peak in a bright sea, towering cumulus, slow push in'],
  ['s02', 3.0, 5.5, 'shrine', 'keeper', 'the tiny shrine on the peak, cicadas, heat shimmer, the torii against the sky'],
  ['s03', 5.5, 9.0, 'shrine', 'keeper', 'Clawd sweeps the stone steps with his broom, proud of a neat pile of leaves'],
  ['s04', 9.0, 11.0, 'shrine', 'keeper', 'macro: one leaf drifts down and lands on the clean step; his eye twitches'],
  ['s05', 11.0, 13.0, 'shrine', 'keeper', 'he hurries after it, trips on the striped rope of the bell'],
  ['s06', 13.0, 15.0, 'shrine', 'keeper', 'the bell swings: DONG; a drawn ring of sound rolls out over the island'],
  ['s07', 15.0, 17.0, 'island', 'world', 'birds burst from the forest; the leaf pile trembles'],
  ['s08', 17.0, 20.0, 'island', 'world', 'wide: the whole forest ripples down the mountain like fur'],
  ['s09', 20.0, 22.0, 'island', 'dragon', 'CU rock face: a huge amber eye opens, trees sliding off the lid'],
  ['s10', 22.0, 23.5, 'shrine', 'keeper', 'Clawd slowly looks over the edge, eyes wide'],
  ['s11', 23.5, 28.5, 'island', 'dragon', 'THE RISE: slopes crack, coils pull out of the earth, the head lifts with the shrine between the horns'],
  ['s12', 28.5, 31.0, 'paddies', 'dragon', 'low angle from the fields: the colossal head against the sun, rocks raining down'],
  ['s13', 31.0, 33.0, 'shrine', 'keeper', 'Clawd dangling from the bell rope, wind flattening him, broom still in his nub'],
  ['s14', 33.0, 36.0, 'island', 'dragon', 'TAKE-OFF: the dragon dives off the island, the body whipping after it'],
  ['s15', 36.0, 39.0, 'paddies', 'world', 'skimming the rice fields, a wake of wind flattening the paddies in a V'],
  ['s16', 39.0, 42.0, 'town', 'world', "low over tile roofs, laundry ripped away, wires snapping, the cat's fur blown flat"],
  ['s17', 42.0, 44.0, 'shrine', 'keeper', 'POV along the horn: the world screaming past, Clawd screaming'],
  ['s18', 44.0, 47.0, 'sea', 'world', 'out over the sea, the tail tearing a wall of spray'],
  ['s19', 47.0, 49.5, 'sea', 'world', 'ahead, a towering indigo storm wall; the dragon goes straight in'],
  ['s20', 49.5, 52.0, 'storm', 'world', 'inside: rain, walls of cloud, lightning branching around the coils'],
  ['s21', 52.0, 53.5, 'storm', 'dragon', 'a bolt strikes the head; it roars and thrashes, out of control'],
  ['s22', 53.5, 56.0, 'shrine', 'keeper', 'Clawd crawls along the brow in the rain and scratches behind the eye with the broom'],
  ['s23', 56.0, 57.5, 'storm', 'dragon', 'CU the amber eye: the slit pupil widens, it softens'],
  ['s24', 57.5, 61.0, 'sky', 'dragon', 'BREAKOUT: it bursts up through the storm top into a blinding sunlit sea of cloud, spiralling'],
  ['s25', 61.0, 63.5, 'shrine', 'keeper', 'Clawd stands on the horn, nubs up, overjoyed, the broom raised'],
  ['s26', 63.5, 66.0, 'sky', 'dragon', 'dusk: the dragon glides home, gold on every scale'],
  ['s27', 66.0, 68.5, 'island', 'dragon', 'it coils back into the island, the forest settles'],
  ['s28', 68.5, 70.0, 'island', 'dragon', 'the great eye closes; moss and trees slide back'],
  ['s29', 70.0, 73.0, 'shrine', 'keeper', 'Clawd, covered in leaves, sweeps; one leaf falls at 71.6; he sighs, smiles, sweeps it'],
  ['s30', 73.0, 76.0, 'card', 'engine', 'end card: Fable 5.5 brush lettering, red 寓話 seal, title RYŪ 龍'],
].map(([id, t0, t1, set, owner, what], i) => {
  const env = set === 'shrine' ? (SHOT_ENV[id] || 'island') : set;
  return { id, i, t0, t1, set, env, owner, what, f0: Math.round(t0 * FPS), f1: Math.round(t1 * FPS),
    groups: [...new Set([...SET_GROUPS[set], ...SET_GROUPS[env], ...(SHOT_EXTRA[id] || [])])] };
});

export const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
// shot containing film time t (frame-exact: uses the frame index so cuts land on whole frames)
export function shotAt(t) { const f = Math.round(t * FPS); return SHOTS.find(s => f >= s.f0 && f < s.f1) || SHOTS[SHOTS.length - 1]; }
// time of a point inside a shot: k = 0 first frame, 1 last frame
export const shotTime = (id, k = 0.5) => { const s = SHOT[id]; return (s.f0 + Math.round(k * (s.f1 - 1 - s.f0))) / FPS; };
