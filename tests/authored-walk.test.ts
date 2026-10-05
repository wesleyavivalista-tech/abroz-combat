import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AuthoredWalk,authoredWalkFrame} from '../apps/client/src/rendering/AuthoredWalk.js';
import {walkAtlases,type WalkCharacter} from '../apps/client/src/rendering/WalkAtlas.js';
import {SpriteIsolation} from '../apps/client/src/rendering/SpriteIsolation.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {GutSpearVisual,GUT_SPEAR_LENGTH} from '../apps/client/src/rendering/GutSpearVisual.js';

test('spear body restores its atlas after walking for idle, attacks and airborne poses in both skins',()=>{
 for(const skin of [0,1])for(const facing of [1,-1] as const){
  const atlas=new THREE.Texture();atlas.name='spear-body';
  const walks=walkAtlases.spear.sources.map((_,i)=>{const t=new THREE.Texture();t.name=`walk-${i}`;return t;});
  const visual=new GutSpearVisual(atlas,new THREE.Texture(),walks);
  const body=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  const f=createFighter('gut',1200,facing);
  for(const state of ['Idle','Crouch','Jump','Fall','DashBackward','SpecialMove']){
   for(const phase of [0,7,14,21]){
    f.move=null;f.state='WalkForward';f.stateFrame=phase;visual.update(f,skin);
    assert.match(body.material.map!.name,/^walk-/);
    f.state=state;f.move=state==='SpecialMove'?'spearHeavy':null;f.moveFrame=25;
    visual.update(f,skin);
    assert.equal(body.material.map!.name,'spear-body',`${skin}: ${state} after walk ${phase}`);
    assert.ok(body.scale.x>0&&body.scale.y>0);
   }
  }
  visual.dispose();
 }
});

test('drawn walking never changes artwork geometry or its aspect ratio, in every skin and direction',()=>{
 for(const kind of Object.keys(walkAtlases) as WalkCharacter[])for(const skin of kind==='clone'?[0]:[0,1]){
  const data=walkAtlases[kind],animation=new AuthoredWalk(data.sources.map(()=>new THREE.Texture()),kind);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial()),isolation=new SpriteIsolation(mesh.material);
  const original=Array.from(mesh.geometry.attributes.position.array),f=createFighter(kind==='clone'?'bozo':kind==='spear'?'gut':kind,1200,1);
  for(const state of ['WalkForward','WalkBackward']){
   f.state=state;const poses=new Set();
   for(let tick=0;tick<64;tick++){
    f.stateFrame=tick;const before=JSON.stringify(f);assert.equal(animation.apply(f,skin,mesh,isolation),true);
    const frame=data.frames[skin*4+authoredWalkFrame(f)!],[l,t,r,b]=frame.bounds;
    assert.ok(Math.abs(mesh.scale.x/mesh.scale.y-(r-l+2)/(b-t+2))<1e-10,'uniform scale only');
    assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),original,'no bending or stretching vertices');
    assert.equal(JSON.stringify(f),before);assert.ok(Math.abs(mesh.position.y-mesh.scale.y/2)<1e-10);
    poses.add(mesh.material.map!.image+':'+frame.atlas+':'+frame.bounds.join());
    const position=mesh.position.toArray();animation.apply(f,skin,mesh,isolation);assert.deepEqual(mesh.position.toArray(),position);
   }
   assert.equal(poses.size,4);
  }
  f.move='jab';assert.equal(animation.apply(f,skin,mesh,isolation),false);
  animation.dispose();mesh.geometry.dispose();mesh.material.dispose();
 }
});

test('spear retains fixed length and stays on the drawn rear hand through both walking halves',()=>{
 for(const skin of [0,1]){
  const data=walkAtlases.spear,visual=new GutSpearVisual(new THREE.Texture(),new THREE.Texture(),data.sources.map(()=>new THREE.Texture()));
  const f=createFighter('gut',1200,1);f.state='WalkForward';
  for(let i=0;i<4;i++){
   f.stateFrame=i*7;visual.update(f,skin);const frame=data.frames[skin*4+i],scale=data.height/frame.height,[x,y]=frame.grips!,angle=visual.weapon.rotation.z;
   assert.ok(Math.abs(visual.weapon.position.x+Math.cos(angle)*.85-(x-frame.pivot)*scale)<1e-9);
   assert.ok(Math.abs(visual.weapon.position.y+Math.sin(angle)*.85-(frame.bounds[3]-y)*scale)<1e-9);
   assert.equal(visual.blade.geometry.parameters.width,GUT_SPEAR_LENGTH);assert.deepEqual(visual.blade.scale.toArray(),[1,1,1]);
  }
  visual.dispose();
 }
});
