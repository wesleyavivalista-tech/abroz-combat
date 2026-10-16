import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RenderInterpolation} from '../apps/client/src/rendering/RenderInterpolation.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
function fixture(){const sim=new GameSimulation();sim.state.phase='fight';const view=new RenderInterpolation();view.capture(sim.state);sim.state.frame++;sim.state.fighters[0].x+=12;return {sim,view};}
test('position interpolation preserves authoritative state and current pose timing',()=>{
 const {sim,view}=fixture();const f=sim.state.fighters[0],before=structuredClone(sim.state);
 assert.equal(view.view(sim.state,.5).fighters[0].x,f.x-6);
 assert.equal(view.view(sim.state,0).fighters[0].x,f.x-12);
 assert.equal(view.view(sim.state,1).fighters[0].x,f.x);
 assert.equal(view.view(sim.state,.5).fighters[0].stateFrame,f.stateFrame);
 assert.deepEqual(sim.state,before);
});
test('combat, interruptions, teleports, mounts and respawns snap immediately',()=>{
 for(const change of [
  (s:GameSimulation)=>{s.state.hitstop=2;},
  (s:GameSimulation)=>{s.state.fighters[0].move='jab';},
  (s:GameSimulation)=>{s.state.fighters[0].lastStunHitFrame++;},
  (s:GameSimulation)=>{s.state.fighters[0].state='Land';},
  (s:GameSimulation)=>{s.state.fighters[0].health--;},
  (s:GameSimulation)=>{s.state.fighters[0].facing=-1;},
  (s:GameSimulation)=>{s.state.fighters[0].x+=100;},
  (s:GameSimulation)=>{s.state.fighters[0].jopaRide=42;},
  (s:GameSimulation)=>{s.state.fighters[0].respawnAt=100;},
 ]){const {sim,view}=fixture();change(sim);assert.equal(view.view(sim.state,.25).fighters[0],sim.state.fighters[0]);}
});
test('restore, skipped frames, phase changes and reset discard stale samples',()=>{
 for(const change of [(s:GameSimulation)=>s.restore(s.snapshot()),(s:GameSimulation)=>{s.state.frame++;},(s:GameSimulation)=>{s.state.phase='result';}]){
  const {sim,view}=fixture();change(sim);assert.equal(view.view(sim.state,.5),sim.state);
 }
 const {sim,view}=fixture();view.reset();assert.equal(view.view(sim.state,.5),sim.state);
});
test('summons follow stable IDs and new summons appear at current positions',()=>{
 const {sim,view}=fixture();sim.state.clones=[{id:1,owner:0,fighter:structuredClone(sim.state.fighters[0])}];
 view.capture(sim.state);sim.state.frame++;sim.state.clones[0].fighter.x+=10;
 sim.state.clones.push({id:2,owner:0,fighter:structuredClone(sim.state.fighters[0])});
 const result=view.view(sim.state,.5);
 assert.equal(result.clones[0].fighter.x,sim.state.clones[0].fighter.x-5);
 assert.equal(result.clones[1].fighter,sim.state.clones[1].fighter);
 sim.state.clones.reverse();assert.equal(view.view(sim.state,.5).clones[1].fighter.x,sim.state.clones[1].fighter.x-5);
});
for(const id of Object.keys(characters))test(`${id}: repeated display frames preserve combat/movement state and events`,()=>{
 const sim=new GameSimulation([id,id],true),baseline=new GameSimulation([id,id],true),view=new RenderInterpolation();
 for(let frame=0;frame<600;frame++){
  const masks=[frame%80<30?Button.Right:frame%23===0?Button.Up:frame%17===0?Button.Heavy:frame%19===0?Button.Special:frame%11===0?Button.Light:0,0];
  view.capture(sim.state);sim.step(masks);baseline.step(masks);
  for(const alpha of [0,.25,.5,.75,1])view.view(sim.state,alpha);
  assert.equal(hashState(sim.state),hashState(baseline.state));assert.deepEqual(sim.events,baseline.events);
 }
});
test('online local position is immediate while remote positions remain smooth and simulation stays untouched',()=>{
 const sim=new GameSimulation(),view=new RenderInterpolation();sim.state.phase='fight';view.capture(sim.state);
 sim.state.frame++;sim.state.fighters.forEach(f=>{f.x+=12;f.y+=6;});const hash=hashState(sim.state);
 for(const alpha of [0,.25,.5,.99,1]){
  const shown=view.view(sim.state,alpha,0);
  assert.equal(shown.fighters[0].x,sim.state.fighters[0].x);assert.equal(shown.fighters[0].y,sim.state.fighters[0].y);
  assert.equal(shown.fighters[1].x,sim.state.fighters[1].x-12+12*alpha);
  assert.equal(hashState(sim.state),hash);
 }
});
