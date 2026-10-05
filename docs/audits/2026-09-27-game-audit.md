# Game audit — September 27, 2026

## Scope and evidence
Reviewed the shared simulation, combat/contact handling, character definitions and special systems, structures, physics, lifecycle/round/tournament transitions, rollback, room server, client networking/input, renderer and asset lifecycles. Reviewed the September 25 audit to avoid reporting resolved findings again. This is a source review plus automated diagnostics; it is not proof that every possible character pairing or browser combination is safe.

Baseline: typecheck and lint pass; 341/342 tests pass. The existing failure is `tests/skins.test.ts:55`, which expects removed `3 looks` text. Reproductions: `tests/fixtures/audit-20260927-repros.ts`. No balance changes are proposed.

## CRITICAL

### C1 — Permanent structure can lock Jomp in Investida or Drupa in Rolling
- **Problem:** The player cannot stop charging or regain control while a surviving permanent house blocks the route. External interruption or destruction is needed.
- **Where:** `packages/game-core/simulation/GameSimulation.ts:487` and `StructureSystem.ts:111` (`collideStructures`).
- **Reproduce (confirmed):** Build Luizinho's house ahead of Jomp, use Investida toward it, release all buttons. The fixture observes Investida still at frame 14 after 900 simulation steps; house health remains 1290.
- **Cause:** Arena-roll moves repeat their active frame until reaching the arena boundary. Structure collision repeatedly stops movement; the same attack serial can damage the house only once.
- **Safest fix:** When a solid structure blocks an active arena-roll move horizontally, enter that move's existing recovery. Leave unobstructed charge, damage, timing constants and hit deduplication unchanged.
- **Regression risk:** Low–medium: applies to all arena-roll moves; verify other users of the mechanic, both directions, allied walls and unobstructed travel.
- **Status:** Fixed after the audit report was written; the new tests also reproduced the same defect in Drupa’s Rolling move before the fix.

## HIGH

### H1 — Guard fails on structure roofs
- **Problem:** Holding the correct guard direction on a roof takes an unblocked aerial hit.
- **Where:** `CombatSystem.ts:29` and `GameSimulation.ts:672`.
- **Reproduce (confirmed):** Compare a standing defender holding back on the ground and at a built wall's roof height. The same palm produces BlockStanding versus AirHitStun.
- **Cause:** Movement uses `collisionStage` containing roof platforms; hit resolution receives the original stage.
- **Safest fix:** Pass the same authoritative support surfaces to hit resolution and audit periodic reactions for the same distinction.
- **Regression risk:** Medium: aerial launches, platform edges and chip damage need tests.

### H2 — Failed Dodo/Jomp asset load cannot be retried normally
- **Problem:** A transient image failure leaves subsequent attempts to start with that character rejected until page reload/cache disposal.
- **Where:** `apps/client/src/rendering/DodoRenderer.ts:81–100`, `JompRenderer.ts:85–91`.
- **Reproduce (source-established, browser fault injection not performed):** Fail one character image request, restore connectivity and retry character loading in the same page.
- **Cause:** Character-level promises retain rejection even though the outer visual registry and shared texture cache support retry. Partial successful frame textures also lack failure cleanup.
- **Safest fix:** Reset the rejected character promise and dispose resources allocated by that failed attempt; guard against overlapping retries/disposal.
- **Regression risk:** Medium: shared texture ownership must be preserved.

### H3 — Rollback can reuse the wrong companion visual
- **Problem:** A surviving cached clone ID can show the wrong character/companion variant after rollback changes summon order.
- **Where:** `SceneRenderer.ts:270–275`; `HairSystem.ts:20`.
- **Reproduce (source-established):** Draw a snapshot with clone ID 0 from one summoner, then restore a snapshot where ID 0 belongs to another character/variant and draw again.
- **Cause:** Renderer identity is only numeric clone ID; creation order is part of rollback state and can change. Existing visuals are not checked against current character/kind/variant.
- **Safest fix:** Include presentation identity in the cache entry and replace only mismatched visuals.
- **Regression risk:** Low: verify disposal and rollback across summon/despawn boundaries.

## MEDIUM

### M1 — Companion balls share structure hit identifiers
- **Problem:** Distinct companions' projectiles can be consumed by a structure while only one deals damage.
- **Where:** `StructureSystem.ts:86` and its hit-stamp pruning.
- **Reproduce (confirmed):** Send balls from companion IDs 0 and 1 with the same local attack serial into one enemy wall. Health drops by only one ball's damage.
- **Cause:** The key uses owner, move and serial but omits companion identity; companion serials start independently.
- **Safest fix:** Include companion ID in both stamp creation and retention keys.
- **Regression risk:** Low: preserve intentional repeat-hit suppression for a single projectile.

