import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TochaRenderer, tochaFireFrame } from "../apps/client/src/rendering/TochaRenderer.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { createFighter } from "../packages/game-core/simulation/Fighter.js";
import { tochaFireFrames, tochaFireFeet } from "../apps/client/src/rendering/TochaFireAtlas.js";
const def = characters.tocha;
test("illustrated fire follows each attack phase, including air and crouch, but not the Satan release", () => {
  const f=createFighter("tocha",600,1);
  for(const [id,frame] of Object.entries({jab:0,cross:1,finisher:2,heavy:3,double:4,fireball:5,crouch:6,air:7})) {
    const m=def.moves[id];f.move=id;f.state=m.state;f.moveFrame=0;assert.equal(tochaFireFrame(f,def),null);
    f.moveFrame=m.startupFrames;assert.equal(tochaFireFrame(f,def),frame);
    f.moveFrame=m.startupFrames+m.activeFrames+8;assert.equal(tochaFireFrame(f,def),null);
  }
  f.move="satan";f.moveFrame=def.moves.satan.startupFrames;assert.equal(tochaFireFrame(f,def),null);
});
test("both skins preserve body pivots, feet and facing when switching to integrated fire textures", () => {
  const textures=[new THREE.Texture(),new THREE.Texture()];const flames=[new THREE.Texture(),new THREE.Texture()];
  for(const skin of [0,1]) {
    const v=new TochaRenderer(def,textures,skin,flames);const f=createFighter("tocha",600,1);
    f.state="Idle";v.update(f,0);const sprite=v.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;const normal=sprite.material.map;
    for(const [id,index] of Object.entries({jab:0,cross:1,finisher:2,heavy:3,double:4,fireball:5,crouch:6,air:7})) {
      f.move=id;f.moveFrame=def.moves[id].startupFrames;f.state=def.moves[id].state;v.update(f,0);
      assert.notEqual(sprite.material.map,normal);
      const [,top,,bottom]=tochaFireFrames[skin ? "2":"1"][index];const scale=skin ? 1.62/287:1.58/264;
      assert.ok(Math.abs(sprite.position.y-((tochaFireFeet[skin][index]-(top+bottom)/2)*scale))<1e-8);
      const x=sprite.position.x;f.facing=-1;v.update(f,0);assert.equal(v.root.scale.x,-1);assert.equal(sprite.position.x,x);f.facing=1;
    }
    f.move=null;f.state="Idle";v.update(f,0);assert.equal(sprite.material.map,normal);v.dispose();
  }
});
