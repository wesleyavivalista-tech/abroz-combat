# Production recovery runbook

## Boundaries

One Fly machine owns all online room, match and tournament state. The recovery
release below adds reservations and durable checkpoints without a replica.
Recovery remains conditional on the freshness and availability of the checkpoint.
Do not add replicas without room routing; local volume storage is not failover.

## First response (read-only)

1. Check https://abroz-combat.fly.dev/healthz, the homepage and /play.
2. Inspect `flyctl machine list --app abroz-combat --json`, checks, recent events
   and bounded logs. Record UTC time, image digest, contentVersion, room counts,
   RSS and event-loop delay. Do not publish secrets or player data.
3. Distinguish provider outage, process exit, process hang, admission limit and
   version mismatch. A full server is not a reason to restart active matches.
4. Failed health checks do not restart a hung process. The current on-failure
   policy retries unsuccessful exits, up to ten retries; persistent faults need
   operator intervention. External health alerts must be verified separately.

## Planned deployment / rollback

Build and review the image before maintenance. Retain the last known-good image
DIGEST and its matching web/desktop content version and configuration. Do not use
`latest`. Check compatibility before rolling back only one component.

1. Have one operator own maintenance; prevent concurrent manual deployments.
2. Enter the existing SIGUSR2 drain mode on the server Node process only after
   the image is ready. Do not send SIGTERM or signal an unverified process.
3. Wait for zero rooms AND zero connections. Include lobbies, completed matches,
   and whole tournaments, not just currently fighting players. Draining rejects
   new connections/create/join but does not terminate existing matches.
4. Use the guarded entry point from the repository root:

   FLY_APP_NAME=abroz-combat \
   ABROZ_SERVER_IMAGE=registry.fly.io/abroz-combat@sha256:<reviewed-digest> \
   ABROZ_FLY_CONFIG=deploy/local/fly.toml \
   node scripts/deploy-server-safe.mjs

   Set FLYCTL_PATH if flyctl is not on PATH. Use the reviewed generated config.
   The guard refuses missing counters, non-drained/nonempty states, multiple
   machines, HTTP failures, and a machine/version change during its two checks.
   It never enters maintenance itself or forces players out. Direct Fly commands
   can bypass it: this is an operator safeguard, not provider access control.
5. After deployment verify /healthz is `ok`, /readyz is 200, expected version,
   and a private two-client create/join/play/leave check. Confirm counts clear.

The guard reduces races but is not a distributed deployment lock. Coordinate
operators. Do not use this path for initial provisioning or an already-dead server.

## Aborted maintenance

Drain mode has no resume signal. Do not drain merely to test the guard. If a
planned deploy is canceled, wait for zero rooms/connections and redeploy the SAME
reviewed image/config with the guard. Never restart occupied rooms just to reopen
admission. If an urgent security/reliability incident requires interruption, the
operator must explicitly accept match loss and communicate it.

## Crash, hang or OOM recovery

If automatic restart succeeds, verify recovery and a fresh private match and counts.
Without a valid checkpoint, lost matches cannot be restored. If retries repeat/exhaust, inspect the root cause
and choose the last compatible release. For a hang, preserve diagnostics before
an operator-authorized restart. Do not endlessly restart a deterministic fault.
A provider outage has no configured application failover: communicate status,
retain evidence, and wait for recovery rather than editing DNS impulsively.

## Alerts to verify

Use free HTTP monitors for the homepage and /healthz, with down AND recovery
email to the owner. Confirm alert contact activation and use a provider test
notification; never break production to test email. Monitor /healthz rather than
/readyz so planned draining does not falsely report an outage. HTTP success alone
cannot validate gameplay. CPU/RAM/crash alerts require provider telemetry and
are not supplied by an HTTP monitor. Record actual confirmation, not assumptions.

## Isolated recovery rehearsal

Use isolated localhost child processes with no production credentials. An optional
separate staging app needs explicit authorization. Test crash/restart, bounded repeated failure,
process hang, memory exhaustion, dropped client connections, full admission,
tournament departure and drain/deploy. Record service recovery time and match
loss, verify menu escape and fresh-room creation, and check room/socket counts.
Test rollback with matching client versions. Never run these drills on production.

