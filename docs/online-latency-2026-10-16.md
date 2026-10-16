# Online latency audit and incremental optimization — 2026-10-16

## Architecture and findings

- Browser and Electron clients use the same deterministic 60 Hz combat simulation. WebSocket/TCP carries small JSON input masks, not full state every frame. Room, championship and persistent-championship servers validate ordered inputs and independently simulate settled inputs with `VerifiedMatch`. Checksums are emitted every 60 simulation frames. Snapshots are for rollback and recovery, not routine state streaming.
- Rollback already exists: snapshots, deterministic restoration/replay, held-input prediction, deferred burst replay, confirmed damage audio, authoritative results and reconnection. Attacks, summons, transformations, traps and structures are part of the same snapshot. No replacement netcode is needed.
- Two fixed input-delay frames remain (33.3 ms). Local movement does not wait for server acknowledgment. Normal render interpolation added up to another frame of positional lag to the locally controlled online fighter.
- The prior 12-frame prediction bound (~200 ms) causes stalls when relay delivery exceeds it. WebSocket retransmission delays all following packets on a connection; temporary jitter can therefore appear as a missing-input stall even when both players are active.
- History cleanup scanned retained snapshots and every retained input map on every forward/replay step. With eight fighters there are 17 input maps, each containing roughly 180 entries. That work is avoidable.
- Inputs are already small and essential. Batching them across multiple ticks would add latency. Compression is not useful for these packets. No binary protocol or transport rewrite was justified by this audit.
- Deployment configuration uses one always-running performance CPU in São Paulo (`gru`). Geography/routing, device frame stalls and inactive browser tabs remain separate causes of delay. This audit did not read live private match logs or measure production CPU/network routes.

## Changes

1. Increase the bounded rollback prediction window from 12 to 16 frames (~267 ms), retaining two-frame local input delay and authoritative simulation. Larger gaps still stall safely. This trades occasional longer visual corrections for fewer freezes; it does not predict indefinitely.
2. Replace snapshot-history scanning with a frame-tagged ring retaining the same inclusive 180-frame boundary. Prune input maps only for newly expired frame numbers; replay no longer scans the whole retained history. Recovery resets the pruning boundary.
3. Render the locally controlled online fighter at its latest predicted position. Keep remote interpolation, animation timing, collision, attack timing and discrete hit/mode transitions unchanged. No extrapolated hits or extra damage confirmation are introduced.
4. Explicitly retain TCP no-delay and disabled WebSocket compression (these were already library defaults; no measured speedup is attributed to those settings).
5. Add opt-in development diagnostics at `/play?netdebug=1`, independent of combat debug/hitbox rendering. Show RTT, successive-RTT jitter, render FPS, observed simulation progress, configured response estimate, rollback count/depth, backlog, stalls, socket buffered bytes, and optional server step mean/max plus ping-handler time. Hidden by default and unavailable as an overlay in production builds. Server timing is requested only when enabled. Raw packet loss is unavailable from browser WebSocket/TCP and is explicitly labeled unavailable.
6. Repair the existing isolated capacity runner to include the current match ID on input messages. Without it the current server correctly ignores stale/unidentified inputs, so the runner would measure mostly idle connections.

Diagnostics limits: input response is an estimate (33–50 ms plus device/display, while unstalled), not a hardware measurement. Server step metrics are process-wide executed-step aggregates; ping-handler time excludes OS/event-loop queueing. Observed client tick rate includes countdown/hitstop/slow-motion/stalls. RTT variation cannot identify packet loss by itself.

## Reproducible measurements

Run `node --import tsx audits/online-latency-benchmark.ts`. Evidence is in `audits/evidence/2026-10-16-network-before.json` and `2026-10-16-network-after.json`.

