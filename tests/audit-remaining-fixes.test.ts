import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters,registerCharacter} from '../packages/game-core/characters/registry.js';
import {advanceNikalz,foreheadWave,spawnBees} from '../packages/game-core/simulation/NikalzSystem.js';
import {advanceDodo} from '../packages/game-core/simulation/DodoSystem.js';
import {resolveKnockouts} from '../packages/game-core/simulation/LifeSystem.js';
import {advanceStatuses} from '../packages/game-core/simulation/StatusSystem.js';
import {summonClones} from '../packages/game-core/simulation/HairSystem.js';
const game=(ids=['nikalz','gut'])=>{const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=1000+i*20;});return g;};
function wave(g:GameSimulation,meteor=false){foreheadWave(g.state,0,1000,0,290,meteor);advanceNikalz(g.state,g.stage);}
test('waves respect get-up/knockdown protection and escape immunity',()=>{
 for(const state of ['GetUp','Knockdown'] as const){const g=game(),d=g.state.fighters[1],hp=d.health;d.state=state;wave(g);assert.equal(d.health,hp);assert.equal(d.state,state);assert.equal(d.stun,0);}
 for(const meteor of [false,true]){const g=game(),d=g.state.fighters[1],hp=d.health;d.hitstunImmuneUntil=100;wave(g,meteor);assert.ok(d.health<hp);assert.equal(d.stun,0);assert.equal(d.nikalzStunUntil,undefined);assert.equal(d.state,'Idle');}
});
test('waves keep eligible duration but cannot cancel armor or fifth-hit escape',()=>{
 for(const meteor of [false,true]){const g=game(),d=g.state.fighters[1];wave(g,meteor);assert.equal(d.stun,meteor?360:120);}
 for(const move of ['coolMuscles','gymBro']){const g=game(['nikalz','jomp']),d=g.state.fighters[1];d.move=move;wave(g);assert.equal(d.move,move);assert.equal(d.stun,0);assert.equal(d.nikalzStunUntil,undefined);}
 const g=game(),d=g.state.fighters[1];d.consecutiveHits=4;d.lastStunHitFrame=0;wave(g);assert.equal(d.stun,0);assert.equal(d.nikalzStunUntil,undefined);assert.ok(d.hitstunImmuneUntil>0);
 g.state.frame++;advanceNikalz(g.state,g.stage);assert.equal(d.stun,0);
});
test('simultaneous lethal music pulses trade and replay identically',()=>{
 const g=game(['dodo','dodo']);g.state.frame=1;g.state.fighters.forEach(f=>{f.health=20;f.weaponUntil=1000;});
 const before=g.snapshot();advanceDodo(g.state,0);assert.deepEqual(g.state.fighters.map(f=>f.health),[0,0]);const expected=hashState(g.state);g.restore(before);advanceDodo(g.state,0);assert.equal(hashState(g.state),expected);
});
test('normal KO and competition forfeits clear persistent combat entities',()=>{
 for(const mode of [false,true,'elimination'] as const){
  const g=new GameSimulation(['nikalz','gut'],false,undefined,undefined,undefined,mode);g.state.phase='fight';spawnBees(g.state,0,200,85);foreheadWave(g.state,0,200,0,290);
  if(mode)g.step([0,0],[1]);else {g.state.fighters[1].health=0;g.state.fighters[1].lives=1;resolveKnockouts(g.state);}
  assert.equal(g.state.phase,'result');assert.equal(g.state.bees?.length,0);assert.equal(g.state.foreheadWaves?.length,0);
 }
 const g=game();spawnBees(g.state,0,200,85);g.state.fighters[0].health=0;resolveKnockouts(g.state);assert.equal(g.state.bees?.length,0);
});
test('generic hazard ticks attribute damage to their own source, not a victim burn',()=>{
 const g=game(['tocha','gut']);g.state.frame=1;g.state.fighters[1].burnOwner=-1;
 g.state.hazards.push({owner:0,x:g.state.fighters[1].x,y:0,expiresAt:100,move:'pentagram',nextTicks:[]});g.clearPresentationEvents();advanceStatuses(g.state);
 const e=g.gameplayEvents.find(e=>e.type==='DamageApplied');assert.equal(e?.source,0);assert.equal(e?.move,'pentagram');assert.equal(e?.amount,18);
});
test('companion health configuration preserves approved health for renamed fighters',()=>{
 for(const id of ['bozo','dodo']){const alias='audit-'+id;registerCharacter({...characters[id],id:alias});try{
  const a=game([id,'gut']),b=game([alias,'gut']);summonClones(a.state,0,a.stage);summonClones(b.state,0,b.stage);
  assert.deepEqual(b.state.clones.map(c=>c.fighter.health),a.state.clones.map(c=>c.fighter.health));
  assert.equal(a.state.clones[0].fighter.health,Math.floor(characters[id].stats.maxHealth*(id==='bozo'?1/3:.4))-(id==='bozo'?60:120));
 }finally{delete characters[alias];}}
});
test('bee cap replaces oldest only for that owner, retaining lifetime and replay order',()=>{
 const g=game(['nikalz','nikalz']);for(let i=0;i<100;i++){spawnBees(g.state,0,200,85);spawnBees(g.state,1,2200,85);}
 const before=g.snapshot(),other=g.state.bees!.filter(b=>b.owner===1).map(b=>b.id);
 spawnBees(g.state,0,200,85);
 assert.equal(g.state.bees!.length,200);assert.equal(g.state.bees!.some(b=>b.id===0),false);
 assert.deepEqual(g.state.bees!.filter(b=>b.owner===1).map(b=>b.id),other);
 const expected=hashState(g.state);g.restore(before);spawnBees(g.state,0,200,85);assert.equal(hashState(g.state),expected);
 g.state.frame=100000;advanceNikalz(g.state,g.stage);assert.equal(g.state.bees!.length,200);
});
test('waves cannot overwrite a Gym Bro victim reservation or another protected stun',()=>{
 const g=game(['nikalz','gut','jomp']),d=g.state.fighters[1],holder=g.state.fighters[2];
 holder.move='gymBro';d.grappleUntil=100;d.grappleOwner=2;d.state='Grappled';
 wave(g);assert.equal(d.state,'Grappled');assert.equal(d.nikalzStunUntil,undefined);assert.equal(d.grappleUntil,100);
 const h=game(),v=h.state.fighters[1];v.gymStunnedUntil=100;v.stun=100;v.state='HitStunStanding';wave(h);assert.equal(v.stun,100);assert.equal(v.nikalzStunUntil,undefined);
});
