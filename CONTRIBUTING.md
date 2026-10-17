# Contributing to Abroz Combat

## Run locally

Install Git, Node.js 22.13 or newer (including npm), and pnpm 12.10.1. Accept your GitHub repository invitation, clone the private repository using its Code button, and open its directory.

```sh
pnpm install --frozen-lockfile
pnpm graphify:setup
cp .env.example .env
pnpm dev
```

Open http://localhost:5173/play. The local multiplayer server uses port 8080. Local development does not require production credentials.

## Knowledge graph (required before working with Claude Code)

The repository tracks a graphify knowledge graph in `graphify-out/`. Claude Code sessions query it instead of reading the whole tree, which cuts token usage by an order of magnitude. `pnpm graphify:setup` (also run by `pnpm install` in interactive shells and by the Claude Code `SessionStart` hook) installs the `graphify` CLI with `uv`/`pipx`/`pip`, installs the git post-commit and post-checkout hooks, and verifies the graph is present. It needs Python 3.10+. The CLI version is pinned (`GRAPHIFY_VERSION` in `scripts/graphify-setup.mjs`, currently `graphifyy==0.9.80`); bump it deliberately. `pnpm graphify:setup` exits with an error when the CLI cannot be installed, the git hooks fail to install or `graphify-out/graph.json` is missing; the Claude Code hooks report the same problems without blocking the session.

- Explore: `graphify query "<question>" --budget 2000`, `graphify explain "<Symbol>"`, `graphify path "<A>" "<B>"`. Open `graphify-out/graph.html` in a browser for the interactive map.
- Update after code changes: `pnpm graphify:update` (AST only, no API cost). The post-commit hook and the Claude Code `Stop` hook do this automatically. Commit the resulting `graphify-out/` changes with your code.
- Docs changes: run `/graphify --update` inside Claude Code (semantic extraction).
- Do not add `graphify-out/` to `.gitignore`.

## Make a change

```sh
git switch main
git pull --ff-only
git switch -c feature/describe-your-change
```

Keep each branch focused. Commit your changes, push the branch, and open a pull request targeting main. Have another collaborator review gameplay and network changes before merging. Resolve conflicts on your feature branch and rerun relevant checks.

```sh
pnpm check
pnpm test:desktop
pnpm test:deployment
pnpm test:e2e
pnpm build
```

`pnpm test:all` runs the first four together. `pnpm check` covers the unit and integration suite (`tests/*.test.ts`), including real local WebSocket servers. `pnpm test:e2e` drives the real browser client with Playwright (`tests/e2e/`): it starts the development servers itself and uses your installed Chrome locally (CI installs Chromium). It starts dedicated servers on ports 15173 and 18080, forces the local WebSocket endpoint, and refuses to reuse existing servers. `pnpm test:coverage` prints a coverage report for `packages/` and `apps/`. Add tests with every gameplay, network or menu change; the broad regression nets in `tests/roster-determinism.test.ts` and `tests/architecture-*.test.ts` must stay green.

Test affected local and online modes. For desktop development, run `pnpm desktop:install-runtime` and `pnpm dev:desktop`. Do not change combat timing, frame mappings, or network contracts accidentally. Keep generated simulation revision changes produced by the existing scripts with related simulation changes.

## Project layout

- `apps/client`: browser client, interface, rendering, and public assets.
- `apps/server`: multiplayer server.
- `packages/game-core`: shared combat simulation.
- `packages/shared` and `packages/networking`: shared contracts and network support.
- `tests`: regression checks.
- `docs`: architecture and feature documentation.

## Credentials and releases

Never commit `.env`, API tokens, server credentials, database backups, or files from `deploy/local`. Use `.env.example` for documented placeholders. Review `git diff --cached` before committing.

This collaboration repository starts from stable version 0.1.9. Production hosting and its existing repository remain in place. Merging here does not deploy the game. Coordinate an explicit release with the owner using the existing deployment procedure. CI workflow files are included, but production secrets are not copied. Do not configure deployment credentials or publish installers as part of routine development.
