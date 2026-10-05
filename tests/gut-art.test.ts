import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GutRenderer} from '../apps/client/src/rendering/GutRenderer.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {characters} from '../packages/game-core/characters/registry.js';
test('Gut walking preserves head height and grounded feet while cycling six distinct poses in both directions and skins',()=>{
 for(const skin of [0,1])for(const state of ['WalkForward','WalkBackward']){
  const v=new GutRenderer(Array.from({length:8},()=>new THREE.Texture()),skin),f=createFighter('gut',500,1);
  const sprite=v.root.children[0] as THREE.Mesh;f.state=state;const offsets=new Set();
  for(let i=0;i<6;i++){f.stateFrame=i*(state==='WalkBackward'?7:6);v.update(f,0);assert.ok(Math.abs(sprite.scale.y-1.8)<.001);assert.ok(Math.abs(sprite.position.y-sprite.scale.y/2)<.001);const map=(sprite.material as THREE.MeshBasicMaterial).map!;offsets.add(`${map.offset.x},${map.offset.y}`);}
  assert.equal(offsets.size,6);v.dispose();
 }
});
test('Gut uses one rigid full-length spear for standing, walking and every attack in both skins',()=>{
 for(const skin of [0,1]){
  const v=new GutRenderer(Array.from({length:5},()=>new THREE.Texture()),skin),f=createFighter('gut',500,1);f.weaponUntil=1000;
  const group=v.root.children[2] as THREE.Group;
  const weapon=group.children[1] as THREE.Group;
  const blade=weapon.children[0] as THREE.Mesh;
  const positions=Array.from(blade.geometry.attributes.position.array);
  for(const state of ['Idle','WalkForward','WalkBackward','DashForward','thrust','sweep','spearFinish','spearSwing','spearLow','spearAir','spearHeavy','spearDive']){
   f.move=characters.gut.moves[state]?state:null;f.state=f.move?'AirAttack':state;f.moveFrame=7;
   v.update(f,0);assert.equal(group.visible,true);assert.deepEqual(Array.from(blade.geometry.attributes.position.array),positions);assert.deepEqual(blade.scale.toArray(),[1,1,1]);
   blade.geometry.computeBoundingBox();assert.ok(Math.abs(blade.geometry.boundingBox!.max.x-blade.geometry.boundingBox!.min.x-4.3)<.001);
  }
  f.weaponUntil=0;f.move=null;f.state='Idle';v.update(f,0);assert.equal(group.visible,false);v.dispose();
 }
});
test('Gut spear grip stays fixed through impact and early recovery: only the authored arms extend it',()=>{
 for(const skin of [0,1]){
  const v=new GutRenderer(Array.from({length:5},()=>new THREE.Texture()),skin),f=createFighter('gut',500,1);f.weaponUntil=1000;
  const weapon=(v.root.children[2] as THREE.Group).children[1];
  for(const name of ['thrust','sweep','spearFinish','spearHeavy','spearSwing','spearLow']){
   f.move=name;f.state='MediumAttack';const m=characters.gut.moves[name];f.moveFrame=m.startupFrames;v.update(f,0);const position=weapon.position.toArray(),rotation=weapon.rotation.z;
   for(let n=0;n<4;n++){f.moveFrame=m.startupFrames+m.activeFrames+n;v.update(f,0);assert.deepEqual(weapon.position.toArray(),position);assert.equal(weapon.rotation.z,rotation);}
  }
  v.dispose();
 }
});
