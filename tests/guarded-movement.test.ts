import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { guardedMovementFrame } from "../apps/client/src/rendering/GuardedMovement.js";
import { BozoRenderer } from "../apps/client/src/rendering/BozoRenderer.js";
import { TochaRenderer } from "../apps/client/src/rendering/TochaRenderer.js";
import { characters } from "../packages/game-core/characters/registry.js";
import { createFighter } from "../packages/game-core/simulation/Fighter.js";

test("guarded walking stays synchronized through facing changes, position corrections and replay", () => {
  for (const id of ["bozo","tocha"] as const) {
    const f=createFighter(id,600,1);
    for (const state of ["WalkForward","WalkBackward"] as const) {
      f.state=state;
      const poses=new Set<number|null>();
      for (let tick=0;tick<32;tick++) {
        f.stateFrame=tick;
        const pose=guardedMovementFrame(f,id);poses.add(pose);
        f.x=-f.x+127;f.facing=f.facing===1?-1:1;
        assert.equal(guardedMovementFrame(f,id),pose);
      }
      assert.equal(poses.size,4);
    }
  }
});

test("both skins use a distinct back dash, keep walk feet grounded and release the movement atlas on attacks", () => {
  for (const id of ["bozo","tocha"] as const) for (const skin of [0,1]) {
    const atlases=[new THREE.Texture(),new THREE.Texture(),new THREE.Texture()];
    const movement=new THREE.Texture();
    const visual=id==="bozo" ? new BozoRenderer(atlases,skin,false,movement) : new TochaRenderer(characters.tocha,atlases,skin,[],undefined,movement);
    const sprite=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
    const f=createFighter(id,600,1);f.state="WalkBackward";
    visual.update(f,0);const map=sprite.material.map;
    assert.equal(sprite.position.y-sprite.scale.y/2,0);
    f.state="DashBackward";
    const poses=new Set<number|null>();
    for(let tick=0;tick<12;tick++) {
      f.stateFrame=tick;poses.add(guardedMovementFrame(f,id));visual.update(f,0);
      assert.equal(sprite.material.map,map);
      assert.ok(sprite.position.y-sprite.scale.y/2>=-1e-9);
      const position=sprite.position.clone();visual.update(f,1000);assert.deepEqual(sprite.position,position);
    }
    assert.equal(poses.size,4);
    assert.ok(Math.abs(sprite.position.y-sprite.scale.y/2)<1e-9);
    f.state="StandingAttack";f.move="jab";f.moveFrame=8;
    visual.update(f,0);assert.notEqual(sprite.material.map,map);
    visual.dispose();
  }
});

test("hair clones and armored Bozo share the new hair walk atlas without changing into a clothing skin",()=>{
 const atlas=[new THREE.Texture(),new THREE.Texture(),new THREE.Texture()];
 for(const clone of [true,false]) {
  const visual=new BozoRenderer(atlas,1,clone,new THREE.Texture(),new THREE.Texture());
  const f=createFighter('bozo',600,1);f.state='WalkForward';if(!clone)f.armorUntil=100;
  const sprite=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  const offsets=new Set<number>();
  for(let tick=0;tick<24;tick+=6){f.stateFrame=tick;visual.update(f,0);offsets.add(sprite.material.map!.offset.x);assert.equal(sprite.position.y-sprite.scale.y/2,0);}
  assert.equal(offsets.size,4);
  const walk=sprite.material.map;f.state='StandingAttack';f.move='jab';f.moveFrame=8;visual.update(f,0);assert.notEqual(sprite.material.map,walk);
  visual.dispose();
 }
});

test("Bozo keeps idle height and planted feet throughout both walking cycles in both skins",()=>{
 for(const skin of [0,1]){
  const visual=new BozoRenderer([new THREE.Texture(),new THREE.Texture(),new THREE.Texture()],skin,false,new THREE.Texture(),undefined,new THREE.Texture());
  const f=createFighter('bozo',600,1);
  const sprite=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  visual.update(f,0);const idleHeight=sprite.scale.y;
  for(const state of ['WalkForward','WalkBackward'] as const){
  const poses=new Set<number>();
  for(let tick=0;tick<36;tick++){
   f.state=state;f.stateFrame=tick;visual.update(f,0);
   poses.add(sprite.material.map!.offset.x);
   assert.ok(Math.abs(sprite.scale.y-idleHeight)<.025);
   assert.ok(Math.abs(sprite.position.y-sprite.scale.y/2)<1e-9);
  }
  assert.equal(poses.size,6);
  }
  visual.dispose();
 }
});
