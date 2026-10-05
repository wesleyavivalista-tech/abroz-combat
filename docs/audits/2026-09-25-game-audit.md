# Game audit — September 25, 2026

## Scope and evidence

Reviewed the current combat, state, input, physics, life/reset, status, projectile, beam, summon, networking, room, loading, rendering and UI lifecycle paths, together with character definitions and existing regression tests. This is a static code audit with targeted deterministic reproductions, not a guarantee that every combination of moves or every browser has been exhaustively tested.

Baseline: `npm run check` passed: type checking, lint and **242 tests**, including 87 existing move traces and multiplayer rollback tests. Passing traces preserve historical behavior; they do not establish that the historical behavior is correct.

Targeted reproductions: `node_modules/.bin/tsx tests/fixtures/audit-repros.ts`. Source locations below are relative to this game directory. Findings distinguish reproduced defects from static findings and future risks. No balance changes are proposed without an explicit rules decision.

**Audit before fixes: 1 CRITICAL, 5 HIGH, 6 MEDIUM, 3 LOW.** Only C1 is authorized for implementation in this pass. The completion section records its final disposition.

## CRITICAL

### C1 — Unrecoverable multiplayer failures do not stop the match

- **Problem:** A missing rollback snapshot or confirmed state-hash mismatch records a diagnostic but allows play to continue. Peers can continue showing incompatible health, positions or winners with no visible warning unless diagnostics are open.
- **Where:** `packages/networking/RollbackManager.ts`: `receive`, `disconnect`, `tick`, `schedule`; `apps/client/src/main.ts`: pending hash comparison and network message handlers.
- **Reproduce:** The audit fixture delivers an input outside retained history, then supplies confirmation and calls `tick`. Before the fix, it prints `Input outside history`, `tick advances: true`, `frame change: 1`. Separately, compare different hashes for an already confirmed frame: the client merely assigns `MISMATCH @ frame` and continues. A stale client build or simulation defect can trigger this path; the reproduction deliberately injects the failure rather than claiming normal traffic always produces one.
- **Cause:** Desynchronization is treated as a debug string, not a terminal session state. The relay has no authoritative snapshot from which clients can safely recover.
- **Safest fix:** Fail closed after an unrecoverable rollback error or confirmed hash disagreement: stop simulation/input scheduling, visibly interrupt the local match, close its connection, and allow return to the menu. Continue normal prediction/stalling for merely late input. Do not invent a winner or silently resynchronize to one peer.
- **Regression risk:** Low–medium. A legitimate failure will now interrupt play instead of silently continuing. Hash comparison must wait for confirmed history; delayed input must remain recoverable. This contains divergence, not its possible underlying causes.

## HIGH — leave unchanged in this pass

### H1 — Interrupted action timer can consume a later super

- **Problem:** An old spin deadline can end a new water move during startup, after its energy and once-per-match use have been spent.
- **Where:** `simulation/AbilityTimers.ts:advanceAbilityTimers`; `simulation/GameSimulation.ts:updateFighter` (move entry); `combat/CombatSystem.ts:resolveHit` and `simulation/ReturningProjectileSystem.ts:periodicHit`. All simulation/combat paths are under `packages/game-core`.
- **Reproduce:** Start spin, interrupt it, then start water so its 30-frame startup overlaps the old spin deadline. Fixture: frame 100, water at move frame 0, old deadline 105; five ticks put water at **931**, skipping activation.
- **Cause:** `actionUntil` survives interruption and is not cleared on entering a new move. Expiry acts on whichever move happens to be current.
- **Safest fix:** Clear the action-owned deadline on move replacement/interruption, or bind it to the attack serial. Preserve independently persistent armor/juggling durations.
- **Regression risk:** Medium: cover interruption, cancel chains, hitstop, slow, recovery, death and respawn; avoid changing intended active durations.

### H2 — Simultaneous axe spins favor the earlier player seat