## Recovery release

`ABROZ_RECOVERY_ENABLED=1` enables optional recovery for clients advertising
`recovery:1` when creating/joining rooms. Without that setting existing behavior
is unchanged. Modern clients keep a random bearer credential in memory, never
in URLs or diagnostics. Credentials are issued only when seats become stable at
match start, so lobby departures cannot transfer reconnect ownership.
Explicit menu departure revokes it. A transport loss
reserves the seat for 30 seconds; neutral input continues the match, including
when every player is temporarily offline. The grace starts on server detection.
A valid credential atomically replaces a half-open transport; another seat's ID
alone cannot take ownership. Credentials stay valid within the session so a lost
resume response does not strand the player; connected ownership is singular.
Closing/reloading the app loses its in-memory credential. This feature does not
promise recovery after deliberately closing/reloading the client.

`ABROZ_RECOVERY_PATH=/data/checkpoints/state.bin` additionally enables one-second
atomic server checkpoints. Mount durable encrypted storage on /data and prepare
/data/checkpoints owned by the container's node user (UID/GID 1000), mode 0700,
before enabling the path. The running app remains non-root. Never put this file
in public assets, source control, or logs. It contains hashed credentials and
private match state. File permissions are 0600 and the file budget is 32 MiB.
No historical snapshot backup is needed: states older than five seconds at
startup, from the future, or with a different content/schema version are rejected.
Consequently outages/restarts longer than this window cannot resume old matches.
Corrupt checkpoints fail closed and require operator inspection; preserve the
file securely before removing it during an approved recovery operation.

Snapshots include settled simulation state, pending input queues, departures,
rosters, tournament brackets and active duel attempts. Restored clients receive
server state only; client-uploaded HP/positions/snapshots are not accepted.
Snapshot transport preserves non-finite simulation sentinels. Reconnect does
not bypass capacity/admission limits. At a full server, a half-open old socket
may delay admission until normal cleanup. Planned drain still rejects new
WebSocket upgrades, including reconnects: perform maintenance during quiet hours.

Release compatibility: messages are additive, but deterministic source hashing
includes networking. Rebuild/release the server, browser and desktop candidates
from the SAME source revision. Do not deploy only the server and strand old
installers. The old capability-free behavior is regression tested within the
matching content version; it is not a bypass for a different release checksum.

Local rehearsal coverage includes controlled child-process crash/restart,
process suspension/continuation, capacity rejection/cleanup, neutral input,
automatic client retry/cancel, credential ownership, tournament resume and
checkpoint freshness/corruption. No production failure is used for validation.

## Deployment verified — 2026-10-08

- Game/network source a037157; compatibility `46-8a66351b`. Browser publishing
  commit 4002123 adds the matching download links, without simulation changes.
- Single Fly machine `0807569c9039d8`, replacing the previous machine during the
  guarded empty-server rollout. No additional game server remains.
- Encrypted 1 GB volume `vol_vlym3gnldd2kgyd4` mounted at /data. Verified checkpoint
  directory UID/GID 1000, mode 0700; state file mode 0600, updating each second.
  Historical volume snapshots are disabled; they exceed the accepted recovery age.
- 1,149 TypeScript tests, 20 desktop/deployment/guard tests, typecheck, lint,
  browser build, server image and all three desktop packaging jobs passed.
- Local crash/restart restored a real browser match and movement input. Absent
  opponent expired to the victory screen; returning home cleared the room.
  Serialized replay also matched in eight-player groups across the whole roster
  and all four arenas. Production servers were not crashed for testing.
- Production private-room create/join/start/reconnect/leave smoke passed. Its
  reconnect replaced a half-open transport; neutral continuation after detected
  disconnection is covered locally. Final health returned zero rooms/connections.
- All five published installer/checksum/notes links returned 200. Both Mac DMG
  checksums passed verification; packaged ARM64 assets contain the expected
  simulation revision and production backend. Windows/macOS installers remain
  unsigned, and actual installation on each OS still requires manual QA.
- The Windows link includes a version query to avoid an edge-cached pre-upload
  404. Do not probe unpublished object paths before uploads finish; a negative
  response can be cached even after the object exists.
