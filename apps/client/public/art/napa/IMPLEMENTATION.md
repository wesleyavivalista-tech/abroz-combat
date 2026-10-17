# Napa implementation

Approved look: both skins match the approved Napa review. Production art is in this directory.
Generated with built-in image_gen. Prompts: animation-prompts.json; original look prompts: ../reviews/napa-v1/prompts.json.

## Baking summon
180 simulation frames / 3 seconds: knead (0–29), shape and bake (30–94), place (95–134), emerge (135–179). The Cookie Monster becomes an active companion at frame 180. An interrupted move cannot complete the summon. Hitstop and attack-speed effects keep the art and gameplay on the same move timeline. Both skins have eight dedicated baking poses. Crumbs, cookie swelling and the growing monster use snapshot-derived visuals, not timers.

## Gameplay
- Cookie projectile; Super Sniff pulls opponents radially from every direction, respecting teams, invulnerability and solid structures.
- Cookie Monster: 1040 HP (60% of 1400 plus 200), slow movement, repeating barrage/slam/chomp and pauses. Barrage includes horizontal, diagonal and bouncing cookies.
- Defeated monster creates exactly five deterministic cookies, persisting until collected or match reset. Any Napa heals 70 HP (5%); other characters get five seconds of poison. Companions cannot collect drops.
- Mega Sneeze: 720 units wide and 56 units thick (50% wider and twice the original thickness), 120 seconds, 70% reduction to enemy movement and attack speed while in contact; allies and owner unaffected.
- New move values not specified by the user follow existing basic-attack conventions. No existing fighter balance changed.

## Verification
366 automated tests passed, production client/server build passed, and 144 V8/JavaScriptCore move/scenario traces matched. Browser checked both skins, baking, monster emergence, selection and training.
Preview: /napa-preview.html (development review with pause/scrub/replay and walk toggle).
