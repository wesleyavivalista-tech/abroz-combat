import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {HairGripVisual,hairGripCatalog,hairGripVariant,hairGripPose,hairGripPath} from '../apps/client/src/rendering/HairGripVisual.js';
import {HairEffects} from '../apps/client/src/rendering/HairEffects.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {worldX} from '../apps/client/src/rendering/StageCoordinates.js';

test('every roster skin has transparent authored trap art, with separate transformed sheets',()=>{
 assert.deepEqual(Object.keys(hairGripCatalog).sort(),Object.keys(characters).sort());
 for(const [id,spec] of Object.entries(hairGripCatalog)){
  const f=createFighter(id,900,1);
  for(const [row,skin] of characters[id].skins!.entries())assert.equal(hairGripVariant(id,skin.id,f)?.row,row);
  for(const key of [id,...Object.keys(spec.extras??{}).map(form=>`${id}-${form}`)]){
   const png=readFileSync('apps/client/public'+hairGripPath(key));assert.equal(png[25],6,`${key} needs alpha`);
  }
 }
});
test('trap sequence uses authoritative remaining ticks, independent of render time and hit reactions',()=>{
 const f=createFighter('nikalz',900,1);f.state='HairTrapped';f.trappedUntil=1180;
 assert.equal(hairGripPose(f,1000),1);assert.equal(hairGripPose(f,1012),2);assert.equal(hairGripPose(f,1024),3);
 f.stateFrame=0;assert.equal(hairGripPose(f,1024),3,'another hit cannot restart the visual clock');
 assert.equal(hairGripPose(f,1160),4);assert.equal(hairGripPose(f,1172),5);assert.equal(hairGripPose(f,1180),null);
 for(const state of ['KO','Respawning','Idle','AirHitStun'] as const){f.state=state;assert.equal(hairGripPose(f,1050),null);}
 f.state='HairTrapped';f.health=0;assert.equal(hairGripPose(f,1050),null);
});
test('transformations retain their authored identity and stature',()=>{
 for(const [id,field,sheet,height,row] of [
  ['eide','weaponUntil','eide-mutant',3.52,0],['biel','angelUntil','biel-angel',2.25,0],
  ['drupa','weaponUntil','drupa-buda',5.25,0],['gut','weaponUntil','gut-spear',1.8,0],
  ['bozo','armorUntil','bozo',1.64,2],['roms','armorUntil','roms',1.81,2],['fausto','weaponUntil','fausto',1.66,2],
 ] as const){const f=createFighter(id,900,1);f[field]=999;assert.deepEqual(hairGripVariant(id,'original',f),{sheet,row,height});}
 const caio=createFighter('caio',900,1);caio.bloodMasterUntil=999;assert.equal(hairGripVariant('caio','black',caio)?.sheet,'caio-master-black');
 const eide=createFighter('eide',900,1);eide.loveMode=true;assert.equal(hairGripVariant('eide','gym',eide)?.sheet,'eide-love');
});
test('visual replaces body once, follows facing/position, restores on release and never changes gameplay',()=>{
 const root=new THREE.Group();let calls=0,disposed=false,textureDisposed=false;
 const base={root,update(){calls++;},dispose(){disposed=true;}};
 const frames=Array.from({length:12},()=>({texture:new THREE.CanvasTexture(undefined),width:100,height:160,pivot:50,referenceHeight:180}));
 frames.forEach(f=>f.texture.addEventListener('dispose',()=>{textureDisposed=true;}));
 const visual=new HairGripVisual(base,'nikalz','original',new Map([['nikalz',frames]]));
 const f=createFighter('nikalz',900,-1);f.state='HairTrapped';f.trappedUntil=180;f.y=120;
 const before=JSON.stringify(f);visual.update(f,0,12);visual.update(f,99,12);
 assert.equal(JSON.stringify(f),before);assert.equal(root.visible,false);assert.equal(visual.root.userData.hairGripActive,true);
 const body=visual.root.getObjectByName('hair-grip-body') as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 assert.equal(body.material.map,frames[2].texture);assert.ok(body.scale.x<0);assert.equal(body.position.x,worldX(900));
 assert.ok(Math.abs(body.position.y-body.scale.y/2-1.2)<1e-9);
 visual.root.position.set(2,5,0);visual.root.rotation.z=1;f.state='Idle';f.trappedUntil=0;visual.update(f,0,180);
 assert.equal(body.visible,false);assert.equal(root.visible,true);assert.equal(visual.root.userData.hairGripActive,false);
 assert.deepEqual(visual.root.position.toArray(),[0,0,0]);assert.equal(visual.root.rotation.z,0);assert.equal(calls,3);
 visual.dispose();assert.equal(disposed,true);assert.equal(textureDisposed,false);
});
test('missing art retains the existing body instead of making a fighter invisible',()=>{
 const root=new THREE.Group(),visual=new HairGripVisual({root,update(){},dispose(){}},'nikalz','original',new Map());
 const f=createFighter('nikalz',900,1);f.state='HairTrapped';f.trappedUntil=180;visual.update(f,0,0);
 assert.equal(root.visible,true);assert.equal(visual.root.userData.hairGripActive,false);visual.dispose();
});
test('authored fighter never receives the generic overlay; unsupported entities keep fallback',()=>{
 const simulation=new GameSimulation();const s=simulation.snapshot();const f=s.fighters[0];f.trappedUntil=s.frame+180;f.state='HairTrapped';
 const effect=new HairEffects();effect.update(s,false,new Set([f]));assert.equal(effect.root.children[0].visible,false);
 effect.update(s,false);assert.equal(effect.root.children[0].visible,true);
 effect.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
});
