import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {resolveHit} from '../packages/game-core/combat/CombatSystem.js';
import {Button} from '../packages/game-core/types.js';
const setup=()=>{const g=new GameSimulation(['nikalz','drupa','gut']);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=200+i*800;f.health=10000;});return g;};
const hit=(g:GameSimulation,seat:number)=>resolveHit(g.state,g.stage,()=>{},seat,characters[seat?'drupa':'nikalz'].moves[seat?'bellyDive':'foreheadDive'],0,false,2);
const run=(g:GameSimulation,n:number)=>{for(let i=0;i<n;i++){g.state.hitstop=0;g.step([0,0,0]);}};
for(const seat of [0,1])test(`dive ${seat} cannot refresh stun, alternate dives cannot bypass recovery, and control returns`,()=>{
 const g=setup(),d=g.state.fighters[2];hit(g,seat);const end=d.nikalzStunUntil!,immune=d.diveStunImmuneUntil!;
 assert.equal(end,g.state.frame+120);assert.equal(immune,end+60);
 run(g,70);const hp=d.health,remaining=d.stun;hit(g,1-seat);
 assert.ok(d.health<hp);assert.equal(d.stun,remaining);assert.equal(d.nikalzStunUntil,end);assert.equal(d.diveStunImmuneUntil,immune);assert.equal(g.state.hitstop,0);
 run(g,end-g.state.frame);assert.equal(d.stun,0);assert.equal(d.dazed,false);
 const x=d.x;g.step([0,0,Button.Left]);assert.ok(d.x<x);
 g.step([0,0,Button.Light]);const move=d.move;assert.ok(move);hit(g,seat);assert.equal(d.move,move);assert.equal(d.stun,0);
 run(g,immune-g.state.frame-1);hit(g,1-seat);assert.equal(d.stun,0);assert.equal(d.diveStunImmuneUntil,immune);
 run(g,1);hit(g,seat);assert.equal(d.stun,120);
});
test('dives do not replace ordinary hitstun or bypass the general escape immunity',()=>{
 const g=setup(),d=g.state.fighters[2];d.stun=12;d.state='HitStunStanding';hit(g,0);assert.equal(d.stun,12);assert.equal(d.nikalzStunUntil,undefined);
 d.stun=0;d.hitstunImmuneUntil=g.state.frame+45;hit(g,1);assert.equal(d.stun,0);assert.equal(d.nikalzStunUntil,undefined);
});
test('recovery protection survives snapshot replay and clears on KO',()=>{
 const g=setup();hit(g,0);run(g,80);const snap=g.snapshot();
 const replay=()=>{hit(g,1);run(g,80);hit(g,0);run(g,30);};replay();const hash=hashState(g.state);g.restore(snap);replay();assert.equal(hashState(g.state),hash);
 const d=g.state.fighters[2];d.health=0;run(g,1);assert.equal(d.diveStunImmuneUntil,undefined);
});
