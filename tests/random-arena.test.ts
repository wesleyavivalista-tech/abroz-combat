import test from 'node:test';
import assert from 'node:assert/strict';
import {randomArena} from '../packages/game-core/stages/random.js';
import {stages} from '../packages/game-core/stages/registry.js';
test('random arenas cover every other arena without an immediate repeat',()=>{
 for(const previous of Object.keys(stages)){
  const choices=Object.keys(stages).filter(id=>id!==previous);
  assert.deepEqual(choices.map((_,i)=>randomArena(previous,()=>i/choices.length)),choices);
 }
});

import {usesRandomArenas} from '../packages/game-core/stages/random.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
test('only multi-fight modes automatically randomize arenas',()=>{
 for(const mode of ['ffa','2v2','3v3','training'])assert.equal(usesRandomArenas(mode),false,mode);
 for(const mode of ['championship','ffa-tournament','elimination','elimination-party'])assert.equal(usesRandomArenas(mode),true,mode);
});
for(const mode of [true,'elimination','elimination-party'] as const)test(`${mode}: new fights change arena, rollback restores it, and in-fight ticks keep it`,()=>{
 const first=Object.values(stages)[0];const g=new GameSimulation(['nikalz','jopa','gut','tocha','napa','biel'],false,first,undefined,undefined,mode,123);
 g.state.phase='result';g.state.phaseFrame=480;
 if(g.state.tournament){g.state.tournament.scoredRound=1;g.state.tournament.wins[0]=1;}
 if(g.state.elimination){g.state.elimination.scored=true;g.state.elimination.next={active:[0,1,2,3],stage:'save',newRound:true};}
 const before=g.snapshot();g.step([0,0,0,0,0,0]);const next=g.stage.id;assert.notEqual(next,first.id);const after=hashState(g.state);
 g.restore(before);assert.equal(g.stage.id,first.id);g.step([0,0,0,0,0,0]);assert.equal(g.stage.id,next);assert.equal(hashState(g.state),after);
 const recovered=new GameSimulation(['nikalz','jopa','gut','tocha','napa','biel'],false,first);recovered.restore(g.snapshot());assert.equal(recovered.stage.id,next);
 for(let i=0;i<120;i++)g.step([0,0,0,0,0,0]);assert.equal(g.stage.id,next);
});
test('single fights keep their chosen arena across simulation resets',()=>{
 for(const arena of Object.values(stages)){
  const g=new GameSimulation(['nikalz','jopa'],false,arena);g.state.phase='fight';g.step([0,0]);g.resetPositions();assert.equal(g.stage.id,arena.id);assert.equal(g.state.seriesArena,undefined);
 }
});
