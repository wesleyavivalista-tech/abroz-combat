import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {activateStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {Button} from '../packages/game-core/types.js';
for(const id of ['jomp','drupa'])for(const facing of [1,-1] as const){
 test(`${id} recovers after a house blocks its charge facing ${facing}`,()=>{
  const g=new GameSimulation([id,'luizinho']);g.state.phase='fight';const [f,builder]=g.state.fighters;g.state.fighters.forEach(a=>{a.state='Idle';a.y=g.stage.floorHeight;});
  builder.x=1000;builder.facing=1;activateStructure(g.state,g.stage,builder,1,characters.luizinho.moves.home);activateStructure(g.state,g.stage,builder,1,characters.luizinho.moves.build);
  builder.x=2500;f.x=facing===1?900:1700;f.facing=facing;f.meter=100;const button=id==='jomp'?Button.Special2:Button.Special;
  g.step([button,0]);const initial=g.snapshot();for(let i=0;i<200;i++)g.step([0,0]);assert.equal(f.move,null);assert.equal(f.state,'Idle');assert.equal(g.state.structures![0].health,g.state.structures![0].maxHealth-characters[id].moves[id==='jomp'?'investida':'rolling'].damage);
  const end=hashState(g.state);g.restore(initial);for(let i=0;i<200;i++)g.step([0,0]);assert.equal(hashState(g.state),end);
  const before=g.state.fighters[0].x;g.step([facing===1?Button.Left:Button.Right,0]);assert.notEqual(g.state.fighters[0].x,before);
 });
 test(`${id} unobstructed charge still reaches arena boundary facing ${facing}`,()=>{
  const g=new GameSimulation([id,'luizinho']);g.state.phase='fight';const f=g.state.fighters[0];g.state.fighters.forEach(a=>{a.state='Idle';a.y=g.stage.floorHeight;});f.x=1300;f.facing=facing;f.meter=100;g.state.fighters[1].y=1000;
  g.step([id==='jomp'?Button.Special2:Button.Special,0]);for(let i=0;i<260;i++)g.step([0,0]);assert.equal(f.move,null);assert.equal(f.x,facing===1?g.stage.width-40:40);
 });
}