- **Problem:** Equivalent simultaneous spins do not trade; the earlier actor cancels the later actor before its attack is evaluated.
- **Where:** `packages/game-core/simulation/ContinuousAttackSystem.ts:advanceContinuousAttacks`; `ReturningProjectileSystem.ts:periodicHit`.
- **Reproduce:** Two Roms 100 units apart, both active in spin on frame 20. Fixture yields health **1050 / 1036** and moves **spin / null**. Swap physical sides: actor-array order still decides.
- **Cause:** Contact discovery and mutation happen in the same loop. Ordinary melee instead gathers contacts before resolving them.
- **Safest fix:** Gather eligible periodic contacts first, then resolve using an explicit simultaneous-hit policy consistent with normal melee.
- **Regression risk:** Medium–high: trades, KO ordering, summons and hit interruptions can change. Keep damage/range/interval values intact.

### H3 — Attack families disagree about get-up protection and target geometry

- **Problem:** Ordinary melee/projectiles reject Knockdown/GetUp and honor move hurtboxes; returning balls, spin and continuous beams use other eligibility/geometry paths. Some can knock a recovering fighter straight back into hitstun.
- **Where:** `GameSimulation.ts:hurts`, `ReturningProjectileSystem.ts:advanceReturningProjectiles`, `ContinuousAttackSystem.ts`, `LightBeamSystem.ts`, `combat/CollisionSystem.ts:targetBoxes`.
- **Reproduce:** Fixture places Gut in GetUp inside Roms spin: ordinary `hurts` rejects the target, while spin deals 14 damage and enters HitStunStanding. Compare a move with custom hurtboxes against a normal attack and a ball.
- **Cause:** Shared damage arithmetic does not yet share target eligibility or protection rules. Periodic reactions also bypass normal guard/counter/combo-scaling handling.
- **Safest fix:** First specify which attacks intentionally bypass guard/get-up and which hurtbox profile each uses; then encode those exceptions in a shared contact policy. Do not automatically make every attack blockable.
- **Regression risk:** High: this affects move behavior and potentially balance; needs explicit intended-rule tests before fixing.

### H4 — One unrelated broken art asset prevents all matches from loading

- **Problem:** A failed image for an unselected fighter blocks starting a match between healthy fighters.
- **Where:** `apps/client/src/rendering/VisualRegistry.ts:loadFighterSprites`; `SceneRenderer.ts:prepareFighters`; `main.ts:start`.
- **Reproduce:** Block a Roms atlas request and launch Gut versus Tocha. Every load awaits the full roster, so the loading promise rejects and the match is interrupted.
- **Cause:** A single all-roster promise couples every fighter and skin to every match.
- **Safest fix:** Load/cache required fighter and skin dependencies per match, including any needed summon assets; keep the current actionable load-error UI.
- **Regression risk:** Medium: alternate forms and summons must declare all dependencies. This is a loading change, not an art rewrite.

### H5 — A connected client that stops simulation can stall everyone indefinitely

- **Problem:** A suspended/background client can stop sending gameplay input while its browser still answers WebSocket pings. Other clients exhaust prediction and wait indefinitely.
- **Where:** `apps/client/src/main.ts:loop`; `packages/networking/RollbackManager.ts:tick`; `apps/server/src/index.ts` heartbeat; `rooms.ts:expire`.
- **Reproduce:** In an online match, suspend one client's animation loop while keeping its socket alive. The others stop once they exceed the eight-frame prediction allowance; transport heartbeat does not remove the non-progressing player.
- **Cause:** Connection liveness and gameplay progress are different. Only waiting rooms expire; started rooms have no input-progress timeout.
- **Safest fix:** Add a generous, documented server-side progress timeout with a warning/grace period and deterministic forfeit through the existing departure-frame path. Never have peers independently decide forfeits by local clocks.
- **Regression risk:** Medium–high: slow loading, tab throttling, network stalls and latency simulation must not cause premature forfeits. Choosing the timeout requires a product decision.

## MEDIUM — leave unchanged in this pass

### M1 — Compatibility signature does not cover all deterministic inputs

