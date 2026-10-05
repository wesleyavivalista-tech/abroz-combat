import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GameSimulation,
  hashState,
} from "../packages/game-core/simulation/GameSimulation.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { Button } from "../packages/game-core/types.js";
import { RollbackManager } from "../packages/networking/RollbackManager.js";
function match(id = "prototype-a") {
  const sim = new GameSimulation([id, id]);
  sim.state.phase = "fight";
  sim.state.fighters.forEach((f) => (f.state = "Idle"));
  return sim;
}
function run(sim: GameSimulation, n: number) {
  for (let i = 0; i < n; i++) sim.step([0, 0]);
}
for (const id of ["prototype-a", "prototype-b"]) {
  test(`${id} has two specials and two distinct high-powered supers`, () => {
    const c = characters[id];
    assert.equal(new Set([...c.specialButtons, ...c.superButtons]).size, 4);
    for (const name of c.superButtons) {
      assert.equal(c.moves[name].meterCost, 100);
      assert.ok(c.moves[name].damage >= 300);
    }
  });
  for (const [slot, button] of [Button.Super1, Button.Super2].entries())
    test(`${id} super ${slot + 1} requires full energy, empties it and cannot be reused`, () => {
      const sim = match(id),
        f = sim.state.fighters[0],
        move = characters[id].superButtons[slot];
      f.meter = 99;
      sim.step([button, 0]);
      assert.equal(f.move, null);
      assert.deepEqual(f.usedSupers, []);
      run(sim, 8);
      f.meter = 100;
      sim.step([button, 0]);
      assert.equal(f.move, move);
      assert.equal(f.meter, 0);
      assert.deepEqual(f.usedSupers, [move]);
      run(sim, 110);
      f.meter = 100;
      sim.step([button, 0]);
      assert.equal(f.move, null);
      assert.equal(f.meter, 100);
      assert.deepEqual(f.usedSupers, [move]);
    });
  test(`${id} the other super remains usable after refilling`, () => {
    const sim = match(id),
      f = sim.state.fighters[0];
    f.meter = 100;
    sim.step([Button.Super1, 0]);
    run(sim, 110);
    f.meter = 99;
    sim.step([Button.Super2, 0]);
    assert.equal(f.move, null);
    run(sim, 8);
    f.meter = 100;
    sim.step([Button.Super2, 0]);
    assert.equal(f.move, characters[id].superButtons[1]);
    assert.equal(f.usedSupers.length, 2);
    assert.equal(f.meter, 0);
  });
}
test("super usage survives life loss and exact-position respawn", () => {
  const sim = match(),
    f = sim.state.fighters[0];
  f.meter = 100;
  sim.step([Button.Super1, 0]);
  run(sim, 100);
  f.health = 0;
  sim.step([0, 0]);
  run(sim, 120);
  assert.equal(f.lives, 2);
  assert.deepEqual(f.usedSupers, ["nova"]);
  f.meter = 100;
  sim.step([Button.Super1, 0]);
  assert.equal(f.move, null);
  assert.equal(f.meter, 100);
});
test("attempting super while stunned does not consume energy or usage", () => {
  const sim = match(),
    f = sim.state.fighters[0];
  f.meter = 100;
  f.stun = 20;
  f.state = "HitStunStanding";
  sim.step([Button.Super1, 0]);
  assert.equal(f.meter, 100);
  assert.deepEqual(f.usedSupers, []);
});
test("regular specials are repeatable and do not consume super allowances", () => {
  const sim = match(),
    f = sim.state.fighters[0];
  for (let i = 0; i < 2; i++) {
    f.meter = 100;
    sim.step([Button.Special, 0]);
    assert.equal(f.move, "special");
    run(sim, 100);
  }
  assert.deepEqual(f.usedSupers, []);
});
test("new match resets usage; training reset explicitly refreshes practice attempts", () => {
  const sim = match();
  sim.state.fighters[0].meter = 100;
  sim.step([Button.Super1, 0]);
  assert.deepEqual(new GameSimulation(["prototype-a", "prototype-b"]).state.fighters[0].usedSupers, []);
  sim.resetPositions();
  assert.deepEqual(sim.state.fighters[0].usedSupers, []);
});
test("snapshot restore and late remote super rollback preserve meter and allowance", () => {
  const baseline = match(),
    predicted = match();
  for (const sim of [baseline, predicted]) sim.state.fighters[1].meter = 100;
  const rb = new RollbackManager(predicted, 0, 0, 8);
  const masks = [Button.Super2, 0, 0, 0, 0, 0, 0];
  const snap = baseline.snapshot();
  masks.forEach((m, i) => {
    baseline.step([0, m]);
    rb.local.set(i, 0);
    rb.tick();
  });
  masks.forEach((m, i) => rb.receive(i, m));
  assert.equal(hashState(baseline.state), hashState(predicted.state));
  assert.deepEqual(predicted.state.fighters[1].usedSupers, ["skybreak"]);
  const result = hashState(baseline.state);
  baseline.restore(snap);
  masks.forEach((m) => baseline.step([0, m]));
  assert.equal(hashState(baseline.state), result);
});

test("all four supers deal their configured damage when they connect", () => {
  for (const id of ["prototype-a", "prototype-b"])
    for (const [slot, button] of [Button.Super1, Button.Super2].entries()) {
      const sim = match(id),
        [a, b] = sim.state.fighters;
      a.x = 650;
      b.x = 780;
      a.meter = 100;
      const move = characters[id].moves[characters[id].superButtons[slot]];
      sim.step([button, 0]);
      run(sim, move.startupFrames + 6);
      assert.equal(b.health, 1400 - move.damage, move.id);
      assert.equal(a.meter, 0);
    }
});
