import {test} from 'node:test';
import assert from 'node:assert/strict';
import {characters} from '../packages/game-core/characters/registry.js';
import {fighterSkins} from '../packages/game-core/characters/skins.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {GameSimulation, hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../packages/game-core/types.js';

// Broad regression net: every shipped fighter, on every arena, with every skin,
// must simulate identically run after run and across snapshot restore. This
// catches wall-clock, random or hidden-closure state entering any character
// system without asserting specific balance numbers.
const roster = Object.keys(characters).sort();
const arenas = Object.values(stages);
const FRAMES = 600;

/**
 * Scripted inputs exercise movement, jumps, crouching, blocking and every attack button, and press
 * both super buttons. Whether a press starts a super depends on the fighter's state at that frame,
 * so the dedicated super test below is what guarantees every super really runs.
 * Seat 1 receives seat 0's inputs with left and right swapped: a mirror image.
 */
function script(seat: number, frame: number): number {
  const toward = seat === 0 ? Button.Right : Button.Left;
  const away = seat === 0 ? Button.Left : Button.Right;
  if (frame < 60) return toward;
  if (frame % 97 === 0) return Button.Super1;
  if (frame % 89 === 0) return Button.Super2;
  if (frame % 53 === 0) return Button.Special;
  if (frame % 47 === 0) return Button.Special2;
  if (frame % 31 === 0) return Button.Heavy;
  if (frame % 23 === 0) return Button.Medium;
  if (frame % 17 === 0) return Button.Light;
  if (frame % 13 === 0) return Button.Up;
  if (frame % 11 === 0) return Button.Down | Button.Light;
  if (frame % 7 === 0) return away;
  if (frame % 5 === 0) return toward;
  return 0;
}

function play(ids: string[], stage: (typeof arenas)[number], skins: string[], frames = FRAMES, seed = 7): GameSimulation {
  const game = new GameSimulation(ids, false, stage, undefined, skins, false, seed);
  for (let frame = 0; frame < frames; frame++) {
    // Guarantee both supers become affordable mid-match in a deterministic way.
    if (frame === 150) game.state.fighters.forEach(f => { f.meter = 100; });
    game.step(ids.map((_, seat) => script(seat, frame)));
  }
  return game;
}

for (const stage of arenas) {
  test(`every fighter with every skin is deterministic on ${stage.id} and survives snapshot restore`, () => {
    for (const [index, id] of roster.entries()) for (const skin of fighterSkins(characters[id])) {
      const opponent = roster[(index + 1) % roster.length];
      const skins = [skin.id, fighterSkins(characters[opponent])[0].id];
      const label = `${id} (${skin.id}) vs ${opponent} on ${stage.id}`;
      const first = play([id, opponent], stage, skins);
      const second = play([id, opponent], stage, skins);
      assert.equal(first.state.skins[0], skin.id, label);
      assert.equal(hashState(second.state), hashState(first.state), label);
      assert.ok(first.state.frame === FRAMES && first.state.fighters.every(f => Number.isFinite(f.x) && Number.isFinite(f.y)), `${label} produced non-finite state`);

      // Restore from the midpoint and replay: identical to the uninterrupted run.
      const branch = play([id, opponent], stage, skins, FRAMES / 2);
      const midpoint = branch.snapshot();
      for (let frame = FRAMES / 2; frame < FRAMES; frame++) branch.step([script(0, frame), script(1, frame)]);
      const uninterrupted = hashState(branch.state);
      branch.restore(midpoint);
      for (let frame = FRAMES / 2; frame < FRAMES; frame++) branch.step([script(0, frame), script(1, frame)]);
      assert.equal(hashState(branch.state), uninterrupted, `${label} replay after restore`);
    }
  });
}

/** Starts a fresh duel and returns it at the first frame of the fight, past the intro. */
function fightStarted(ids: string[], stage: (typeof arenas)[number]): GameSimulation {
  const game = new GameSimulation(ids, false, stage, undefined, undefined, false, 7);
  for (let frame = 0; game.state.phase !== 'fight'; frame++) {
    assert.ok(frame < 600, 'the intro ends');
    game.step(ids.map(() => 0));
  }
  return game;
}

