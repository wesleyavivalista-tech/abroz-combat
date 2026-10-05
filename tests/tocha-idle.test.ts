import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TochaRenderer, tochaIdleFrame } from "../apps/client/src/rendering/TochaRenderer.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { createFighter } from "../packages/game-core/simulation/Fighter.js";

test("Tocha breathes on simulation time with planted shoes and returns from attacks in both skins", () => {
  for (const skin of [0, 1]) {
    const visual = new TochaRenderer(characters.tocha, [new THREE.Texture(), new THREE.Texture()], skin, [], new THREE.Texture());
    const f = createFighter("tocha", 600, 1);
    f.state = "Idle";
    const sprite = visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    for (let frame = 0; frame < 4; frame++) {
      f.stateFrame = frame * 24;
      assert.equal(tochaIdleFrame(f), frame);
      visual.update(f, 0);
      assert.equal(sprite.material.map!.offset.x, frame / 4);
      assert.equal(sprite.material.map!.offset.y, skin ? 0 : .5);
      const position = sprite.position.clone();
      visual.update(f, 999);
      assert.deepEqual(sprite.position, position);
      const footPixel = skin ? [475, 476, 475, 476][frame] : 478;
      assert.ok(Math.abs(sprite.position.y + (256 - footPixel) / 512 * sprite.scale.y) < 1e-9);
    }
    const idleMap = sprite.material.map;
    f.move = "jab"; f.state = "StandingAttack"; f.moveFrame = 8;
    assert.equal(tochaIdleFrame(f), null);
    visual.update(f, 0); assert.notEqual(sprite.material.map, idleMap);
    f.move = null; f.state = "Idle"; f.stateFrame = 96; f.facing = -1;
    visual.update(f, 0); assert.equal(sprite.material.map, idleMap);
    assert.equal(sprite.material.map!.offset.x, 0); assert.equal(visual.root.scale.x, -1);
    visual.dispose();
  }
});
