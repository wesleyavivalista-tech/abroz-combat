import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {activateNikalz,advanceNikalz,spawnBees,beePosition,foreheadWave,meteorDamage,NIKALZ} from '../packages/game-core/simulation/NikalzSystem.js';
import {activateStructure,damageStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {movementSlow} from '../packages/game-core/simulation/BloodSystem.js';
import {resolveHit} from '../packages/game-core/combat/CombatSystem.js';
const game=(ids=['nikalz','gut'])=>{const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.meter=100;f.x=400+i*1000;f.y=g.stage.floorHeight;});return g;};
const run=(g:GameSimulation,n:number,input=0)=>{for(let i=0;i<n;i++)g.step([input,0]);};
const fresh=(g:GameSimulation,input:number)=>{const f=g.state.fighters[0];f.move=null;f.state='Idle';f.buffer=[];f.previousInput=0;g.step([input,0]);};
test('four basic presses chain jab straight cross forehead; held input does not auto-chain',()=>{
 const g=game(),f=g.state.fighters[0];g.step([Button.Light,0]);assert.equal(f.move,'jab');
 for(const next of ['straight','cross','forehead']){run(g,12);g.step([Button.Light,0]);run(g,7);assert.equal(f.move,next);}
 const held=game();run(held,80,Button.Light);assert.equal(held.state.fighters[0].attackSerial,1);
});
test('double jump second basic is the forehead dive; a hit stuns exactly two seconds',()=>{
 const g=game(),f=g.state.fighters[0],d=g.state.fighters[1];f.y=300;f.airJumpUsed=true;f.airJumpsUsed=1;f.state='Jump';g.step([Button.Medium,0]);assert.equal(f.move,'foreheadDive');
 resolveHit(g.state,g.stage,()=>{},0,characters.nikalz.moves.foreheadDive,0,false,1);assert.equal(d.nikalzStunUntil,g.state.frame+120);run(g,119);assert.ok(d.stun>0);run(g,1);assert.equal(d.stun,0);
});
test('regular swarm persists, loops, hits one enemy once and slows movement 40% for 3 seconds',()=>{
 const g=game(),d=g.state.fighters[1];spawnBees(g.state,0,700,85);const b=g.state.bees![0];run(g,400);assert.equal(g.state.bees!.length,1);
 assert.deepEqual(beePosition(b,b.born),beePosition(b,b.born+b.period));d.x=b.x;d.y=0;const hp=d.health;g.step([0,0]);assert.equal(g.state.bees!.length,0);assert.equal(d.health,hp-54);assert.equal(movementSlow(d,g.state.frame),.6);const end=d.beeSlowUntil!;run(g,end-g.state.frame);assert.equal(movementSlow(d,g.state.frame),1);
});
test('five placements use every basic button, keep five 550 HP boxes, then restore normal moves',()=>{
 const g=game(),f=g.state.fighters[0];g.step([Button.Super2,0]);run(g,55);assert.equal(f.beeBoxes,5);
 for(let i=0;i<5;i++){f.x=300+i*150;fresh(g,[Button.Light,Button.Medium,Button.Heavy][i%3]);assert.equal(f.move,'placeBox');run(g,35);}
 assert.equal(f.beeBoxes,0);assert.equal(g.state.structures!.length,5);assert.ok(g.state.structures!.every(b=>b.health===550));fresh(g,Button.Light);assert.equal(f.move,'jab');
});
test('boxes spawn every 240 ticks with independent varied paths; destruction stops spawns and drops one honey',()=>{
 const g=game(),f=g.state.fighters[0],m=characters.nikalz.moves.placeBox;activateStructure(g.state,g.stage,f,0,m);const b=g.state.structures![0];
 run(g,239);assert.equal(g.state.bees?.length??0,0);run(g,1);assert.equal(g.state.bees!.length,1);run(g,240);assert.equal(g.state.bees!.length,2);
 assert.notEqual(g.state.bees![0].range,g.state.bees![1].range);assert.notEqual(g.state.bees![0].direction,g.state.bees![1].direction);
 damageStructure(g.state,b,550,'test',0,g.stage);assert.equal(b.phase,'collapsed');assert.equal(g.state.hazards.filter(h=>h.kind==='honey').length,1);const count=g.state.bees!.length;run(g,120);assert.equal(g.state.bees!.length,count);
});
test('honey rewards allies and poisons enemies',()=>{
 for(const ally of [true,false]){const g=game(),f=g.state.fighters[ally?0:1];f.x=700;f.meter=10;g.state.hazards.push({kind:'honey',owner:0,x:700,y:0,createdAt:-30,expiresAt:99999,move:'placeBox',nextTicks:[]});advanceNikalz(g.state,g.stage);assert.equal(ally?f.meter:f.poisonUntil,ally?35:300);assert.equal(g.state.hazards[0].expiresAt,g.state.frame);}
});
test('Testada hits both sides, launches and maintains its two-second stun through landing',()=>{
 const g=game(['nikalz','gut','gut']);g.state.fighters[1].x=250;g.state.fighters[2].x=550;foreheadWave(g.state,0,400,0,360);run(g,7);
 for(const f of g.state.fighters.slice(1)){assert.ok(f.health<characters.gut.stats.maxHealth);assert.ok(f.nikalzStunUntil);assert.ok(f.vy>0);}
 const d=g.state.fighters[1],end=d.nikalzStunUntil!;run(g,end-g.state.frame-1);assert.ok(d.stun>0);run(g,1);assert.equal(d.stun,0);
});
test('Meteor ascends offscreen, lands, spreads arena-wide and has continuous distance damage with six-second stun',()=>{
 const g=game(),f=g.state.fighters[0],d=g.state.fighters[1];d.x=1900;g.step([Button.Super1,0]);run(g,50);assert.ok(f.y>=1000);run(g,49);assert.equal(f.y,0);assert.ok(g.state.foreheadWaves?.some(w=>w.meteor));run(g,40);assert.ok(d.health<characters.gut.stats.maxHealth);assert.ok(d.nikalzStunUntil!>g.state.frame+300);
 assert.ok(meteorDamage(0,2400)>meteorDamage(600,2400));assert.ok(meteorDamage(600,2400)>meteorDamage(1800,2400));assert.equal(meteorDamage(2400,2400),78);
});
test('Nikalz new snapshot state replays deterministically and cleans owned entities on final KO',()=>{
 const g=game();activateStructure(g.state,g.stage,g.state.fighters[0],0,characters.nikalz.moves.placeBox);activateNikalz(g.state,g.stage,g.state.fighters[0],0,characters.nikalz.moves.bees);const snap=g.snapshot();run(g,500);const hash=hashState(g.state);g.restore(snap);run(g,500);assert.equal(hashState(g.state),hash);g.state.fighters[0].lives=1;g.state.fighters[0].health=0;run(g,1);assert.equal(g.state.bees!.length,0);assert.equal(g.state.structures!.length,0);
});