- **Problem:** The signature covers character data but excludes stage layout, executable state hooks and simulation code. Different builds can pass the handshake if a protocol bump is forgotten.
- **Where:** `packages/shared/contentVersion.ts`; stage registry; character `states` hooks.
- **Reproduce:** Change platform height or a state hook in one build without changing character data or protocol; the content signature is unchanged.
- **Cause:** Manual protocol versioning covers changes outside the data hash. Character insertion order also affects the signature although it is not inherently a compatibility difference.
- **Safest fix:** Include deterministic stage data and an explicit build/simulation revision; sort definitions by ID. Keep render-only assets excluded.
- **Regression risk:** Low–medium: mixed builds will be rejected more reliably; deployment/client/server revisions must agree.

### M2 — Projectile collision implementations have different movement assumptions

- **Problem:** Ordinary projectiles test only the endpoint; returning projectiles use the bounding rectangle of the entire step, which can overcount diagonal corners. Neither sweeps the target's own movement.
- **Where:** `GameSimulation.ts` ordinary projectile loop; `ReturningProjectileSystem.ts`; `combat/CollisionSystem.ts:sweptBox`.
- **Reproduce:** Geometry fixture: move a projectile across a narrow target in one tick with neither endpoint inside it; normal collision misses. For a diagonal return, place a target in a corner of the sweep rectangle away from the actual segment; the broad rectangle can report a hit. These are geometry risks, not a claim that every current projectile speed tunnels through standing fighters.
- **Cause:** One path uses point-in-time overlap and the other uses a broad-phase approximation as its final collision test.
- **Safest fix:** Reuse segment-versus-expanded-box narrow-phase tests; separately define collision against moving targets. Retain existing radii and projectile speed.
- **Regression risk:** Medium: grazing contacts and edge-of-arena hits may change; test both directions, crouching, launches and dashes.

### M3 — Failed art retries retain partially loaded resources

- **Problem:** A late loading failure resets the global promise, but previously created textures/factories are not transactionally disposed or reused before retry.
- **Where:** `apps/client/src/rendering/VisualRegistry.ts` loading body and final catch; `SpriteIsolation.ts` mask cache.
- **Reproduce:** Fail a late atlas or custom skin loader after earlier factories registered, then retry repeatedly. Earlier textures/masks are reconstructed and registered again without an explicit release path.
- **Cause:** Incremental registration precedes completion and retry restarts the entire pipeline. WeakMap entries alone do not provide explicit GPU resource disposal.
- **Safest fix:** Cache individual successful asset loads or stage resources in a temporary batch and dispose the failed batch. Define shared texture ownership before adding disposal.
- **Regression risk:** Medium: disposing a texture still used by an existing fighter would break rendering. This is a static resource-lifetime finding, not a measured browser-memory benchmark.

### M4 — Character validation leaves important optional contracts unchecked

- **Problem:** Some malformed definitions pass validation and fail or produce invalid state only during play.
- **Where:** `packages/game-core/characters/registry.ts:validateCharacter`; `StatusSystem.ts` weapon-expiry move lookup.
- **Reproduce:** Give a registered character a nonexistent `weaponExpiryMove`; the required-move list does not check it, then expiry dereferences the missing move's projectile. Non-finite knockback or malformed optional projectile/hazard values also lack comprehensive validation.
- **Cause:** Validation covers common fields and selected recent mechanics rather than the complete runtime contract.
- **Safest fix:** Validate every referenced move and all simulation-driving numeric values/intervals at registration, with focused invalid-definition tests.
- **Regression risk:** Low–medium: currently tolerated custom definitions may be rejected. No shipped invalid definition was found; this is a future-character risk rather than a current startup crash.

### M5 — Simulation stages and visual stages are not fully interchangeable

