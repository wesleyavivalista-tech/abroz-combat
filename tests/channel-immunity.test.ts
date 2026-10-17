import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {isInvulnerable} from '../packages/game-core/simulation/LifeSystem.js';
import {applyDamage} from '../packages/game-core/combat/DamageSystem.js';
import {igniteTarget} from '../packages/game-core/simulation/StatusSystem.js';
for(const [id,move,button,seconds] of [['drupa','budaBeam',Button.Super1,18],['roms','water',Button.Super2,15]] as const){
 test(`${id} channel grants complete immunity only during its ${seconds}-second active phase`,()=>{
  const g=new GameSimulation([id,'tocha']);g.state.phase='fight';const [f,d]=g.state.fighters;
  f.state=d.state='Idle';f.meter=100;f.x=300;d.x=1800;
  const m=characters[id].moves[move];g.step([button,0]);assert.equal(isInvulnerable(f,g.state.frame),false);
  for(let i=0;i<m.startupFrames;i++)g.step([0,0]);
  assert.equal(f.actionUntil!-g.state.frame,seconds*60);assert.equal(isInvulnerable(f,g.state.frame),true);
  const hp=f.health;assert.equal(applyDamage(g.state,f,1000,{source:1}),0);assert.equal(f.health,hp);
  igniteTarget(g.state,f,1,180,10);assert.equal(f.burnUntil,0);
  g.hit(1,characters.tocha.moves.double,0,false,0);assert.equal(f.health,hp);assert.equal(f.stun,0);assert.equal(f.move,move);
  const snap=g.snapshot();const expiry=f.actionUntil!;g.state.hitstop=seconds*60+20;
  while(g.state.frame<expiry-1)g.step([0,0]);assert.equal(isInvulnerable(f,g.state.frame),true);
  g.step([0,0]);assert.equal(isInvulnerable(f,g.state.frame),false);const expected=hashState(g.state);
  g.restore(snap);g.state.hitstop=seconds*60+20;while(g.state.frame<expiry)g.step([0,0]);assert.equal(hashState(g.state),expected);
  assert.ok(applyDamage(g.state,g.state.fighters[0],10,{source:1})>0);
 });
}
