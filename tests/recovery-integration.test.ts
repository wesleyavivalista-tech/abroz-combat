import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {WebSocket} from 'ws';
import {RoomService} from '../apps/server/src/rooms.js';
import {RecoveryStore} from '../apps/server/src/recoveryStore.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {encodeSnapshot,decodeSnapshot} from '../packages/shared/recovery.js';
import type {ServerMessage} from '../packages/shared/protocol.js';
function socket(){const messages:ServerMessage[]=[];return {messages,ws:{readyState:1,bufferedAmount:0,send:(raw:string)=>messages.push(JSON.parse(raw)),close(){},terminate(){}} as unknown as WebSocket};}
function setup(mode:'ffa'|'championship'='ffa'){
 const rooms=new RoomService(()=>{},true),a=socket(),b=socket();
 rooms.create(a.ws,'nikalz',2,mode);const room=[...rooms.rooms.values()][0];rooms.join(b.ws,room.code,'jopa');rooms.ready(a.ws);rooms.ready(b.ws);rooms.startMatch(a.ws);
 const token=b.messages.find(m=>m.type==='resume-token');assert.ok(token?.type==='resume-token');
 if(mode==='championship'){
  const bracket=a.messages.find(m=>m.type==='championship');assert.ok(bracket?.type==='championship');
  const match=bracket.bracket.rounds.flat().find(m=>m.status==='ready')!;
  // Use the actual tournament attempt token rather than assuming match ID alone.
  return {rooms,a,b,room,token:token.token,match};
 }
 return {rooms,a,b,room,token:token.token};
}
test('lobby departure cannot leave reconnect credentials pointing to a reassigned seat',()=>{
 const rooms=new RoomService(()=>{},true),a=socket(),b=socket(),c=socket();
 rooms.create(a.ws,'nikalz',2);const room=[...rooms.rooms.values()][0];rooms.join(b.ws,room.code,'jopa');
 assert.ok(!b.messages.some(m=>m.type==='resume-token'));
 rooms.leave(a.ws);rooms.join(c.ws,room.code,'biel');rooms.ready(b.ws);rooms.ready(c.ws);rooms.startMatch(b.ws);
 const token=b.messages.find(m=>m.type==='resume-token');assert.ok(token?.type==='resume-token');
 const fresh=socket();rooms.detach(b.ws,'peer-closed',1000);rooms.resume(fresh.ws,token.token,1001);
 assert.equal(room.peers[0].socket,fresh.ws);assert.equal(room.peers[1].socket,c.ws);
});
import {matchToken} from '../packages/game-core/tournament/Championship.js';
test('reserved fighter receives neutral input, resumes exact authority and expires to departure',()=>{
 const {rooms,a,b,room,token}=setup();
 for(let f=2;f<20;f++){rooms.input(a.ws,f,0);rooms.input(b.ws,f,0);}
 rooms.detach(b.ws,'peer-closed',1000);
 for(let f=20;f<40;f++){rooms.input(a.ws,f,0);rooms.recoveryTick(1001);}
 assert.equal(room.verification!.simulation.state.frame,40);
 assert.equal(room.peers[1].connected,false);assert.ok(!a.messages.some(m=>m.type==='left'));
 const fresh=socket();rooms.resume(fresh.ws,token,2000);
 const resumed=fresh.messages.find(m=>m.type==='resume');assert.ok(resumed?.type==='resume'&&resumed.state);
 const peer=new RollbackManager(new GameSimulation(),1);peer.restoreRecovery(resumed.state);
 assert.equal(hashState(peer.simulation.state),hashState(room.verification!.simulation.state));
 peer.schedule(0,(f,mask)=>rooms.input(fresh.ws,f,mask)); // No missing input frames.
 assert.equal(room.peers[1].lastFrame,42);
 assert.throws(()=>rooms.resume(socket().ws,'0'.repeat(64),2001));
 rooms.detach(fresh.ws,'peer-closed',3000);rooms.recoveryTick(33000);
 assert.ok(a.messages.some(m=>m.type==='left'));assert.throws(()=>rooms.resume(socket().ws,token,33001));
});
test('cancel/intentional leave never reserves a seat',()=>{
 const {rooms,b,room,token}=setup();rooms.leave(b.ws,'intentional-leave');assert.equal(room.peers[1].reconnectUntil,undefined);assert.throws(()=>rooms.resume(socket().ws,token));
});
test('checkpoint restores authoritative rooms and credentials without duplicate ownership',async()=>{
 const {rooms,a,b,room,token}=setup();for(let f=2;f<30;f++){rooms.input(a.ws,f,0);rooms.input(b.ws,f,0);}
 const dir=await mkdtemp(join(tmpdir(),'abroz-recovery-'));try{
  const store=new RecoveryStore(join(dir,'state.bin'));await store.save(rooms.checkpoint(),1000);
  const saved=await store.load(2000);assert.ok(saved);
  const recovered=new RoomService(()=>{},true);recovered.restoreCheckpoint(saved.data,saved.savedAt);
  assert.equal(recovered.membership.size,0);const fresh=socket();recovered.resume(fresh.ws,token,2000);
  const resumed=fresh.messages.find(m=>m.type==='resume');assert.ok(resumed?.type==='resume'&&resumed.state);
  assert.equal(hashState(decodeSnapshot(resumed.state.snapshot)),hashState(room.verification!.simulation.state));
  assert.throws(()=>recovered.resume(socket().ws,'0'.repeat(64),2001));
  assert.equal(await store.load(6001),undefined);assert.equal(await store.load(999),undefined);
  assert.equal((await stat(join(dir,'state.bin'))).mode&0o777,0o600);
  await writeFile(join(dir,'state.bin'),'corrupt');await assert.rejects(store.load(2000));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('championship duel resumes with the correct seat and attempt',()=>{
 const setupData=setup('championship');const {rooms,a,b,room,token}=setupData;const match=setupData.match!;const id=matchToken(match);
 rooms.championshipReady(a.ws,id);rooms.championshipReady(b.ws,id);
 rooms.input(a.ws,2,0,id);rooms.input(b.ws,2,0,id);rooms.detach(b.ws,'peer-closed',1000);
 rooms.input(a.ws,3,0,id);rooms.recoveryTick(1001);
 const fresh=socket();rooms.resume(fresh.ws,token,2000);const resumed=fresh.messages.find(m=>m.type==='resume');
 assert.ok(resumed?.type==='resume'&&resumed.state);assert.equal(resumed.matchId,id);assert.equal(decodeSnapshot(resumed.state.snapshot).frame,4);
 const restored=new RoomService(()=>{},true);restored.restoreCheckpoint(rooms.checkpoint(),2000);
 assert.deepEqual([...restored.rooms.values()][0].championship!.bracket,room.championship!.bracket);
});
test('snapshot transport preserves non-finite fields and authority hash',()=>{
 const simulation=new GameSimulation();simulation.state.endedAt=Infinity;
 const restored=decodeSnapshot(encodeSnapshot(simulation.snapshot()));assert.equal(restored.endedAt,Infinity);assert.equal(hashState(restored),hashState(simulation.state));
});
test('legacy clients keep immediate departure behavior on a recovery-enabled server',()=>{
 const rooms=new RoomService(()=>{},true),a=socket(),b=socket();rooms.allowRecovery(a.ws,false);rooms.allowRecovery(b.ws,false);
 rooms.create(a.ws,'nikalz');const room=[...rooms.rooms.values()][0];rooms.join(b.ws,room.code,'jopa');rooms.ready(a.ws);rooms.ready(b.ws);rooms.startMatch(a.ws);
 assert.ok(!b.messages.some(m=>m.type==='resume-token'));rooms.detach(b.ws,'peer-closed',1000);
 assert.ok(a.messages.some(m=>m.type==='left'));assert.equal(room.peers[1].reconnectUntil,undefined);
 const restored=new RoomService(()=>{},true);restored.restoreCheckpoint(rooms.checkpoint(),1000);assert.equal(restored.rooms.size,0);
});
test('all disconnected players continue under neutral input and disappear at expiry',()=>{
 const {rooms,a,b,room}=setup();rooms.detach(a.ws,'peer-closed',1000);rooms.detach(b.ws,'peer-closed',1000);
 const frame=room.verification!.simulation.state.frame;rooms.recoveryTick(2000);assert.equal(room.verification!.simulation.state.frame,frame+60);
 rooms.recoveryTick(31000);assert.equal(rooms.rooms.size,0);assert.equal(rooms.membership.size,0);
});
test('valid credential replaces a half-open socket without duplicate ownership',()=>{
 const {rooms,b,room,token}=setup(),fresh=socket();rooms.resume(fresh.ws,token,1000);
 assert.equal(rooms.membership.has(b.ws),false);assert.equal(rooms.membership.has(fresh.ws),true);assert.equal(room.peers.length,2);
 rooms.detach(b.ws,'peer-closed',1001);assert.equal(room.peers[1].socket,fresh.ws);assert.equal(room.peers[1].connected,true);
});
