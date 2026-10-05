import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GameSimulation, hashState } from "../packages/game-core/simulation/GameSimulation.js";
import { Button } from "../packages/game-core/types.js";
import { characters } from "../packages/game-core/characters/registry.js";
function setup(id = "prototype-a") {
  const sim = new GameSimulation([id, id]);
  sim.state.phase = "fight";
  sim.state.fighters.forEach(f => f.state = "Idle");
  return sim;
}
function ticks(sim: GameSimulation, n: number, input = 0) {
  for (let i = 0; i < n; i++) sim.step([input, 0]);
}
for (const id of ["prototype-a", "prototype-b"]) {
  test(`${id}: repeated first-button presses chain three distinct moves, even on a miss`, () => {
    const sim = setup(id), f = sim.state.fighters[0];
    sim.step([Button.Light, 0]); assert.equal(f.move, "light");
    ticks(sim, 1); sim.step([Button.Light, 0]);
    for (let i = 0; i < 30 && f.move === "light"; i++) ticks(sim, 1);
    assert.equal(f.move, "chain2");
    ticks(sim, 1); sim.step([Button.Light, 0]);
    for (let i = 0; i < 30 && f.move === "chain2"; i++) ticks(sim, 1);
    assert.equal(f.move, "chain3");
    assert.equal(f.attackSerial, 3);
    ticks(sim, 60); assert.equal(f.move, null);
    sim.step([Button.Light, 0]); assert.equal(f.move, "light");
  });
  test(`${id}: holding attack one does not chain; buttons two and three stay single strikes`, () => {
    for (const [button, move] of [[Button.Light, "light"], [Button.Medium, "heavy"], [Button.Heavy, "kick"]] as const) {
      const sim = setup(id), f = sim.state.fighters[0];
      sim.step([button, 0]); assert.equal(f.move, move);
      ticks(sim, 90, button); assert.equal(f.attackSerial, 1); assert.equal(f.move, null);
    }
    const moves = characters[id].moves;
    assert.ok(moves.heavy.damage > moves.kick.damage && moves.heavy.damage > moves.light.damage);
    assert.ok(moves.heavy.startupFrames > moves.kick.startupFrames);
  });
}
test("snapshot restoration preserves an early queued follow-up", () => {
  const sim = setup();sim.step([Button.Light,0]);ticks(sim,1);sim.step([Button.Light,0]);
  const copy = setup();copy.restore(sim.snapshot());
  ticks(sim,20);ticks(copy,20);
  assert.equal(hashState(sim.state),hashState(copy.state));
  assert.equal(sim.state.fighters[0].move,"chain2");
});
for (const id of ["prototype-a", "prototype-b"]) {
  test(`${id}: all three chained strikes connect at close range`, () => {
    const sim = setup(id), [a,b] = sim.state.fighters;
    a.x = 650; b.x = 735;
    sim.step([Button.Light,0]); ticks(sim,1); sim.step([Button.Light,0]);
    for (let i=0;i<70 && a.move!=="chain2";i++) ticks(sim,1);
    assert.equal(a.move,"chain2");
    ticks(sim,1);sim.step([Button.Light,0]);
    let hits=0, hp=b.health;
    // Include the first connected strike, then observe the remaining impacts.
    assert.ok(b.combo>=1); hits=b.combo;
    for (let i=0;i<100;i++) { ticks(sim,1); if(b.health<hp) {hits++;hp=b.health;} }
    assert.equal(hits,3);
  });
}
