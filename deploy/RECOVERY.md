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
