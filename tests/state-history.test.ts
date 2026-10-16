import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StateHistory} from '../packages/networking/StateHistory.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
test('history ring retains the inclusive rollback boundary and rejects stale slots after gaps',()=>{
 const h=new StateHistory(3),s=new GameSimulation().snapshot();
 for(let frame=0;frame<10;frame++)h.set(frame,{...s,frame});
 assert.equal(h.get(5),undefined);for(let f=6;f<=9;f++)assert.equal(h.get(f)?.frame,f);
 h.set(7,{...s,frame:70});assert.equal(h.get(7)?.frame,70);assert.equal(h.get(9)?.frame,9);
 h.set(100,{...s,frame:100});assert.equal(h.get(9),undefined);assert.equal(h.get(97),undefined);
 h.set(0,s);assert.equal(h.get(100)?.frame,100);
});
test('incremental input pruning remains bounded across long sessions and late replay',()=>{
 const a=new RollbackManager(new GameSimulation(),0),b=new RollbackManager(new GameSimulation(),0);
 for(let frame=0;frame<1000;frame++){
  for(const p of [a,b])p.schedule(0,()=>{});
  a.receive(frame+2,frame%2,1);
  if(frame>=5)b.receive(frame-3,(frame-5)%2,1,true);
  assert.equal(a.tick(),true);assert.equal(b.tick(),true);
 }
 for(let f=997;f<1002;f++)b.receive(f,(f-2)%2,1,true);b.flushPending();
 assert.equal(hashState(a.simulation.state),hashState(b.simulation.state));
 for(const p of [a,b])for(const map of [p.local,...p.remotes,...p.usedBySeat]){
  assert.ok(map.size<=184);assert.ok([...map.keys()].every(f=>f>=819));
 }
});
