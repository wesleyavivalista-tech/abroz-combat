import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {activateStructure,hitStructureProjectile} from '../packages/game-core/simulation/StructureSystem.js';
import {initializeProjectile} from '../packages/game-core/simulation/ProjectilePool.js';
import {hitboxes,hurtbox,sweepEntry} from '../packages/game-core/combat/CollisionSystem.js';

for(const movingAway of [true,false])test(`projectile/structure ordering uses moving target trajectory (${movingAway?'away':'across'})`,()=>{
 const g=new GameSimulation(['luizinho','gut']);g.state.phase='fight';
 const [owner,target]=g.state.fighters;owner.x=500;owner.y=target.y=0;target.state='Idle';
 activateStructure(g.state,g.stage,owner,0,characters.luizinho.moves.wall);
 // An enemy-owned wall blocks this shot, and the fighter can be hit independently.
 const wall=g.state.structures![0];wall.owner=1;wall.x=500;
 target.x=movingAway?800:200;target.y=0;
 const old={x:200,y:movingAway?0:1000};
 const p=g.state.projectiles[0];initializeProjectile(p,{active:true,owner:0,move:'seller',serial:1,x:1000,y:80,vx:1000,life:20});
 const radius=characters.luizinho.moves.seller.projectile!.radius??22;
 const time=sweepEntry(hurtbox(target),target.x-old.x,80+target.y-old.y,1000,80,radius);
 assert.equal(time<.4,movingAway);
 const hp=wall.health;
 assert.equal(hitStructureProjectile(g.state,p,{x:0,y:80},g.stage,new Map([[target,old]])),!movingAway);
 assert.equal(wall.health<hp,!movingAway);
});

for(const stage of Object.values(stages))test(`${stage.id}: roster high-speed falls land and knockback remains bounded`,()=>{
 for(const id of Object.keys(characters)){
  const g=new GameSimulation([id,'gut']);g.stage=stage;g.state.phase='fight';
  const [f,other]=g.state.fighters;other.x=2200;other.y=0;other.state='Idle';
  Object.assign(f,{x:1200,y:1500,vy:-2000,state:'Fall',vx:0});
  g.step([0,0]);assert.ok(f.y>=stage.floorHeight,`${id} fell through floor`);assert.equal(f.vy,0);
  Object.assign(f,{x:1200,y:1400,vx:10000,vy:0,stun:20,state:'AirHitStun'});
  g.step([0,0]);assert.ok(f.x>=40&&f.x<=stage.width-40,`${id} escaped boundary`);
 }
});

test('all authored hitboxes respect startup and active-window boundaries',()=>{
 for(const [id,c] of Object.entries(characters)){
  const f=new GameSimulation([id,'gut']).state.fighters[0];
  for(const m of Object.values(c.moves)){
   f.move=m.id;f.moveFrame=m.startupFrames-1;assert.equal(hitboxes(f,m).length,0,`${id}/${m.id} startup`);
   f.moveFrame=m.startupFrames+m.activeFrames;assert.equal(hitboxes(f,m).length,0,`${id}/${m.id} recovery`);
   if(m.activeFrames>0){f.moveFrame=m.startupFrames;assert.equal(hitboxes(f,m).length,m.hitboxes.length);}
  }
 }
});

for(const stage of Object.values(stages))test(`${stage.id}: simulation damages moving fighter before wall`,()=>{
 const g=new GameSimulation(['luizinho','gut']);g.stage=stage;g.state.phase='fight';
 const [owner,target]=g.state.fighters;Object.assign(owner,{x:500,y:0,state:'Idle'});
 activateStructure(g.state,stage,owner,0,characters.luizinho.moves.wall);
 const wall=g.state.structures![0];wall.owner=1;wall.x=500;owner.x=100;
 Object.assign(target,{x:200,y:10,vx:600,vy:0,stun:10,state:'AirHitStun'});
 initializeProjectile(g.state.projectiles[0],{active:true,owner:0,move:'seller',serial:1,x:0,y:80,vx:1000,life:20});
 const hp=target.health,wallHP=wall.health;g.step([0,0]);
 assert.ok(target.health<hp);assert.equal(wall.health,wallHP);assert.equal(g.state.projectiles[0].active,false);
});
