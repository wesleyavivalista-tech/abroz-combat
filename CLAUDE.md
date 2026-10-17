# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository. Read it with [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The "Historical project notes" section of README.md is outdated (npm commands, VECTOR/BRUT, old protocol numbers); trust this file, CONTRIBUTING.md and docs/ARCHITECTURE.md instead.

Abroz Combat is a 2.5D fighting game for browser and desktop (Electron) with deterministic rollback multiplayer. This is the private collaboration repository, initialized from released version 0.1.9. Merging here does not deploy anything; production lives elsewhere.

## Before anything else: the knowledge graph (mandatory)

This repository ships a graphify knowledge graph in `graphify-out/` (3k+ nodes covering `packages/`, `apps/`, `tests/`, `scripts/` and the engineering docs). Querying it costs a few hundred tokens; exploring the raw tree costs tens of thousands. Every session, human or Claude, must use it:

1. **First command of every session**: `pnpm graphify:setup`. It installs the `graphify` CLI if missing, installs the git hooks (post-commit / post-checkout) and confirms `graphify-out/graph.json` exists. The Claude Code `SessionStart` hook in `.claude/settings.json` runs it automatically; if it reports that graphify could not be installed, stop and fix that before touching code.
2. **Orient with the graph before reading files**: `graphify query "<question>" --budget 2000`, `graphify explain "<Symbol>"`, `graphify path "<A>" "<B>"`. Read raw source only to modify or debug specific lines the graph pointed you to. Include this rule in every subagent prompt that explores code.
3. **Keep it current**: after changing code run `pnpm graphify:update` (AST only, free). The `Stop` hook does this in the background after each Claude turn and the post-commit hook after each commit. Commit the resulting `graphify-out/` changes together with your code so the next person pulls an up-to-date graph. Docs changes need `/graphify --update` in Claude Code (semantic extraction).
4. `graphify-out/` is tracked on purpose. Never add it to `.gitignore`; only `.graphify_python`, `.graphify_root`, the AST cache and local backups are ignored.

## Setup and commands

- Node.js 22.13+ (Node 24 recommended; the persistent championship needs built-in SQLite) and **exactly pnpm 12.10.1**. Always install with `pnpm install --frozen-lockfile`; do not change the lockfile unless a dependency change is the goal.
- Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell). Vite reads `.env`; the server does **not** — export server variables (`ALLOWED_ORIGINS`, `ABROZ_CHAMPIONSHIP_PATH`, …) in the shell.

| Task | Command |
|---|---|
| Client + server | `pnpm dev`, then open http://localhost:5173/play (server on :8080) |
| Client / server only | `pnpm dev:client` / `pnpm dev:server` |
| Desktop | `pnpm desktop:install-runtime` once, then `pnpm dev:desktop` |
| Typecheck + lint + all TS tests | `pnpm check` |
| Desktop / deployment checks | `pnpm test:desktop`, `pnpm test:deployment` |
| Browser end-to-end (real client + relay) | `pnpm test:e2e` (starts the dev servers itself) |
| Everything above | `pnpm test:all` |
| Coverage report for packages/ and apps/ | `pnpm test:coverage` |
| Production build (web + server) | `pnpm build` |
| One TS test file | `pnpm exec tsx --test --import ./tests/setup/english-locale.mjs tests/<name>.test.ts` |
| One .mjs test file | `node --test tests/<name>.test.mjs` |
| One E2E spec | `pnpm exec playwright test tests/e2e/<name>.spec.ts` |

Test layout: `tests/*.test.ts` are unit and integration tests on `node:test` (simulation, rollback, server, UI markup, real WebSocket servers); `tests/*.test.mjs` cover desktop and deployment scripts; `tests/e2e/*.spec.ts` are Playwright flows that drive the real browser client (`playwright.config.ts`). `tests/setup/english-locale.mjs` is preloaded by `pnpm test` so UI assertions see English regardless of the machine's language; tests that cover pt-BR call `setLocale('pt-BR')` explicitly. A few server tests need POSIX signals and skip themselves on Windows; CI runs them on Linux.

