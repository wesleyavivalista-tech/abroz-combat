#!/usr/bin/env node
// Ensures the graphify knowledge-graph tooling is ready on this machine and keeps
// graphify-out/ current. Wired into: `pnpm install` (postinstall), the Claude Code
// hooks in .claude/settings.json, and `pnpm graphify:setup`.
//
//   node scripts/graphify-setup.mjs                 install graphify if missing, install git hooks
//   node scripts/graphify-setup.mjs --update        same, then `graphify update .` (AST only, no tokens)
//   node scripts/graphify-setup.mjs --guard <kind>  stdin/stdout pass-through to `graphify hook-guard <kind>`
//   node scripts/graphify-setup.mjs --from-install  postinstall mode: silent outside an interactive shell
//   node scripts/graphify-setup.mjs --strict        exit 1 when graphify cannot be installed, or the
//                                                   git hooks or the graph update fail
//
// Installs the pinned GRAPHIFY_VERSION; bump it deliberately after checking the new release.
// Never fails CI or Docker builds: it exits 0 immediately when CI is set.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const GRAPHIFY_VERSION = '0.9.80';
const PACKAGE = `graphifyy==${GRAPHIFY_VERSION}`;

const args = new Set(process.argv.slice(2));
const win = process.platform === 'win32';
const guardIndex = process.argv.indexOf('--guard');
const guardKind = guardIndex >= 0 ? process.argv[guardIndex + 1] : null;

if (process.env.CI || process.env.GITHUB_ACTIONS) process.exit(0);
if (args.has('--from-install') && !process.stdout.isTTY) process.exit(0);

function run(cmd, cmdArgs, options = {}) {
  // Windows needs a shell to resolve .exe/.cmd launchers; the command is passed as one
  // constant string (never user input) so nothing is interpolated.
  if (win) return spawnSync([cmd, ...cmdArgs].join(' '), { encoding: 'utf8', shell: true, ...options });
  return spawnSync(cmd, cmdArgs, { encoding: 'utf8', ...options });
}
function available(cmd) {
  const result = run(cmd, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
  return result.status === 0;
}

// --guard: forward the Claude Code hook payload to graphify, but never break tool calls
// on a machine where graphify is not installed yet.
if (guardKind) {
  if (!available('graphify')) process.exit(0);
  let input = '';
  try { input = readFileSync(0, 'utf8'); } catch { input = ''; }
  const result = run('graphify', ['hook-guard', guardKind], { input, stdio: ['pipe', 'pipe', 'ignore'] });
  if (result.stdout) process.stdout.write(result.stdout);
  process.exit(result.status === 2 ? 2 : 0);
}

const log = (line) => process.stdout.write(`[graphify-setup] ${line}\n`);

let ready = available('graphify');
if (!ready) {
  log(`graphify not found on this machine; installing ${PACKAGE} (one time, ~1 min)...`);
  const attempts = [
    ['uv', ['tool', 'install', PACKAGE]],
    ['pipx', ['install', PACKAGE]],
    ['python', ['-m', 'pip', 'install', '--user', PACKAGE]],
    ['python3', ['-m', 'pip', 'install', '--user', PACKAGE]],
    ['pip', ['install', '--user', PACKAGE]],
  ];
  for (const [cmd, cmdArgs] of attempts) {
    if (!available(cmd)) continue;
    const result = run(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status === 0 && available('graphify')) { ready = true; break; }
  }
}

if (!ready) {
  log('COULD NOT INSTALL graphify. The knowledge graph in graphify-out/ saves most of the tokens');
  log('Claude spends exploring this codebase; sessions without it fall back to reading raw files.');
  log(`Install Python 3.10+ and run one of:  uv tool install ${PACKAGE}  |  pip install ${PACKAGE}`);
  log('then run:  pnpm graphify:setup');
  process.exit(args.has('--strict') ? 1 : 0);
}

const installed = (run('graphify', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] }).stdout || '').trim();
if (!installed.includes(GRAPHIFY_VERSION)) {
  log(`warning: found "${installed}", this repository pins graphifyy ${GRAPHIFY_VERSION}.`);
}

const failures = [];
const lastLine = (result) => (result.stderr || result.stdout || result.error?.message || '').trim().split('\n').pop();

// Git hooks live in .git/ and never come with the clone: post-commit rebuilds the AST
// graph in the background, post-checkout keeps it aligned with the branch.
const hooks = run('graphify', ['hook', 'install'], { stdio: ['ignore', 'pipe', 'pipe'] });
if (hooks.status !== 0) failures.push(`git hook install failed: ${lastLine(hooks)}`);

if (!existsSync('graphify-out/graph.json')) {
  failures.push('graphify-out/graph.json missing. Run /graphify in Claude Code to build the full graph.');
} else if (args.has('--update')) {
  const update = run('graphify', ['update', '.'], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (update.status !== 0) failures.push(`graph update failed: ${lastLine(update)}`);
}

if (failures.length) {
  for (const failure of failures) log(`ERROR: ${failure}`);
  log('graphify is installed but the setup is incomplete; fix the errors above, then run:  pnpm graphify:setup');
  process.exit(args.has('--strict') ? 1 : 0);
}

log('ready: graphify installed, git hooks installed, graph.json present.');
log('Query it before reading source: graphify query "<question>" --budget 2000');