- Fly reported a lease-clear warning for the replaced machine ID; inventory and
  health confirmed the old machine was gone and the single replacement healthy.

### Compatibility release gate

Browser release metadata and desktop `desktop-config.json` include `contentVersion`
and `protocolVersion`. Set `ABROZ_EXPECTED_CONTENT_VERSION` to the **candidate server's**
identifier when building every release artifact; a mismatch fails the build before
publishing/packaging. For incompatible updates, do not use the old live server's identifier.
Compare every candidate artifact before coordinating server/browser/desktop publication.

Changes to message meaning, ordering, admission or recovery behavior in
`apps/server/src` or `apps/client/src/network.ts` require an explicit compatibility
review: bump `PROTOCOL_VERSION` when old and new peers cannot safely interoperate.
Those paths are not automatically source-fingerprinted. Cosmetic-only releases
may retain compatibility. Never relax exact-match room admission to accommodate
an old installer. Retain the legacy error message alongside structured error fields.

## Compatibility and controls release verified — 2026-10-08

- Release 0.1.1; game build `98860c4`, browser publishing commit `d718830`,
  compatibility `46-84932811`, protocol 46. Production Pages deployment
  `5e0181e1.abroz-combat.pages.dev`; server image SHA256
  `270f3ab11262d9f070337cb77361ceb86896ca2450b795bb94ee61390bd774c3`.
- Guarded rollout confirmed zero rooms and connections twice before replacing
  the server. The existing single machine and encrypted recovery volume remain.
- 1,156 game tests and 22 release/desktop/deployment tests passed, along with
  typecheck, tracked-source lint, production browser/server builds, and all
  three native CI packaging jobs (run 37870967669). Lint excluded ignored
  deploy/local diagnostic scripts, which contain pre-existing explicit-any uses.
- Both Mac DMGs passed integrity verification and contain matching version,
  compatibility and production WSS metadata. All three installers, checksums
  and release notes were uploaded and remote size/hash metadata verified; all
  five public download links returned HTTP 200.
- Live browser smoke: main menu, fighter selection, arena loading/rendering,
  movement, registered 35-damage hit, pause and return to menu passed without
  console errors. Local production-build smoke also covered training reset,
  resume and English/PT-BR switching.
- Private production two-client create/join/start/disconnect/resume/leave passed.
  A previous compatibility client was rejected with VERSION_MISMATCH. Follow-up
  health returned zero rooms/connections. Health checks passed and the bounded
  recent log review found no error/fatal/uncaught entries.
- Existing desktop installations require a manual download/update to 0.1.1;
  refresh existing browser tabs. Installers remain unsigned. Actual Windows
  installation, physical-controller and multi-device visual/audio QA remain
  manual checks; this smoke test does not establish exhaustive gameplay QA.

## Combat and permanent desktop workflow release verified — 2026-10-09

- Release 0.1.2, candidate build a733271, browser publishing commit cff0e90,
  compatibility `46-4e5ec6cc`, protocol 46. Pages deployment
  `7452e0f9.abroz-combat.pages.dev`; server image SHA256
  `1ac800b67f6f2b9aa67fa558fc605f86df61dfbd51a228220e36eee12035a32c`.
- Includes bee rendering batching, execution-only Special/Ultimate armor, and
  owned persistent entities surviving non-final life loss. Personal death/reset
  cleanup and final-elimination cleanup remain covered by regression tests.
- Permanent desktop workflow retains installers, checksums and compatibility
  metadata in unpublished draft GitHub releases. Run 37993788024 passed all
  three native packaging jobs. R2 promotion and production deployment remain
  deliberate operator steps. No new service or billing plan was introduced.
- 1,436 game tests passed locally and on Linux CI; final local release/desktop
  suite passed 27 tests. Typecheck, source lint and production builds passed.
  Linux CI container check hit Docker Hub authentication HTTP 504 twice; the
  actual release image built successfully via Fly. Isolated compiled-server
  two-client combat/hash/cleanup smoke passed before deployment.
- Both CI Mac DMGs passed hdiutil integrity checks. All three installer downloads
  from GitHub matched their checksums and metadata; full-body public R2 downloads
  also matched SHA256. All five public download links returned HTTP 200.
