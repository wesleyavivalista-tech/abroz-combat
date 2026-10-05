# Creating characters and abilities

## 1. Character package

Create `packages/game-core/characters/<id>/character.ts`, splitting `moves.ts`, stats and ability configuration as the package grows. Export a `CharacterDefinition`; register it in `characters/registry.ts` or a shared content bootstrap used by client and server. Ordinary additions must not edit `GameSimulation`.

Define the existing three-hit chain, heavy/third/crouch/air mappings, two specials, two supers, statistics and cosmetic skin IDs. Reuse `move()` from `characters/common.ts` for shared defaults. Registration validates references and frame data. A skin changes presentation, not fighter identity or move balance.

For a new visual adapter, keep client code in `apps/client/src/characters/<id>/presentation.ts`; use Roms's package as the loader example. Register each actual skin with `registerFighterVisual`, and menu portraits with `registerFighterPresentation`. Binary assets remain in `apps/client/public/art/<id>`. Do not import client code into game-core.

## 2. Basic attack

```ts
jab: move('jab', {
  startupFrames: 8, activeFrames: 4, recoveryFrames: 16,
  damage: 50, hitstun: 22, knockback: 4,
  hitboxes: [{x: 15, y: 60, w: 110, h: 55}],
  cancelRules: [],
})
```

Map the ID in `basicAttacks`. Positions are simulation units (100 per metre), positive Y is up; speed is units per 60 Hz tick. Startup 8 means active frames begin at move frame 8. `allowedStates` is an optional additional entry restriction; shared state locks and cancel rules still apply. Do not rename existing states just to make a new character fit.

## 3. Standard projectile

```ts
shot: move('shot', {
  startupFrames: 12, activeFrames: 1, recoveryFrames: 20,
  damage: 40, hitboxes: [],
  projectile: {originX: 55, originY: 110, speed: 15, lifetime: 120, radius: 18},
})
```

Align the visual weapon/hand attachment with the same origin. Standard projectiles use normal guard/hit resolution. Returning projectiles instead use `returningProjectile: 'ball'` and a character-owned `returningPaths.ball` definition:

```ts
returningPaths: {
  ball: {motion: 'straight', speed: 18, verticalSpeed: 0, gravity: 0,
         radius: 17, hitInterval: 24, life: 900},
},
returningCapacity: 4,
```

Other supported motions are `vertical` and `bounce`. `exclusive` allows only one active instance of that path; `weapon` prevents basic attacks while the weapon is away. Paths use shared return/catch and arena-bounce defaults. Extend the reusable path schema when a future projectile needs a genuinely different behavior; do not add a fighter-name branch.

## 4. Special abilities

A continuous movable attack uses:

```ts
spin: move('spin', {
  startupFrames: 15, activeFrames: 180, recoveryFrames: 20,
  damage: 14, hitboxes: [], mobile: true, durationClock: 'simulation',
  periodicMelee: {interval: 10, rangeX: 175, rangeY: 145, hitstun: 12, push: 1.5},
})
```

A directional continuous attack uses `beam` with width, origin, interval, continuous, steerable and optional push. `clipToArena` shares a finite visible endpoint with collision; `targetProfile: 'lower-stance'` includes spread legs. `initialAim` belongs in the definition. Armor uses a timed `armorFrames` move and character `armorDamageTaken` (a multiplier: .6 means 40% less damage).

Temporary alternate attacks use `weaponFrames`, `weaponAttacks` and `weaponModifiers`. `modeDirectInputs` selects alternate buttons directly even in the air. Optional `modeFinale` supplies a move, returning path, duration and burst velocities. Expiry, interruption and death are different lifecycle events: death must not trigger an expiry attack.

## 5. New reusable mechanic

1. Specify gameplay intent, targeting, blocking, duration clock, stacking/refresh and interruption/cleanup rules.
2. Add typed configuration in `types.ts`, with startup-time validation in `validateCharacter`.
3. Implement a mechanic module consuming definitions and snapshot state. Keep update order explicit.
4. Use `applyDamage` for health subtraction and shared collision helpers for contact. Preserve the intended reaction policy: periodic damage need not stun.
5. Add future-affecting state to snapshots and initialization/cleanup; never use wall-clock timers or hidden mutable closures.
6. Add tests with a second arbitrary fighter ID to prove reuse, plus replay, mirror directions, teams, invulnerability, hitstop and simultaneous modes.
7. Add debug geometry from the same collision data and presentation events/attachments.
8. Increment protocol revision for engine/hook changes; gameplay data changes also change the content fingerprint.

Do not add every imaginable component in advance. Unique character behavior can remain a deterministic package-owned hook, with an explicit version change and tests.

## 6. Animation and assets

Create full action coverage: idle, both walking legs, forward/back dash, jump/fall, crouch, guard, hit reactions, knockdown/recovery, every attack, victory and each transformation. Use `AnimationContract` validation and per-action manifests. Missing art must not silently masquerade as an unrelated attack.

Resolve action first, then outfit/mode artwork. Use `attachmentOffset` for authored hand/weapon/nozzle points. Visual frames follow simulation state, never trigger simulation damage. Check foot anchors, silhouette consistency, both facing directions and mode overlap manually. An automated manifest check cannot judge whether the walk looks natural.

## 7. Verification and shipping

Run `npm run check` and `npm run build`. Keep the pre-refactor behavior baseline unchanged unless a gameplay change is intentional. Test offline, training and delayed-input rollback; inspect debug shapes against art. Stress active effects in six-player matches. Update the move guide and artwork notes.

The room relay rejects different gameplay-content versions. Deploy/restart client and server together after protocol changes. The relay is not authoritative anti-cheat; do not confuse deterministic synchronization with competitive security.
