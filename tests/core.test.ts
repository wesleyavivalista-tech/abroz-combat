import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GameSimulation,
  hashState,
} from "../packages/game-core/simulation/GameSimulation.js";
import { Button, type InputSample } from "../packages/game-core/types.js";
import {
  record,
  motion,
  direction,
  bufferedButton,
} from "../packages/game-core/input/InputBuffer.js";
import {
  intersects,
  scaledDamage,
  hitboxes,
  pushApart,
} from "../packages/game-core/combat/CollisionSystem.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { RollbackManager } from "../packages/networking/RollbackManager.js";
function combat() {
  const sim = new GameSimulation(["prototype-a", "prototype-b"]);
  sim.state.phase = "fight";
  sim.state.fighters.forEach((f) => (f.state = "Idle"));
  sim.state.fighters[0].x = 650;
  sim.state.fighters[1].x = 735;
  return sim;
}
function run(sim: GameSimulation, n: number, a = 0, b = 0) {
  for (let i = 0; i < n; i++) sim.step([a, b]);
}
test("input directions and quarter circles mirror with facing", () => {
  assert.equal(direction(Button.Right, 1), 6);
  assert.equal(direction(Button.Left, -1), 6);
  const b: InputSample[] = [];
  [Button.Down, Button.Down | Button.Left, Button.Left | Button.Light].forEach(
    (m, i) => record(b, i, m, 0, -1),
  );
  assert.equal(motion(b, "236"), true);
  assert.equal(motion(b, "214"), false);
  assert.equal(bufferedButton(b, 7, Button.Light), true);
  assert.equal(bufferedButton(b, 8, Button.Light), false);
});
test("buffer is bounded and expired motion is rejected", () => {
  const b: InputSample[] = [];
  for (let i = 0; i < 90; i++) record(b, i, 0, 0, 1);
  assert.equal(b.length, 40);
  assert.equal(motion(b, "623"), false);
});
test("damage scaling, counter bonus and collision boundaries", () => {
  assert.equal(scaledDamage(100, 0, false), 100);
  assert.equal(scaledDamage(100, 2, false), 76);
  assert.equal(scaledDamage(100, 20, false), 30);
  assert.equal(scaledDamage(100, 0, true), 120);
  assert.equal(
    intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 2, h: 2 }),
    false,
  );
  assert.equal(
    intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 2, h: 2 }),
    true,
  );
});
test("light attack first hits at startup frame 5, hits once and recovers", () => {
  const sim = combat();
  sim.step([Button.Light, 0]);
  run(sim, 4);
  assert.equal(sim.state.fighters[1].health, 1400);
  sim.step([0, 0]);
  assert.equal(sim.state.fighters[1].health, 1352);
  assert.equal(sim.state.fighters[0].meter, 48);
  run(sim, 45);
  assert.equal(sim.state.fighters[1].health, 1352);
  assert.equal(sim.state.fighters[0].state, "Idle");
});
test("active boxes enable and disable on exact frame boundaries", () => {
  const sim = combat(),
    f = sim.state.fighters[0],
    m = characters[f.characterId].moves.light;
  f.moveFrame = 4;
  assert.equal(hitboxes(f, m).length, 0);
  f.moveFrame = 5;
  assert.equal(hitboxes(f, m).length, 1);
  f.moveFrame = 7;
  assert.equal(hitboxes(f, m).length, 1);
  f.moveFrame = 8;
  assert.equal(hitboxes(f, m).length, 0);
});
test("standing block stops a mid and crouching block stops a low", () => {
  const sim = combat();
  sim.step([Button.Light, Button.Right]);
  run(sim, 5, 0, Button.Right);
  assert.equal(sim.state.fighters[1].health, 1400-Math.ceil(characters["prototype-a"].moves.light.damage*.4));
  assert.equal(sim.state.fighters[1].state, "BlockStanding");
  const low = combat();
  low.step([Button.Down | Button.Light, Button.Down | Button.Right]);
  run(low, 7, Button.Down, Button.Down | Button.Right);
  assert.equal(low.state.fighters[1].health, 1400-Math.ceil(characters["prototype-a"].moves.crouch.damage*.4));
  assert.equal(low.state.fighters[1].state, "BlockCrouching");
});
test("standing guard loses to low; heavy launches and knocks down", () => {
  const sim = combat();
  sim.step([Button.Down | Button.Light, Button.Right]);
  run(sim, 7, Button.Down, Button.Right);
  assert.ok(sim.state.fighters[1].health < 1400);
  const heavy = combat();
  heavy.step([Button.Medium, 0]);
  run(heavy, 12);
  assert.equal(heavy.state.fighters[1].state, "AirHitStun");
  let sawKnockdown = false;
  for (let i = 0; i < 100; i++) {
    heavy.step([0, 0]);
    sawKnockdown ||= String(heavy.state.fighters[1].state) === "Knockdown";
  }
  assert.ok(sawKnockdown);
});
test("jump startup, gravity and land return to floor", () => {
  const sim = combat();
  sim.state.fighters[0].x = 1100;
  sim.step([Button.Up, 0]);
  assert.equal(sim.state.fighters[0].state, "JumpStartup");
  run(sim, 3);
  assert.ok(sim.state.fighters[0].y > 0);
  run(sim, 60);
  assert.equal(sim.state.fighters[0].y, 0);
  assert.equal(sim.state.fighters[0].state, "Idle");
});
test("meter gates specials and projectile slots recycle", () => {
  const sim = combat();
  sim.state.fighters[0].meter = 0;
  sim.step([Button.Special, 0]);
  assert.equal(sim.state.fighters[0].move, null);
  sim.state.fighters[0].meter = 100;
  sim.step([0, 0]);
  sim.step([Button.Special, 0]);
  assert.equal(sim.state.fighters[0].meter, 80);
  run(sim, 14);
  assert.ok(
    sim.state.projectiles.some((p) => p.active) ||
      sim.state.fighters[1].health < 1400,
  );
  run(sim, 130);
  assert.ok(sim.state.projectiles.every((p) => !p.active));
});
test("cancel rules allow combo opener to heavy on connection", () => {
  const sim = combat();
  sim.step([Button.Light, 0]);
  run(sim, 6);
  run(sim, 6);
  sim.step([Button.Medium, 0]);
  run(sim, 1);
  assert.equal(sim.state.fighters[0].move, "heavy");
});
test("pushboxes resolve overlap against both corners", () => {
  const sim = combat(),
    [a, b] = sim.state.fighters;
  a.x = 40;
  b.x = 45;
  pushApart(a, b, 1500);
  assert.equal(a.x, 40);
  assert.equal(b.x - a.x, 65);
  a.x = 1455;
  b.x = 1460;
  pushApart(a, b, 1500);
  assert.equal(b.x, 1460);
  assert.equal(b.x - a.x, 65);
});
test("snapshot restore produces identical future state including buffers", () => {
  const sim = combat();
  run(sim, 8, Button.Right, Button.Left);
  const snapshot = sim.snapshot();
  run(sim, 70, Button.Light, Button.Medium);
  const expected = hashState(sim.state);
  sim.restore(snapshot);
  run(sim, 70, Button.Light, Button.Medium);
  assert.equal(hashState(sim.state), expected);
  assert.notEqual(snapshot.frame, sim.state.frame);
});
test("deterministic replay across 5000 frames", () => {
  const a = new GameSimulation(["prototype-a", "prototype-b"]),
    b = new GameSimulation(["prototype-a", "prototype-b"]);
  for (let i = 0; i < 5000; i++) {
    const pair: [number, number] = [
      i % 45 < 20 ? Button.Right : i % 23 === 0 ? Button.Heavy : 0,
      i % 80 < 20 ? Button.Left : i % 31 === 0 ? Button.Special : 0,
    ];
    a.step(pair);
    b.step(pair);
  }
  assert.equal(hashState(a.state), hashState(b.state));
});
test("late remote input rolls back and matches an input-perfect simulation", () => {
  const baseline = combat(),
    predicted = combat();
  const rollback = new RollbackManager(predicted, 0, 0, 8);
  const inputs = [0, Button.Light, 0, 0, 0, 0, 0];
  for (let frame = 0; frame < inputs.length; frame++) {
    baseline.step([0, inputs[frame]]);
    rollback.local.set(frame, 0);
    rollback.tick();
  }
  for (let frame = 0; frame < inputs.length; frame++)
    rollback.receive(frame, inputs[frame]);
  assert.ok(rollback.rollbackCount > 0);
  assert.equal(hashState(predicted.state), hashState(baseline.state));
});
test("rollback stalls beyond prediction horizon and resumes on confirmation", () => {
  const sim = combat(),
    rollback = new RollbackManager(sim, 0, 2, 8);
  for (let i = 0; i < 30; i++) rollback.tick();
  assert.equal(sim.state.frame, 10);
  assert.equal(rollback.stalled, true);
  for (let i = 2; i < 10; i++) rollback.receive(i, 0);
  assert.equal(rollback.tick(), true);
});
test("training health and meter reset without losing lives", () => {
  const sim = new GameSimulation(["prototype-a", "prototype-b"], true);
  sim.state.fighters[0].health = 500;
  sim.state.fighters[0].meter = 0;
  run(sim, 1);
  assert.equal(sim.state.fighters[0].health, 1400);
  assert.equal(sim.state.fighters[0].meter, 100);
  assert.equal(sim.state.fighters[0].lives, 3);
  assert.equal(sim.state.phase, "fight");
});