The harness runs 600 combat frames on 2, 4, 6 and 8 clients at 30, 80, 150 and 240 ms synthetic full relay delivery delay, plus 150 ms with up to 40 ms deterministic jitter and a 100 ms retransmission delay every 97 input frames. Delivery remains ordered and reliable, modeling TCP head-of-line delay rather than silently dropping WebSocket messages. Fighters use movement, basic attacks, specials and ultimates. Health is raised in the harness to sustain combat. It is not a real Internet or GPU benchmark.

Every client matched an independently advanced authoritative simulation in all 20 scenarios, both before and after. Combat hashes match between before/after runs.

| Scenario | Previous stalled tick attempts (2 / 4 / 6 / 8 clients) | Updated |
| --- | --- | --- |
| 30, 80, 150 ms, stable | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| 240 ms, stable | 80 / 160 / 240 / 320 | 0 / 0 / 0 / 0 |
| 150 ms + jitter/retransmission | 33 / 87 / 137 / 192 | 0 / 0 / 0 / 0 |

These are aggregate stalled tick attempts across clients, not milliseconds or universal stall-rate guarantees. Server ping is unchanged. Local positional interpolation delay is reduced by 0–16.7 ms, established by deterministic render tests, not a camera-based input latency measurement.

Representative client simulation/replay p95 on this development Mac:

| Players / relay delay | Before | After |
| --- | --- | --- |
| 2 / 80 ms | 0.470 ms | 0.429 ms |
| 8 / 150 ms | 2.286 ms | 2.122 ms |
| 8 / 240 ms | 3.531 ms | 3.553 ms |
| 8 / jitter/retransmission | 3.285 ms | 3.315 ms |

CPU timings vary with JIT, garbage collection and host load; some scenarios are slower. No universal CPU/FPS improvement is claimed. The larger prediction window can require more replay work. The repeatable benefit is removal of observed stalls in these profiles, unchanged settled outcomes, and removal of local positional interpolation delay.

## Remaining limits and decisions

- Keep existing rollback. No major rewrite, gameplay rebalance, protocol replacement or fixed input-delay reduction was performed. Reducing input delay requires separate startup/recovery/bootstrap compatibility work and broader timing tests.
- Above the prediction window, especially sustained loss or slow/background devices, the match will still stall. Prediction cannot remove geographic RTT and may correct visible remote positions.
- Structured snapshot cloning and complex combat/rendering remain costs. GPU quality, animation and VFX were preserved. No production frame-rate claim is made without matched device/browser captures.
- WebRTC/unreliable input redundancy, adaptive prediction limits, render-correction smoothing and server worker isolation need a separate design and measured justification. Incorrect smoothing can hide hitbox disagreement; no such change was made.
- Additional regions could lower RTT for distant players but require matchmaking, routing and persistent-state coordination, plus hosting costs. No infrastructure, capacity, region, database or hosting-price changes were made.
- Changes are local and require a matching browser/server/desktop release; the generated simulation revision prevents incompatible peers from silently mixing. This task does not deploy them.

## Validation

- Full TypeScript test suite: 1,654 passed; new opt-in diagnostics test: 1 passed. Coverage includes room flows, team/FFA/competition modes, persistent tournaments, recovery, deterministic replay, late input, authoritative verification and real sockets with browser/desktop origins.
- Desktop configuration/runtime tests: 17 passed.
- Type checking, changed-file lint, diff whitespace check and production browser build passed. The build retains its existing large-chunk warning.
- Isolated two-player server run: eight seconds including countdown and live combat, 457 executed steps, final aggregate step mean 0.167 ms and maximum 4.097 ms. Post-countdown samples used approximately 2.3–5.7% of one core. Short development-machine sample with other host work; not a production capacity guarantee or a matched before/after CPU comparison. All test sockets and the owned child server were cleaned up. Raw data: `audits/evidence/2026-10-16-network-server.jsonl`.
- No live production matches were disturbed. Browser/Electron share the tested simulation/network/render code; signed native installers and real multi-device Internet gameplay were not rebuilt or manually qualified in this task.
