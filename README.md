# AFTERGLOW — Fighting Lab

## Web and desktop builds

The game shares one client and simulation across the browser and Electron desktop.
See [the desktop distribution report](docs/desktop/distribution.txt) for setup,
build commands, security, generated artifacts and the exact verification limits.
The [architecture audit](docs/desktop/architecture-audit.txt) records the runtime decision.

- Browser: `pnpm run dev:client` and `pnpm run dev:server`; build with `pnpm run build:web`.
- Desktop: `pnpm run desktop:install-runtime`, then `pnpm run dev:desktop`.
- Offline desktop build: `pnpm run build:desktop --offline --dir`.
- Windows installer target: `pnpm run build:desktop --offline --win --x64` on Windows.

The current macOS test build is unsigned and offline. Windows installer compilation
failed on the Mac host; native Windows testing and production WSS setup remain required.

An original browser fighting-game foundation with two generic combat rigs, a cel-shaded Three.js arena, a pure TypeScript combat simulation and input-based WebSocket rollback multiplayer.

**This is the engine phase.** VECTOR and BRUT are test fighters, not finished roster characters. There are no borrowed game characters, sounds or environments.

## Run locally

Requires **Node.js 22.12+** (Node 24 also works) and npm.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. The room server listens on **8080**.

Separately:

```sh
npm run dev:client
npm run dev:server
```

## Play

Local Versus → choose Player 1 → choose Player 2 → The Foundry → Enter the Arena.

| Action                         | Player 1               | Player 2               |
| ------------------------------ | ---------------------- | ---------------------- |
| Move / jump / crouch           | A D / W / S            | ← → / ↑ / ↓            |
| Combo / heavy / kick         | J / K / L              | 1 / 2 / 3              |
| Special 1 / Special 2          | I / U                  | 0 / 9                  |
| Three-move sequence            | Tap J three times      | Tap 1 three times      |
| Block                          | Hold away              | Hold away              |
| Low block                      | Down + away            | Down + away            |
| Dash                           | Double-tap a direction | Double-tap a direction |
| Combat diagnostics             | F1                     | F1                     |
| Pause (local) / leave (online) | Escape                 | Escape                 |
| Reset training                 | R                      | R                      |

Keys can be rebound in Settings. Gamepads use the left stick/D-pad and default A/X/B/Y/RB/LT/RT attacks; attack button indices are configurable. First connected controller controls P1; second controls P2. Online uses your P1 keyboard/controller bindings regardless of assigned seat. Keyboard rollover depends on your keyboard; two gamepads avoid key-ghosting limitations.

### Prototype moves

- **VECTOR:** jab → cross → kick chain, slow heavy launcher, single kick, crouching low, aerial attack, `236 + attack` projectile, `623 + attack` rising strike.
- **BRUT:** slower/stronger normals, crouching low, aerial attack, `236 + attack` rush, `214 + attack` knockback strike.
- `236` means down → down-forward → forward. `623` means forward → down → down-forward. `214` mirrors the quarter circle backward. Press J/K/L on the final direction. I triggers Special 1; U triggers Special 2. Both can be rebound, and both work online.
- Specials cost meter. Match start grants 40; successful hits and blocks build more.
- Repeated first-button presses queue a three-move jab → cross → kick chain, even on a miss; holding does not auto-chain. Button two performs one slow heavy strike; button three performs one kick. Confirmed attacks may cancel into other moves as allowed by character data. Heavy attacks launch and knock down. Airborne opponents remain in air hit stun until landing.

Matches give each fighter **three lives**, with 1000 HP per life and no round timer. At zero HP, one life is lost. A fighter with lives remaining disappears for **two seconds**, then respawns at the exact defeat position (including height if airborne), at full health with **two seconds of invulnerability**, shown by a cyan shield. The opponent keeps their health and can continue moving. Meter carries across lives; the defeated fighter’s projectiles are removed. The last fighter with lives remaining wins. A simultaneous final-life knockout is a draw. Training provides recovering health, optional infinite meter, five dummy behaviors, input history, frame data, damage readouts and collision-box visualization.

### Super Specials

Each fighter has two Supers in addition to their two normal specials:

