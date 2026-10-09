# Special / Ultimate execution phase audit

Inspected before implementation: all 64 button abilities in the 16-character registry, GameSimulation move entry/completion, each associated ability system, direct/periodic contacts, grabs, finance stun, forced displacement, status expiry, and death cleanup.

## Protection boundary

Activation starts when the move is accepted (including startup). Execution includes active animation and recovery until `fighter.move` clears or switches. Held/channel/scripted actions retain their real execution state until their existing release, exhaustion, travel, or completion condition. No protection is inferred from effect timers, transformation flags, summons, or projectiles. Existing invulnerability and defensive modifiers remain unchanged. Death and existing intentional exits remain authoritative.

| Fighter | Specials: activation / execution → persistent phase | Ultimates: activation / execution → persistent phase |
|---|---|---|
| Nikalz | Testada cast → shockwave; Bees cast → swarm | Meteor startup + scripted flight/impact/recovery → expanding wave; Bee house cast → carried boxes. Each placeBox cast is a continuation; idle carrying/buildings/swarms are unprotected. |
| Jopa | Football / Chess Master casts → ball / chess pieces | Crying Tree / Chess Knight startup → possession / mount. These clear the cast at activation; their existing possession invulnerability is separate and unchanged. |
| Biel | Wine lover / Coin Rain casts → bottle / rain | Selling Loan cast → five stamp attempts (each stamp has its own execution); MMORPG addicted transformation cast → flight. Feathers/dive/divine are transformed basic attacks, unprotected. Loan energy lock persists independently. |
| Eide | Seller / Casas Bahia casts → appliances | In love cast → NPC / love effect; Suco lover cast → mutant control. Mutant basics remain interruptible. |
| Astolfo | Talking held execution until release/exhaustion; Spider collection cast → spider / poison | Bipolar cast → personalities; A great idea cast → aura. Neither persistent phase grants armor. |
| Fausto | Origami cast → trap; White Cloud cast → cloud | Ancestry cast → sword mode; Bravinho cast → anger. Sword basics / flash remain interruptible. |
| Napa | Cookie cast → projectile; Super Sniff startup + sustained suction + recovery | Cookie Monster summoning cast → independent summon; Mega Sneeze cast → snot hazard. |
| Jomp | Cool Muscles held execution until release/exhaustion; Investida startup + travel until boundary/collision + recovery | Gym Bro startup/homing + actual grab sequence until release; Body Perfections cast → transformed control. Existing stance damage reduction preserved. |
| Dodo | Power Chord cast → sound projectile; Low-profile instant cast → invisibility timer (not execution) | Pain Killers cast → clones; Guitar Star cast → guitar mode. Charged starWave is a basic attack, unprotected. |
| Drupa | Rolling startup + travel + recovery; Bald head startup + beam emission + recovery | White Buda Beam is a sustained execution, protected through emission/recovery; White Buda Transformation cast → transformed control. Transformed budaForward basic beam remains interruptible. |
| Gut | Unwanted touching startup + successful grapple + recovery; Meditation held execution until release / loss of support | Immortal cast → extra life; Kung Fu Panda cast → panda control. Dedicated spearThrow expiry animation protected only while executing; outgoing spear is independent. |
| Tocha | Fireball cast → projectile/burn; Heavy Metal pentagram cast → ground hazard | On fire cast → aura; Metal Head Banging cast → projectile / pentagram / burn. |
| Bozo | Body hair melee execution; Hair grip cast → projectile / trap | Bunda de Pelucia cast → existing damage reduction; Hair clones cast → clones. Damage reduction is not execution armor. |
| Caio | Bloody ass cast → pool; Indigena cast → dart / poison | Sea of ass blood cast/recovery → flood; Blood master cast → buff. Basic vanish is not protected despite using SpecialMove state. |
| Roms | Heavy firefighter cast → gear reduction; Axe spin startup + continuous spin + recovery | Juggling cast → weapon control; Firefighter water startup + sustained beam + recovery. Expiry finale projectiles do not create an execution animation or grant armor. |
| Luizinho | Seller cast → projectile; Wall cast → wall | Turret cast → turret; Your dream home mark cast → marker, subsequent build cast → house. Structures do not extend protection. |

