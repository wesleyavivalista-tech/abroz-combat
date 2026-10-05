# Fausto — playable implementation

Approved September 28, 2026. The suit portrait uses the approved v3 image; the casual portrait uses the approved v6 clothing variant. Skin 2 wears an oversized black T-shirt, jeans and white sneakers.

## Moves
- Punch → kick → punch, heavy kick and heavy punch.
- Origami: visible folding and placement; five deterministic random designs, identical explosive traps. Traps persist until triggered, owner defeat or match reset. A 128-trap per-owner safety limit prevents unbounded state.
- White Cloud: stationary for 5 seconds, 40% movement slow; no attack-speed reduction.
- Ancestry: Samurai outfit and sword for 20 seconds, +20% movement and attack speed. Includes slash → kick → slash, a 1-second held Flash Slash that moves through opponents, and a heavy sword attack.
- Bravinho: independent Anger Mode for 30 seconds. Movement speed, attack speed and outgoing damage begin at +20%; each landed hit received adds 5 percentage points to all three, without a stack cap or duration refresh. Blocks and poison/burn ticks do not add stacks. Multihit attacks, beams and grapple impacts each count their actual hit events. Bonuses combine multiplicatively with Samurai Mode. Expiry, KO and reset clear anger state.

Unspecified new-fighter damage, meter costs and base stats follow existing roster conventions. Existing character damage, movement and cooldown values were not retuned.

## Implementation
Gameplay and all durations live in deterministic simulation snapshots. No ability timers or event listeners are added to combat. Trap collision uses swept feet positions, and Flash Slash uses swept hitboxes with one hit per target. KO/reset removes owned traps and clears new statuses. Shared movement, hit resolution, weapon transformation and rollback systems are reused. Effects and textures are disposed with their renderers.

Walking uses separate near-leg and far-leg strides for both skins and Samurai Mode. Samurai-specific special sprites keep the outfit active while casting. The local /fausto-preview.html page includes a frame scrubber for visual review.

## Verification
- 381 automated tests passed, including 15 focused Fausto tests.
- Type checking, lint and production build passed.
- 166 deterministic traces matched across V8 and JavaScriptCore.
- Browser checked both outfits, walking, folding/placement, cloud, Samurai transformation, Flash Slash and white hair; no preview console errors.
- Live local multiplayer smoke test: room creation/join with both Fausto skins, match start and input relay.

## Art
Raster assets were generated with the built-in image generation tool using the approved likeness and Gut sprite references. Prompts are saved in animation-prompts.json. The earlier walk.png is retained as an unused draft; runtime loads walk-near-v2.png, walk-far-v2.png and walk-samurai.png.

## September 28 animation corrections
Closed fists replace the walking open palms. corrections-v2.png supplies a guarded heavy punch and alternating two-handed hair ruffling for both outfits and Samurai Mode. White Cloud keeps its 5-second stationary hazard, with mist emerging from the hair during casting. Instant Gray casts for 48 frames, releases mist, clears it, then applies the full 18-second status. An interrupted cast does not apply the status. Flash Slash charges for 60 frames (1 second); its rendering follows the move definition. FireEffects now ignores non-fire typed hazards, removing the accidental pentagrams. Built-in image generation prompts: fixes-v2-prompts.json.

## September 29 — Bravinho replaces Instant Gray
Removed the old silence status and white-hair shader. Anger deadlines and stack counts are snapshot-owned; shared damage commits count eligible landed hits. Outgoing damage and movement/animation speed derive from one helper, with no persistent edits to character stats. Rage sprites preserve each current pose and outfit, add a furious face and flushed skin, and are further tinted with subtle aura intensity as stacks grow. Visual intensity saturates for readability; gameplay stacks do not cap.

Validation: 384 tests, typecheck and lint passed; 166 V8/JavaScriptCore traces matched. New tests cover duration, uncapped additive stacking, blocked/periodic/invulnerable contacts, movement/attack/damage bonuses, Samurai coexistence, KO/reset and rollback.