- Drain was entered only after verifying zero rooms/connections. Guarded rollout
  preserved machine 0807569c9039d8 and its recovery volume/configuration.
  Previous server image 270f3ab11262d9f070337cb77361ceb86896ca2450b795bb94ee61390bd774c3,
  Pages deployment 5e0181e1 and 0.1.1 download assets remain for rollback.
- Live private two-client combat, matching state hashes, damage, reconnect/seat
  restoration and leave/cleanup passed. Follow-up health/ready returned zero
  rooms/connections, and Fly health checks passed. Old compatibility was
  rejected with VERSION_MISMATCH. Recent structured error/fatal/uncaught count: 0.
- Live browser fighter/stage selection, rendering, movement, 35-damage hit, pause
  and return to menu passed without console errors. A local macOS ARM64 package
  with the matching gameplay revision launched successfully.
- Desktop users must manually update to 0.1.2; browser users refresh. Installers
  remain unsigned. Native Windows/Intel-Mac installation, physical controllers,
  multi-device audio/visual and long-session QA remain manual checks.
- The initial draft's checksum filenames were normalized after GitHub renamed
  spaces to dots. The permanent uploader now normalizes names before upload and
  has regression coverage. Preliminary unlinked local-candidate R2 objects under
  beta-0.1.2-596e0e5 remain; they are not linked from the production download page.

## Combat adjustments and startup readiness release verified — 2026-10-10

- Release 0.1.3, candidate build 03e5b30890746182fe96255f6b7dd5e309ddccff,
  browser publishing commit f0bfb185a0f99c8c99904ed1fe3fdc3113f5b34b,
  compatibility `46-ba730a68`, protocol 46. Publishing commit differs only in
  a capacity-test delivery wait; runtime source matches the desktop candidate.
- Includes Drupa Giant Buda hit-reaction armor; straight-travelling Jopa chess
  piece with one-second stun; soccer-ball repeat-contact registration; Nikalz
  bees at 40 damage and 35% slow; online countdown waiting for peer loading.
  Drupa beam timing received regression coverage without a gameplay change.
- 1,453 game tests and 25 desktop/release checks passed, with typecheck, source
  lint and production browser/server builds. Broad lint still reports two
  pre-existing explicit-any uses in the ignored recovery diagnostic helper;
  it is excluded from release artifacts. One flaky capacity assertion was
  fixed by awaiting trailing socket delivery, preserving its exact count.
- All three native packaging jobs passed in run 38086472555. GitHub candidate
  installers matched their checksums and compatibility metadata. Both Mac DMGs
  passed integrity verification. Full public downloads of all three installers
  matched SHA256; notes and checksum links returned HTTP 200.
- Pages production deployment: `22b5c081.abroz-combat.pages.dev`.
  Server immutable image SHA256:
  `70f5fe652f84816208ac50c777e15fe3fc9bfe2b3be4e18de421b3500adfcc0c`.
  Guarded rollout checked empty rooms/connections and preserved machine
  0807569c9039d8 and encrypted volume vol_vlym3gnldd2kgyd4/configuration.
- Rollback retained: Pages 7452e0f9, 0.1.2 downloads, and server image SHA256
  `1ac800b67f6f2b9aa67fa558fc605f86df61dfbd51a228220e36eee12035a32c`.
  No migration or new infrastructure was required.
- Live private two-client combat matched simulation hashes, registered damage,
  and cleaned up; reconnect restored seat 1 and a frame-122 snapshot; old 0.1.2
  was rejected with VERSION_MISMATCH. Follow-up health/ready and Fly checks
  passed with zero rooms/connections. Recent new-release structured logs had
  no exceptions, fatal errors or recovery failures; the expected old-version
  rejection was recorded as validation.
- Live browser fighter/arena selection, graphics, movement, a 35-damage hit,
  pause and return to menu passed without captured console errors. The actual
  packaged Apple Silicon Mac app also loaded gameplay, moved, registered a
  45-damage Gut hit, paused and returned to menu.
- A temporary R2 credential expired between Mac and Windows uploads; no
  production switch occurred until the owner renewed it and every installer
  was verified. All release files are under beta-0.1.3; old files remain.