| Fighter | Super 1 | Super 2 |
|---|---|---|
| VECTOR | Nova Cannon — high-powered projectile | Skybreaker — rising launcher |
| BRUT | Juggernaut — long rushing strike | Faultline — wide low shockwave |

Supers require **100 energy** and consume the full bar on activation. **Each Super can be used once per fighter per match**, across all three lives. A miss, block or interruption still spends the use. Refill the bar to use the other Super. The HUD shows CHARGE / READY / USED. Gamepad defaults: LT / RT. Normal specials remain repeatable with their existing meter costs. In training, infinite meter refills the bar, but used Supers stay spent until Reset is pressed.

## Test multiplayer locally

1. Start client and server with `npm run dev`.
2. Open 2–6 browser windows or devices connected to the same server.
3. In the first, Online Match → choose fighter → stage → choose Free-for-all (2–6), 2 vs 2 or 3 vs 3 → choose Auto balance, Blue or Red → Create Room.
4. In the other clients, follow the same flow and join the displayed five-character code.
5. The match starts when all selected slots are filled and ready. Each client uses its P1 controls. Local versus remains two-player.
6. F1 shows ping, input delay, rollback count, remote frame and desync status.

Browsers throttle background tabs; keep both windows visible. Slow/background clients make the opponent wait at the prediction limit. A room disconnect ends the session with an explicit message. Rejoining/resuming an old match is not implemented.

### Another machine on your LAN

Vite listens on the LAN for development. Open `http://YOUR_LAN_IP:5173`. Add that origin to `ALLOWED_ORIGINS` when starting the server. The client defaults to WebSocket on the page hostname, port 8080. Allow those development ports through your local firewall as appropriate.

### Latency simulation

Settings provides 0/50/100/150/200 ms of **additional outbound one-way input delay**, plus optional 0–20 ms jitter. Transport order is preserved. Network ping measures the connection itself and excludes this artificial delay. Default input delay is 2 frames and max prediction/rollback horizon is 8 frames. Change constructor/server match configuration to tune them. Delays exceeding the horizon cause stalls, not silent divergence.

## Architecture

```text
apps/client/src/
  input/        keyboard, remapping, gamepads
  rendering/    Three.js scene, stage, fighter adapters, pooled effects
  audio/        generated placeholder music and sound effects
  assets/       resource registration and preloading
  ui/           menu/HUD rendering
  network.ts    browser WebSocket transport and latency simulation
apps/server/src/
  rooms.ts      room lifecycle, seat assignment, validation, relay
  index.ts      HTTP health + WebSocket server
packages/game-core/
  simulation/   fixed-tick match, state machine, snapshots
  combat/       deterministic collision, scaling, pushboxes
  input/        frame input buffer and motion recognition
  characters/   independently defined prototype packages
  stages/       stage gameplay/presentation metadata
packages/networking/
  StateHistory.ts / RollbackManager.ts
packages/shared/protocol.ts
```

Combat has no Three.js, browser or server dependency. It steps with two integer input masks at 60 Hz. No wall-clock or random number enters simulation. Rendering interpolates camera motion separately; combat frame data is authoritative. All positions/velocities use integers. Snapshot data includes input buffers and projectiles, excludes audio/camera/VFX, and can be restored and replayed.

See [Architecture](docs/ARCHITECTURE.md), [Creating Characters](docs/CREATING_CHARACTERS.md), [Creating Stages](docs/CREATING_STAGES.md), and [Validation](docs/VALIDATION.md).

## How rollback works

1. Schedule local input at simulation frame + input delay; send the mask and frame.
2. Save the snapshot immediately before each tick.
3. Predict unreceived remote input from the most recent preceding confirmed mask.
4. When different late input arrives, restore its saved frame and replay to the present.
5. Once prediction reaches its configured horizon, wait for confirmation.
6. Compare periodic confirmed-state hashes to flag desyncs.

Only inputs and diagnostic hashes travel during play. There is no position synchronization. State/input histories retain 180 frames. Effects/audio are suppressed during replay; visual prediction corrections may therefore briefly appear or disappear. WebSocket ordered reliable transport is simple and functional but can stall on lost packets; a future WebRTC transport can use the same synchronization layer.

