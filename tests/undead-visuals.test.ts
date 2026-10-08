import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {graveDamagePose,graveRubbleOpacity} from '../apps/client/src/rendering/GraveArt.js';
import {UndeadVisuals} from '../apps/client/src/rendering/UndeadVisuals.js';
import {ZombieSpriteRenderer,zombieSpritePose,zombieAirGroups} from '../apps/client/src/rendering/ZombieSpriteRenderer.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {existsSync} from 'node:fs';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {FINAL_DEATH_FRAMES,ZOMBIE_RISE_FRAMES} from '../packages/game-core/simulation/UndeadSystem.js';

test('cross grave cracks, dedicated zombie rise/death transforms and teardown',()=>{
 const g=new GameSimulation(['nikalz','jopa','gut']);g.state.phase='fight';g.state.fighters[0].lives=1;g.state.fighters[0].health=0;
 const run=(n:number)=>{for(let i=0;i<n;i++)g.step([0,0,0]);};run(1+FINAL_DEATH_FRAMES);
 const art={texture:new THREE.CanvasTexture(undefined),width:840,height:1100,pivot:420};const frames=Array.from({length:6},()=>({...art,texture:new THREE.CanvasTexture(undefined)}));const visual=new UndeadVisuals(()=>frames);visual.update(g.state,false);const count=()=>{let n=0;visual.root.traverseVisible(o=>{if(o instanceof THREE.Line)n++;});return n;};
 const stone=visual.root.children[0].children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 assert.ok(stone.geometry instanceof THREE.PlaneGeometry);assert.equal(stone.material.map,frames[0].texture);
 assert.ok(stone.scale.x<=.84&&stone.scale.y<=1.10);assert.equal(stone.position.y,stone.scale.y/2);
 assert.equal(count(),0);g.state.clones[0].fighter.health=400;visual.update(g.state,false);assert.equal(count(),0);assert.equal(stone.material.map,frames[2].texture);
 g.state.clones[0].fighter.health=0;run(1);visual.update(g.state,false);
 assert.equal(stone.material.map,frames[3].texture);
 const body=visual.root.getObjectByName('zombie-nikalz')!;assert.ok(body);
 const initialY=body.position.y;run(30);visual.update(g.state,false);assert.ok(body.position.y>initialY);assert.equal(stone.material.map,frames[5].texture);
 const transform=body.matrix.clone();visual.update(g.state,false);assert.deepEqual(body.matrix,transform);
 run(ZOMBIE_RISE_FRAMES);visual.update(g.state,false);assert.equal(body.scale.y,1);
 g.state.clones[0].fighter.health=0;run(1);visual.update(g.state,false);run(35);visual.update(g.state,false);assert.ok(((body.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity<1);
 let disposed=0;body.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.addEventListener('dispose',()=>disposed++);});
 g.state.clones=[];visual.update(g.state,false);assert.equal(visual.root.children.length,0);assert.ok(disposed>0);const total=disposed;visual.dispose();assert.equal(disposed,total);
});

test('illustrated zombie uses flat authored poses, distance-driven steps and exact claw contact',()=>{
 const g=new GameSimulation(['nikalz','jopa','gut']);const f=g.state.fighters[0];f.undead='zombie';f.state='WalkForward';
 const u={phaseAt:0,target:1,nextAttack:0,attackAt:0,attackFrame:0,hit:false,stuck:0,lastX:f.x,spawnX:f.x,spawnY:f.y};
 const frames=Array.from({length:10},(_,i)=>({texture:new THREE.CanvasTexture({} as HTMLCanvasElement),width:i===7?400:240,height:i===7?90:400,pivot:100,referenceHeight:i>=8?500:400}));
 const model=new ZombieSpriteRenderer('nikalz',frames);model.update(f,u,10);
 assert.ok(model.sprite.geometry instanceof THREE.PlaneGeometry);assert.ok(model.sprite.material instanceof THREE.MeshBasicMaterial);
 assert.equal(model.sprite.material.map,frames[1].texture);
 for(let i=0;i<3;i++){f.x+=7;model.update(f,u,11+i);}assert.equal(model.sprite.material.map,frames[2].texture);
 const texture=model.sprite.material.map;model.update(f,u,13);model.update(f,u,14);assert.equal(model.sprite.material.map,texture,'stationary feet do not keep cycling');
 f.state='LightAttack';u.attackFrame=17;model.update(f,u,15);assert.equal(model.sprite.material.map,frames[4].texture);
 u.attackFrame=18;model.update(f,u,16);assert.equal(model.sprite.material.map,frames[5].texture);
 u.attackFrame=24;model.update(f,u,17);assert.equal(model.sprite.material.map,frames[0].texture);
 f.stun=2;assert.equal(zombieSpritePose(f,u,18,0),6);f.stun=0;
 f.facing=-1;model.update(f,u,18);assert.equal(model.root.scale.x,-1);
 f.state='Jump';f.y=150;model.update(f,u,19);assert.equal(model.sprite.material.map,frames[8].texture);assert.equal(model.root.position.y,1.5);assert.ok(Math.abs(model.sprite.scale.y-400*1.7/500)<1e-9);
 f.state='Fall';model.update(f,u,20);assert.equal(model.sprite.material.map,frames[9].texture);
 f.stun=2;model.update(f,u,21);assert.equal(model.sprite.material.map,frames[6].texture);f.stun=0;
 f.state='Idle';f.y=0;model.update(f,u,22);assert.equal(model.sprite.material.map,frames[0].texture);assert.equal(model.root.position.y,0);
 f.undead='dying';u.phaseAt=10;model.update(f,u,30);assert.equal(model.sprite.material.map,frames[7].texture);assert.equal(model.sprite.scale.y,90*1.7/400);
 let disposed=0;frames.forEach(f=>f.texture.addEventListener('dispose',()=>disposed++));model.dispose();assert.equal(disposed,0,'instances must not dispose shared art');frames.forEach(f=>f.texture.dispose());
});

test('every zombie has exactly one airborne artwork row and all sheets are shipped',()=>{
 const ids=zombieAirGroups.flat();
 assert.equal(new Set(ids).size,ids.length);assert.deepEqual([...ids].sort(),Object.keys(characters).sort());
 zombieAirGroups.forEach((_,i)=>assert.ok(existsSync(new URL(`../apps/client/public/art/zombies/air-${i}-v1.png`,import.meta.url))));
});

test('grave damage and collapse frames follow health and simulation age',()=>{
 assert.deepEqual([1000,778,518,278].map(h=>graveDamagePose(h,false,0)),[0,1,2,3]);
 assert.deepEqual([0,9,10,23,24,59].map(age=>graveDamagePose(1000,true,age)),[3,3,4,4,5,5]);
 assert.equal(graveRubbleOpacity(24),1);assert.equal(graveRubbleOpacity(60),0);
 assert.ok(graveRubbleOpacity(50)>0&&graveRubbleOpacity(50)<1);
});
