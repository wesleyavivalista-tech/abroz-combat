# Jopa

Implemented from the user's approved portraits and Gut-style fighter models, 2026-09-30.

## Appearance and controls

- Skin 1: Santos jersey, black shorts, white sneakers. Skin 2: white tee, beige shorts, white sneakers.
- Approved clean-v14 portraits are copied unchanged into production. Victory art uses the same approved identity.
- Punch → kick → punch combo, heavy kick, heavy punch, low punch, air kick; authored guarded walking, dash, jump, fall, block, hit, knockdown, victory and mounted poses.
- The usual keyboard mapping is J/K/L basics, I/U specials, O/P ultimates. All bindings remain remappable.

## Abilities

- **Football:** 25 energy; 65 damage per hit; fast ricochet from all fighters (including Jopa and allies), arena sides and built structures; friendly fighter contacts cause no damage or stun. Absolute 180-frame (3-second) lifetime. A 12-frame per-target contact cooldown permits repeated hits without overlapping damage every tick.
- **Chess Master:** 25 energy; deterministic cycle of pawn, rook, bishop, queen, knight. Hops toward the far edge, leaps toward an opponent within 300 units, deals 80 damage and stuns for 120 frames. Placed on the ground with a crouched placement pose before hopping. Consumed on contact or leaving the arena; 15-second maximum projectile lifetime prevents orphaned objects.
- **Crying Tree:** full energy, once per fight. Censored crying transformation and growing hollow tree. Tree health 980 (70% maximum), 70-second lifetime; Jopa is protected and cannot move/attack inside. Creates a 140-health attacking root tentacle every 180 frames. Tentacles jump onto platforms to chase elevated opponents. Tree death restores Jopa and adds up to five attacking tentacles; a global limit of 10 living tentacles applies across all owners and all spawn sources. Existing tentacles remain. Tentacles deal 35 damage at most once per second each and have no timeout.
- **Chess Knight:** full energy, once per fight. 700 health, no timeout. Summons already mounted. Jump and double jump; horizontal movement is possible only while airborne, at 5.4 units/frame (10% slower), or 2.7 during recovery; the backward rebound is also 10% slower; land within 140 horizontal units of an opponent for 170 damage and 60-frame stun. The knight keeps one rigid chess-piece silhouette in every state. Successful landings emit impact and dust bursts and bounce it backward; a 90-frame recovery halves air steering and prevents another jump or landing hit, leaving 30 frames to escape after the 60-frame stun. The backward rebound is preserved. Rider damage redirects to the knight; the rider cannot attack separately. Second basic dismounts, or mounts an unoccupied allied knight when grounded directly in front within 170 units. One rider per knight, deterministic seat order for simultaneous attempts. Empty knights wait in place between autonomous jumps toward enemies. Every current fighter and both skins have dedicated seated artwork.
- Summons and projectiles disappear when their owner is knocked out or the round resets. Teammates riding a defeated/removed knight are released. Supers follow the existing once-per-fight rules.

## Integration and verification

Jopa is in the shared character registry, menus, fighter guide, training, versus and online roster. All ability state, ownership, timers, variant selection and riding state are serialized in simulation snapshots. No random or wall-clock gameplay logic.

Production assets: `apps/client/public/art/jopa/`. Exact generation prompts and source output paths: `prompts.json` there. New raster art generated with the built-in image-generation tool. Original approved concepts and earlier variants are preserved.

`jopa-preview.html` is a development review page showing the actual game renderer and snapshots for both skins and abilities. Use the main game for live controls.

Verified: 440 tests pass; TypeScript and ESLint pass; client production build and server compilation pass. Browser checks cover both skins, chess pieces, tree/tentacles, knight riding and teammate riding. The movement atlas has a per-sheet extraction seam between two touching silhouettes; all 12 frames load separately.

## Full-roster mounted pose correction

All 12 allied fighters now use `mounted-a-v2.png`, `mounted-b-v2.png`, and `mounted-c-v2.png` (both skins, 24 poses). The built-in image generator authored forward-leaning side-view riders from the original identity sheets and Jopa's corrected riding reference. `MountedVisual` anchors each rider at the hips and uses fighter-specific scale. Jopa retains his existing corrected poses. Exact prompts and generation paths are in `apps/client/public/art/jopa/mounted-v2-prompts.json`.

Review at `/mounted-preview.html` during development; this uses the gameplay renderer. Visually checked all 24 poses and mirrored direction. Typecheck, targeted lint, production client build, and all 22 Jopa tests pass. Screenshot: `docs/mounted-roster-v2.png`.

## Crying Tree lifetime
The tree expires 4,200 simulation frames (70 seconds) after spawning, including hitstop. Destruction and timeout both release Jopa, trigger the existing capped tentacle burst once, and retain a snapshot-backed one-second collapse/shudder/fade effect. Reset clears that effect. `/tree-preview.html` previews the animation stages in the gameplay renderer.
