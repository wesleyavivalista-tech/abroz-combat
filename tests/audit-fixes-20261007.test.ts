import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {periodicHit} from '../packages/game-core/combat/PeriodicHit.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.ts';
import {characters} from '../packages/game-core/characters/registry.ts';
import {FINAL_DEATH_FRAMES,ZOMBIE_RISE_FRAMES,ZOMBIE_CLAW,advanceUndead} from '../packages/game-core/simulation/UndeadSystem.ts';
import {UndeadVisuals} from '../apps/client/src/rendering/UndeadVisuals.ts';

function grave(){
 const g=new GameSimulation(['nikalz','gut','drupa']);g.state.phase='fight';
 g.state.fighters.forEach(f=>f.state='Idle');
 Object.assign(g.state.fighters[0],{lives:1,health:0});
 for(let i=0;i<=FINAL_DEATH_FRAMES;i++)g.step([0,0,0]);
 assert.equal(g.state.clones[0].fighter.undead,'grave');return g;
}

// A miss at startup must not consume the remaining active contact window.
test('zombie claw hits late entries once per target and not after its active window',()=>{
 const g=grave(),c=g.state.clones[0];c.fighter.health=0;
 for(let i=0;i<=ZOMBIE_RISE_FRAMES;i++)g.step([0,0,0]);
 Object.assign(c.fighter,{x:1000,y:0,vy:0,facing:1,state:'LightAttack',stun:0});
 Object.assign(c.undead!,{attackAt:g.state.frame-17,attackFrame:17,hit:false,target:1});
 g.state.fighters[1].x=1300;g.state.fighters[2].x=2200;
 const hp=g.state.fighters[1].health;
 advanceUndead(g.state,g.stage);
 assert.equal(c.undead!.attackFrame,ZOMBIE_CLAW.startupFrames);
 g.state.fighters[1].x=1075;g.state.frame++;advanceUndead(g.state,g.stage);
 assert.equal(c.undead!.attackFrame,19);assert.ok(g.state.fighters[1].health<hp);const hitHP=g.state.fighters[1].health;
 for(let i=0;i<5;i++){g.state.frame++;advanceUndead(g.state,g.stage);}
 assert.equal(g.state.fighters[1].health,hitHP);
 g.state.fighters[2].x=1075;const lateHP=g.state.fighters[2].health;g.state.frame++;advanceUndead(g.state,g.stage);assert.equal(g.state.fighters[2].health,lateHP);
});
// Escape must be legal immediately, before another movement tick.
test('fifth-hit escape respects both arena edges even through hitstop',()=>{
 const g=new GameSimulation(['dodo','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');
 const f=g.state.fighters[1];Object.assign(f,{x:40,consecutiveHits:4,lastStunHitFrame:0});
 g.hit(0,characters.dodo.moves.jab,0,false,1,-1);
 assert.equal(f.x,40);
 g.state.hitstop=3;g.step([0,0]);assert.equal(f.x,40);
 for(const direction of [-1,1])for(const periodic of [false,true]){
  const custom={...trainingRoom,width:3100};const sim=new GameSimulation(['dodo','gut'],false,custom);
  const target=sim.state.fighters[1],edge=direction<0?40:custom.width-40;
  Object.assign(target,{state:'Idle',x:edge,consecutiveHits:4,lastStunHitFrame:0});
  if(periodic)periodicHit(sim.state,target,1,direction,10,1,undefined,0,{},custom.width);
  else sim.hit(0,characters.dodo.moves.jab,0,false,1,direction);
  assert.equal(target.x,edge);
 }
});
// A predicted rise can be rolled back to the grave with the same entity ID.
test('rollback hides predicted zombie and restores grave lighting and menu visibility',()=>{
 const g=grave(),before=g.snapshot();
 const frames=Array.from({length:6},()=>({texture:new THREE.CanvasTexture(undefined),width:840,height:1100,pivot:420}));
 const v=new UndeadVisuals(()=>frames);v.update(g.state,false);
 g.state.clones[0].fighter.health=0;g.step([0,0,0]);v.update(g.state,false);
 const zombie=v.root.getObjectByName('zombie-nikalz')!;assert.ok(zombie.visible);
 g.restore(before);v.update(g.state,false);assert.equal(zombie.visible,false);
 let graveVisitors=0;v.forEachGrave(()=>graveVisitors++);assert.equal(graveVisitors,1);
 v.update(g.state,true);assert.equal(zombie.visible,false);
 g.state.clones[0].fighter.health=0;g.step([0,0,0]);v.update(g.state,false);assert.equal(zombie.visible,true);
 g.state.clones[0].fighter.characterId='gut';v.update(g.state,false);
 assert.equal(v.root.getObjectByName('zombie-nikalz'),undefined);assert.ok(v.root.getObjectByName('zombie-gut'));
 v.dispose();frames.forEach(f=>f.texture.dispose());
});
// The early tournament-forfeit result path bypasses normal fighter cleanup.
test('tournament forfeit clears attacks and deadlines without changing winner or health',()=>{
 const g=new GameSimulation(['drupa','gut'],false,undefined,undefined,undefined,true);g.state.phase='fight';
 const f=g.state.fighters[0];const m=Object.values(characters.drupa.moves).find(m=>m.beam)!;
 Object.assign(f,{move:m.id,state:m.state,moveFrame:m.startupFrames,actionUntil:500});
 g.step([0,0],[1]);assert.equal(g.state.phase,'result');assert.equal(f.move,null);assert.equal(f.actionUntil,0);assert.equal(g.state.winner,0);assert.equal(f.health,characters.drupa.stats.maxHealth);
});

test('escape retains open-space distance and cannot cross solid walls or house walls',()=>{
 for(const kind of ['wall','house'] as const){
  const g=new GameSimulation(['dodo','gut']);g.state.phase='fight';const f=g.state.fighters[1];
  const b={id:0,owner:0,move:'test',kind,phase:'built' as const,x:1100,y:0,width:100,height:240,health:1000,maxHealth:1000,createdAt:0,expiresAt:0,nextShot:0,shots:0,trapped:[],hits:{},facing:1 as const};
  g.state.structures=[b];Object.assign(f,{x:1000,y:0,state:'Idle',consecutiveHits:4,lastStunHitFrame:0});
  g.hit(0,characters.dodo.moves.jab,0,false,1,1);assert.equal(f.x,1019);
  Object.assign(f,{x:900,consecutiveHits:4,lastStunHitFrame:0,hitstunImmuneUntil:0});
  g.hit(0,characters.dodo.moves.jab,0,false,1,1);assert.equal(f.x,940);
  Object.assign(f,{x:1000,y:240,consecutiveHits:4,lastStunHitFrame:0,hitstunImmuneUntil:0});
  g.hit(0,characters.dodo.moves.jab,0,false,1,1);assert.equal(f.x,1040);assert.equal(f.y,240);
 }
});

test('late claw contacts preserve multi-target stamps across snapshot replay',()=>{
 const g=grave();g.state.clones[0].fighter.health=0;for(let i=0;i<=ZOMBIE_RISE_FRAMES;i++)g.step([0,0,0]);
 const c=g.state.clones[0];Object.assign(c.fighter,{x:1000,y:0,vy:0,facing:1,state:'LightAttack',stun:0});
 Object.assign(c.undead!,{attackAt:g.state.frame-17,attackFrame:17,hit:false,target:1});
 g.state.fighters[1].x=1075;g.state.fighters[2].x=2200;advanceUndead(g.state,g.stage);
 const hp=g.state.fighters[1].health,snapshot=g.snapshot();
 const run=()=>{g.state.fighters[2].x=1075;for(let i=0;i<6;i++){g.state.frame++;advanceUndead(g.state,g.stage);}};
 run();assert.equal(g.state.fighters[1].health,hp);assert.ok(g.state.fighters[2].health<characters.drupa.stats.maxHealth);
 const hash=hashState(g.state);g.restore(snapshot);run();assert.equal(hashState(g.state),hash);
});

test('elimination forfeit and ordinary final KO clear transient mode state',()=>{
 for(const format of [false,'elimination'] as const){
  const g=new GameSimulation(['jomp','gut'],false,undefined,undefined,undefined,format);g.state.phase='fight';
  const f=g.state.fighters[0];Object.assign(f,{state:'GymBro',move:'gymBro',gymTarget:1,gymStartedAt:1,gymNextRep:500,weaponUntil:500,actionUntil:500,jopaRide:7,grappleUntil:500,grappleOwner:1,trappedUntil:500});
  const hp=f.health,meter=f.meter;g.state.fighters[1].lives=1;g.state.fighters[1].health=0;
  g.step([0,0],format?[1]:[]);
  assert.equal(g.state.phase,'result');assert.equal(g.state.winner,0);assert.equal(f.move,null);
  assert.equal(f.actionUntil,0);assert.equal(f.weaponUntil,0);assert.equal(f.gymTarget,-1);
  assert.equal(f.jopaRide,undefined);assert.equal(f.grappleUntil,0);assert.equal(f.trappedUntil,0);
  assert.equal(f.health,hp);assert.equal(f.meter,meter);
 }
});
