# Bozo

Approved likeness and both skins are playable: Polo and Basketball. Height 1.64 m. The appearance reference page remains in `apps/client/public/art/reviews/bozo-v1/`.

## Controls (player 1)
- J, repeated presses: jab → cross → beard tentacle lash.
- K: slow heavy beard sweep.
- L: single kick.
- Crouch + attack: low kick; airborne + attack: air kick.
- I: Body hair, a long forward hair spear.
- U: Hair grip, a zero-damage projectile that holds a hit opponent for 120 ticks (2 seconds). Movement, attacks and blocking are disabled; further hits still deal damage. Knockback does not displace the trapped fighter. An animated hair binding appears around any fighter or clone.
- O: Bunda de Pelucia, hair armor for 1320 ticks (22 seconds), reducing incoming melee, projectile, burn and ground-hazard damage by 90%, rounded up to a whole health point.
- P: Hair clones, three hair-bodied AI companions. Each has 423 health, follows opponents and uses his basic moves. Clones can be hit, trapped and burned. They do not respawn or count as players/lives for victory.

Both supers require full 100 energy and each can be used once per fight, including across respawns. Training Reset restores their use.

## Team and lifecycle rules
Clones inherit their owner's team; no friendly damage. They use deterministic simulation inputs and are included in snapshots and rollback. Maximum 18 clones for six Bozo players; original network player seats remain unchanged. Defeat or disconnection removes that owner's clones and armor. Match end and training reset clear all companions. Armor expires on simulation ticks even during hitstop. Clones can jump to pursue elevated opponents and walk off platforms to pursue lower opponents.

## Art
Two 24-pose fighter atlases and a dedicated 24-pose hair-clone atlas. Menu portraits are the approved review artwork. Sprite bounds are recorded in `BozoAtlas.ts`. Hair bindings and spear extensions are rendered separately to fit the target and actual attack reach. Prompts: `apps/client/public/art/bozo/prompts.json`.

## Validation
Bozo tests cover basic chains, trap movement/continued damage/guard/invulnerability, armor duration and damage reduction, clones/AI/death/training cleanup, one-use supers, team allegiance, owner departure and 2v2/3v3 rollback convergence. Live WebSocket check covers Bozo's alternate skin in a four-client team room and surviving a client departure.

## Range and movement tuning

Hair Grip now travels for 75 ticks at the same speed of 11 units per tick (about 15% farther). Damage, projectile width and two-second trap duration are unchanged. Both clothing skins use newly drawn upright guarded walking poses in `apps/client/public/art/bozo/walk-v5.png`, referenced directly from the original standing sprites. `BozoWalk` uses one uniform scale per skin, measured crop bounds and pelvis anchors; no per-axis stretching or per-frame height compensation. Forward and backward walking use the new sheet; existing dash and clone art remains separate. Built-in imagegen prompt: `docs/bozo-walk-v5-prompt.txt`. Online protocol 11 keeps the new projectile lifetime synchronized.

Walking revision v5: six poses per skin, alternating near/far leg overlap, visible body hair and standing-matched clothing colors. Uniform scale across the full cycle; five ticks per forward frame and six per backward frame.

Body Hair reach: hitbox width increased from 300 to 900 (three times the original reach). The existing illustrated spear is extended to the hitbox tip without stretching the fighter. Removed the separate tube-based spear overlay from HairEffects. Damage and timing unchanged. Protocol 13 prevents mixed old/new reach in online rooms.

Clone invocation presentation: Body Hair pose replaces the raised-hand summoning pose. During startup, three miniature hair bodies grow outward from beard/arm anchors to their spawn positions. Braided strands connect them to Bozo, then thin and detach over 18 ticks after activation while following the moving clones. Animation is derived from simulation move/frame data (no wall-clock spawn timers), resets on interruption or menu, and does not change AI, damage, spawn timing or networking state.

Approved hair-attack portraits applied to both skins: portrait-1-hair-v2.png and portrait-2-hair-v2.png. Relaxed arms, attacking beard/body hair; existing preview scale retained. Original portraits preserved. Basketball prompt in docs/bozo-basketball-hair-portrait-prompt.txt.
