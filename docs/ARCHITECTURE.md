# Game architecture

## Boundaries and allowed dependencies

- `packages/game-core/characters/<id>` owns immutable character statistics, move definitions, ability configuration, and optional deterministic state hooks. `characters/registry.ts` is the content composition point; it may name fighters.
- `packages/game-core/simulation` owns fixed 60 Hz gameplay, input interpretation, physics, states, ability lifecycle and match management. It does not select behavior by character or move name.
- `packages/game-core/combat` owns contact geometry, normal hit/block resolution, shared damage commits, and observational gameplay events/debug geometry.
- `packages/networking` owns input histories, snapshots, prediction and replay. The same simulation runs offline and online.
- `apps/client/src/characters/<id>` owns character-specific presentation loading. Custom renderers remain allowed in `rendering`; migrate existing adapters when they need work rather than replacing working artwork.
- `apps/client` owns rendering, audio, controls, camera, menus and asset loading. It reads simulation state; animation callbacks never cause damage.
- `apps/server` validates and relays room configuration and inputs. It is not an authoritative anti-cheat server.

Only content registration, character packages, and presentation adapters should name specific fighters. Shared systems use capabilities on definitions. No DOM, Three.js, audio, wall clock or external mutable state may drive core gameplay.

## Existing reusable mechanics

Ordinary moves already configure timing, collision boxes, damage, knockback, launch, guarding, meter and cancels. The refactor adds/extracts:

- `DamageSystem`: one health subtraction, defense multiplication and rounding path. Reaction, guard, counter and eligibility policies remain explicit at contact resolution. `combo: 'hit'` counts a hit; `combo: 'damage'` adds damage without incrementing hits; omission preserves continuous damage behavior.
- `CombatSystem`: existing normal attack/block/grapple contact resolution, extracted without changing ordering or balance.
- `ReturningProjectileSystem`: configurable vertical, straight and bouncing paths, return-to-owner, weapon availability, exclusive projectiles, per-target hit intervals and mode finales.
- `ContinuousAttackSystem`: movable periodic contact volumes configured through `periodicMelee`.
- `AbilityTimers`: simulation-clock move durations, mode finale expiry and activation threshold crossing.
- `Actors`: stable fighter/summon ordering and ownership, independent of hair-specific presentation.
- `CollisionSystem.targetBoxes`: body, move-specific and lower-stance profiles. Beam collision and diagnostics share these boxes.
- `AnimationContract`: atlas validation, action-coverage validation for migrated manifests and named attachment alignment. Existing adapters remain responsible for visual quality and action selection.

The specialized burn, grapple, trail and blood-area modules remain: these implement mechanics and read definitions, rather than identifying a caster by name. This is intentionally not a new ECS or an arbitrary scripting language.

## Timing and state rules

The tick order is preserved: input recording → statuses/trails/grapples/areas → absolute ability timers → returning projectiles → periodic melee → hitstop gate → fighter updates → pushboxes → beams → normal contact collection/trades → training recovery → knockouts.

- `moveFrame` advances with attack-speed modifiers. Ordinary startup/active/recovery use that clock.
- `durationClock: 'simulation'` starts an absolute deadline at activation. Its active duration is not prolonged by attack slow or hitstop. Startup and recovery still use move frames.
- Armor, modes and respawn deadlines use absolute simulation frames. Armor expires at its deadline. Existing burn/poison final-tick boundary behavior is preserved; do not change endpoint rules during cleanup.
- `allowedStates` adds an optional move-entry restriction. Existing shared movement locks, guard rules, cancels and interruption behavior remain authoritative. Defaults preserve current behavior.
- Death/respawn/reset cleanup remains centralized in `LifeSystem` and `GameSimulation.resetPositions`. Add any future persistent state to initialization, snapshots, cleanup and replay tests together.
- Slows use the strongest applicable slowdown; the flood owner's speed boost is then applied. Defense modifiers multiply; damage is rounded upward once after all defense factors. Reapplications must not postpone an already scheduled damage tick.

## Events and rollback

`GameSimulation.events` remains the forward presentation stream used for existing audio/VFX. `gameplayEvents` is a typed, per-frame observational journal (damage, attack/state transitions, projectile lifecycle and match phase). Neither stream is part of the gameplay snapshot or used to make gameplay decisions.

A corrected input restores the snapshot before that frame and replays forward. Presentation and diagnostic events from replay are cleared. Health, combos, deadlines, per-target hit histories, projectile velocities and return state are snapshot data. Do not hide these in closures or event listeners.

Client room requests carry a canonical gameplay-content fingerprint plus protocol revision. The relay rejects missing/mismatched versions before joining a room. Increment the protocol revision for shared engine behavior or hook-code changes: the data fingerprint is not a source-code hash.

## Debugging and validation

F1 shows state, move/frame, position/velocity, health, defense multiplier, remaining action/mode times, network information and recent gameplay events. Overlays include normal/move hurtboxes, widened lower stance when applicable, hit/grab boxes, beams, returning projectile sweeps, continuous contact ranges, areas and platforms. Continuous ranges are attacker-relative target-origin ranges, not limb outlines.

`validateCharacter` checks required move IDs and new ability/path references, positive intervals, finite boxes, mode finale references and armor multipliers. Asset loading validates atlas coordinates. A manifest cannot prove anatomy or movement quality: inspect both facings, all skins, armor/modes, and walking while attacking.

## Migration safeguards

`tests/fixtures/behavior-baseline.json` records pre-refactor gameplay checkpoints for every existing move over 1,801 simulation frames, including movement and hitstop. Only renamed snapshot keys are normalized. Do not regenerate this fixture merely to make a failing test pass. Intentional balance changes need an explicit behavior review and new baseline.

Additional tests cover component reuse by another fighter, six concurrent modes, effect cleanup, snapshot replay, invalid content, version rejection and animation contracts. Keep the current regression suite and browser inspection. Assets were not regenerated for this architecture change.