test('swarm travel takes twice as long and Testada uses the reduced range only on impact',()=>{
 const g=game(),f=g.state.fighters[0];spawnBees(g.state,0,400,85);
 const b=g.state.bees![0];assert.equal(b.period,400);
 assert.equal(beePosition(b,b.born+100).x,b.originX+b.range);
 spawnBees(g.state,0,400,85,{id:0,shots:0,facing:1});assert.equal(g.state.bees![1].period,440);
 assert.equal(NIKALZ.shockRange,290);
 g.step([Button.Special,0]);run(g,25);assert.equal(g.state.foreheadWaves?.length??0,0);
 run(g,3);assert.equal(g.state.foreheadWaves?.[0].range,290);assert.equal(f.move,'testada');
});

test('carrying all boxes preserves jumping, double jumping and dashing',()=>{
 const g=game(),f=g.state.fighters[0];f.beeBoxes=5;
 g.step([Button.Up,0]);run(g,10);assert.ok(f.y>0);const first=f.y;
 g.step([Button.Up,0]);run(g,8);assert.ok(f.y>first);assert.equal(f.beeBoxes,5);
 const d=game(),a=d.state.fighters[0];a.beeBoxes=5;d.step([Button.Right,0]);d.step([0,0]);d.step([Button.Right,0]);assert.equal(a.state,'DashForward');const x=a.x;run(d,5);assert.ok(a.x>x+25);assert.equal(a.beeBoxes,5);
});


test('each bee box releases exactly ten swarms, collapses with honey, and replays across exhaustion',()=>{
 const g=game(),f=g.state.fighters[0];
 activateStructure(g.state,g.stage,f,0,characters.nikalz.moves.placeBox);
 const b=g.state.structures![0];
 run(g,NIKALZ.spawnInterval*10-1);
 assert.equal(b.shots,9);assert.equal(b.phase,'built');
 const snapshot=g.snapshot();run(g,1);
 assert.equal(b.shots,10);assert.equal(b.phase,'collapsed');assert.equal(b.health,0);
 assert.equal(g.state.nextBeeId,10);assert.equal(g.state.hazards.filter(h=>h.kind==='honey').length,1);
 run(g,300);assert.equal(g.state.structures!.length,0);assert.equal(g.state.nextBeeId,10);
 const hash=hashState(g.state);g.restore(snapshot);run(g,301);assert.equal(hashState(g.state),hash);
});
test('meteor deals its increased damage once to fighters and destroys a nearby 550 HP box',()=>{
 const g=game(['nikalz','nikalz']),d=g.state.fighters[1];d.x=410;
 activateStructure(g.state,g.stage,d,1,characters.nikalz.moves.placeBox);
 const box=g.state.structures![0],hp=d.health;
 foreheadWave(g.state,0,400,0,g.stage.width,true);advanceNikalz(g.state,g.stage);
 assert.equal(meteorDamage(0,g.stage.width),650);
 assert.equal(d.health,hp-meteorDamage(10,g.stage.width));assert.equal(box.phase,'collapsed');
 advanceNikalz(g.state,g.stage);assert.equal(d.health,hp-meteorDamage(10,g.stage.width));
});

test('special and box swarms both deal 54 damage and slow by 40 percent',()=>{
 assert.equal(characters.nikalz.moves.bees.damage,54);assert.equal(NIKALZ.swarmDamage,54);assert.equal(NIKALZ.slowMultiplier,.6);
 for(const box of [false,true]){
  const g=game(),f=g.state.fighters[0],d=g.state.fighters[1];
  if(box){activateStructure(g.state,g.stage,f,0,characters.nikalz.moves.placeBox);g.state.frame=NIKALZ.spawnInterval;advanceNikalz(g.state,g.stage);}
  else activateNikalz(g.state,g.stage,f,0,characters.nikalz.moves.bees);
  const bee=g.state.bees![0];assert.ok(bee);d.x=bee.x;d.y=0;const hp=d.health;
  advanceNikalz(g.state,g.stage);assert.equal(d.health,hp-54);assert.equal(movementSlow(d,g.state.frame),.6);
  assert.equal(d.beeSlowUntil,g.state.frame+180);assert.equal(g.state.bees!.length,0);
  advanceNikalz(g.state,g.stage);assert.equal(d.health,hp-54);
 }
});
