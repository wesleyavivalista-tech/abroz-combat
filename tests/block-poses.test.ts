import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BlockVisual,blockVariant} from '../apps/client/src/rendering/BlockVisual.js';
import {gutPose} from '../apps/client/src/rendering/GutRenderer.js';
import {romsPose} from '../apps/client/src/rendering/RomsPose.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';

test('block artwork selects each outfit and transformation without overriding other actions',()=>{
 for(const [id,second] of [['drupa','purple'],['caio','black'],['gut','kung-fu']]){
  const f=createFighter(id,100,1);f.state='BlockStanding';if(id==='gut')f.weaponUntil=100;
  assert.equal(blockVariant(id,'original',f)?.index,0);assert.equal(blockVariant(id,second,f)?.index,1);
  if(id==='drupa'){f.weaponUntil=100;assert.deepEqual(blockVariant(id,second,f),{index:2,height:5.25});}
  if(id==='caio'){f.bloodMasterUntil=100;assert.equal(blockVariant(id,'original',f)?.index,2);assert.equal(blockVariant(id,second,f)?.index,3);}
  for(const state of ['Idle','BlockCrouching','AirHitStun','KO','LightAttack'] as const){f.state=state;assert.equal(blockVariant(id,second,f),undefined);}
  f.state='BlockStanding';f.jopaRide=0;assert.equal(blockVariant(id,second,f),undefined);delete f.jopaRide;
  f.stun=2;assert.equal(blockVariant(id,second,f),undefined);f.stun=0;f.move='air';assert.equal(blockVariant(id,second,f),undefined);
 }
});
test('existing Gut and Roms defensive frames retain skin and armor selection',()=>{
 const gut=createFighter('gut',100,1);gut.state='BlockStanding';assert.equal(gutPose(gut),16);gut.state='BlockCrouching';assert.equal(gutPose(gut),19);
 const roms=createFighter('roms',100,1);roms.weaponUntil=100;
 for(const skin of [0,1])for(const armor of [0,100]){roms.armorUntil=armor;roms.state='BlockStanding';assert.deepEqual(romsPose(roms,skin),{sheet:armor?9:1+skin,pose:14});roms.state='BlockCrouching';assert.deepEqual(romsPose(roms,skin),{sheet:armor?9:1+skin,pose:10});}
});
test('block rendering restores body visibility, preserves effects and never mutates fighter state',()=>{
 const root=new THREE.Group(),body=new THREE.Group(),weapon=new THREE.Group(),effect=new THREE.Group();weapon.visible=false;root.add(body,weapon,effect);
 const texture=new THREE.CanvasTexture(undefined);let textureDisposed=false;texture.addEventListener('dispose',()=>{textureDisposed=true;});
 const frame={texture,width:100,height:160,pivot:50};
 const visual=new BlockVisual({root,fallBodies:[body,weapon],update(){},dispose(){}},'caio','original',new Map([['caio',[frame,frame,frame,frame]]]));
 const f=createFighter('caio',100,1);f.state='BlockStanding';const before=structuredClone(f);
 visual.update(f,0);visual.update(f,1);assert.deepEqual(f,before);assert.equal(body.visible,false);assert.equal(effect.visible,true);assert.equal(root.getObjectByName('standing-block')?.visible,true);
 f.state='Idle';visual.update(f,2);assert.equal(body.visible,true);assert.equal(weapon.visible,false);assert.equal(root.getObjectByName('standing-block')?.visible,false);
 f.state='BlockStanding';visual.update(f,3);visual.dispose();assert.equal(body.visible,true);assert.equal(textureDisposed,false);
});