## Root causes and scoped changes

Direct/periodic hit reactions clear the active move and overwrite its animation. The five-hit escape can also clear a move before the contact handler evaluates protection. Finance stun, Gym Bro capture, water push, suction, and house collapse write reactions separately. Use one derived execution predicate at these entry points. Preserve damage/status effects that do not interrupt execution, existing attack-priority clash rules, self-directed cancellations and mode expiry behavior. No new timers, serialized state, move timing, stat, or protocol fields are needed.

## Implementation and files

- `packages/game-core/combat/ExecutionArmor.ts`: one derived predicate for registered Specials/Ultimates, explicit continuation casts, and dedicated expiry animation. Requires a living, non-respawning fighter in the matching execution state (including grapple/Gym Bro execution).
- `packages/game-core/combat/HitstunSystem.ts`: consult protection before the hit-sequence counter/escape can change state. Existing direct and periodic damage still executes.
- `packages/game-core/simulation/FinanceSystem.ts`: loan still applies its energy restriction but cannot impose interrupting stun during execution, including its expiry pulse.
- `packages/game-core/simulation/JompSystem.ts`: protected execution cannot be selected or forcibly captured by Gym Bro; a target that becomes protected during approach uses the existing release path.
- `packages/game-core/simulation/LightBeamSystem.ts`: water retains damage ticks but does not push a protected cast.
- `packages/game-core/simulation/NapaSystem.ts`: suction cannot displace a protected cast.
- `packages/game-core/simulation/StructureSystem.ts`: collapse daze/velocity reset requires an actual hit reaction; damage remains.
- `packages/shared/simulationRevision.ts`: regenerated compatibility fingerprint for this deterministic simulation change. No message schema changes. Release clients and server together; existing compatibility gating separates old simulation builds.
- `tests/execution-armor.test.ts`: 201 tests, including three tests for each of 64 abilities, persistent-mode basics, dedicated ending/follow-up casts, forced displacement, loan, capture, collapse, duplicate summons, active-phase lethal damage, authoritative verification and delayed-input rollback.
- Updated `tests/combat-state-audit.test.ts`, `tests/astolfo.test.ts`, `tests/biel.test.ts`, `tests/fausto.test.ts`, `tests/gut.test.ts`, `tests/napa.test.ts`: replace obsolete normal-hit cancellation expectations with death cleanup or the new protected-execution expectations. Ordinary/basic interruption coverage remains.

## Verification

- Full TypeScript test suite: **1,358 passed, 0 failed**.
- Focused new execution tests: **201 passed** (included above).
- Desktop configuration tests: **12 passed**.
- TypeScript check: passed.
- Production Vite client build and TypeScript server build: passed (the build script's constituent commands were run directly because npm is not on PATH).
- Changed-source/test lint: passed.
- Repository-wide lint: two pre-existing `no-explicit-any` errors in ignored `deploy/local/recovery-production-smoke.ts`, line 9. That unrelated local script was not changed.
- Final diff/whitespace review: passed. No fighter definitions, damage formulas, assets, networking messages, or production configuration changed. Existing bee-rendering optimization and evidence were preserved.

## Limits and manual verification

Not deployed. Native Windows/macOS execution and real multi-device network play were not run in this turn. Before a coordinated release, visually test one long transformation (ordinary reactions after control returns), a long beam under repeated attacks, Meditation release, a protected caster dying, and two clients using the same new build. Existing projectile lifetime, intentional release/cancellation, mode expiry, and attack-priority clash rules remain unchanged. The protection deliberately does not turn persistent invisibility, possession, gear reduction, or transformed basic attacks into additional super armor.
