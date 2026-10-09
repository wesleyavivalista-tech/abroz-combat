import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../packages/game-core/types.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {advanceFireTrails} from '../packages/game-core/simulation/FireTrailSystem.js';
function match(){const s=new GameSimulation(['tocha','gut']);s.state.phase='fight';s.state.fighters.forEach(f=>f.state='Idle');s.state.fighters[0].x=200;s.state.fighters[1].x=1600;return s;}
test('On Fire leaves contiguous ground patches expiring exactly three seconds after last contact',()=>{
 const s=match(),a=s.state.fighters[0];a.onFireUntil=1000;
 s.step([0,0]);assert.equal(s.state.hazards[0].expiresAt-s.state.frame,180);
 for(let i=0;i<30;i++)s.step([Button.Right,0]);
 const patches=s.state.hazards.filter(h=>h.kind==='fire-trail');assert.ok(patches.length>=4);
 for(let i=1;i<patches.length;i++)assert.ok(patches[i].x-patches[i-1].x<=48);
 const first=structuredClone(patches[0]);a.onFireUntil=0;a.x=1200;
 s.state.frame=first.expiresAt-1;advanceFireTrails(s.state,s.stage);assert.ok(s.state.hazards.some(h=>h.x===first.x));
 s.state.frame++;advanceFireTrails(s.state,s.stage);assert.ok(!s.state.hazards.some(h=>h.x===first.x));
});
test('abandoned ground fire ignites opponents, not airborne enemies, teammates or invulnerable fighters',()=>{
 for(const kind of ['enemy','air','team','protected']){
  const s=match(),[a,b]=s.state.fighters;a.onFireUntil=1000;s.step([0,0]);const patch=s.state.hazards[0];a.x=1200;a.onFireUntil=0;b.x=patch.x;b.y=kind==='air'?100:0;
  if(kind==='team')s.state.teams[1]=s.state.teams[0];if(kind==='protected')b.invulnerableUntil=100;
  s.step([0,0]);assert.equal(b.burnUntil>0,kind==='enemy');if(kind==='enemy'){assert.equal(b.burnDamage,10);assert.equal(b.burnKind,'normal');assert.equal(b.stun,0);}
 }
});
test('platform trail stays on the platform, never appears below an airborne Tocha and clears on reset',()=>{
 const s=match(),a=s.state.fighters[0];a.x=500;a.y=340;a.vy=0;a.onFireUntil=1000;s.step([0,0]);assert.equal(s.state.hazards[0].y,340);
 a.x=1000;a.y=500;a.vy=5;const n=s.state.hazards.length;s.step([0,0]);assert.equal(s.state.hazards.length,n);
 a.health=0;s.step([0,0]);assert.equal(s.state.hazards.length,n);assert.equal(a.onFireUntil,0);s.resetPositions();assert.equal(s.state.hazards.length,0);
});
test('fire trail positions, expiration and ignition converge through rollback',()=>{
 const a=match(),b=match();for(const s of [a,b]){s.state.fighters[0].onFireUntil=1000;s.state.fighters[1].x=650;}
 const rb=new RollbackManager(b,0,0,8);
 for(let frame=0;frame<240;frame++){const local=frame<60?Button.Right:0,remote=frame>65&&frame<140?Button.Left:0;a.step([local,remote]);rb.local.set(frame,local);rb.tick();rb.receive(frame,remote,1);}
 assert.equal(hashState(a.state),hashState(b.state));
});