- Desktop users must manually install 0.1.3; browser/PWA users reload. Installers
  remain unsigned beta builds. Windows/Intel-Mac installation and upgrades,
  physical controllers, multi-device visual/audio and long-session QA remain
  manual checks; this release smoke test is not exhaustive gameplay QA.

## Invasion, championship and online lobby release verified — 2026-10-11

- Release 0.1.4, game candidate aa47587333a0fd36ebb88ef60f8ff18f959d953e,
  browser publishing commit fabbb177e29cf78725794b8f3ec40d8582cd6559.
  Compatibility `49-8f68f503`, protocol 49. Publishing commit only updates downloads.
- Includes the completed invasion/timer/audio and hose/beam work, existing combat
  adjustments, generic controller mapping and local player management, championship
  brackets/winner artwork, restart, FFA statistics and full online room/lobby flow.
- 1,553 game tests passed locally and in release-check CI (38192263515). Local
  release/desktop suite: 27 passed. Full lint, client/server types, web/desktop
  builds and CI container health passed. Minimal preparation fixes: document an
  intentional test loop, type a local diagnostic helper, and exclude two new
  sprite-generation notes from release output. No combat changes during deployment.
- Native Windows x64, Mac ARM64 and Mac x64 candidates passed workflow 38192261261.
  All metadata matched candidate compatibility; all three full public downloads
  matched SHA256. Both Mac DMGs passed integrity checks and contained expected
  metadata. The packaged ARM64 app launched and created/left a private live room.
- Owner explicitly approved publishing matching installers before the rollout.
  Downloads are under beta-0.1.4; previous versioned downloads remain untouched.
- Pages production: `52e662b7-a355-4a4e-ac2d-0bc917c27388`.
  Server image: `registry.fly.io/abroz-combat@sha256:abb6497c4eb3a0d64b9daf9b574c72b32c9a06c4d28987271b2f01cb8761b96c`.
  The guarded drain verified zero rooms/connections twice. Machine
  0807569c9039d8 and encrypted volume vol_vlym3gnldd2kgyd4 were preserved.
  No migration, new service, replica, or production secret change was needed.
- Rollback pair: Pages `22b5c081-e2fe-4f4d-8ddc-fd0d9cfff845`, 0.1.3 downloads,
  server image `registry.fly.io/abroz-combat@sha256:70f5fe652f84816208ac50c777e15fe3fc9bfe2b3be4e18de421b3500adfcc0c`.
  Six previous hashed browser chunks remain in the new output for loading tabs.
- Live browser pair: private create/join, fighter selection, ready/owner start,
  combat, 3:05 invasion with red timer, synchronized restart, result/menu exit
  passed without page errors. Live reconnect restored seat 1 at frame 122.
  Thirty page/critical asset requests passed. Final health: zero rooms/connections;
  Fly checks passing. Bounded new-release log review found no exceptions.
  Previous desktop compatibility is rejected with VERSION_MISMATCH by design.
- Browser/PWA users reload; desktop users must manually install 0.1.4 for online
  play. Unsigned beta status remains unchanged. Windows/Intel Mac installation
  and upgrades, physical controllers, multi-device audio and long-session QA
  remain manual. Existing >500 kB web bundle warning remains.
- Evidence: audits/evidence/2026-10-11-release-014.json. Detailed transfer logs,
  checksums, compatibility metadata and rollback config: deploy/local/release-014.

## Combat and online menu release verified — 2026-10-13

- Release 0.1.5; candidate c24cf71ab72d44396eec9cc4e204d304cfe0723e; browser
  publishing commit 7b78ea916b80b0d669da2597185dd966d3f6d7d2. Compatibility
  49-460a5a44, protocol 49. No migration or infrastructure changes.
- Includes completed Nikalz, Eide, Napa, Dodo, Jopa and invasion adjustments,
  one-time championship controller setup and cinematic online menu.
- 1,575 game tests, 27 release/desktop checks, types, lint, production builds
  and CI checks passed. Workflows: release 38429356344, native 38429351346.
  All three public installers matched SHA-256; both DMGs passed integrity and
  metadata checks. Packaged ARM64 app startup verified.