test('every fighter executes both supers deterministically and replays them after restore', () => {
  for (const [index, id] of roster.entries()) {
    const opponent = roster[(index + 1) % roster.length];
    for (const [slot, button] of [Button.Super1, Button.Super2].entries()) {
      const move = characters[id].superButtons[slot];
      const run = () => {
        const game = fightStarted([id, opponent], arenas[0]);
        game.state.fighters[0].meter = 100;
        game.step([button, 0]);
        return game;
      };
      const game = run();
      assert.equal(game.state.fighters[0].move, move, `${id} starts ${move}`);
      assert.deepEqual(game.state.fighters[0].usedSupers, [move], `${id} spends ${move}`);

      // Let the super play out (summons, beams, modes) with a restore in the middle of it.
      const midpoint = (() => { for (let frame = 0; frame < 60; frame++) game.step([0, 0]); return game.snapshot(); })();
      for (let frame = 0; frame < 240; frame++) game.step([0, 0]);
      const finished = hashState(game.state);
      game.restore(midpoint);
      for (let frame = 0; frame < 240; frame++) game.step([0, 0]);
      assert.equal(hashState(game.state), finished, `${id} ${move} replays identically after restore`);
      const again = run();
      for (let frame = 0; frame < 300; frame++) again.step([0, 0]);
      assert.equal(hashState(again.state), finished, `${id} ${move} is deterministic`);
    }
  }
});

/** A layout is mirror-symmetric when every static platform has a twin reflected about the centre. */
function mirrorSymmetric(stage: (typeof arenas)[number]): boolean {
  const platforms = stage.platforms ?? [];
  return platforms.every(p => !p.motion && platforms.some(q =>
    !q.motion && q.y === p.y && q.width === p.width && q.x === stage.width - p.x - p.width));
}

test('a mirror match stays mirror-symmetric frame by frame on every symmetric arena', () => {
  const symmetric = arenas.filter(mirrorSymmetric);
  // Moving platforms (the shopping mall) are not mirrored, so that arena cannot be compared.
  assert.ok(symmetric.length >= 3, 'most arenas are mirror-symmetric');
  for (const stage of symmetric) for (const id of roster) for (const skin of fighterSkins(characters[id])) {
    const game = new GameSimulation([id, id], false, stage, undefined, [skin.id, skin.id], false, 7);
    for (let frame = 0; frame < FRAMES; frame++) {
      game.step([script(0, frame), script(1, frame)]);
      const [a, b] = game.state.fighters;
      const at = `${id} (${skin.id}) on ${stage.id} at frame ${frame}`;
      assert.equal(a.x + b.x, stage.width, `${at}: mirrored x`);
      assert.equal(a.vx + b.vx, 0, `${at}: mirrored horizontal velocity`);
      assert.equal(a.facing, -b.facing, `${at}: opposite facing`);
      assert.deepEqual([a.y, a.vy, a.state, a.move, a.health, a.meter], [b.y, b.vy, b.state, b.move, b.health, b.meter], `${at}: mirrored fighter`);
    }
  }
});

test('eight-fighter free-for-all covering the whole roster is deterministic on every arena', () => {
  const groups = [roster.slice(0, 8), roster.slice(8, 16)];
  for (const stage of arenas) for (const ids of groups) {
    const skins = ids.map(id => fighterSkins(characters[id])[0].id);
    const a = play(ids, stage, skins, 420);
    const b = play(ids, stage, skins, 420);
    assert.equal(hashState(a.state), hashState(b.state), `${ids.join(',')} on ${stage.id}`);
    assert.equal(a.state.fighters.length, 8);
  }
});

test('team matches across the roster are deterministic and keep teams fixed', () => {
  const ids = roster.slice(0, 6);
  const teams = [0, 1, 0, 1, 0, 1];
  const run = () => {
    const game = new GameSimulation(ids, false, arenas[1], teams, ids.map(() => 'original'), false, 3);
    for (let frame = 0; frame < 420; frame++) game.step(ids.map((_, seat) => script(seat % 2, frame)));
    return game;
  };
  const a = run(), b = run();
  assert.equal(hashState(a.state), hashState(b.state));
  assert.deepEqual(a.state.teams, teams);
  assert.ok(a.state.teamMatch);
});
