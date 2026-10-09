import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {hasExecutionArmor} from '../packages/game-core/combat/ExecutionArmor.js';
import {periodicHit} from '../packages/game-core/combat/PeriodicHit.js';
import {applyLoan,advanceFinance} from '../packages/game-core/simulation/FinanceSystem.js';
import {advanceBeams} from '../packages/game-core/simulation/LightBeamSystem.js';
import {advanceNapa} from '../packages/game-core/simulation/NapaSystem.js';
import {gymTarget,startJomp,advanceJomp} from '../packages/game-core/simulation/JompSystem.js';
import {activateStructure,damageStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {advanceStatuses} from '../packages/game-core/simulation/StatusSystem.js';
import {VerifiedMatch} from '../apps/server/src/verifiedMatch.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';

function game(ids=['nikalz','gut','bozo']){
 const g=new GameSimulation(ids);g.state.phase='fight';
 g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',x:300+i*650,y:g.stage.floorHeight,meter:100}));
 return g;
}
function cast(g:GameSimulation,id:string,seat=0,age=0){
 const f=g.state.fighters[seat],m=characters[f.characterId].moves[id];
 Object.assign(f,{move:id,moveFrame:age,state:m.state,attackSerial:1});return f;
}
for(const [id,c] of Object.entries(characters))for(const move of [...c.specialButtons,...c.superButtons]){
 test(`${id}/${move}: startup, active and recovery take damage without any hit reaction`,()=>{
  const m=c.moves[move];
  for(const age of [0,m.startupFrames,m.startupFrames+m.activeFrames]){
   const g=game([id,'gut','bozo']),f=cast(g,move,0,age);
   f.health=100000;f.consecutiveHits=4;f.lastStunHitFrame=g.state.frame;
   const before={state:f.state,move:f.move,frame:f.moveFrame,x:f.x,y:f.y,vx:f.vx,vy:f.vy,serial:f.attackSerial};
   for(let i=0;i<7;i++){
    const hp=f.health;
    // Simultaneous/repeated normal hits, fixed stun, launch and trap contacts.
    g.hit(1,i%2?characters.nikalz.moves.foreheadDive:characters.gut.moves.palm,0,true,0,-1);
    g.hit(2,characters.bozo.moves.grip,0,false,0,1);
    assert.ok(f.health<hp);
    assert.equal(periodicHit(g.state,f,10,-1,120,30),false);
    assert.equal(f.move,before.move);assert.equal(f.moveFrame,before.frame);assert.equal(f.state,before.state);
    assert.equal(f.x,before.x);assert.equal(f.y,before.y);assert.equal(f.vx,before.vx);assert.equal(f.vy,before.vy);
    assert.equal(f.attackSerial,before.serial);assert.equal(f.stun,0);assert.ok(!f.dazed);assert.equal(f.trappedUntil,0);
    assert.equal(f.hitstunImmuneUntil,0);assert.equal(f.consecutiveHits,4);
   }
   // No timer-based immunity survives the end of execution.
   f.move=null;f.state='Idle';f.consecutiveHits=0;
   assert.equal(hasExecutionArmor(f),false);
   g.hit(1,characters.gut.moves.palm,0,false,0,-1);assert.ok(f.stun>0);
  }
 });
 test(`${id}/${move}: real input starts protection and the existing completion releases it`,()=>{
  const g=game([id,'gut']),f=g.state.fighters[0];
  const buttons=[Button.Special,Button.Special2,Button.Super1,Button.Super2];
  const button=buttons[[...c.specialButtons,...c.superButtons].indexOf(move)];
  g.step([button,0]);assert.equal(f.move,move);assert.equal(hasExecutionArmor(f),true);
  // Exercise the actual clock, including held, travel, possession and scripted moves.
  for(let i=0;i<1600&&f.move;i++){
   if(i===2){const hp=f.health;g.hit(1,characters.gut.moves.palm,0,false,0,-1);assert.ok(f.health<hp);assert.equal(f.move,move);}
   g.step([i<90?button:0,0]);
  }
  assert.equal(f.move,null,`${id}/${move} must finish/release`);assert.equal(hasExecutionArmor(f),false);
 });
 test(`${id}/${move}: lethal damage overrides protection before another activation`,()=>{
  const g=game([id,'gut']),f=cast(g,move);f.health=1;
  g.hit(1,characters.gut.moves.palm,0,false,0,-1);
  assert.equal(f.health,0);assert.equal(hasExecutionArmor(f),false);
  g.step([0,0]);assert.equal(f.move,null);assert.ok(f.respawnAt>0);
  assert.equal(f.weaponUntil,0);assert.ok(!g.state.projectiles.some(p=>p.active&&p.owner===0));
 });
}

test('persistent transformations and buffs never protect their idle or basic execution states',()=>{
 for(const [id,c] of Object.entries(characters)){
  const g=game([id,'gut']),f=g.state.fighters[0];
  Object.assign(f,{weaponUntil:5000,armorUntil:5000,onFireUntil:5000,bloodMasterUntil:5000,angelUntil:5000,beeBoxes:5,stampAttempts:5,modeFinaleUntil:5000});
  assert.equal(hasExecutionArmor(f),false,id);
  const basics=[...Object.values(c.weaponAttacks??{}).flat(),...(c.financeMoves?[c.financeMoves.feathers,c.financeMoves.dive,c.financeMoves.beam]:[])];
  if(id==='caio')basics.push('vanish');
  for(const move of basics){
   if(!move||!c.moves[move])continue;
   cast(g,move);assert.equal(hasExecutionArmor(f),false,`${id}/${move}`);
   f.stun=0;f.consecutiveHits=0;
   g.hit(1,characters.gut.moves.palm,0,false,0,-1);assert.equal(f.move,null,`${id}/${move}`);assert.ok(f.stun>0);
  }
 }
});

test('ability follow-up and dedicated ending animations protect only their live cast',()=>{
 for(const [id,move] of [['nikalz','placeBox'],['biel','stamp'],['luizinho','build'],['gut','spearThrow']]){
  const g=game([id,'gut']),f=cast(g,move);assert.equal(hasExecutionArmor(f),true);
  f.move=null;assert.equal(hasExecutionArmor(f),false);
 }
 const g=game(['gut','nikalz']),f=g.state.fighters[0];g.state.frame=10;f.weaponUntil=10;
 advanceStatuses(g.state,g.stage.width,g.stage.floorHeight);assert.equal(f.move,'spearThrow');assert.equal(hasExecutionArmor(f),true);
 for(let i=0;i<100;i++)g.step([0,0]);assert.equal(hasExecutionArmor(f),false);
});

test('loan applies its energy lock without canceling a cast, including expiry stun',()=>{
 const g=game(['tocha','biel']),f=cast(g,'satan');
 applyLoan(g.state,f);assert.ok(f.loanUntil);assert.equal(f.loanStunUntil,undefined);assert.equal(f.move,'satan');
 g.state.frame=f.loanUntil!;advanceFinance(g.state,g.stage);assert.equal(f.move,'satan');assert.equal(f.stun,0);
 f.move=null;f.state='Idle';applyLoan(g.state,f);assert.ok(f.stun>0);
});

test('Gym Bro does not capture protected execution, including protection started during homing',()=>{
 const g=game(['jomp','tocha']),[a,d]=g.state.fighters;
 cast(g,'satan',1);assert.equal(gymTarget(g.state,a),-1);
 d.move=null;d.state='Idle';cast(g,'gymBro');startJomp(g.state,a);assert.equal(a.gymTarget,1);
 cast(g,'satan',1);advanceJomp(g.state,g.stage);assert.equal(d.move,'satan');assert.equal(d.grappleUntil,0);assert.equal(a.gymTarget,-1);
});

test('water and suction do not displace executing abilities; water still damages',()=>{
 const g=game(['roms','tocha','napa']),[a,d,n]=g.state.fighters;
 cast(g,'water',0,characters.roms.moves.water.startupFrames);cast(g,'satan',1);
 a.x=300;d.x=600;n.x=300;a.facing=1;d.y=a.y;n.y=a.y;
 const hp=d.health,x=d.x,y=d.y;advanceBeams(g.state,g.stage.width,undefined,g.stage.floorHeight);
 assert.ok(d.health<hp);assert.equal(d.x,x);assert.equal(d.y,y);
 cast(g,'sniff',2,characters.napa.moves.sniff.startupFrames);advanceNapa(g.state,g.stage);assert.equal(d.x,x);
 d.move=null;d.state='Idle';advanceNapa(g.state,g.stage);assert.ok(d.x<x);
});

test('house collapse damages without freezing or dazing an executing cast',()=>{
 const g=game(['luizinho','tocha']),[builder,d]=g.state.fighters;
 activateStructure(g.state,g.stage,builder,0,characters.luizinho.moves.home);
 activateStructure(g.state,g.stage,builder,0,characters.luizinho.moves.build);
 const house=g.state.structures![0];d.x=house.x;cast(g,'satan',1);d.vx=3;d.vy=2;
 const hp=d.health;damageStructure(g.state,house,house.health,'test',0,g.stage);
 assert.ok(d.health<hp);assert.equal(d.move,'satan');assert.equal(d.vx,3);assert.equal(d.vy,2);assert.ok(!d.dazed);
});

test('server verification and late-input rollback agree on protected hits and completed casts',()=>{
 const make=()=>{const g=game(['bozo','gut']);g.state.fighters[1].x=430;return g;};
 const server=new VerifiedMatch(make(),()=>{}),local=make(),predicted=make();
 local.restore(server.simulation.snapshot());predicted.restore(local.snapshot());
 const peer=new RollbackManager(predicted,0,0,8);peer.confirmed=predicted.state.frame-1;let sawDamage=false;
 for(let n=0;n<110;n++){
  const frame=local.state.frame,a=n===0?Button.Super1:0,b=n===3?Button.Light:0;
  local.step([a,b]);server.receive(0,frame,a);server.receive(1,frame,b);
  peer.local.set(frame,a);assert.equal(peer.tick(),true);peer.receive(frame,b,1);
  if(local.state.fighters[0].health<characters.bozo.stats.maxHealth){sawDamage=true;if(n<40)assert.equal(local.state.fighters[0].move,'armor');}
 }
 assert.ok(sawDamage);assert.ok(peer.rollbackCount>0);
 assert.equal(hashState(local.state),hashState(server.simulation.state));assert.equal(hashState(local.state),hashState(predicted.state));
});

test('repeated incoming hits neither duplicate summons nor restart or recharge execution',()=>{
 for(const [id,button,move] of [['nikalz',Button.Special2,'bees'],['napa',Button.Super1,'cookieMonster']] as const){
  const g=game([id,'gut']),f=g.state.fighters[0];f.health=100000;
  g.step([button,0]);const serial=f.attackSerial;
  for(let i=0;i<250;i++){
   if(f.move){g.hit(1,characters.gut.moves.palm,0,false,0,-1);assert.equal(f.move,move);assert.equal(f.attackSerial,serial);}
   g.step([0,0]);
  }
  assert.equal(f.move,null);assert.equal(f.attackSerial,serial);
  if(id==='nikalz')assert.equal(g.state.bees?.filter(b=>b.owner===0).length,1);
  else{assert.equal(g.state.clones.filter(c=>c.owner===0).length,1);assert.deepEqual(f.usedSupers,['cookieMonster']);}
 }
});

test('lethal hits during an active channel, grapple or transformation clean up normally',()=>{
 for(const [id,button,frames] of [['drupa',Button.Super1,60],['gut',Button.Special,40],['eide',Button.Super2,95]] as const){
  const g=game([id,'nikalz']),f=g.state.fighters[0];
  if(id==='gut')g.state.fighters[1].x=f.x+70;
  g.step([button,0]);for(let i=0;i<frames;i++)g.step([0,0]);
  assert.ok(hasExecutionArmor(f));f.health=1;
  g.hit(1,characters.nikalz.moves[characters.nikalz.basicAttacks!.chain[0]],0,false,0,-1);g.step([0,0]);
  assert.equal(f.move,null);assert.equal(f.weaponUntil,0);assert.equal(g.state.fighters[1].grappleUntil,0);assert.ok(f.respawnAt>0);
 }
});
