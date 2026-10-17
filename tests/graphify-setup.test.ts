import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const script = path.resolve('scripts/graphify-setup.mjs');
const win = process.platform === 'win32';

/**
 * Runs the setup script in a scratch directory whose PATH holds only a fake graphify CLI, so no
 * real installer (uv, pipx, pip) or git hook is ever reachable. The fake fails the subcommands in `fail`.
 */
function setup(args: string[], {fail = [] as string[], cli = true, graph = true} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'graphify-setup-'));
  try {
    const bin = path.join(root, 'bin');
    mkdirSync(bin);
    if (cli) {
      writeFileSync(path.join(bin, 'graphify.cjs'), `const cmd=process.argv[2];
if(cmd==='--version'){console.log('graphify 0.9.80');process.exit(0);}
if(process.env.FAKE_GRAPHIFY_FAIL.split(',').includes(cmd)){console.error(cmd+' exploded');process.exit(3);}`);
      if (win) writeFileSync(path.join(bin, 'graphify.cmd'), `@"${process.execPath}" "%~dp0graphify.cjs" %*\r\n`);
      else {
        writeFileSync(path.join(bin, 'graphify'), `#!/bin/sh\nexec "${process.execPath}" "\${0%/*}/graphify.cjs" "$@"\n`);
        chmodSync(path.join(bin, 'graphify'), 0o755);
      }
    }
    if (graph) {
      mkdirSync(path.join(root, 'graphify-out'));
      writeFileSync(path.join(root, 'graphify-out', 'graph.json'), '{}');
    }
    // A fresh environment: no CI flag (the script exits early under CI) and nothing else on PATH.
    const env: NodeJS.ProcessEnv = {PATH: bin, FAKE_GRAPHIFY_FAIL: fail.join(',')};
    if (win) Object.assign(env, {SystemRoot: process.env.SystemRoot, ComSpec: process.env.ComSpec, PATHEXT: '.COM;.EXE;.BAT;.CMD'});
    const result = spawnSync(process.execPath, [script, ...args], {cwd: root, env, encoding: 'utf8'});
    return {status: result.status, output: `${result.stdout}${result.stderr}`};
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
}

test('a healthy setup installs the hooks, updates the graph and reports ready', () => {
  const {status, output} = setup(['--strict', '--update']);
  assert.equal(status, 0, output);
  assert.match(output, /ready: graphify installed, git hooks installed/);
  assert.doesNotMatch(output, /ERROR|warning/);
});

test('--strict fails when the git hooks or the graph update fail, and never claims ready', () => {
  for (const fail of [['hook'], ['update'], ['hook', 'update']]) {
    const {status, output} = setup(['--strict', '--update'], {fail});
    assert.equal(status, 1, `${fail}: ${output}`);
    assert.doesNotMatch(output, /ready:/);
    if (fail.includes('hook')) assert.match(output, /ERROR: git hook install failed: hook exploded/);
    if (fail.includes('update')) assert.match(output, /ERROR: graph update failed: update exploded/);
  }
});

test('--strict fails when graph.json is missing', () => {
  const {status, output} = setup(['--strict'], {graph: false});
  assert.equal(status, 1, output);
  assert.match(output, /graph\.json missing/);
});

test('without --strict (Claude Code hooks) failures are reported but never block the session', () => {
  const {status, output} = setup(['--update'], {fail: ['hook', 'update']});
  assert.equal(status, 0, output);
  assert.match(output, /setup is incomplete/);
  assert.doesNotMatch(output, /ready:/);
});

test('--strict fails when graphify is missing and no installer is available', () => {
  const {status, output} = setup(['--strict'], {cli: false});
  assert.equal(status, 1, output);
  assert.match(output, /COULD NOT INSTALL graphify/);
  assert.match(output, /graphifyy==\d+\.\d+\.\d+/);
});
