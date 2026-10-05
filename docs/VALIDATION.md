# Validation record

## Automated checks

Validated on 2026-09-16 with Node.js 24.19.0:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — 73 tests passed, 0 failed.
- `npm run build` — frontend bundle and compiled Node server passed.
- `npm run dev` — client and server start together successfully.

Coverage includes mirrored motion recognition, input buffer expiry, collision boundaries, scaling/counter damage, exact active frames, blocking heights, jump/landing states, launch/knockdown, meter/projectile lifetime, cancels, corner pushboxes, three-life elimination, exact respawn/protection deadlines, snapshot restore, 5000-frame determinism, rollback correction, prediction stalling and training resets.

Both shortcut specials are tested independently for each fighter, including meter costs and Vector's self-launch. Two-peer rollback tests run at 0/50/100/150/200ms latency with jitter and compare both peers against an input-perfect baseline. A separate test starts a real WebSocket server and checks room creation, join, ready/start, input relay, invalid input rejection, hash relay and disconnect notification.

## Browser checks performed

In the Codex in-app browser:

- Main menu loads and renders the original arena and both placeholder rigs.
- Fighter selection and stage selection reach Training Mode.
- Training HUD, damage readout, reset and F1 collision/diagnostics panel render.
- Updated menus identify both special moves for each fighter.
- Updated match footer shows I/U special controls.
- Arena/HUD/menu layout inspected visually.

No physical gamepad was connected for hardware testing. Dedicated Chrome, Edge, Firefox and Safari compatibility passes have not been performed. Internet-hosted multiplayer and two separate physical computers have not been tested. Automated WebSocket transport plus two-peer rollback tests verify those layers independently, not a deployed end-to-end service.

## Known prototype limits

- Placeholder procedural rigs, sounds and effects; no finished roster assets.
- Single built-in stage; stage metadata is modular, but adding a selectable online stage also requires extending the start protocol and UI registry.
- WebSocket reliable ordered transport; at high delay the prediction horizon stalls.
- Predicted presentation effects may briefly appear before a correction; replay does not duplicate sound effects.
- Rooms are ephemeral and use a single server process. No reconnect, authentication or authoritative anti-cheat.
- Charge motions, throws, armor, parry, cinematic supers, AI and Quick Match are future extensions.
- Vite reports one approximately 578 KB minified JS bundle (approximately 152 KB compressed), including Three.js. Build succeeds; separating the rendering vendor chunk is a future loading optimization.
- Snapshots are cloned for clarity/correctness; particles and projectiles are pooled. No formal GPU/CPU performance benchmark across target hardware has been completed.

## Painted Foundry art update

Original painted background integrated with physical 3D floor, articulated toon-shaded rigs, soft contact shadows, ambient motes/haze, subtle bloom and expanding hit rings. Built-in image generation was used for the background; the exact prompt and asset location are recorded in ART_DIRECTION.md. Type checking, lint, all 25 tests and production build pass after the art update.

Final browser review on 2026-09-16 confirmed the updated painted arena, training HUD and two-special control hints. The final production build and all 25 tests passed after the final camera/background and menu-fit adjustments.

## Three-life survival update

Rounds and timeouts removed. Verified three starting lives, lethal life deduction, survivor health preservation, exact 120-tick respawn delay (including hit stop), exact 120-tick immunity, inactive waiting fighters, meter retention, third-life elimination, simultaneous deaths/draws, projectile cleanup, snapshot restore and late-input rollback across death/respawn/protection. All 36 tests, lint, type checking and production build pass. Browser check confirms local match startup with three life markers per player and a Survival heading instead of the round timer.

## Exact-position respawn

Respawning preserves the defeat X/Y, including airborne height and either stage boundary. Added regression checks for an opponent occupying the same location and gravity resuming after an airborne spawn. All 39 tests, type checking, lint and production build pass.

## Two Super Specials per fighter

Added four distinct Super move definitions, full-energy activation and independent once-per-match allowances retained across lives. Tests cover partial-meter rejection, full-meter consumption, repeat rejection, independent second use, life-loss persistence, failed attempts during stun, repeatable regular specials, fresh-match/training reset, snapshot/rollback equality and actual damage from every Super. Short keyboard taps are latched until the next input poll, with a regression test. All 65 tests, TypeScript checks, lint and production build pass. Browser testing confirmed O uses Nova Cannon while Skybreaker stays READY, and P independently changes Skybreaker to USED.

Arena expansion: regression covers centered starts, movement to both 24-metre arena boundaries, training reset, and exact-position respawn at the widened right edge.

Platform checks cover both characters reaching both decks, walking and jumping again, stepping off, grounded attacks and blocking, elevated rising specials, high-speed landing, knockdown recovery, exact-position respawn and snapshot replay. The floor-jump regression starts in the open center lane.

Double jump: both fighters reach both raised decks only with a second jump; single/held jumps stay below them. Third jumps are rejected, landing restores the allowance, attacks and hitstun prevent air jumps, and snapshot replay preserves usage.

## Six-player online matches

70 automated tests pass, including six-way elimination/draw/respawn, multi-target melee and projectile ownership, six-client rollback against an input-perfect baseline with independent latency/jitter, and room capacity/seat relay/disconnect validation. A live browser client plus five headless WebSocket clients entered a six-player room; all six rendered with individual HUDs and tags, and the browser reported DESYNC OK. This is a local transport/browser check, not an Internet deployment or a test on six physical machines.

