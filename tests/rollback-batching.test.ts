import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {Button} from '../packages/game-core/types.js';
for(const count of [2,8])test(`${count} fighters: a burst of late inputs replays once and agrees with immediate replay`,()=>{
 const ids=Array.from({length:count},(_,i)=>i%2?'luizinho':'nikalz');
 const a=new RollbackManager(new GameSimulation(ids),0),b=new RollbackManager(new GameSimulation(ids),0);
 for(let frame=0;frame<10;frame++)for(const peer of [a,b]){peer.schedule(0,()=>{});assert.equal(peer.tick(),true);}
 for(let frame=2;frame<9;frame++)for(let seat=1;seat<count;seat++){
  const mask=frame%2?Button.Left:Button.Right;a.receive(frame,mask,seat);b.receive(frame,mask,seat,true);
 }
 assert.equal(b.rollbackCount,0);b.flushPending();assert.equal(b.rollbackCount,1);assert.equal(a.rollbackCount,7*(count-1));assert.equal(hashState(a.simulation.state),hashState(b.simulation.state));
 assert.equal(a.desync,'OK');assert.equal(b.desync,'OK');assert.equal(a.confirmedHash(5),b.confirmedHash(5));
});
test('hash validation flushes pending corrections and missing history remains terminal',()=>{
 const p=new RollbackManager(new GameSimulation(),0);
 for(let i=0;i<5;i++){p.schedule(0,()=>{});p.tick();}
 p.receive(2,Button.Right,1,true);p.confirmedHash(0);assert.equal(p.rollbackCount,1);
 const bad=new RollbackManager(new GameSimulation(),0);bad.simulation.state.frame=5;bad.receive(2,1,1,true);assert.equal(bad.tick(),false);assert.equal(bad.desync,'Missing rollback snapshot');
});
