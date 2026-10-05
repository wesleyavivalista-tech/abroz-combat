import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';
import {Button} from '../packages/game-core/types.js';
function setup(id='gut',height=340){
 const s=new GameSimulation([id,'tocha'],false,{...trainingRoom,platforms:[{x:360,y:340,width:480},{x:360,y:160,width:480}]});
 s.state.phase='fight';const f=s.state.fighters[0];f.x=600;f.y=height;f.vy=0;f.state='Idle';s.state.fighters[1].x=2000;return s;
}
test('every fighter drops through the current platform and lands on the one below',()=>{
 for(const id of Object.keys(characters)){
  const s=setup(id),f=s.state.fighters[0];s.step([Button.Down,0]);assert.equal(f.y,340);
  s.step([0,0]);s.step([Button.Down,0]);assert.ok(f.y<340,id);assert.equal(f.state,'Fall');
  for(let n=0;n<90;n++)s.step([Button.Down,0]);assert.equal(f.y,160,id);
 }
});
test('holding Down, slow taps, and double Down on the arena floor do not drop',()=>{
 const held=setup();for(let n=0;n<30;n++)held.step([Button.Down,0]);assert.equal(held.state.fighters[0].y,340);
 const slow=setup();slow.step([Button.Down,0]);for(let n=0;n<14;n++)slow.step([0,0]);slow.step([Button.Down,0]);assert.equal(slow.state.fighters[0].y,340);
 const floor=setup('gut',0);floor.step([Button.Down,0]);floor.step([0,0]);floor.step([Button.Down,0]);assert.equal(floor.state.fighters[0].y,0);
});