- Guarded empty-server rollout preserved machine 0807569c9039d8 and volume.
  Image: registry.fly.io/abroz-combat@sha256:a3e0a72f194a3e4c2c6b51d327442e9e8a688de487e85a22d3da61c3c4a37240.
  Pages: de114c3e-8586-4706-987c-fd687c9d0463. Downloads: beta-0.1.5.
  Thirteen old hashed chunks retained for existing tabs.
- Live private create/join/start/combat hashes/reconnect/cleanup passed. Old
  clients rejected with VERSION_MISMATCH. Final health/ready healthy, zero
  rooms/connections, provider checks passing, no recent exception/fatal entries.
  Live browser arena loading, movement, 45-damage hit, pause/menu and online
  screen passed without console errors. 27 page/assets and 6 audio checks passed.
- Rollback: Pages 52e662b7-a355-4a4e-ac2d-0bc917c27388, beta-0.1.4 downloads,
  registry.fly.io/abroz-combat@sha256:abb6497c4eb3a0d64b9daf9b574c72b32c9a06c4d28987271b2f01cb8761b96c.
- Browser/PWA players reload; desktop players install 0.1.5 for online play.
  Unsigned beta remains. Windows/Intel Mac installation, physical controllers
  and long-session visual/audio QA remain manual. Existing bundle warning remains.
- Evidence: audits/evidence/2026-10-13-release-015.json. Detailed logs and rollback
  config: ignored deploy/local/release-015. No gameplay changes during preparation.

## Energy indicator and local selection release verified — 2026-10-13

- Browser release 0.1.6, candidate b7da305bfe159724abbd1a8e035611d1053c886a.
  Includes the full-energy silhouette effect and simultaneous local multiplayer
  fighter/skin selection, readiness, team colors and original portrait roster.
- Compatibility remains 49-460a5a44 / protocol 49. No server source, gameplay,
  network, secrets, infrastructure or migration change. The existing Fly server
  was not restarted; installed 0.1.5 clients remain online-compatible.
- 1,583 game tests and 27 release/desktop checks passed, with types, lint, web
  and server compilation. CI release checks 38470552555 passed. Archived
  generated bundles were narrowly excluded from ESLint; no runtime fix needed.
- Windows x64 and macOS ARM64/x64 packaging passed workflow 38470548357.
  All three candidate metadata files match the commit, WSS endpoint and live
  compatibility. Installers remain in draft desktop-candidate-38470548357-1;
  public download links remain 0.1.5. Native installation/launch/upgrade and
  physical-controller QA remain manual; unsigned beta status is unchanged.
- Pages production 48ea933b-146b-4fee-b409-043e43218b6a serves verified 0.1.6
  metadata. Previous Pages de114c3e-8586-4706-987c-fd687c9d0463 is retained for
  browser-only rollback with the same server. Nineteen previous hashed assets
  remain available in the new output for existing tabs.
- Production-build browser smoke verified two keyboard players selecting and
  readying independently, fight start/pause/menu, and full-energy aura turning
  off independently after spending energy. Live browser selection and arena
  loading passed without console errors. Forty-two page/assets/audio requests
  passed. Private live combat hashes/damage and reconnect/seat restoration
  passed; final health/ready show zero rooms/connections. Recent server logs
  contained no exception/fatal entries. Existing bundle-size warning remains.
- Evidence: audits/evidence/2026-10-13-release-016.json; detailed logs and draft
  desktop metadata are in ignored deploy/local/release-016.

## Bozo artwork and combat fixes release — 2026-10-15

- Release 0.1.7, game candidate aba052a06419f724da075eac04703f2cde39cb87,
  web/download commit 2dbf3baaf75fe2e36f4ff73938714ca1ea56bc7f. Compatibility
  49-9fb11e6b, protocol 49. Includes Bozo model consistency, authored extended
  Body Hair artwork/double reach, 3-second Hair Grip, 3-second poison on every
  zombie attack, and Meteor Forehead hitting airborne opponents.