### M2 — Exact multiplayer hashes depend on transcendental floating-point results
- **Problem:** Cross-engine last-bit differences could terminate otherwise equivalent matches as desynchronized.
- **Where:** `JompSystem.ts:47–60`, `ReturningProjectileSystem.ts:37`, `LightBeamSystem.ts`, exact snapshot hashing in `GameSimulation.ts`.
- **Reproduce (risk, not a reproduced cross-browser failure):** Replay identical Gym Bro, returning-weapon and angled-water inputs on different JavaScript engines and compare snapshots frame by frame.
- **Cause:** Unrounded Math.hypot/cos/sin-derived values enter authoritative positions/velocities; hashing compares exact serialization. Same-engine deterministic tests cannot establish cross-engine equivalence.
- **Safest fix:** First add a multi-engine replay harness; then use a consistent deterministic numeric policy at simulation boundaries, with move-trace comparisons.
- **Regression risk:** High: numeric changes can alter contacts; do not casually round all physics or weaken hashes.

### M3 — Swept projectile target priority follows seat order
- **Problem:** If one travel segment intersects multiple eligible hurtboxes, it can hit the farther lower-seat target first.
- **Where:** `GameSimulation.ts:268`.
- **Reproduce (source-established):** Arrange two enemies along one swept segment, with the nearer enemy later in actor order; overlapping hurtboxes make this reachable without changing projectile speed.
- **Cause:** `findIndex` selects the first actor rather than earliest time of impact; structure contacts already calculate that time.
- **Safest fix:** Select the smallest sweep-entry time with a stable tie-break, using the existing relative-motion handling.
- **Regression risk:** Medium: trades, overlapping bodies and moving targets need tests.

### M4 — Respawn retains optional fields absent from a fresh fighter
- **Problem:** Reset correctness depends on manually remembering every optional ability field.
- **Where:** `LifeSystem.ts:34`, `Fighter.ts` and character-specific cleanup.
- **Reproduce (source-established fragility):** Set an optional property such as `dazed`, eliminate and respawn the fighter; Object.assign does not remove properties missing from the fresh object. A gameplay lock from this example is not established.
- **Cause:** Reset overlays a fresh object onto the old one, with separate hand-maintained cleanup lists.
- **Safest fix:** Define explicit preserved fields and replace/remove the remainder in one shared reset operation, after tests enumerate existing lifecycle contracts.
- **Regression risk:** Medium–high: object identity, lives, meter, serials and ultimate-use persistence must remain correct.

### M5 — WebSocket output has no backpressure bound
- **Problem:** Slow consumers can accumulate queued server output despite input-rate and room-count limits.
- **Where:** `apps/server/src/rooms.ts`, shared `send` helper and broadcasts.
- **Reproduce (operational risk; load test not performed):** Keep a connection alive while its receive throughput stays below repeated broadcast throughput; observe buffered output growth.
- **Cause:** Sends check open state but not bufferedAmount or a queue budget.
- **Safest fix:** Add a measured output budget and disconnect persistently slow peers through normal leave/forfeit handling.
- **Regression risk:** Medium: thresholds must tolerate short network stalls and loading bursts.

## LOW

### L1 — Selector test expects removed copy
- **Problem:** The baseline check command is red even though the earlier skin/portrait assertions pass.
- **Where:** `tests/skins.test.ts:55`.
- **Reproduce (confirmed):** Run npm run check: assertion for `3 looks` fails.
- **Cause:** Test is coupled to old selector copy after the layout change.
- **Safest fix:** Assert available skin options and selected seat state instead of obsolete copy.
- **Regression risk:** Low; retain actual multi-skin coverage.

### L2 — Companion labels disagree with uniform numbering
- **Problem:** HUD companion labels use numbers 11, 23, 34 while current uniforms use 77, 23, 11.
- **Where:** `SceneRenderer.ts:343` and companion assets.
- **Reproduce (source/asset comparison):** Summon all three companions and compare their labels with uniforms.
- **Cause:** Renderer numbers are separate hardcoded presentation data.
- **Safest fix:** Define companion labels alongside variant metadata.
- **Regression risk:** Low, presentation only.

## Working but fragile as the roster grows
- Ability entry/interruption/death/respawn cleanup is distributed among GameSimulation, status, grapple, Jomp and Life systems. New timed abilities need lifecycle tests for each interruption path.
- Direct, periodic, beam, returning-weapon and structure damage follow separate routes. Guard/armor/target eligibility and outgoing modifiers need a documented shared contract; do not merge them wholesale because some differences are intentional.
- Ordinary melee gathers contacts before resolving; beams and other periodic systems mutate actors during traversal. Add seat-permutation tests before introducing more interrupting area abilities.
- Pairwise push separation and fixed body distances deserve crowded eight-player and enlarged-fighter tests; no new confirmed critical failure established here.
- Rendering factories, asset promises and simulation character definitions are registered separately. Validate presentation completeness and transient failure recovery when adding fighters.

## Verification limits and next steps
Existing tests exercise rollback, interruption, teardown, tournament advancement, disconnects, custom floors, structures, pooling and eight-player play. This pass did not run a real multi-device network soak, cross-browser deterministic replay or GPU memory profiling. Those remain useful follow-ups, not claimed passes. No additional confirmed CRITICAL issue was found in this pass.

