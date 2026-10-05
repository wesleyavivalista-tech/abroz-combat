# Luizinho — playable implementation

Appearance approved on 25 September 2026. Both outfits use the approved portraits and matching movement/combat atlases. The original approval page remains at `/art/reviews/luizinho-v1/index.html`.

## Controls

Default player-one controls: J punch/punch/kick chain, K heavy kick, L straight punch, I Seller, U Wall, O Turret, P Your dream home. Tap P once to mark, continue fighting, then press P again to build without spending more energy. Normal jump, double jump, crouch, guard and dash controls apply. Both skins have identical gameplay.

## Requested mechanics

- Ten distinct product sprites, cycled deterministically; no random-number dependency in online play.
- Destructible wall blocks enemies and incoming enemy projectiles. When cast on a platform, it uses that platform height and stays inside the platform edges.
- Improvised brick-and-timber turret with metal barrel/details: 700 health (70% of max), 80 seconds, aimed, dodgeable cannonballs in all directions. Placement uses the floor/platform at Luizinho's position. The gun carriage pitches toward elevated or lower targets; each shot keeps its release direction so later movement can evade it.
- House: marked location persists until built; encloses both sides and roof, taller than platforms, 1,000 health (100% of max), attackable by everyone including its owner. An opaque cutaway interior sits behind the fighters, with the two brick side walls and timber ceiling in front. Construction is first marked by only sparse bricks and wooden planks on the ground. Active jumping strikes at the ceiling damage the roof; idle head bumps do not. Destruction animates inward and applies damage plus seven seconds of stun, respecting existing recovery protection.
- Structures/projectiles clear on owner knockout, forfeit, result, or practice reset. Timers use simulation frames and continue during hitstop. Snapshots contain all structure state for rollback.
- Complete movement and combat sheets for both skins: alternating legs, opposite-hand punches, kicks, dash forward/backward, jump/fall, crouch, guard, hit, knockdown/get-up, blueprint and product throw actions.

## Initial values where the brief did not specify a number

These are Luizinho's starting values for playtesting; existing fighter balance was not changed.

| Item | Initial value |
| --- | --- |
| Max health | 1,000 |
| Walk / backward speed | 5 / 4 units per tick |
| Basic combo damage | 50 / 60 / 85 |
| Heavy kick / straight punch | 125 / 70 |
| Seller | 65 damage, 25 energy, 15 units per tick |
| Wall | 300 health, 5 seconds, 25 energy |
| Turret shot | 36 damage, one per second, 18 units per tick |
| House collapse | 400 damage + seven-second stun |
| Ultimate activation | Existing 100-energy / once-per-match rule; house second press is free |

Startup, active and recovery timings are centralized in `packages/game-core/characters/luizinho/character.ts`, alongside these initial values.

## Validation

`tests/luizinho.test.ts` covers variants, damage, mirrored launches, wall/dash collision, projectile ordering, returning projectiles, platform placement, exact turret lifetime, free house reactivation, enclosure, roof jumping, owner destruction, collapse/recovery protection, hit deduplication, cleanup, bounded structures, six-fighter replay, delayed remote input convergence, and animation pose selection. Existing pre-refactor roster traces remain unchanged.

Artwork generation prompts: `apps/client/public/art/luizinho/PROMPTS.md`. Atlas rectangles follow actual connected artwork rather than equal grid cells, so feet and crossing limbs are not cropped.

Construction artwork revision: `apps/client/public/art/luizinho/construction-v2.png`; built-in imagegen prompt in `PROMPT-construction-v2.md`. Health, damage, duration, and movement values are unchanged by this visual/platform revision.

Structures react to confirmed hits with shake, a brief tint, contact sparks and chips. House destruction splits the existing interior artwork into sections that tip/fall inward and settle into dust over the original 45-frame effect lifetime. Turret and wall destruction now breaks their artwork into falling debris and dust, including on expiry. House collapse deals 400 damage and stuns for seven seconds.
