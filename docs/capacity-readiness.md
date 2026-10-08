# Capacity readiness safeguards

Connection limits remain unchanged. A failed browser handshake makes one bounded HTTP request to `/connection-status`. Known capacity/rate/maintenance messages are shown through existing localization. Unknown/unavailable responses retain the original connection error. Successful connections incur no extra request. A pre-open rejection no longer opens the active-match disconnect overlay over its actionable error.

`/healthz` and `/readyz` report aggregate waiting rooms, active rooms, active matches, retained result rooms, connections and configured capacity. A championship room can contain several matches; authoritative completion determines result classification. No invite codes, addresses, or player identities are exposed.

Production `server-health` logs additionally report simulation step count, mean and maximum milliseconds per step, and current total/max socket-buffer bytes. Timing totals reset each 60-second reporting window. The mean includes executed steps only (not time waiting for player input); socket queues are instantaneous samples, not peaks. These metrics do not estimate RTT, total CPU per match, or safe player capacity by themselves.

## Isolated load runner

Run with the repository's Node runtime:

```
node --import tsx scripts/capacity-staging.ts
node --import tsx scripts/capacity-staging.ts --execute --quick
node --import tsx scripts/capacity-staging.ts --execute
```

Default is a dry-run plan. Execution starts and owns a new local child server on an ephemeral port; it accepts no URLs or remote targets. Unknown arguments fail before creating a server. Detailed test metrics require NODE_ENV=test, ABROZ_CAPACITY_TEST=1 and no Fly app name, and are absent in production. Runner checks the child PID before sending gameplay commands. It does not provision cloud resources or alter production configuration.

The full ramp is 2, 8, 16, 25, 32, 48, 64 connections, with one minute per level. Matches are pairs to exercise many simulations; the odd participant is an idle connection. Inputs run near 60 Hz with basic attacks. Stop conditions: one-core CPU above 85%, event-loop p95 above 100 ms, RSS above 1536 MiB, socket/server errors, or failed cleanup. SIGINT/SIGTERM stop input and close the owned server. CPU measures the server child, not the load generator. Startup/JIT and local-machine contention can trigger thresholds. Review raw output before interpreting capacity.

This is an initial harness, not full production qualification: extend hold times and add eight-player rooms, more complex abilities and a two-hour soak in a separately approved, isolated environment. Existing 64-socket integration coverage verifies settled hashes for eight eight-player rooms. No remote load or production capacity test is authorized by running this script.

## Validation in this change

Local two-player quick run completed with cleanup; approximately 3.6–4.2% of one core and 82–93 MiB RSS in this short sample. These are development-machine measurements, not Fly capacity guarantees. Existing 64-socket/eight-room integration passed with identical combat hashes and complete room/connection cleanup. No production load test was run.


## Security follow-up (2026-10-08)

Roomless connections now expire after two minutes (checked on the existing 30-second heartbeat). Expired waiting rooms close their sockets. Lobby create/join commands have a separate token budget: burst 10 per socket replenished at 20/minute; burst 128 per address replenished at 120/minute, shared across reconnects. These limits leave gameplay message/input rates unchanged and allow the existing 64-client local integration scenario. The generous shared-address burst accommodates simultaneous joins.

Ordinary-match results retention additionally requires the authoritative simulation to be in its result phase. Client completion claims alone no longer bypass inactivity processing.

Browser and desktop CSP permit HTTPS status checks only on the configured relay origin, alongside WSS. Browser HSTS starts with max-age=86400, without includeSubDomains or preload.

All three published beta-b495bf3 installers were downloaded and matched their published SHA256 checksums. The verified Windows installer's embedded payload matched the previously scanned archive; the application code/configuration/text assets in both verified Mac installers were also scanned. No credential-pattern matches were found. This is scoped pattern scanning, not a proof that every possible secret is absent. Apple Silicon is ad-hoc signed, not Developer ID signed; published releases remain unsigned betas. Publisher signing/notarization is blocked on the user's Apple Developer and Windows signing setup. No installer was replaced during this change.
