import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GameSimulation,
  hashState,
} from "../packages/game-core/simulation/GameSimulation.js";
import { Button } from "../packages/game-core/types.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { hurtbox } from "../packages/game-core/combat/CollisionSystem.js";
import { RollbackManager } from "../packages/networking/RollbackManager.js";
function match() {
  const sim = new GameSimulation(["prototype-a", "prototype-b"]);
  sim.state.phase = "fight";
  sim.state.fighters.forEach((f) => (f.state = "Idle"));
  return sim;
}
function run(sim: GameSimulation, n: number, a = 0, b = 0) {
  for (let i = 0; i < n; i++) sim.step([a, b]);
}
function defeat(sim: GameSimulation, index: number) {
  sim.state.hitstop = 0;
  sim.state.fighters[index].health = 0;
  sim.step([0, 0]);
}
test("fighters start with three lives; nonlethal damage does not consume one", () => {
  const sim = match();
  assert.deepEqual(
    sim.state.fighters.map((f) => f.lives),
    [3, 3],
  );
  sim.state.fighters[0].health = 800;
  run(sim, 1);
  assert.equal(sim.state.fighters[0].lives, 3);
});
test("lethal combat hit removes one life and leaves survivor health intact", () => {
  const sim = match();
  const [a, b] = sim.state.fighters;
  a.x = 650;
  b.x = 735;
  a.health = 732;
  b.health = 1;
  sim.step([Button.Light, 0]);
  run(sim, 5);
  assert.equal(b.lives, 2);
  assert.equal(b.state, "Respawning");
  assert.equal(b.respawnAt, sim.state.frame + 120);
  assert.equal(a.health, 732);
  assert.equal(sim.state.phase, "fight");
});
test("respawn is exactly 120 ticks after death, even during hit stop", () => {
  const sim = match();
  defeat(sim, 1);
  const f = sim.state.fighters[1];
  const deathFrame = sim.state.frame;
  sim.state.hitstop = 200;
  run(sim, 119);
  assert.equal(f.health, 0);
  assert.equal(f.lives, 2);
  assert.equal(f.respawnAt, deathFrame + 120);
  run(sim, 1);
  assert.equal(f.health, 1400);
  assert.equal(f.respawnAt, 0);
  assert.equal(f.state, "Idle");
  assert.equal(f.invulnerableUntil, sim.state.frame + 120);
});
test("respawn protection blocks damage and collision for exactly 120 ticks", () => {
  const sim = match();
  defeat(sim, 1);
  run(sim, 120);
  const f = sim.state.fighters[1];
  const spawnFrame = sim.state.frame;
  const m = characters[sim.state.fighters[0].characterId].moves.heavy;
  assert.equal(sim.hurts(f, hurtbox(f)), false);
  sim.hit(0, m, 0, false);
  assert.equal(f.health, 1400);
  assert.equal(f.stun, 0);
  run(sim, 119);
  assert.equal(sim.state.frame, spawnFrame + 119);
  assert.equal(sim.hurts(f, hurtbox(f)), false);
  sim.hit(0, m, 0, false);
  assert.equal(f.health, 1400);
  run(sim, 1);
  assert.equal(sim.hurts(f, hurtbox(f)), true);
  sim.hit(0, m, 0, false);
  assert.equal(f.health, 1290);
});
test("waiting fighter cannot move, attack or block the survivor; life is deducted once", () => {
  const sim = match();
  defeat(sim, 1);
  const [a, b] = sim.state.fighters;
  const start = a.x;
  b.x = a.x + 65;
  const deadX = b.x;
  run(sim, 50, Button.Right, Button.Left | Button.Heavy | Button.Special2);
  assert.ok(a.x > start + 100);
  assert.equal(b.x, deadX);
  assert.equal(b.move, null);
  assert.equal(b.buffer.length, 0);
  assert.equal(b.lives, 2);
  assert.equal(sim.hurts(b, hurtbox(b)), false);
});
test("respawn clears temporary combat state and keeps earned meter", () => {
  const sim = match(),
    f = sim.state.fighters[1];
  f.meter = 73;
  f.combo = 5;
  f.stun = 20;
  f.vx = 17;
  f.vy = 9;
  f.y = 80;
  defeat(sim, 1);
  run(sim, 120);
  assert.equal(f.meter, 73);
  assert.equal(f.combo, 0);
  assert.equal(f.stun, 0);
  assert.equal(f.vx, 0);
  assert.equal(f.vy, 0);
  assert.equal(f.y, 80);
  assert.equal(f.lives, 2);
  assert.equal(f.health, 1400);
});
test("third lost life ends match immediately; no respawn or round reset", () => {
  const sim = match();
  sim.state.fighters[0].health = 601;
  for (let life = 0; life < 3; life++) {
    defeat(sim, 1);
    assert.equal(sim.state.fighters[1].lives, 2 - life);
    if (life < 2) {
      assert.equal(sim.state.phase, "fight");
      run(sim, 240);
    }
  }
  assert.equal(sim.state.phase, "result");
  assert.equal(sim.state.winner, 0);
  assert.equal(sim.state.fighters[0].health, 601);
  assert.equal(sim.state.fighters[1].respawnAt, 0);
  run(sim, 500);
  assert.equal(sim.state.fighters[1].health, 0);
  assert.equal(sim.state.fighters[0].lives, 3);
});
test("simultaneous deaths each deduct a life; simultaneous final KO is a draw", () => {
  const sim = match();
  sim.state.fighters.forEach((f) => (f.health = 0));
  sim.step([0, 0]);
  assert.deepEqual(
    sim.state.fighters.map((f) => f.lives),
    [2, 2],
  );
  assert.equal(sim.state.phase, "fight");
  run(sim, 120);
  sim.state.fighters.forEach((f) => {
    f.lives = 1;
    f.health = 0;
  });
  sim.step([0, 0]);
  assert.equal(sim.state.phase, "result");
  assert.equal(sim.state.winner, -1);
  assert.deepEqual(
    sim.state.fighters.map((f) => f.lives),
    [0, 0],
  );
});
test("equal-priority final-life attacks can trade into a draw", () => {
  const sim = new GameSimulation(["prototype-a", "prototype-a"]);
  sim.state.phase = "fight";
  sim.state.fighters.forEach((f, i) => {
    f.state = "Idle";
    f.x = 650 + i * 85;
    f.health = 1;
    f.lives = 1;
  });
  sim.step([Button.Light, Button.Light]);
  run(sim, 5);
  assert.equal(sim.state.phase, "result");
  assert.equal(sim.state.winner, -1);
});
test("defeat removes owned projectiles while preserving opponent projectiles", () => {
  const sim = match();
  sim.state.projectiles.slice(0, 2).forEach((p, i) =>
    Object.assign(p, {
      active: true,
      owner: i,
      x: 100,
      y: 80,
      vx: 0,
      life: 30,
      move: "special",
    }),
  );
  defeat(sim, 1);
  assert.equal(sim.state.projectiles[0].active, true);
  assert.equal(sim.state.projectiles[1].active, false);
});
test("snapshot restore spans respawn and protection expiry identically", () => {
  const sim = match();
  defeat(sim, 1);
  run(sim, 80);
  const before = sim.snapshot();
  run(sim, 180, Button.Right, 0);
  const expected = hashState(sim.state);
  sim.restore(before);
  run(sim, 180, Button.Right, 0);
  assert.equal(hashState(sim.state), expected);
});
test("late lethal remote attack replays lives, respawn and shield identically", () => {
  const baseline = match(),
    predicted = match();
  for (const sim of [baseline, predicted]) {
    sim.state.fighters[0].x = 650;
    sim.state.fighters[1].x = 735;
    sim.state.fighters[0].health = 1;
  }
  const rollback = new RollbackManager(predicted, 0, 0, 8);
  const packets: { frame: number; mask: number }[] = [];
  for (let frame = 0; frame < 300; frame++) {
    const mask = frame === 0 ? Button.Light : 0;
    baseline.step([0, mask]);
    rollback.local.set(frame, 0);
    packets.push({ frame, mask });
    if (packets.length > 3) {
      const p = packets.shift()!;
      rollback.receive(p.frame, p.mask);
    }
    assert.equal(rollback.tick(), true);
  }
  packets.forEach((p) => rollback.receive(p.frame, p.mask));
  assert.equal(hashState(predicted.state), hashState(baseline.state));
  assert.equal(predicted.state.fighters[0].lives, 2);
  assert.equal(predicted.state.fighters[0].respawnAt, 0);
  assert.ok(rollback.rollbackCount > 0);
});
test("survival match has no time limit", () => {
  const sim = match();
  run(sim, 60 * 110);
  assert.equal(sim.state.phase, "fight");
  assert.deepEqual(
    sim.state.fighters.map((f) => f.lives),
    [3, 3],
  );
});