- **Problem:** StageDefinition is accepted by the simulation, but spawn height and several ability floor/ceiling limits assume the current arena; visual world coordinates/shadows also import the training arena directly.
- **Where:** `GameSimulation.ts:spawnFighters`; `ReturningProjectileSystem.ts` bounce/return limits; `LightBeamSystem.ts` floor clipping; `apps/client/src/rendering/StageCoordinates.ts` and fighter shadow rendering.
- **Reproduce:** Supply a stage with nonzero floor height or a different width/platform layout. Fighters initially spawn at y=0, while beam clipping and returning-ball floor handling retain zero-based assumptions; renderer coordinates remain tied to the existing arena.
- **Cause:** Stage support is partial. The present zero-floor rooftop hides those assumptions.
- **Safest fix:** Before adding arenas, pass stage geometry to all relevant physics/visual helpers and initialize fighters on the floor. Avoid changing the current arena's coordinates.
- **Regression risk:** Medium: camera, shadows, projectile returns and platform landing need checks together.

### M6 — Reused projectile slots carry obsolete optional state

- **Problem:** A normal projectile spawned into a returning-projectile slot retains old `vy`, `age`, `returning` and `nextHits` fields. Current dispatch mostly ignores them, but they remain in snapshots/hashes and are easy for a future effect or mechanic to misread.
- **Where:** `GameSimulation.ts` normal projectile spawn; `StatusSystem.ts` expiry spawn; `ReturningProjectileSystem.ts` spawn.
- **Reproduce:** Spawn/deactivate a returning ball, then reuse its slot for a normal projectile. Inspect the snapshot: trajectory is cleared, but prior return-path fields remain.
- **Cause:** Multiple partial `Object.assign` initializers share one heterogeneous pool.
- **Safest fix:** Centralize a complete slot initializer or explicitly reset the optional fields. Keep pool size and spawn ordering unchanged.
- **Regression risk:** Low–medium: snapshot hashes/golden fixtures will change even if gameplay does not; coordinate a protocol bump and explain fixture changes.

## LOW — leave unchanged in this pass

### L1 — App-level listeners and rendering resources have no teardown contract

- **Problem:** Input listeners, main-loop/ping handles, ResizeObserver, audio drone and renderer resources are owned for the lifetime of the page. There is no clean remount path.
- **Where:** `apps/client/src/input/InputManager.ts` constructor; `main.ts` global listeners/loop/interval; `SceneRenderer.ts` ResizeObserver; `audio/AudioManager.ts`.
- **Reproduce:** Instantiate a second InputManager/SceneRenderer in a test harness without reloading the page; the earlier listeners/observer remain installed. Normal match restarts reuse these singletons and do not themselves create this leak.
- **Cause:** The application currently assumes one mount per document.
- **Safest fix:** Add explicit disposal only when supporting remounts/hot embedding; retain handler references and dispose owned resources.
- **Regression risk:** Low–medium: removing shared listeners/textures by mistake could disable the live game.

### L2 — Shared systems still have misleading ownership and parallel conventions

- **Problem:** `periodicHit` lives in ReturningProjectileSystem; several modules import actors/damage through HairSystem compatibility exports; fire and blood trails implement similar cell-expiry logic separately. These work now but invite drift.
- **Where:** `ReturningProjectileSystem.ts`, `ContinuousAttackSystem.ts`, `HairSystem.ts`, `FireTrailSystem.ts`, `BloodSystem.ts`.
- **Reproduce:** Add a new periodic area attack or trail and follow existing imports: there are several plausible owners and duplicated lifetime/contact conventions.
- **Cause:** Incremental extraction retained compatibility and character-specific history.
- **Safest fix:** Once behavior is covered, move reaction helpers to combat and share only genuinely identical trail primitives; retain distinct fire/blood rules.
- **Regression risk:** Low for import cleanup, medium for consolidating behavior. No broad rewrite is warranted now.

### L3 — Debug event history survives match/training resets

- **Problem:** The bounded recent-events list can display events from the previous match after reset or rematch.
- **Where:** `apps/client/src/main.ts:recentGameplayEvents`, `start`, reset actions.
- **Reproduce:** Generate hits with F1 open, reset training or launch a new match, then inspect the event list before enough new events replace it.
- **Cause:** The simulation journal resets but its separate UI history does not.
- **Safest fix:** Clear the UI history at explicit match/training reset boundaries.
- **Regression risk:** Very low; diagnostics only.