## Build and validate

```sh
npm run typecheck
npm run lint
npm test
npm run check
npm run build
npm run start:server
```

Frontend output: `dist/`. Server output: `dist-server/`. Tests run headlessly without rendering and include a real temporary WebSocket server.

## Deploy later

Frontend: build command `npm run build`, publish `dist` on Vercel, Netlify or Cloudflare Pages. Set build-time `VITE_WS_URL=wss://YOUR_SERVER_HOST`.

Server: install dependencies, build, then run `npm run start:server` on Railway, Fly.io, Render or a Node host. Set `PORT` to the host-provided port and `ALLOWED_ORIGINS` to a comma-separated exact list of frontend origins. Use TLS/WSS when the frontend uses HTTPS. The HTTP endpoint provides a JSON health response.

`.env.example` documents configuration. Vite reads root `.env` for client values. Export server environment variables in your shell or hosting configuration; the server does not automatically load `.env`.

Rooms are in-memory, single-instance, limited to six peers, and expire while waiting. Input ranges, sequence, lead and rate are validated. The relay is not authoritative anti-cheat, and there is no authentication, ranked matchmaking, persistent profile or reconnect protocol. Quick Match is an explicitly future adapter. No public deployment has been performed.

## Presentation and assets

The arena combines an original AI-generated painted backdrop with locally generated floor geometry, placeholder fighter rigs, haze and particles. See [Art Direction](docs/ART_DIRECTION.md) for the asset provenance and exact prompt. Audio uses Web Audio synthesis after a user interaction. Typography has local system fallbacks; Google Fonts is an optional enhancement. The scene uses toon materials and GPU rendering ([Three.js documentation](https://threejs.org/docs/pages/MeshToonMaterial.html)); local serving follows [Vite server configuration](https://vite.dev/config/server-options).

Target presentation is 16:9 with letterboxing. Canvas resolution scales with the viewport; device pixel ratio is capped at 2. Particle and projectile pools are bounded. Diagnostic features are optional. See validation notes for what was actually tested rather than assuming cross-browser certification.

Online free-for-all uses three lives per fighter. Eliminated players watch the remaining fighters; the last survivor wins. Fighter tags and HUD colors distinguish duplicate character picks. Disconnected fighters forfeit at a shared simulation frame; everyone else continues. Waiting-room slots reopen after departures. Reconnect and mid-match joining are not supported.


## Online team matches

Select **2 vs 2** or **3 vs 3** in the online lobby. Team rooms require exactly four or six players. Choose Blue or Red before creating/joining to play with friends, or use Auto balance. Full teams reject additional members; choose the other team or Auto balance and join again. Team choice is ignored in free-for-all rooms. Room mode is set by its creator.

Each fighter retains three independent lives, two-second respawn at the death position and two-second protection. Friendly fire is disabled for melee, projectiles and supers. Fighters face the nearest active enemy, and teammates spawn together. The last team with lives remaining wins; simultaneous final elimination is a draw. A disconnected fighter forfeits without ending the fight for teammates. Team assignments remain fixed once a match starts.

The client and server must both use this updated build (protocol 5, skin and team assignments included in start messages and simulation snapshots).


## Fighter skins

Fighters support an expandable catalogue of cosmetic skins, selected before locking in the fighter. Each player chooses independently. The chosen look follows portraits, gameplay, respawns and online matches without changing combat. Existing fighters currently have only their Original artwork; additional designs will be registered as supplied. See the multiple-skins section in [Creating Characters](docs/CREATING_CHARACTERS.md).

## Caio and September 23 fighter updates

Caio is playable in local, training and online modes with Teal & Gold and Blackout skins. His third jump uses a blood burst; dash reaches 25% farther. Hold Basic 2 for invisibility while moving/jumping; release before attacking. His combo uses a left jab, right cross and kick.

Specials cost 25 energy: a 6-second blood pool slows movement and attacks by 50%; the blowgun dart deals 45 base damage and slows movement by 20% for 3 seconds. Full-energy supers are once per match: a 17-second arena flood slows movement/attacks by 80% below its surface, while Blood master lasts 34 seconds and leaves 2-second trails/contact slows. Strongest slow wins. Teams, spawn protection, knockouts, clones and rollback share the same rules.

Drupa has a new walk cycle with fixed anatomical scale, distinct opposite-arm jab/cross artwork for both skins, and golden light around his preview fists. Caio has dedicated victory artwork and blood-coated hands in his portraits. Protocol version 29 includes the new fighter state; reload clients together after updating.

### Production release checklist

See [Release configuration](docs/RELEASE_CHECKLIST.txt) for production WSS/origin settings, root-path hosting, cache policy, asset exclusions, and desktop signing requirements. Do not publish the repository or use development-server URLs as the release endpoint.


## Persistent Online Championships

A separate account-free mode under Online. All fights reuse GameSimulation,
VerifiedMatch, rollback inputs, the fighter roster, stages, and match statistics.
The existing championship coordinator is unchanged: its player-bound seats and
single-fight advancement are deliberately not reused. Only its bracket seeding
is reused. This new coordinator supports independently available series, fixed
teams, and two wins before advancement.

### Storage and operations

Use Node 22.13+ (Node 24 recommended) for the built-in SQLite module. No new npm
runtime dependency or hosted database service is needed. Enable the mode with:

```sh
ABROZ_CHAMPIONSHIP_PATH=/absolute/persistent/path/history.sqlite pnpm dev:server
```

Without this variable the existing server works normally and the new mode
reports that it is unavailable. Local test databases should use a dedicated
path outside the repository. Production configuration uses
`/data/championships/history.sqlite` on the existing `abroz_recovery` volume.
Do not place the database inside the deployment image or delete the volume.
The existing safe deployment script requires exactly one server machine.
Do not scale this implementation to multiple writers/machines: room claims
are process-local and the volume is not a distributed database.

SQLite uses WAL, FULL synchronous commits, foreign keys, schema version 1,
and an explicit transaction for result/statistics/score/advancement updates.
Newer unknown schemas fail closed. Unfinished attempts are cancelled on process
startup; completed records do not expire with the short-lived room checkpoint.
Claims are temporary and are released on leave, heartbeat failure, inactivity,
or restart. Active interruptions award no win. A draw replays the fight.
Up to eight persistent fights can run concurrently, within existing connection
and server capacity limits. There are at most 32 claimed series lobbies.

Back up the database regularly, in addition to volume snapshots. Use the SQLite
backup command below against the production database, with a new output filename;
copy that backup off the host using the existing operational backup destination.
Never copy only the live `.sqlite` file while ignoring its WAL. To restore, stop
the single server, validate the backup with `PRAGMA integrity_check`, restore it
with owner permissions for the server user, and restart. Rehearse this before
launch; this change does not provision paid backup services or a backup schedule.

```sh
node scripts/backup-championships.mjs /data/championships/history.sqlite /data/backups/history-YYYY-MM-DD.sqlite
```

The account-free management PIN has 72 random bits and is stored only as a salted
scrypt hash. Public snapshots exclude it. Creation and management share a five
operations/minute/address budget; gameplay input retains the existing budget.
A browser installation ID prevents ordinary tabs claiming multiple slots, but
is not authentication and cannot prove two devices are different people.
Results are accepted only from the server simulation, never a client winner.

### UI and verification

Links use `/play?championship=<uuid>`; desktop poster links use the public website.
The normal controller menu navigator and on-screen keyboard drive the new screens.
Controller 1 operates online menus; every fighter requires a separate connection.
Posters use browser canvas and existing artwork, with PNG download and native
sharing when supported. Native sharing cancellation falls back to download.
Completed history is immutable through the public API. Team wins count once;
fighter totals are scoped to their tournament team/roster position. MVP sums the
existing performanceScore formula across finalized fights, with ties shared.

Automated coverage lives in `tests/persistent-championship.test.ts` and
`tests/persistent-sockets.test.ts`: nine size/mode combinations, BO3 results,
statistics, idempotency, disk reopen, interruption recovery, claims, and actual
2/4/6-client WebSocket input/hash convergence. Physical controllers, native mobile
sharing, sustained production capacity, production volume/backup restore, and
native desktop multiplayer still require release verification. Do not interpret
local automated checks as those production checks.
