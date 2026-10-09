import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {Button} from '../packages/game-core/types.js';
import {RESPAWN_FRAMES} from '../packages/game-core/simulation/LifeSystem.js';

const attacks=[Button.Light,Button.Medium,Button.Heavy,Button.Special,Button.Special2,Button.Super1,Button.Super2];
for(const id of Object.keys(characters))test(`${id}: death during attack input sequences clears personal modes and restores control`,()=>{
 for(const button of attacks)for(const age of [1,20,90]){
  const g=new GameSimulation([id,'gut','drupa']);g.state.phase='fight';
  g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',x:500+i*350,meter:100}));
  const f=g.state.fighters[0];
  for(let i=0;i<age;i++)g.step([button,0,0]);
  const lives=f.lives;f.health=0;g.step([0,0,0]);
  assert.equal(f.lives,lives-1,`${button}/${age}: KO`);
  assert.equal(f.move,null);assert.equal(f.stun,0);
  assert.equal(f.weaponUntil,0);assert.equal(f.armorUntil,0);assert.equal(f.onFireUntil,0);
  for(let i=0;i<RESPAWN_FRAMES+180;i++)g.step([0,0,0]);
  assert.equal(f.respawnAt,0);assert.equal(f.move,null);assert.equal(f.stun,0);
  const x=f.x;g.step([f.x<g.stage.width/2?Button.Right:Button.Left,0,0]);
  assert.notEqual(f.x,x,`${button}/${age}: control after respawn`);
  g.step([0,0,0]);g.step([Button.Light,0,0]);assert.ok(f.move,`${button}/${age}: attacks after respawn`);
 }
});
for(const stage of Object.values(stages))test(`${stage.id}: repeated active resets and simultaneous final deaths stay deterministic`,()=>{
 const ids=['jopa','eide','nikalz','bozo','napa','biel','luizinho','astolfo'];
 const g=new GameSimulation(ids,false,stage);g.state.phase='fight';
 for(let round=0;round<8;round++){
  g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});
  for(let i=0;i<120;i++)g.step(ids.map((_,seat)=>i%8===0?attacks[(round+seat)%attacks.length]:0));
  const before=g.snapshot();g.resetPositions();const expected=hashState(g.state);
  assert.ok(g.state.projectiles.every(p=>!p.active));assert.equal(g.state.clones.length,0);assert.equal(g.state.hazards.length,0);
  assert.equal(g.state.finalDeaths,undefined);assert.ok(g.state.fighters.every(f=>f.move===null&&f.respawnAt===0&&f.stun===0));
  g.restore(before);g.resetPositions();assert.equal(hashState(g.state),expected);
 }
 g.state.fighters.forEach(f=>{f.lives=1;f.health=0;});g.step(ids.map(()=>0));
 assert.equal(g.state.phase,'result');assert.equal(g.state.winner,-1);
 for(let i=0;i<120;i++)g.step(ids.map(()=>2047));
 assert.ok(g.state.projectiles.every(p=>!p.active));assert.equal(g.state.clones.length,0);
 assert.ok(g.state.fighters.every(f=>f.move===null&&f.stun===0));
});

test('every fighter recovers movement and attacks after an interrupted basic startup',()=>{
 for(const id of Object.keys(characters)){
  const g=new GameSimulation([id,'gut']);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');
  const f=g.state.fighters[0];g.step([Button.Light,0]);assert.ok(f.move,id);
  g.hit(1,characters.gut.moves.palm,0,true,0,-1);
  assert.equal(f.move,null,id);assert.ok(f.stun>0,id);
  for(let i=0;i<180;i++)g.step([0,0]);
  assert.equal(f.stun,0,id);const x=f.x;g.step([Button.Left,0]);assert.notEqual(f.x,x,id);
  g.step([0,0]);g.step([Button.Light,0]);assert.ok(f.move,id);
 }
});