Only C1 is authorized for repair in this audit phase. HIGH/MEDIUM/LOW findings remain open; no balance changes or broad refactor are included.


## Critical repair completed

Changed only the shared structure/charge boundary:
- `StructureSystem.collideStructures` reports actors whose horizontal position was blocked by a solid structure.
- `GameSimulation` resolves the existing frame’s structure and fighter contacts first, then advances an active blocked arena-roll move to its existing recovery.
- No damage, speed, cooldown, recovery duration or animation assets changed. Jomp and Drupa retain normal travel to the arena edge when unobstructed.
- Regenerated the simulation content revision so incompatible online builds are distinguished.

Added `tests/audit-charge-recovery.test.ts`: eight tests cover both fighters, both directions, surviving house collision, exactly one intended damage application, regained movement control, unobstructed boundary travel, and identical snapshot replay. Before the fix all four blocked-charge cases failed; afterward all eight pass.

Final verification: typecheck and lint pass; production build passes (existing bundle-size advisory). Full suite: **349/350 pass**, with only the pre-existing L1 selector-copy assertion failing. The diagnostic fixture still reproduces H1/M1 and confirms C1 is repaired. Real cross-engine/network soak and GPU profiling were not performed.

Stopped after the critical repair, as requested. Remaining: **3 HIGH, 5 MEDIUM, 2 LOW**, including explicitly marked unverified risks. No broad refactor or balance adjustment was made.

## Follow-up — all listed findings addressed

The user subsequently authorized fixing every remaining finding. The previous “stopped after critical” status above records the original audit phase, not the current state.

| Finding | Resolution |
| --- | --- |
| H1 | Direct hit resolution now receives the same roof/platform collision stage used by movement. Tests cover guarding and standing reactions on walls and houses. |
| H2 | Dodo and Jomp share a retryable resource owner. Failed attempts release derived textures, including late completions; rejected promises are cleared. Disposal cancels pending results without poisoning a later attempt. Shared source textures retain their existing ownership. |
| H3 | Companion visuals are checked against character, kind and variant as well as clone ID. Mismatches are disposed and recreated. A rollback-style replacement test verifies reuse, replacement and removal. |
| M1 | Structure projectile stamps and their pruning keys include companion identity. Tests verify two independent hits and suppression of a repeated identical shot. |
| M2 | Authoritative trigonometry and vector lengths use fixed arithmetic paths rather than native transcendental functions. Exact state hashes remain enabled. A reusable V8/JavaScriptCore harness matches 129 move/match traces, including eight-player scenarios. |
| M3 | Ordinary swept projectiles choose the earliest hurtbox entry, retaining actor order only as a tie-break. Relative target motion is preserved. A later-seat nearer-target test verifies single-hit consumption. |
| M4 | Respawn clears the previous object's fields before assigning the fresh state; actor identity and the existing explicit life/meter/serial/ultimate-use preservation rules remain intact. |
| M5 | Server sends enforce a 1 MiB queued-output ceiling. Exceeding it terminates the slow socket, using the existing close/leave/forfeit path; subsequent sends cannot keep growing its queue. |
| L1 | The selector test checks the available skin option values rather than obsolete copy. |
| L2 | Companion numbers and asset paths now share presentation metadata: 77, 23, 11. |

### Determinism and behavior evidence

`node scripts/cross-engine-replay.mjs` bundles and replays the same inputs in Node/V8 and the macOS JavaScriptCore shell. Other hosts can supply `JSC_PATH`. All 129 trace sets match exactly. This checks the core simulation in two engines; it is not a multi-device network soak.

Only three pre-existing movement trace entries changed: Roms straight/straight2/straight3. `node scripts/compare-simulation-math.mjs` compared native and shared arithmetic over 5,403 frames: all discrete state matched, with a maximum numeric difference of **1.4210854715202004e-14**. Only those three exact-hash fixtures were updated after this comparison. No damage, speed, cooldown or duration definitions changed.

Targeted tests are in `tests/audit-followup.test.ts`; the original diagnostic fixture now verifies H1/M1 as repaired. The earlier architectural watchlist remains guidance for future characters, not a reason to rewrite working systems.

Final follow-up verification: **350/350 tests pass**, typecheck and lint pass, and the production/client/server build passes. The existing bundle-size advisory remains. Cross-engine replay and native-math comparison also pass. All ten remaining numbered findings are addressed; no balance definitions were changed. Network backpressure is covered by a targeted queue-budget test rather than a production load test, and GPU memory profiling was not performed.

Fixture correction: the original H1 diagnostic set roof height without moving the defender over the roof's horizontal span. That particular original observation was therefore insufficient proof. The corrected diagnostic and new wall/house tests place the defender on the actual roof and pass with the shared collision-stage fix; source inspection independently established the original mismatch.