Before declaring a change done: run the relevant single tests while iterating, then `pnpm check`. Also run `pnpm build` for client/server/build-config changes, `pnpm test:desktop` for `apps/desktop` or `scripts/desktop*` changes, and `pnpm test:e2e` for menu, match-flow or lobby changes. CI (`.github/workflows/release-checks.yml`) runs all of these on every PR, plus a Docker build, a health check and the browser suite on Linux Chromium.

New gameplay or network code needs tests in the same PR. Broad safety nets already exist and must stay green: `tests/roster-determinism.test.ts` (every fighter × arena × skin hashes identically and survives snapshot restore), `tests/architecture-*.test.ts` (dependency boundaries) and the behavior baselines.

## Layout and dependency boundaries

- `packages/game-core/` — deterministic simulation. `characters/<id>/` (immutable fighter data and optional deterministic hooks), `simulation/` (60 Hz tick, states, abilities, match/tournament logic), `combat/` (collision, hit/block, `DamageSystem`), `stages/`, `types.ts`.
- `packages/networking/` — input history, snapshots, prediction, rollback. Offline and online run the same simulation.
- `packages/shared/` — wire protocol, content version, recovery format.
- `apps/client/` — Three.js rendering, UI, audio, input/gamepads, i18n, assets in `public/`.
- `apps/server/` — WebSocket relay: rooms, admission, reconnect, persistent championships.
- `apps/desktop/` — Electron shell (origin `abroz://game`).

Hard rules (several are enforced by `tests/architecture-*.test.ts`):

1. `game-core/simulation` and `game-core/combat` must not import `three`, browser/DOM APIs or `apps/client`, and must not call `Math.random`, `Date.now` or `performance.now`.
2. Shared systems never branch on a fighter's ID or name (`characterId === '...'`, `characters.roms`, …). Express behavior as typed capabilities on `CharacterDefinition` in `types.ts`, validated in `validateCharacter` (`characters/registry.ts`). Only the registry, character packages and client presentation adapters may name specific fighters.
3. `game-core` never imports client or server code. The client only reads simulation state; animation callbacks and visual frames never cause damage or make gameplay decisions.
4. The server validates and relays; it is not authoritative over inputs. Persistent championship results are the exception: they come from the server-side simulation, never from a client-reported winner.

Code style: ESM TypeScript, relative imports end in `.js` (e.g. `'../types.js'`), `import type` for type-only imports, no `any` (lint error), unused parameters prefixed with `_`. Match the style of the file you edit; don't reformat untouched code.

## Determinism and rollback (non-negotiable)

- Fixed 60 Hz tick with integer positions and velocities; durations and deadlines are counted in simulation frames, never wall-clock time. Units: 100 per metre, positive Y is up.
- Every piece of state that affects future frames must live in the snapshot, be initialized and cleaned up (`LifeSystem`, `GameSimulation.resetPositions`), and survive restore/replay. Never keep gameplay state in closures, event listeners or module-level variables.
- `GameSimulation.events` and `gameplayEvents` are presentation/diagnostic streams only. They are not part of snapshots and must never drive gameplay.
- Preserve the tick order documented in docs/ARCHITECTURE.md. Do not change combat timing, frame data, cancel rules or network contracts unless that is the explicit goal of the task.
- New gameplay state needs tests for snapshot/restore, rollback with delayed input, mirrored facing, teams (no friendly fire), respawn/death cleanup and multi-player matches.

## Compatibility and versioning

- `packages/shared/simulationRevision.ts` is generated by `scripts/simulation-revision.mjs`, which runs automatically before dev, build and check. Never edit it by hand, and commit the regenerated file together with the simulation change that produced it.
- Bump `PROTOCOL_VERSION` in `packages/shared/protocol.ts` for engine behavior, hook code or wire/snapshot format changes. Gameplay data changes alter the content fingerprint automatically.
- Any change in `game-core`, `networking`, `protocol.ts` or `recovery.ts` makes this build incompatible with live clients (`VERSION_MISMATCH`). That is expected, but state it in the PR description.
- `tests/fixtures/behavior-baseline.json` and `tests/fixtures/movement-facing-baseline.json` record approved gameplay. Never regenerate them to make a failing test pass. Update them only for an intentional, reviewed balance change, and call it out explicitly.