test("respawn preserves the exact defeat position at either edge and in the air", () => {
  for (const index of [0, 1])
    for (const [x, y] of [
      [40, 0],
      [2360, 0],
      [823, 157],
    ]) {
      const sim = match(),
        f = sim.state.fighters[index];
      f.x = x;
      f.y = y;
      defeat(sim, index);
      run(sim, 119);
      assert.deepEqual([f.x, f.y], [x, y]);
      run(sim, 1);
      assert.deepEqual([f.x, f.y], [x, y]);
      assert.equal(f.health, 1400);
      assert.equal(f.invulnerableUntil, sim.state.frame + 120);
    }
});
test("an opponent occupying the defeat location does not relocate the respawn", () => {
  const sim = match(),
    [a, b] = sim.state.fighters;
  b.x = 780;
  defeat(sim, 1);
  run(sim, 119);
  a.x = 780;
  sim.step([Button.Right, Button.Left | Button.Up]);
  assert.equal(b.x, 780);
  assert.equal(b.y, 0);
  assert.equal(b.respawnAt, 0);
});
test("airborne respawn starts at the death height, then resumes gravity", () => {
  const sim = match(),
    f = sim.state.fighters[1];
  f.x = 920;
  f.y = 140;
  defeat(sim, 1);
  run(sim, 120);
  assert.deepEqual([f.x, f.y, f.vy], [920, 140, 0]);
  assert.equal(f.state, "Fall");
  run(sim, 2);
  assert.equal(f.y, 139);
});
