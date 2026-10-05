import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GameSimulation,
  hashState,
} from "../packages/game-core/simulation/GameSimulation.js";
import { Button } from "../packages/game-core/types.js";
import { grounded } from "../packages/game-core/simulation/StageCollision.js";
function match(id = "prototype-a") {
  const sim = new GameSimulation([id, "prototype-b"]);
  sim.state.phase = "fight";
  sim.state.fighters.forEach((f) => (f.state = "Idle"));
  return sim;
}
function run(
  sim: GameSimulation,
  count: number,
  inputs: [number, number] = [0, 0],
) {
  for (let i = 0; i < count; i++) sim.step(inputs);
}
for (const id of ["prototype-a", "prototype-b"]) {
  test(`${id} double jumps from the floor onto either platform, walks and jumps again`, () => {
    for (const platform of match().stage.platforms!) {
      const sim = match(id),
        f = sim.state.fighters[0];
      f.x = platform.x + 100;
      sim.step([Button.Up, 0]);
      run(sim, 22);
      sim.step([Button.Up, 0]);
      let peak = 0;
      for (let i = 0; i < 65; i++) {
        sim.step([0, 0]);
        peak = Math.max(peak, f.y);
      }
      assert.ok(peak > 450 && peak < 520);
      assert.equal(f.y, platform.y);
      assert.ok(grounded(f, sim.stage));
      const start = f.x;
      run(sim, 10, [Button.Right, 0]);
      assert.ok(f.x > start);
      assert.equal(f.y, platform.y);
      sim.step([Button.Up, 0]);
      run(sim, 8);
      assert.ok(f.y > platform.y + 100);
      run(sim, 65);
      assert.equal(f.y, platform.y);
    }
  });
}
test("walking off a platform falls to the floor without snapping back to its top", () => {
  const sim = match(),
    f = sim.state.fighters[0];
  Object.assign(f, { x: 835, y: 340 });
  run(sim, 40, [Button.Right, 0]);
  assert.ok(f.x > 840);
  assert.equal(f.y, 0);
  assert.ok(grounded(f, sim.stage));
});
test("normal attacks, guard and specials work at platform height", () => {
  for (const block of [false, true]) {
    const sim = match(),
      [a, b] = sim.state.fighters;
    Object.assign(a, { x: 550, y: 340 });
    Object.assign(b, { x: 635, y: 340 });
    sim.step([Button.Light, block ? Button.Right : 0]);
    run(sim, 8, [0, block ? Button.Right : 0]);
    assert.equal(a.move, "light");
    assert.equal(b.y, 340);
    assert.equal(block ? b.state.startsWith("Block") : b.health < 1400, true);
    if (block) assert.equal(b.health, 1380);
  }
  const sim = match(),
    f = sim.state.fighters[0];
  Object.assign(f, { x: 600, y: 340, meter: 100 });
  sim.step([Button.Special2, 0]);
  let peak = f.y;
  for (let i = 0; i < 40; i++) {
    sim.step([0, 0]);
    peak = Math.max(peak, f.y);
  }
  assert.ok(
    peak > 300,
    "rising special launches from the platform, not the floor",
  );
});
test("high-speed falling hits the platform top and knockdown recovers there", () => {
  const sim = match(),
    f = sim.state.fighters[0];
  Object.assign(f, { x: 600, y: 400, vy: -120, state: "AirHitStun", stun: 10 });
  sim.step([0, 0]);
  assert.equal(f.y, 340);
  assert.equal(f.state, "Knockdown");
  run(sim, 55);
  assert.equal(f.state, "Idle");
  assert.equal(f.y, 340);
});
test("platform death respawns exactly on the deck and replay remains deterministic", () => {
  const sim = match(),
    f = sim.state.fighters[0];
  Object.assign(f, { x: 600, y: 340, health: 0 });
  sim.step([0, 0]);
  const snapshot = sim.snapshot();
  run(sim, 120);
  assert.deepEqual([f.x, f.y, f.health], [600, 340, 1400]);
  sim.step([Button.Right, 0]);
  assert.ok(f.x > 600);
  assert.equal(f.y, 340);
  const expected = hashState(sim.state);
  sim.restore(snapshot);
  run(sim, 120);
  sim.step([Button.Right, 0]);
  assert.equal(hashState(sim.state), expected);
});

for (const id of ["prototype-a", "prototype-b"]) {
  test(`${id} cannot reach a platform with one jump or by holding jump`, () => {
    for (const held of [false, true]) {
      const sim = match(id),
        f = sim.state.fighters[0];
      f.x = 600;
      sim.step([Button.Up, 0]);
      let peak = 0;
      for (let i = 0; i < 100; i++) {
        sim.step([held ? Button.Up : 0, 0]);
        peak = Math.max(peak, f.y);
        assert.equal(f.airJumpUsed, false);
      }
      assert.ok(peak < sim.stage.platforms![0].y);
      if (!held) assert.equal(f.y, 0);
    }
  });
}
test("double jump rejects a third jump, replays identically, and refreshes on landing", () => {
  const sim = match(),
    f = sim.state.fighters[0];
  f.x = 600;
  sim.step([Button.Up, 0]);
  run(sim, 22);
  const before = sim.snapshot();
  sim.step([Button.Up, 0]);
  assert.equal(f.airJumpUsed, true);
  run(sim, 5);
  const velocity = f.vy;
  sim.step([Button.Up, 0]);
  assert.equal(f.vy, velocity - 1);
  const expected = hashState(sim.state);
  sim.restore(before);
  sim.step([Button.Up, 0]);
  run(sim, 5);
  sim.step([Button.Up, 0]);
  assert.equal(hashState(sim.state), expected);
  run(sim, 65);
  assert.equal(sim.state.fighters[0].airJumpUsed, false);
  assert.equal(sim.state.fighters[0].y, 340);
});
test("hitstun and active attacks prevent double jumping", () => {
  for (const state of ["AirHitStun", "AttackLight"] as const) {
    const sim = match(),
      f = sim.state.fighters[0];
    Object.assign(f, {
      x: 600,
      y: 200,
      vy: 5,
      state,
      stun: state === "AirHitStun" ? 10 : 0,
      move: state === "AttackLight" ? "light" : null,
    });
    sim.step([Button.Up, 0]);
    assert.equal(f.airJumpUsed, false);
    assert.equal(f.vy, 4);
  }
});