- 1,593 game tests and 25 desktop/deployment checks passed, plus types, lint,
  web/server builds and CI release checks 38771313096. Desktop workflow
  38771308744 passed all three targets. Public beta-0.1.7 installer bodies
  matched CI SHA-256; both DMGs passed integrity/architecture/metadata checks.
  Packaged Apple Silicon app launched and created/left a private live room.
- Existing approved unsigned-beta R2 publishing workflow used; earlier releases
  and the GitHub draft retained. Browser/PWA players reload; older desktop
  installations must be manually replaced with 0.1.7 for online play.
- Guarded drain verified no rooms/connections; original single machine
  0807569c9039d8 and volume preserved. No new services, migrations or secrets.
  Server: registry.fly.io/abroz-combat@sha256:2f66c34269704e3f0dab13cf554351d7c4e3acfd5d244a461dd548851796874e.
  Pages: 3a25ffd8-23dc-451a-bbd6-839afcea41b1. Previous hashed assets retained.
- Live private create/join/start/combat damage and 600 frames of state hashes
  passed; reconnect restored seat 1 at frame 122. Old clients rejected with
  VERSION_MISMATCH. 59 pages/assets/audio verified; new Bozo artwork and hashed
  bundles match local output. Live browser menu loads without captured game
  console warnings/errors. Health/ready and provider checks pass; final room
  and connection counts zero; no new-release fatal/exception log entries.
- Rollback pair: Pages 48ea933b-146b-4fee-b409-043e43218b6a, desktop beta-0.1.5,
  server registry.fly.io/abroz-combat@sha256:a3e0a72f194a3e4c2c6b51d327442e9e8a688de487e85a22d3da61c3c4a37240,
  content 49-460a5a44. Use the guarded empty-server procedure for rollback.
- Unsigned status remains. Windows/Intel Mac physical installation/upgrade,
  physical controllers, and extended multi-device gameplay/audio QA remain
  manual. Existing >500 kB bundle warning remains.
- Evidence: audits/evidence/2026-10-15-release-017.json. Transfer/checksum,
  maintenance and live verification logs: ignored deploy/local/release-017.


## Combat and online performance release verified — 2026-10-16

- Release 0.1.10, candidate 7bd75f23b2ad97e410c6adcca82e8590a4b5ba9d; browser/download commit b631641b1d929f7d97ac29e668fd412477cb5e60. Content 49-4b7364d2, protocol 49.
- Includes completed combat balance adjustments, persistent victory-page routing, batched rollback, 12-frame prediction tolerance, lighter HUD and per-player diagnostics. No database migration.
- 1,645 game tests and 21 desktop/deployment tests passed, plus lint/types, production builds and CI release checks 38956754663. Native workflow 38956751469 passed all three platforms. Full public installer checksums match; both DMGs validated; packaged ARM64 app startup verified.
- Pages f712f655-4033-4564-aefc-01ac6cbf6fc7; server registry.fly.io/abroz-combat@sha256:4d1a3544215d2b0694cec462535310adbabbed317c221f963c5903d397da7a29. Downloads beta-0.1.10.
- Explicit owner instruction authorized disconnecting everyone online. Verified no regular rooms or active persistent attempts, enabled drain, then deployed the reviewed image directly to disconnect the one idle connection. This was an authorized exception to the zero-connection guard. Same machine and volume preserved. Both championship records were verified unchanged; SQLite backup and integrity check passed.
- Live combat/hash agreement through 600 frames, reconnect, old-client rejection, 65 pages/assets/audio, browser menu and health checks passed. No new-release fatal/socket/simulation errors observed. An unrelated reconnect invalidated the first smoke test's global connection-count assumption; scoped cleanup and repeat passed.
- Rollback: Pages 2a184fa3-2dde-4d49-9af4-ea85c99301bb; beta-0.1.9 downloads; server registry.fly.io/abroz-combat@sha256:a9a150c46adfc4305dd1a10a7723f7ae7e01002630ba4de5b48f1ec8c5a3fc56, content 49-6a773085.
- Browser players reload; desktop players install 0.1.10. Unsigned status and existing bundle warning remain. Windows/Intel physical installation, controllers and extended multi-device gameplay remain manual.
- Evidence: audits/evidence/2026-10-16-release-0110.json; detailed logs in ignored deploy/local/release-0110.
