import {activateBlood,advanceBlood,movementSlow,attackSlow} from '../packages/game-core/simulation/BloodSystem.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {advanceRespawns,resolveKnockouts} from '../packages/game-core/simulation/LifeSystem.js';
import {advanceFinance,applyLoan} from '../packages/game-core/simulation/FinanceSystem.js';
import {applyDamage} from '../packages/game-core/combat/DamageSystem.js';
import {consecutiveHitstun} from '../packages/game-core/combat/HitstunSystem.js';
function respawn(){const g=new GameSimulation(['eide','nikalz']);const s=g.state;s.phase='fight';s.fighters.forEach(f=>f.state='Idle');const d=s.fighters[1];d.health=0;resolveKnockouts(s,false);s.frame=d.respawnAt;advanceRespawns(s,g.stage.floorHeight);return {g,s,d};}
test('respawn blocks damage, stun and every move contact including debuffs',()=>{
 const {g,s,d}=respawn(),hp=d.health;
 for(const def of Object.values(characters))for(const move of Object.values(def.moves)){
  s.fighters[0].characterId=def.id;
  g.hit(0,move,0,false,1,1);
 }
 assert.equal(d.health,hp);assert.equal(d.stun,0);assert.equal(d.trappedUntil,0);assert.equal(d.grappleUntil,0);assert.equal(d.poisonUntil,0);assert.equal(d.burnUntil,0);assert.equal(d.movementSlowUntil,undefined);
 assert.equal(applyDamage(s,d,25),0);assert.equal(consecutiveHitstun(s,d,120,1),0);applyLoan(s,d);assert.equal(d.loanUntil,undefined);
 s.frame=d.invulnerableUntil;assert.ok(applyDamage(s,d,25)>0);assert.ok(consecutiveHitstun(s,d,120,1)>0);applyLoan(s,d);assert.ok(d.loanUntil!>s.frame);
});
test('enemy money bill cannot slow or be consumed by a protected respawn; works at expiry',()=>{
 const {g,s,d}=respawn();s.fighters[0].x=d.x-500;
 s.hazards.push({kind:'money-bill',owner:0,x:d.x,y:d.y+25,createdAt:s.frame,expiresAt:s.frame+600,move:'',nextTicks:[]});
 advanceFinance(s,g.stage);assert.equal(d.movementSlowUntil,undefined);assert.equal(s.hazards.length,1);
 s.frame=d.invulnerableUntil;advanceFinance(s,g.stage);assert.ok(d.movementSlowUntil!>s.frame);assert.equal(s.hazards.length,0);
});

test('Caio blood flood does not slow movement or attacks during respawn immunity',()=>{
 const {g,s,d}=respawn();s.fighters[0].characterId='caio';d.y=g.stage.floorHeight;
 activateBlood(s,g.stage,s.fighters[0],0,characters.caio.moves.flood);
 for(let frame=s.frame;frame<d.invulnerableUntil;frame++){
  s.frame=frame;advanceBlood(s,g.stage);
  assert.equal(movementSlow(d,frame),1);assert.equal(attackSlow(d,frame),1);
 }
 // The river is fully raised and still present at the exact protection boundary.
 s.frame=d.invulnerableUntil;advanceBlood(s,g.stage);
 assert.equal(movementSlow(d,s.frame),.2);assert.equal(attackSlow(d,s.frame),.2);
 // Leaving the river clears its slow immediately.
 d.y=g.stage.floorHeight+1000;advanceBlood(s,g.stage);
 assert.equal(movementSlow(d,s.frame),1);assert.equal(attackSlow(d,s.frame),1);
});