## Adding content

**Fighter** (full guide: [docs/CREATING_CHARACTERS.md](docs/CREATING_CHARACTERS.md))
1. Create `packages/game-core/characters/<id>/character.ts` using `move()` from `characters/common.ts`. It needs a 3-move chain, heavy, kick, crouch and air attacks, two specials, two distinct supers, stats and skins. Register it in `characters/registry.ts`; registration validation must pass.
2. Reuse existing mechanics (returning projectiles, periodic melee, beams, armor, weapon modes, statuses). Only add a new reusable mechanic when none fits: typed config in `types.ts`, validation in `validateCharacter`, a module that reads definitions and snapshot state, `applyDamage` for health changes, debug geometry, and tests that use a second arbitrary fighter ID to prove reuse.
3. Put client presentation in `apps/client/src/characters/<id>/presentation.ts` (see the Roms package), registered with `registerFighterVisual` / `registerFighterPresentation`, and art in `apps/client/public/art/<id>/`. Validate atlases with `AnimationContract` and cover every action (idle, walk, dash, jump, crouch, guard, hit, knockdown, every attack, victory, modes) for both facings and all skins.
4. Add names and guide text to both locales and add tests.

**Stage**: add a `StageDefinition` to `packages/game-core/stages/registry.ts` (the server validates against this registry), plus the renderer and selection UI. Test floor, corners, platforms, max jump height and camera framing. [docs/CREATING_STAGES.md](docs/CREATING_STAGES.md) has the details but is partly historical.

## Client and UI

- Every user-facing string goes in both `apps/client/src/i18n/en.ts` and `pt-BR.ts` with identical keys and `{placeholder}` names (enforced by `tests/localization.test.ts`). Fighter guides live in `guides-en.ts` / `guides-pt-BR.ts`.
- Escape any dynamic text inserted into markup (`escapeText` in `i18n/index.ts`, `escapeMarkup`).
- Menus must work with keyboard and controller only (`input/MenuNavigation.ts`). Online menus are driven by controller 1.
- Keep existing `localStorage` keys (e.g. `afterglow-controls`) so saved settings survive upgrades.
- Asset URLs are root-relative (`/art/...`, `/audio/...`). Authoring files (prompts, generation notes, `art/reviews/`) are stripped from builds by `apps/client/release-assets.ts`; follow its naming rules so they never ship.
- Do not regenerate or replace approved artwork unless the task asks for it.

## Repository hygiene and safety

- Work on a `feature/<description>` branch from an up-to-date `main` and open a PR to `main`. Don't commit directly to `main`. Gameplay and network changes need review from another collaborator.
- The repository is already ~1.5 GB. Don't commit temporary screenshots, review captures, exports or duplicate art.
- Never commit `.env`, `deploy/local/`, tokens, server credentials or database backups. Review `git diff --cached` before committing.
- Do not deploy or publish. Never run the `publish-web` / `desktop-candidates` workflows, `pnpm release:web`, `pnpm release:configure`, `wrangler`, `flyctl`, `scripts/deploy-server-safe.mjs` or `scripts/upload-desktop-candidate.mjs`, and never touch CI secrets, unless the owner explicitly asks. Production runs on a single Fly.io machine whose room state lives in the process; it must never be scaled out. See `deploy/OPERATIONS.txt` and `deploy/RECOVERY.md`.

## Reference docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — boundaries, reusable mechanics, tick order, rollback rules
- [docs/CREATING_CHARACTERS.md](docs/CREATING_CHARACTERS.md), [docs/CREATING_STAGES.md](docs/CREATING_STAGES.md)
- [docs/ELIMINATION.md](docs/ELIMINATION.md), [docs/ZOMBIE_INVASION.md](docs/ZOMBIE_INVASION.md) — game modes
- Per-fighter notes: `docs/<FIGHTER>.md`, `docs/characters/`
- [docs/RELEASE_CHECKLIST.txt](docs/RELEASE_CHECKLIST.txt) — release constraints (context only)
- `audits/` — past audits and release evidence

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
