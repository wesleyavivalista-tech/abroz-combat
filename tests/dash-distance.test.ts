import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';

test('every fighter dashes 30% farther in both directions without extending duration',()=>{
 for(const id of Object.keys(characters))for(const state of ['DashForward','DashBackward'] as const)for(const facing of [-1,1] as const){
  const g=new GameSimulation([id,'gut']);g.state.phase='fight';
  const [f,opponent]=g.state.fighters;f.x=1200;f.y=g.stage.floorHeight;f.facing=facing;f.state=state;f.stateFrame=0;opponent.x=2300;opponent.state='Idle';
  const start=f.x;
  for(let i=0;i<11;i++)g.step([0,0]);
  const expected=11*(state==='DashForward'?11:-9)*1.3*(characters[id].dashMultiplier??1)*facing;
  // Simulation rounds position to 0.1 each tick (at most 0.55 over a dash).
  assert.ok(Math.abs(f.x-start-expected)<.551,`${id} ${state} facing ${facing}`);
  const end=f.x;g.step([0,0]);assert.equal(f.x,end);assert.equal(f.state,'Idle');
 }
});
