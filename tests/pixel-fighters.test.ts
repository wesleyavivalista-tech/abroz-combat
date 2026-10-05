import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GameSimulation } from "../packages/game-core/simulation/GameSimulation.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { pixelPose } from "../apps/client/src/rendering/PixelAnimation.js";
import { PixelFighterRenderer } from "../apps/client/src/rendering/PixelFighterRenderer.js";

test("both sprite fighters anticipate attacks before active frames and recover afterward", () => {
  const sim = new GameSimulation(["prototype-a", "prototype-b"]);
  for (const f of sim.state.fighters) {
    f.state = "LightAttack";
    for (const move of Object.values(characters[f.characterId].moves)) {
      f.move = move.id;
      f.moveFrame = 0;
      const anticipation = pixelPose(f, move);
      f.moveFrame = move.startupFrames;
      const active = pixelPose(f, move);
      assert.notEqual(active, anticipation, move.id);
      f.moveFrame = move.startupFrames + move.activeFrames - 1;
      assert.equal(pixelPose(f, move), active, move.id);
      f.moveFrame = move.startupFrames + move.activeFrames + move.recoveryFrames - 1;
      assert.equal(pixelPose(f, move), anticipation, move.id);
    }
    f.state = "HitStunStanding";
    assert.equal(pixelPose(f, characters[f.characterId].moves.light), 13);
    f.state = "Knockdown";
    assert.equal(pixelPose(f), 14);
    f.state = "MatchWin";
    assert.equal(pixelPose(f), 15);
  }
});

test("sprite instances keep separate UVs, mirror facing and follow platform feet", () => {
  const sim = new GameSimulation(["prototype-a", "prototype-b"]);
  const atlas = new THREE.Texture();
  const f = sim.state.fighters[0];
  const a = new PixelFighterRenderer(characters[f.characterId], atlas);
  const b = new PixelFighterRenderer(characters[f.characterId], atlas);
  f.x = 500; f.y = 340; f.facing = -1; f.state = "Idle";
  a.update(f, 0);
  const mesh = a.root.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  const other = b.root.children[0] as typeof mesh;
  assert.equal(a.root.position.y, 3.4);
  assert.equal(a.root.scale.x, -1);
  assert.ok(Math.abs(a.shadow.position.y - 3.42) < .00001);
  assert.notEqual(mesh.material.map, other.material.map);
  assert.notEqual(mesh.material.map, atlas);
  assert.ok(Math.abs(mesh.position.y - mesh.scale.y / 2) < .02);
  a.dispose(); b.dispose(); atlas.dispose();
});

test("walking uses four dedicated steps and reverses them for retreating", () => {
  const f = new GameSimulation(["prototype-a", "prototype-b"]).state.fighters[0];
  f.state = "WalkForward";
  const sequence = [0, 6, 12, 18, 24].map(t => { f.stateFrame = t; return pixelPose(f); });
  assert.deepEqual(sequence, [16, 17, 18, 19, 16]);
  f.state = "WalkBackward";
  assert.deepEqual([0, 8, 16, 24, 32].map(t => { f.stateFrame = t; return pixelPose(f); }), [18, 17, 16, 19, 18]);
  for (const state of ["DashForward", "DashBackward"]) {
    f.state = state;
    for (let tick = 0; tick < 12; tick++) {
      f.stateFrame = tick;
      assert.ok(pixelPose(f) >= 20, "dash must never display a walking or idle frame");
    }
  }
});

test("movement artwork preserves scale, foot contact and resets to combat artwork", () => {
  for (const f of new GameSimulation(["prototype-a", "prototype-b"]).state.fighters) {
    const atlas = new THREE.Texture(), movement = new THREE.Texture();
    const visual = new PixelFighterRenderer(characters[f.characterId], atlas, movement);
    const mesh = visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    f.state = "Idle"; f.stateFrame = 0;
    visual.update(f, 0);
    const combatMap = mesh.material.map;
    const idleHeight = mesh.scale.y;
    for (let tick = 0; tick < 24; tick++) {
      f.state = "WalkForward"; f.stateFrame = tick;
      visual.update(f, 0);
      assert.notEqual(mesh.material.map, combatMap);
      assert.ok(Math.abs(mesh.scale.y - idleHeight) < .025);
      assert.ok(Math.abs(mesh.position.y - mesh.scale.y / 2) < .02);
    }
    f.state = "DashForward";
    visual.update(f, 0);
    assert.ok(mesh.scale.y < idleHeight * .85, "dash silhouette should be clearly lower");
    f.state = "Idle"; f.stateFrame = 0;
    visual.update(f, 0);
    assert.equal(mesh.material.map, combatMap);
    assert.equal(mesh.scale.y, idleHeight);
    visual.dispose(); atlas.dispose(); movement.dispose();
  }
});

test("double tapping movement enters the dedicated dash sequence in the simulation", async () => {
  const { Button } = await import("../packages/game-core/types.js");
  for (const [input, state] of [[Button.Right, "DashForward"], [Button.Left, "DashForward"]] as const) {
    const sim = new GameSimulation(["prototype-a", "prototype-b"]);
    sim.state.phase = "fight";
    sim.state.fighters.forEach(f => { f.state = "Idle"; });
    sim.step([input, 0]);
    sim.step([0, 0]);
    sim.step([input, 0]);
    const f = sim.state.fighters[0];
    assert.equal(f.state, state);
    assert.ok(pixelPose(f) >= 20);
    for (let i = 0; i < 13; i++) sim.step([input, 0]);
    assert.equal(f.state, state === "DashForward" ? "WalkForward" : "WalkBackward");
    assert.ok(pixelPose(f) >= 16 && pixelPose(f) <= 19);
  }
});

test("crouching sweep uses dedicated phases without squashing the artwork", () => {
  for (const f of new GameSimulation(["prototype-a", "prototype-b"]).state.fighters) {
    const def = characters[f.characterId], move = def.moves.crouch;
    const atlas = new THREE.Texture();
    const visual = new PixelFighterRenderer(def, atlas, atlas, atlas);
    const mesh = visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    f.move = "crouch"; f.state = "CrouchingAttack";
    for (const [tick, expected] of [[0,24],[move.startupFrames,25],[move.startupFrames+move.activeFrames,26]]) {
      f.moveFrame = tick;
      assert.equal(pixelPose(f, move), expected);
      visual.update(f, 0);
      const uv = mesh.material.map!.repeat;
      assert.ok(Math.abs(mesh.scale.x / mesh.scale.y - (uv.x * 1536) / (uv.y * 1024)) < .00001, "preserve image aspect ratio");
      assert.ok(Math.abs(mesh.position.y - mesh.scale.y / 2) < .02, "keep sweep on floor");
    }
    visual.dispose(); atlas.dispose();
  }
});
