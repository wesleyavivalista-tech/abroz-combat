# Owned entities across life loss

## Root cause

`resolveKnockouts` removed clones, projectiles, hazards, bees, shockwaves and structures on every lost life. Independently, companion pruning and several ability update loops required an active owner (`health > 0` and not respawning), so changing death cleanup alone would still remove or disable objects on the next tick.

## Fix

- Fighter death cleanup still clears the fighter's action, input, velocities, transformations, buffs, invulnerability, possession, and carried ability state.
- Central `retainsOwnedEntities` distinguishes an owner waiting to respawn from a permanently eliminated owner, including the frame before knockout resolution.
- Permanent cleanup runs only on the final life. It removes owned entities and attributed burn/poison damage-over-time, and detaches surviving riders. Neutral undead are excluded from owned-summon removal.
- Existing entity objects remain in place on ordinary death: no copying, resurrection, timer restart, HP refill, identity change, or ownership transfer. Normal movement, AI, collisions, damage, expiry and destruction continue.
- Natural summon destruction still produces its normal once-only effects while the owner is respawning (for example Cookie Monster drops and tree/tentacle behavior).
- A dead knight rider relinquishes control without moving the respawning fighter. An old detached tree expiring cannot cancel a new action after its owner respawns.
- Match completion, round/competition transitions, reset and permanent forfeits retain terminal cleanup. Temporary online disconnect reservations retain their existing semantics.

## Boundaries and preserved exceptions

- Casts not yet completed do not finish after death. Channels, grapples, beams and fighter-attached auras end with their fighter's execution/personal mode.
- Personal modes such as mutant, angel, panda, Guitar Star, armor, invisibility, Love Mode and carried bee boxes still reset on death. Already-created independent projectiles, companions, clouds, traps, structures and trails survive a non-final loss.
- Eide's independent NPCs persist, but do not restore Love Mode after respawn.
- Existing destructible death/drop animations and natural expiry rules remain. Owner elimination does not simulate attacking each summon, so it does not manufacture damage bursts or loot. Cookie drops already in the world survive ordinary life loss but are removed on final owner elimination.
- Graves and zombies still follow the separate final-death system. They do not count as ordinary owned summons for permanent cleanup.
- Previously applied non-damaging debuffs without owner identity retain their existing expiry rules; no new status/ownership schema was introduced.
- No damage values, durations, health, cooldowns, entity limits, assets, or network message fields changed. Persistent entities can now remain present longer across lives, as requested.

## Files modified in this change

Simulation:
- `packages/game-core/simulation/LifeSystem.ts`
- `packages/game-core/simulation/CombatLifecycle.ts`
- `packages/game-core/simulation/GameSimulation.ts`
- `packages/game-core/simulation/StructureSystem.ts`
- `packages/game-core/simulation/NikalzSystem.ts`
- `packages/game-core/simulation/ReturningProjectileSystem.ts`
- `packages/game-core/simulation/JopaSystem.ts`
- `packages/game-core/simulation/EideSystem.ts`
- `packages/game-core/simulation/NapaSystem.ts`
- `packages/game-core/simulation/AstolfoSystem.ts`
- `packages/shared/simulationRevision.ts` (generated compatibility fingerprint)

Tests:
- Added `tests/owned-entity-lifecycle.test.ts` with 78 cases.
- Updated outdated every-life destruction expectations in `ability-interaction-audit`, `audit-remaining-fixes`, `prelaunch-stability`, `chaos-prelaunch`, `lives`, `astolfo`, `bozo`, `caio`, `dodo`, `eide`, `fausto`, `fire-trail`, `jopa`, `luizinho`, `napa`, `nikalz`, and `roms` test files.

Existing super-armor and bee-rendering changes were preserved. This is a shared deterministic simulation change; the server and all clients must receive matching builds through the existing compatibility gate. No deployment performed.

## Regression coverage

All 64 roster Specials/Ultimates are activated through their input path, then checked for exact owned-object identity/state retention on non-final loss and removal on final elimination. Additional tests cover summon AI damage during respawn; turret fire and structure damage; bee-box counters; natural expiry and summon drops; mounted-owner death; detached tree expiry; simultaneous losses; attributed damage-over-time; fresh grave creation; FFA, teams, tournament rounds, elimination/party modes; reset and departure; authoritative server and delayed-input rollback convergence through death/respawn.

Manual follow-up: visually verify destruction effects and mount transitions in native Windows/macOS and a real multi-device match after a coordinated release. These native/live tests were not performed here.

## Verification results

- Full regression suite: **1,436 passed, 0 failed**, including the prior super-armor tests, chaos/rematch scenarios and socket-based networking tests.
- New owned-entity lifecycle suite: **78 passed** (included above).
- Desktop configuration tests: **12 passed**.
- TypeScript check, production client/server build, and lint of all files changed for this task: passed.
- Final diff/whitespace review: passed; no unrelated work was removed. The repository-wide lint limitation reported in the prior task (two errors in an ignored local deployment script) remains outside this change.
