# Tocha — playable fighter

Approved appearance implemented in the roster, local play, training, online free-for-all, 2v2 and 3v3. Height: 1.74 m. Both skins share combat stats and moves.

- **Skull tee:** normal hair, white skull on black tee, black pants, white sneakers.
- **Shirtless:** close-cropped hair, winged sun chest tattoo and left upper-arm skull tattoo, black pants, white sneakers.
- Separate 24-pose sprite atlases support movement, dash, attacks, crouching, jumping, reactions and headbanging. During 666 Satan, the shirtless atlas is used temporarily; the selected skin returns afterward.

## Default Player 1 controls

| Key | Move | Initial balance |
| --- | --- | --- |
| J, J, J | Fire jab → Fire cross → Flame kick | 48 / 58 / 82 base damage; repeat presses queue the sequence |
| K | Heavy fire kick | 125 damage, slower startup, launches |
| L | Double inferno | One double-fist strike, 95 damage + 2-second burn |
| I | Fireball | 70 damage + 3-second burn |
| U | Heavy Metal pentagram | Stays 4 seconds, 18 damage every 0.5 seconds to nearby enemies on the same level |
| O | On fire | 18-second aura; contact applies a 3-second burn; movement and attack timing 50% faster |
| P | 666 Satan | Shirtless rock-horns/headbang cast; large seeking pentagram, 360 base damage |

Supers require full energy and consume it. Each super can be used once per fight, including across respawns. Training Reset (R) clears spent supers for another attempt.

Burn deals 10 damage every 0.5 seconds. Reapplication refreshes duration without stacking or delaying the next tick. Burning does not change movement, attacks or stun. Blocking prevents a move's burn; respawn protection blocks burns and ground damage. Friendly fire is disabled. The speed boost affects horizontal movement and move startup/active/recovery timing; jump height and hitstun remain unchanged.

Ground sigils retain separate four-second timers on repeated casts. Defeat clears the defeated fighter's temporary effects and owned sigils/projectiles. Training reset clears all effects. Snapshot state includes burns, aura timers, sigils and fractional attack timing for deterministic online replay. Protocol version: 6.

## Art

Production assets and exact generation prompts: `apps/client/public/art/tocha/` (`prompts.json`). Created with the built-in image generation tool using the approved art in `apps/client/public/art/reviews/tocha-v1/`. PNG alpha was checked; artwork is rendered with transparency and nearest-neighbor sampling. Generated backgrounds beneath zero-alpha pixels do not render.

## Validation

Automated tests cover burn timing during hitstop, free movement, block/invulnerability, sigil lifetime/recasting/height checks, aura duration and speed, super limits across lives, projectile damage, team exclusions, snapshot replay and late-input rollback in 2v2/3v3. Browser checks cover both portraits, both playable skins, aura visibility, fireball burns, and 666 Satan casting.

## Illustrated fire attacks

Both skins now use dedicated eight-pose attack atlases with flames painted directly around the striking fists and shoes. The jab, cross, finishing kick, heavy kick, double punch, fireball cast, crouching sweep and airborne kick use this artwork. The renderer keeps body pivots and feet independent of flame bounds. The former floating hand/foot overlays are removed; projectile travel, burn status and the On fire aura retain their separate effects. Art and exact prompts: `apps/client/public/art/tocha/fire-attacks-prompts.json`.

### Idle breathing
Both skins use four illustrated breathing poses in `idle-v1.png`, advancing every 24 simulation ticks. Fixed shoe baselines replace the old whole-body bob, and simulation timing keeps the animation frozen during pauses and hitstop. Prompt: `apps/client/public/art/tocha/idle-v1-prompt.json`.

## 666 Satan — purple burn

A successful pentagram hit applies purple fire for 600 simulation ticks (10 seconds), dealing 20 damage every 30 ticks: twice the ordinary burn rate. It replaces normal fire without stacking; normal fire cannot downgrade or extend an active purple burn. Burn damage itself adds no stun. Guard, team protection, respawn invulnerability, armor reduction and knockout cleanup still apply. The status label and flame/ember palette distinguish purple fire. Online protocol 9 carries the burn variant consistently through rollback.
