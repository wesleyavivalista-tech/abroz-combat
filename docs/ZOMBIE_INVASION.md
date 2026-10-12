# Zombie invasion — local implementation, October 11, 2026

## Behavior

- Fight clock 180 seconds: two PT invaders at the left, two Bolsonaro invaders at the right.
- Every subsequent 10 seconds: one per side, selected deterministically among that side's three variants.
- Cap: 16 invasion actors total, at most eight per side, including entering/dying actors. Full waves are skipped, not queued. Existing grave zombies have their own lifecycle and are outside this cap.
- Invaders are neutral arena actors, with no player-owned seat. They chase living fighters of either team; their attacks can also hit non-undead summons. Fighters and summons can damage them through existing combat contact paths.
- All six reuse the existing undead movement code, including its 0.49 movement multiplier, shamble, jumping and platform navigation. Weapon types only change attack behavior.
- PT heavy uses a **scythe and hammer**, with three separately registered contacts. The revolver has a 42-frame windup, 150-frame attack cooldown and a dodgeable 4-unit/tick bullet. Bullets stop on solid structures, hit once, and disappear when their shooter dies.
- Bullet pool is separate from fighter projectiles and capped at 24. Invaders never count as competitors or win-condition survivors.
- Match/round cleanup clears invasion actors and bullets. A new tournament/elimination round starts a fresh countdown. Training is excluded.
- These are simulation-clock seconds, so pause/network stalls and existing final-death slow motion affect elapsed wall time as they do the rest of the game.

## Tuning and files

`packages/game-core/simulation/InvasionSystem.ts` contains schedule, capacity, six profiles, deterministic selection and attacks. `UndeadSystem.ts` supplies shared movement and death lifecycle. `GameSimulation.ts`, `CombatLifecycle.ts` and snapshot types integrate the event.

Client presentation: `ZombieSpriteRenderer.ts`, `UndeadVisuals.ts`, `GameAudio.ts`. Six 4×4 sheets (96 authored poses total) are in `apps/client/public/art/zombies/invasion/`. They include idle, walk, enter, attack, hit, death and airborne poses. The built-in image generation tool created them; complete prompts/provenance are in `prompts.json`. A targeted isolation seam separates touching weapon tips in the heavy sheet. The loader rejects incomplete frames rather than silently showing a blank sprite.

Development-only preview: `http://localhost:5174/invasion-preview.html`. It uses the actual game renderers and simulation; its wave test starts two seconds before invasion. It is not a production build entry.

A regression check also caught the previously added Roms/Drupa beam-origin identity branch. It now uses explicit `beam.originProfile: "hose"` metadata on Roms, preserving the two origins without hard-coded fighter identity in shared simulation.

## Verification

- 1,485 TypeScript tests passed with test concurrency limited to four, including networking/security, roster, rollback, lifecycle and architecture suites.
- 16 focused invasion tests passed again after the final total-cap guard.
- Tests cover exact wave timing, hitstop, skipped capped waves, deterministic variety, all-six movement parity on every registered stage, three-hit combo/interruption, bullet windup/dodging/invulnerability/walls, neutral ownership, departure, death cleanup, winner/draw, tournament reset, snapshot recovery and authoritative/rollback state equality.
- TypeScript and targeted ESLint passed. Full lint has two pre-existing `no-explicit-any` errors in `deploy/local/recovery-production-smoke.ts`; that unrelated file was not changed.
- Web production build, desktop web bundle build, and server TypeScript build passed.
- Browser preview loaded all six sheets, displayed corrected heavy attacks, and advanced live waves without console errors.
- Isolated CPU-only test: eight stationary high-HP fighters plus sixteen invaders over 108,000 ticks (30 simulated minutes): mean step 0.092 ms, p95 0.147 ms, maximum sixteen invaders/two simultaneous bullets observed, final serialized snapshot ~46 KB. A separate eight-fighter/no-invasion baseline averaged 0.022 ms. These are development-machine measurements, not GPU, network, worst-case ability swarm, or production capacity promises.

## Release and remaining QA

Not deployed. Publishing this gameplay change requires matching browser assets, server simulation, and Windows/macOS desktop builds. The simulation fingerprint was regenerated for compatibility gating; do not mix old and new builds in online matches.

Before release, play a real online match past 3:00 and 3:10, test heavy/flag/revolver attacks with controllers, and test an eight-player ability-heavy match at the cap on lower-end hardware. Review animation readability and spawn-side presentation in each arena. Native Windows/macOS executable testing and multi-device network testing were not performed for this change.

## Requested balance update

Invasion-only damage is now doubled: normal 56, flag 76, heavy combo 48 / 56 / 72, revolver 68. Player/grave-zombie damage and poison are unchanged. Heavy attack rate is increased by 40%: timeline boundaries divide by 1.4 and round up to simulation ticks, giving contacts at ticks 18 / 43 / 68, combo completion at 83, and a 112-tick attack cycle. Movement is unchanged. Sprite contact timing and the lineup preview use the same updated phases. Twenty-three invasion/presentation/undead regression tests passed for this update.

### Additional 10% attack-speed increase

All six invasion variants now divide their previous attack timings and attack cycles by 1.1, rounding up to whole ticks. This stacks with the heavy variant's prior increase. Current cycle / completion ticks: normal 82 / 44, flag 99 / 55, heavy 102 / 76, revolver 137 / 71. Heavy contacts are now 17 / 40 / 62; revolver fires at 39. Rendering and lineup previews use shared timing. Damage, movement speed, bullet travel speed and player zombies remain unchanged. All 24 focused invasion/presentation/undead tests, type checking, targeted lint and the web build passed.

### Additional 100 HP per invasion variant

Current HP: PT/Bolsonaro normal 340, PT/Bolsonaro flag 420, PT heavy 520, Bolsonaro revolver 340. Player/grave zombies are unchanged. The fighter lineup reads these values directly from the shared profiles.

### Additional 30% attack-speed increase

The latest request stacks another 30% attack-rate increase on the existing timings (divide the previous integer timings by 1.3, then round up). Current cycle / completion ticks: normal 64 / 34, flag 77 / 43, heavy 79 / 59, revolver 106 / 55. Heavy contacts: 14 / 31 / 48; revolver fires at 30. The shared timing functions automatically update sprite playback and the lineup. HP, damage, movement, bullet speed and player zombies are unchanged.
