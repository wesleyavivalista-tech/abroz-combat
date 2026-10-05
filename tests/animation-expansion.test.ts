import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {attackPhase,actionMotion} from '../apps/client/src/rendering/ActionMotion.js';
import {ExpandedAnimation,expansionFrame} from '../apps/client/src/rendering/ExpandedAnimation.js';
import {SpriteIsolation} from '../apps/client/src/rendering/SpriteIsolation.js';
import {GutSpearVisual,GUT_SPEAR_LENGTH} from '../apps/client/src/rendering/GutSpearVisual.js';
test('all basic attacks retain impact frames and get anticipation, recoil and settled guard',()=>{
 for(const [id,moves] of Object.entries({tocha:['jab','cross','finisher','heavy','double'],bozo:['jab','cross','beard','heavy','kick'],gut:['palm','cross','finish','axe','swing']})){
  const f=createFighter(id,500,1);
  for(const name of moves){const m=characters[id].moves[name];f.move=name;f.state=m.state;f.moveFrame=0;assert.notEqual(expansionFrame(f,id as 'tocha'|'bozo'|'gut'),null);
   f.moveFrame=m.startupFrames;assert.equal(attackPhase(f.moveFrame,m),'strike');assert.equal(expansionFrame(f,id as 'tocha'|'bozo'|'gut'),null);
   f.moveFrame=m.startupFrames+m.activeFrames+Math.ceil(m.recoveryFrames*.5);assert.equal(attackPhase(f.moveFrame,m),'recoil');assert.notEqual(expansionFrame(f,id as 'tocha'|'bozo'|'gut'),null);
   assert.equal(attackPhase(m.startupFrames+m.activeFrames+m.recoveryFrames-1,m),'guard');
  }
 }
});
test('Tocha has six distinct grounded walk poses per skin with constant height and uniform scale',()=>{
 for(const skin of [0,1])for(const state of ['WalkForward','WalkBackward']){
  const animation=new ExpandedAnimation(new THREE.Texture(),'tocha');const sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());const isolation=new SpriteIsolation(sprite.material);const f=createFighter('tocha',500,1);f.state=state;const poses=new Set();
  for(let i=0;i<6;i++){f.stateFrame=i*(state==='WalkBackward'?6:5);animation.apply(f,skin,sprite,isolation);poses.add(sprite.material.map!.offset.toArray().join());assert.ok(Math.abs(sprite.scale.y-1.74)<1e-9);assert.ok(Math.abs(sprite.position.y-sprite.scale.y/2)<1e-9);}
  assert.equal(poses.size,6);animation.dispose();sprite.geometry.dispose();sprite.material.dispose();
 }
});
test('clone in-betweens alternate with existing steps, and action movement freezes with simulation time',()=>{
 const f=createFighter('bozo',500,1);f.state='WalkForward';const poses=[];
 for(let i=0;i<8;i++){f.stateFrame=i*3;poses.push(expansionFrame(f,'clone'));}
 assert.deepEqual(poses,[null,0,null,1,null,2,null,3]);
 f.move='heavy';f.moveFrame=10;const before=JSON.stringify(f),motion=actionMotion(f,characters.bozo.moves.heavy);
 for(let i=0;i<100;i++)assert.deepEqual(actionMotion(f,characters.bozo.moves.heavy),motion);
 assert.equal(JSON.stringify(f),before);
});
test('spear transitions keep fixed geometry and length without changing simulation',()=>{
 for(const skin of [0,1])for(const name of ['thrust','sweep','spearHeavy','spearSwing','spearLow','spearDive']){
  const visual=new GutSpearVisual(new THREE.Texture(),new THREE.Texture()),f=createFighter('gut',500,1);f.move=name;f.state='MediumAttack';const m=characters.gut.moves[name];
  const geometry=Array.from(visual.blade.geometry.attributes.position.array);
  for(let frame=0;frame<m.startupFrames+m.activeFrames+m.recoveryFrames;frame++){
   f.moveFrame=frame;const snapshot=JSON.stringify(f);visual.update(f,skin);assert.equal(JSON.stringify(f),snapshot);assert.deepEqual(Array.from(visual.blade.geometry.attributes.position.array),geometry);assert.deepEqual(visual.blade.scale.toArray(),[1,1,1]);assert.ok(Number.isFinite(visual.weapon.rotation.z));
  }
  assert.equal(visual.blade.geometry.parameters.width,GUT_SPEAR_LENGTH);visual.dispose();
 }
});
