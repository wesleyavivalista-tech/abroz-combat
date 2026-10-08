import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.ts';
import {characters} from '../packages/game-core/characters/registry.ts';
import {stages} from '../packages/game-core/stages/registry.ts';
const ids=Object.keys(characters);let seed=1943,ticks=0,matches=0;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;}
for(const stage of Object.values(stages))for(let group=0;group<4;group++){
 const roster=Array.from({length:8},(_,i)=>ids[(group*4+i)%ids.length]);
 const a=new GameSimulation(roster,false,stage),b=new GameSimulation(roster,false,stage);
 a.state.phase='fight';b.restore(a.snapshot());
 let masks=roster.map(()=>0);
 for(let t=0;t<3600;t++){
  if(t%12===0)masks=roster.map(()=>rand()%2048);
  for(const sim of [a,b])for(const f of sim.state.fighters){f.meter=100;if(t%600===0)f.usedSupers=[];}
  a.step(masks);b.step(masks);ticks++;
  for(const f of [...a.state.fighters,...a.state.clones.map(c=>c.fighter)])for(const key of ['x','y','vx','vy','health','meter','stun'])if(!Number.isFinite(f[key as keyof typeof f]))throw Error(`${stage.id} ${roster} ${t} ${f.characterId} ${key}`);
  if(t%60===0){if(hashState(a.state)!==hashState(b.state))throw Error('Restore determinism mismatch');b.restore(a.snapshot());}
  if(a.state.phase==='result'){a.resetPositions();a.state.phase='fight';a.state.phaseFrame=0;b.restore(a.snapshot());}
 }
 matches++;console.log(stage.id,group,'passed');
}
console.log(JSON.stringify({matches,ticks,seed}));
