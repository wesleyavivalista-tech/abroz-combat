import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DrupaRenderer,drupaPose} from '../apps/client/src/rendering/DrupaRenderer.js';
import {drupaAtlases} from '../apps/client/src/rendering/DrupaAtlas.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {characters} from '../packages/game-core/characters/registry.js';
test('Drupa selects valid drawn poses for every move in both skins and returns from transformation',()=>{
 for(const skin of [0,1]){
  const textures=[0,1,2,3,4,5,6,7].map(i=>{const t=new THREE.Texture();t.name=String(i);return t;});
  const v=new DrupaRenderer(textures,skin),f=createFighter('drupa',500,1);
  const mesh=v.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  const geometry=Array.from(mesh.geometry.attributes.position.array);
  for(const weapon of [0,1000])for(const [id,m] of Object.entries(characters.drupa.moves))for(const tick of [0,m.startupFrames,m.startupFrames+m.activeFrames+4]){
   f.weaponUntil=weapon;f.move=id;f.moveFrame=tick;v.update(f);
   const buda=weapon>0||['buda','budaBeam'].includes(id),data=drupaAtlases[buda?'buda-complete-v4':skin?'atlas-2':'atlas-1'];
   assert.ok(data.frames[drupaPose(f,buda)]);assert.equal(mesh.material.map?.name,buda?'2':['swing1','swing2'].includes(id)?'7':['belly','bellyFinish'].includes(id)?'6':id==='bellyDive'?'3':String(skin));
   assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),geometry);
   assert.ok(mesh.scale.x>0&&mesh.scale.y>0);
  }
  f.move=null;f.weaponUntil=0;f.state='Idle';v.update(f);assert.equal(mesh.material.map?.name,'6');
  v.dispose();
 }
});
test('forward dash uses authored frames in both skins and facings with a fixed scale and grounded feet',()=>{
 for(const skin of [0,1])for(const facing of [1,-1] as const){
  const textures=[0,1,2,3,4,5,6,7].map(i=>{const t=new THREE.Texture();t.name=String(i);return t;});
  const visual=new DrupaRenderer(textures,skin),f=createFighter('drupa',500,facing);
  const mesh=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  f.state='DashForward';const crops=new Set<string>();
  const atlas=drupaAtlases['dash-forward-v1'],base=atlas.frames[skin*5+4],scale=1.75/(base[3]-base[1]);
  for(let tick=0;tick<12;tick++){
   f.stateFrame=tick;visual.update(f);assert.equal(mesh.material.map?.name,'4');
   crops.add(mesh.material.map!.offset.toArray().join(','));
   assert.ok(Math.abs(mesh.position.y-mesh.scale.y/2)<1e-9);
   assert.ok(Math.abs(mesh.scale.y/(mesh.material.map!.repeat.y*atlas.height)-scale)<1e-9);
   assert.equal(visual.root.scale.x,facing);
  }
  assert.equal(crops.size,5);
  f.state='Idle';visual.update(f);assert.equal(mesh.material.map?.name,'6');
  f.state='DashBackward';visual.update(f);assert.equal(mesh.material.map?.name,String(skin));visual.dispose();
 }
});
test('White Buda punches retain standing height and Drupa second punch has distinct preparation and recovery',()=>{
 const textures=Array.from({length:8},(_,i)=>{const t=new THREE.Texture();t.name=String(i);return t;});
 for(const skin of [0,1]){
  const visual=new DrupaRenderer(textures,skin),f=createFighter('drupa',500,1),mesh=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  f.weaponUntil=1000;visual.update(f);const height=mesh.scale.y;
  for(const id of ['budaSwing1','budaSwing2','budaFinish']){f.move=id;const m=characters.drupa.moves[id];for(const frame of [0,m.startupFrames,m.startupFrames+m.activeFrames+2]){f.moveFrame=frame;visual.update(f);assert.equal(mesh.material.map?.name,'2');assert.ok(Math.abs(mesh.scale.y-height)<.07,'punch must not crouch or change body scale');}}
  f.weaponUntil=0;f.move='swing2';const crops=new Set<string>();for(const frame of [0,7,10,16]){f.moveFrame=frame;visual.update(f);assert.equal(mesh.material.map?.name,'7');crops.add(mesh.material.map!.offset.toArray().join(','));}assert.equal(crops.size,4);visual.dispose();
 }
});
test('every White Buda movement uses the same complete atlas and anatomical scale',()=>{
 const textures=Array.from({length:6},(_,i)=>{const t=new THREE.Texture();t.name=String(i);return t;}),visual=new DrupaRenderer(textures,0),f=createFighter('drupa',500,1);
 const mesh=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>,atlas=drupaAtlases['buda-complete-v4'];f.weaponUntil=1000;
 const pixelScale=5.25/(atlas.frames[0][3]-atlas.frames[0][1]);
 for(const state of ['Idle','WalkForward','WalkBackward','DashForward','DashBackward','Jump','Fall','Crouch','HitStunStanding'] as const)for(const tick of [0,7,14,21]){
  f.state=state;f.stateFrame=tick;visual.update(f);assert.equal(mesh.material.map?.name,'2');assert.ok(Math.abs(mesh.scale.y/(mesh.material.map!.repeat.y*atlas.height)-pixelScale)<1e-9);
 }
 assert.ok(mesh.material.color.r<.85,'sprite whites must stay below scene bloom threshold');visual.dispose();
});