## Working behavior worth preserving

- Fixed-step simulation and snapshot-based timers; no wall-clock randomness in shared combat.
- Stable network seats after departure, departure-frame replay, bounded prediction/history and tested six-peer convergence.
- KO cleanup removes owner projectiles/hazards/clones and clears status/action timers; fresh matches create new simulation/rollback instances.
- Grapples release when their holder dies or is interrupted; ordinary status and protection deadlines expire during hitstop.
- Client disconnect cancels delayed outgoing packets and ignores stale socket callbacks; match loading uses a revision guard to reject stale completion.
- Most effects use bounded/reused pools; ordinary rematches dispose replaced fighter visuals. No evidence from this review that normal rematches multiply global input listeners.

## Fragile areas as the roster grows

Prioritize H1/H3 and M4 before adding mechanics. Move ownership, eligibility, interruption and cleanup need explicit contracts. Golden move traces should be supplemented with interaction tests, not replaced. Rendering still contains per-character pose rules and direct move-name lists; new forms need explicit animation coverage for movement, hitstun, guard, attacks and interrupted abilities. Six-player collision resolution remains pairwise and order-sensitive; test dense wall/platform clusters before altering it. Do not interpret these risks as permission to rebalance existing characters.

## Critical-fix completion

**C1 resolved by containment. No other finding was changed.**

Exact production changes:

1. `packages/networking/RollbackManager.ts`: scheduling, ticking and incoming replay/departure handling stop after a terminal desync. Added `verifyRemoteHash`, which waits for confirmed history and latches a mismatch as a terminal failure.
2. `apps/client/src/main.ts`: checks session health on incoming inputs/hashes/departures and after simulation ticks. An unrecoverable failure disconnects the local client, disables play, removes any result dialog, and shows the existing interruption screen with a recovery message. HUD/result updates do not run after this interruption.
3. Added `tests/network-failure.test.ts`: missing/outdated snapshots, disconnect rollback failure, confirmed mismatch, unconfirmed-hash deferral, frozen failed sessions, normal late replay and fresh-session recovery.
4. Added manual reproduction fixtures `tests/fixtures/audit-repros.ts` and `audit-peer.ts`. The latter takes an explicitly supplied disposable localhost room code and injects a bad hash for UI verification; it is not included in game runtime.

Verification:

- New regression tests were run before the fix: **2 failed, 1 passed**. Afterward all three pass.
- Full checks: **245 tests pass**, lint/type checking pass; existing **87 move traces remain unchanged**, including related combat/life/ability and multiplayer tests.
- Production build passes. Existing large-bundle warning remains; no new build failure.
- Live browser: created a disposable online room, joined with a test peer, injected a confirmed bad hash, verified the visible **MATCH INTERRUPTED** message and socket departure, returned to the menu, then successfully entered a fresh Drupa/Gut training match.
- Reproduction output now reports `tick advances: false`, `frame change: 0` for C1. H1–H3 still reproduce, confirming they were not silently altered.

No character damage, speed, cooldown, duration, hitbox or move behavior changed. The fix prevents continued play with known-invalid state; it does not introduce authoritative resynchronization or resolve future causes of divergence. Remaining work: **5 HIGH, 6 MEDIUM, 3 LOW**, intentionally stopped here as requested.

# Follow-up: remaining findings fixed

The user subsequently authorized fixing the remaining findings. They explicitly approved shared knockdown/get-up protection for direct attacks, unchanged ongoing poison/burn and guard rules, and a server warning at 30 seconds followed by a 60-second inactivity forfeit, with 120 seconds for initial loading.

The severity sections above preserve the original audit. Their “leave unchanged” labels describe the earlier critical-only pass, not the current status.

