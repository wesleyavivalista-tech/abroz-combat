# Gut

Approved 1.80m fighter, both skins: dress shirt and black/red kung fu. Approved menu portraits retained; short near-black hair in models. Roster, training, local and online selection enabled.

Basic chain: palm, cross, turning kick. Heavy axe kick and wide swing are separate moves. Crouching and airborne variants included.

Unwanted touching: non-sexual forward bear-hug grapple, one opponent, four seconds of immobilization and 24 damage per half-second (plus initial 25). Guard, friendly teams and spawn immunity respected. Breaking the holder's move, defeat or removed clone releases the victim. No global hitstop for periodic grapple damage.
Meditation replaces Flying Kung Fu kick: hold Special 2 while grounded to sit in lotus stance and recover 55 HP (5%) every 180 simulation ticks (3 seconds). Release, hit, trap or defeat interrupts it; each new hold starts a fresh interval. Cannot exceed max health. No automatic re-entry after interruption.
Unwanted touching now advances 11 units/tick (was 10) and reaches 100 units (was 85).
Walking now uses six alternating-leg kung fu guard poses per skin. Spear attack rendering extends only the free shaft, keeping body and blade proportions and matching the hitbox tip.
Immortal: shining cross and ascent animation, adds exactly one life, no healing. HUD supports four lives.
Kung Fu Panda: 20-second spear stance, distinct three-part chain, heavy/swing/crouch/air attacks and movement art. Long reach, increased damage. Expires by simulation tick and clears on defeat.

Both supers require full meter and are once per fight. Protocol 16. Rollback tests cover the new state. Art: public/art/gut; exact built-in imagegen prompts: docs/gut-art-prompts.json. Neighbor artwork isolated with SpriteIsolation. Tests in tests/gut.test.ts.

Spear reach increased roughly 12%; heavy basic is now Rising spear, an upward launch with hitboxes following the ascending shaft. New upward strike illustration for each skin.

Double-jump spear dive: while spear mode is active, press basic attack 2 after using the air jump. Seven-tick startup, downward speed 28 and forward drift 4, 160 damage and knockdown, one hit per dive. Remains active through descent and has 24 ticks of landing recovery. Single-jump attacks keep the normal air thrust. Interrupted by hits and weapon expiry. Both skins use art/gut/spear-dive-v2.png; builtin imagegen prompt set: docs/gut-dive-prompts.json.

## Rigid spear revision

Replaced all stretched weapon meshes with a single 4.3m illustrated spear, translated and rotated between grips without any deformation or resizing. Both skins share the same weapon art through guard, walk, dash, crouch, thrust, rising strike and dive. Body-only weapon poses are in `apps/client/public/art/gut/spear-bodies-v3.png`; fixed weapon is `apps/client/public/art/gut/spear-weapon-v3.png`. Built-in imagegen prompts are in `docs/gut-rigid-spear-prompts.json`. Upward and dive hit areas follow the newly illustrated shaft. Protocol 18. This supersedes the earlier stretched-shaft implementation.