test('Drupa uses distinct jab and opposite-arm cross crops and a stable authored walk scale',async()=>{
 const {drupaMotionData}=await import('../apps/client/src/rendering/drupaMotionData.js');
 for(const skin of [0,1]){
  const v=new DrupaRenderer(Array.from({length:8},()=>new THREE.Texture()),skin),f=createFighter('drupa',500,1),mesh=v.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  f.move='swing1';f.moveFrame=characters.drupa.moves.swing1.startupFrames;v.update(f);const jab=mesh.material.map!.offset.toArray();
  f.move='swing2';f.moveFrame=characters.drupa.moves.swing2.startupFrames;v.update(f);assert.notDeepEqual(mesh.material.map!.offset.toArray(),jab);
  f.move=null;f.state='WalkForward';const scales:number[]=[],crops=new Set<string>();
  for(const frame of [0,8,16,24]){f.stateFrame=frame;v.update(f);scales.push(mesh.scale.y/(mesh.material.map!.repeat.y*drupaMotionData.height));crops.add(mesh.material.map!.offset.toArray().join());assert.equal(mesh.position.y,mesh.scale.y/2);}
  assert.equal(crops.size,3);assert.ok(scales.every(x=>Math.abs(x-scales[0])<1e-9));v.dispose();
 }
});

 test('Drupa motion and full-body punches retain their authored scale in both skins',async()=>{
 const {drupaMotionData}=await import('../apps/client/src/rendering/drupaMotionData.js');
 const {drupaPunchData}=await import('../apps/client/src/rendering/drupaPunchData.js');
 for(const skin of [0,1])for(const facing of [1,-1] as const){
  const visual=new DrupaRenderer(Array.from({length:8},(_,i)=>{const t=new THREE.Texture();t.name=String(i);return t;}),skin),f=createFighter('drupa',500,facing);
  const mesh=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  const base=drupaMotionData.frames[skin*8],scale=1.75/(base[3]-base[1]);
  for(const state of ['Idle','WalkForward','WalkBackward'] as const)for(const move of [null,'swing1','swing2','bellyFinish'])for(const tick of [0,8,16,24]){
   f.state=state;f.move=move;f.moveFrame=tick;f.stateFrame=tick;visual.update(f);
   const m=move?characters.drupa.moves[move]:undefined;
   const punching=m&&['swing1','swing2'].includes(move!)&&tick<m.startupFrames+m.activeFrames+7;
   const data=punching?drupaPunchData:drupaMotionData;
   const ref=data.frames[skin*8];
   assert.equal(mesh.material.map?.name,punching?'7':'6');
   assert.ok(Math.abs(mesh.scale.y/(mesh.material.map!.repeat.y*data.height)-(punching?1.75/(ref[3]-ref[1]):scale))<1e-9);
   assert.equal(mesh.position.y,mesh.scale.y/2);assert.equal(visual.root.scale.x,facing);
  }
  visual.dispose();
 }
});
