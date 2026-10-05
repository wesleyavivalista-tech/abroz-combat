import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
function peer(){return new RollbackManager(new GameSimulation(),0);}
function assertStopped(p:RollbackManager){
 const before=p.simulation.snapshot();let sent=0;
 p.schedule(0,()=>sent++);
 assert.equal(p.tick(),false);
 assert.equal(sent,0);
 assert.deepEqual(p.simulation.snapshot(),before);
}
test('unrecoverable rollback failures stop input scheduling and simulation',()=>{
 const old=peer();old.simulation.state.frame=200;old.confirmed=200;
 old.receive(0,0,1);assert.equal(old.desync,'Input outside history');assertStopped(old);
 const missing=peer();missing.simulation.state.frame=5;missing.confirmed=5;
 missing.receive(2,1,1);assert.equal(missing.desync,'Missing rollback snapshot');assertStopped(missing);
 const departure=peer();departure.simulation.state.frame=5;departure.confirmed=5;
 departure.disconnect(1,2);assert.equal(departure.desync,'Missing disconnect snapshot');assertStopped(departure);
});
test('confirmed hash disagreement stops play; future hashes wait for confirmation',()=>{
 const p=peer();p.schedule(0,()=>{});assert.equal(p.tick(),true);
 const hash=p.confirmedHash(0)!;assert.ok(hash);
 assert.equal(p.verifyRemoteHash(0,hash),true);
 assert.equal(p.verifyRemoteHash(60,'bad'),undefined);
 assert.equal(p.desync,'OK');
 assert.equal(p.verifyRemoteHash(0,hash==='0'?'1':'0'),false);
 assert.equal(p.desync,'MISMATCH @ 0');assertStopped(p);
 // Later packets cannot overwrite the failure or mutate the frozen simulation.
 const frozen=p.simulation.snapshot();p.receive(0,1,1);p.disconnect(1,0);
 assert.deepEqual(p.simulation.snapshot(),frozen);
 assert.equal(p.verifyRemoteHash(0,hash),false);
});
test('ordinary late input still replays, and a new match starts healthy',()=>{
 const p=peer();
 for(let i=0;i<5;i++){p.schedule(0,()=>{});assert.equal(p.tick(),true);}
 p.receive(2,1,1);assert.equal(p.desync,'OK');assert.equal(p.rollbackCount,1);
 assert.equal(p.tick(),true);
 const fresh=peer();assert.equal(fresh.desync,'OK');assert.equal(fresh.tick(),true);
});