test("each fighter has two distinct, working shortcut specials", () => {
  for (const id of ["prototype-a", "prototype-b"]) {
    const definition = characters[id];
    assert.equal(new Set(definition.specialButtons).size, 2);
    for (const [index, button] of [Button.Special, Button.Special2].entries()) {
      const sim = new GameSimulation([id, "prototype-a"]);
      sim.state.phase = "fight";
      sim.state.fighters.forEach((f) => (f.state = "Idle"));
      sim.state.fighters[0].meter = 100;
      sim.step([button, 0]);
      assert.equal(
        sim.state.fighters[0].move,
        definition.specialButtons[index],
      );
      assert.equal(
        sim.state.fighters[0].meter,
        100 - definition.moves[definition.specialButtons[index]].meterCost,
      );
      run(
        sim,
        definition.moves[definition.specialButtons[index]].startupFrames,
      );
      if (index === 1 && id === "prototype-a")
        assert.ok(sim.state.fighters[0].y > 0);
    }
  }
});

test("wider arena centers starts and allows travel all the way to both new edges", () => {
  const sim = new GameSimulation(["prototype-a", "prototype-b"]);
  assert.equal(sim.stage.width, 2400);
  assert.deepEqual(
    sim.state.fighters.map((f) => f.x),
    [1000, 1400],
  );
  sim.state.phase = "fight";
  sim.state.fighters.forEach((f) => (f.state = "Idle"));
  run(sim, 600, Button.Left, Button.Right);
  assert.deepEqual(
    sim.state.fighters.map((f) => f.x),
    [40, 2360],
  );
  sim.resetPositions();
  assert.deepEqual(
    sim.state.fighters.map((f) => f.x),
    [1000, 1400],
  );
});