| Finding | Resolution |
|---|---|
| H1 | Move entry clears an old action deadline. Direct/periodic interruption clears it immediately; timer maintenance clears orphan deadlines. Independent armor, weapon and blood-mode timers remain intact. |
| H2 | Periodic melee gathers contacts before applying reactions. Simultaneous spins now trade, including a symmetric final-life double KO. |
| H3 | `ContactPolicy.ts` supplies recovery eligibility to normal hits, beams, balls and spin. Beams/balls respect move hurtboxes; water retains its explicit lower-stance extension. Guard behavior, poison/burn and configured attack values remain unchanged. |
| H4 | Match preparation loads only the selected fighter families, with their forms/summons. Skins sharing atlas families are cached together. An unrelated fighter's failed asset cannot prevent the selected matchup loading. |
| H5 | Server tracks accepted input progress, warns the player and room, and forfeits through the existing deterministic departure-frame path. Only players at the input watermark can be timed out; players blocked behind them receive a fresh grace period when they leave. Initial loading gets 120 seconds. Agreed finished matches retain their result screens without inactivity forfeits. |
| M1 | Protocol 36 includes sorted character/stage data and a generated SHA-256 simulation-source revision. Development/build/check scripts generate it; the Vite development watcher refreshes it when deterministic source changes. State-hook source and stage geometry are covered. |
| M2 | Both projectile families use a segment-versus-expanded-hurtbox narrow phase. Normal projectiles test their final in-arena path before despawning. Relative target movement is checked; returning projectiles recheck moving targets after integration using existing per-target hit deadlines to prevent duplicate hits. |
| M3 | Shared source textures are cached per URL, including concurrent requests. Failed entries alone are retried. Successful textures/masks survive retries and have explicit application-level disposal. Individual fighters continue owning their texture clones. |
| M4 | Validation now covers optional move references, cancel targets, finite numbers, projectile/status/beam/periodic/heal intervals, return paths, body scales and complete box coordinates. Caio's two nonexistent crouch cancel targets were removed; they could never be used. Retired prototype test fixtures also discard their inert inherited cancel targets. |
| M5 | Spawn/respawn, status transitions, periodic-hit reactions, flood height, beam clipping and returning-ball floor limits use the supplied stage floor. Synchronous render contexts use the current stage's width, camera bounds and shadow surfaces, and restore afterward. Rooftop geometry rebuilds for the supplied platforms/floor. Existing rooftop dimensions and art remain unchanged; this does not add a new arena or artwork. |
| M6 | Every projectile spawn uses a complete shared slot initializer, removing optional state left by an earlier occupant while preserving pool order and ordinary serialization order. |
| L1 | Input/UI listeners have disposal, fetches have cancellation, audio nodes/context are released, ResizeObserver disconnects, and scene/postprocessing resources are disposed. App hot-disposal cancels animation/ping handles and connections. Shared asset disposal is asynchronous and must finish before explicitly remounting with the same module instances. |
| L2 | Periodic hit reactions live in combat, actor enumeration is imported from Actors, and fire/blood share surface-cell refresh/capacity handling while retaining separate contact effects. Compatibility exports remain for older callers. |
| L3 | New matches and training resets clear the visible event history; simulation resets also clear presentation journals. |

## Verification of the follow-up

- Added focused regression tests in `audit-followup.test.ts`, `audit-loading.test.ts`, `audit-timeouts.test.ts`, and `audit-lifecycle.test.ts`.
- All **87 existing move traces match the original fixture without regeneration**. These cover unchanged ordinary move behavior; the new tests cover the corrected interactions.
- Full validation: **259 tests passed**, type checking and lint passed. Production build passed; the existing large-bundle advisory remains.
- Live preview: Roms/Gut loaded using the new loader; Roms's water rendered from the nozzle, damaged the dummy and pushed it across the arena. Training reset and diagnostic history were checked separately.
- No character damage, speed, cooldown, duration, range or artwork data was rebalanced. The approved recovery-protection rule and documented bug interactions are the gameplay changes.

Remaining limitations: tests cannot exhaust every cross-character combination or every browser/device. New arenas still need their own authored visual design; geometry now follows the stage definition. The online fix forfeits inactive connections rather than adding reconnection/resume support. No findings from this report are intentionally left pending.