Disconnect handling: late departure rollback converges, absent input no longer stalls survivors, intro/respawn forfeits cannot return, last survivor wins, and waiting-room slots reopen. Dark arcade menus use original SVG portraits, gold selection framing, a thumbnail roster, stage artwork, and updated combat HUD colors.

Detailed art pass (2026-09-17): type checking, lint and production build pass. Browser inspection confirmed both generated portraits load in the main menu and selection screen, and both articulated fighters render with the new materials and attached mechanical details in Training. Portrait framing was adjusted to preserve the helmets.

## Full gameplay art pass — September 17

Added a generated reactor environment behind physical steel columns, foundation panels, vent grilles, platform trusses and rear support beams. Extended both articulated fighters with faceted armor, helmet/jaw plates, hydraulic tubing, segmented limb armor, distinct power units and stabilizers. Added portrait combat HUD panels and coordinated metal/amber styling. Spark streaks are longer; platform dust now uses the event's surface height.

Verified the selection-to-stage-to-training flow in the browser at 1280×720 and inspected both fighters, arena framing and HUD. Typecheck, lint and all 73 existing tests pass. Production build passes (existing large-bundle advisory remains). No gameplay dimensions or combat rules changed. These remain procedural 3D fighters, not production sculpted character models; this pass does not claim parity with the detailed portrait paintings. Six-player responsive HUD styles are retained but were not browser-tested again in this art-only pass.

## Contemporary rooftop theme

Replaced the active sci-fi environment with an urban rooftop court, fencing, HVAC units, concrete practice platforms and a generated city backdrop. Rebuilt both animated fighter meshes as human street fighters with skin, hair, clothing, wraps and sneakers; replaced all active portrait references. Updated menu, stage and HUD presentation. Gameplay collision surfaces and character stats remain unchanged. Internal stage/character IDs remain stable for compatibility.

Visually reviewed home, both character portraits, stage selection and training gameplay at 1280×720. The playable humans remain stylized procedural models, while portraits use detailed illustration. No multiplayer rules were changed.


## Abroz Combat UI architecture
Rebuilt home markup around two opposing fighters, a centered title and horizontal bottom mode deck. Replaced selection with active-fighter artwork, fighter dossier, roster and explicit player lock-in panel. Replaced stage card with full-bleed arena preview and launch controls. Renamed visible branding and browser title to Abroz Combat; preserved saved-control storage keys for compatibility.
Verified local versus -> change P1 fighter -> lock in -> change P2 fighter -> select arena -> launch. Correct selected characters and three lives appear in gameplay. Inspected home, selection, arena and compact HUD at 1280x720. Production build/typecheck and lint pass.


## Face-off and menu interaction rebuild

Replaced the heavy tilted headline with an upright spaced Abroz Combat wordmark. Added mode selection with a contextual launch action, persistent opposing fighter slots, selecting/locked/up-next states, editable P1 choice, centered roster, and actual special/super names. Online rivals are explicitly unknown until room assignment. Fighter archive selection is independent of match selections. Picker re-render restores keyboard focus. Arena confirmation shows the chosen matchup and supports returning to selection. Added native modal pause drawer and winner/lives result presentation; Escape prevents the native dialog default so opening pause does not immediately close it.

Browser checks: home and face-off at 1280x720 and 800x600; online labels; local P1 lock/edit and P2 selection; arena launch; training flow; pause/resume via Escape and buttons. Result layout checked with a temporary source-exact static winning-snapshot fixture, then removed. Results were not reached through a complete browser-played match. Existing 73 tests, typecheck, lint, and production build pass. Gameplay rules unchanged.


## September 18 technical audit

See [audit findings and current validation](AUDIT_2026-09-18.md). Earlier sections above are historical checkpoints, including artwork and interfaces since replaced.


## Online 2v2 and 3v3 — September 19

Typecheck, lint, all **99 tests**, and client/server production builds pass. Nine new team tests cover balanced capacities and explicit team selection, server assignments, waiting-room departures, teammate damage immunity, projectile pass-through, enemy-facing, respawn eligibility, team wins/draws, four/six-client rollback convergence with delayed inputs and jitter, and late teammate departure reconciliation.

Live local WebSocket checks used one browser plus three/five scripted input clients. Inspected the 2v2 and 3v3 lobbies and fights, team spawn sides, HUD grouping/colors and name tags. Confirmed a teammate disconnect only forfeits that fighter, survivors continue, and elimination of the other team produces the correct team victory screen. No browser console errors were observed. These are local transport checks, not six separate machines or an internet deployment. Vite's existing bundle-size advisory remains.

## Expandable fighter skins — September 19

Typecheck, lint, **103 tests**, and production client/server build pass. Four new tests cover expandable skin catalogues and validation, identical combat across different skins, snapshot/respawn preservation, server rejection and broadcast of chosen skins in team rooms, selector markup, portraits and per-skin rendering factories. Browser inspection confirmed the skin control fits the existing face-off layout, and Original skins load into training without console errors. Multi-skin tests use three synthetic catalogue entries; no alternate artwork has been shipped yet. The current two fighters retain their Original look pending supplied designs. Protocol is now 5; restart the server and reload clients together.
