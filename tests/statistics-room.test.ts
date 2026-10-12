import test from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {RoomService} from '../apps/server/src/rooms.js';
import type {ServerMessage} from '../packages/shared/protocol.js';
function client(){const messages:ServerMessage[]=[];return {messages,ws:{readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},terminate(){}} as unknown as WebSocket};}
function setup(){const service=new RoomService(()=>{},true),clients=[client(),client()];service.create(clients[0].ws,'nikalz',2,'ffa');const room=[...service.rooms.values()][0];service.join(clients[1].ws,room.code,'jopa');clients.forEach(c=>service.ready(c.ws));service.startMatch(clients[0].ws);return {service,clients,room};}
function finish(x:ReturnType<typeof setup>){const s=x.room.verification!.simulation.state;s.phase='fight';s.fighters[1].health=0;s.fighters[1].lives=1;x.clients.forEach(c=>x.service.input(c.ws,2,0,x.room.matchId));assert.equal(s.statistics?.finalized,true);}
test('all clients receive identical authoritative results; independent same-room return waits before the next start and resets the next match',()=>{
 const x=setup(),{service,clients,room}=x,code=room.code;const original=room.matchId;
 service.returnToRoom(clients[0].ws,original);assert.equal(room.started,true);finish(x);
 const results=clients.map(c=>c.messages.find(m=>m.type==='match-statistics'));assert.ok(results[0]);assert.deepEqual(results[0],results[1]);
 service.returnToRoom(clients[0].ws,'wrong');assert.equal(room.peers[0].returnRequested,undefined);
 service.returnToRoom(clients[0].ws,original);assert.equal(room.started,true);assert.equal(clients[1].messages.filter(m=>m.type==='room-state').at(-1)?.type,'room-state');
 service.returnToRoom(clients[1].ws,original);assert.equal(room.started,false);assert.equal(room.code,code);assert.notEqual(room.matchId,original);assert.equal(room.verification,undefined);
 service.input(clients[0].ws,3,16,original);assert.equal(room.peers[0].lastFrame,1);
 clients.forEach(c=>service.ready(c.ws));service.startMatch(clients[0].ws);assert.equal(room.started,true);assert.equal(room.verification!.simulation.state.statistics!.players[1].deaths,0);assert.equal(room.verification!.simulation.state.statistics!.finalized,false);
});
test('reserved reconnect seats prevent early return; expiry releases the waiting room safely',()=>{
 const x=setup();finish(x);const {service,clients,room}=x;
 service.detach(clients[1].ws,'peer-closed');service.returnToRoom(clients[0].ws,room.matchId);assert.equal(room.started,true);
 service.recoveryTick(Date.now()+31_000);assert.equal(room.started,false);assert.equal(room.peers.length,1);assert.equal(room.capacity,2);assert.equal(service.rooms.get(room.code),room);
 const next=client();service.join(next.ws,room.code,'gut');service.ready(clients[0].ws);service.ready(next.ws);service.startMatch(clients[0].ws);assert.equal(room.started,true);assert.equal(room.verification!.simulation.state.fighters[1].characterId,'gut');
});
test('result snapshot survives checkpoint and reconnect without changing counters',()=>{
 const x=setup();finish(x);const token=x.clients[0].messages.find(m=>m.type==='resume-token');assert.ok(token?.type==='resume-token');const stats=structuredClone(x.room.verification!.simulation.state.statistics);
 const restored=new RoomService(()=>{},true);restored.restoreCheckpoint(x.service.checkpoint(),Date.now());const next=client();restored.resume(next.ws,token.token);
 assert.ok(next.messages.some(m=>m.type==='resume'));assert.deepEqual([...restored.rooms.values()][0].verification!.simulation.state.statistics,stats);
});
test('FFA series sends statistics only at final completion, never after an intermediate round',()=>{
 const service=new RoomService(),clients=[client(),client()];service.create(clients[0].ws,'nikalz',2,'ffa-tournament');const room=[...service.rooms.values()][0];service.join(clients[1].ws,room.code,'jopa');clients.forEach(c=>service.ready(c.ws));service.startMatch(clients[0].ws);
 const s=room.verification!.simulation.state;s.phase='fight';s.fighters[1].health=0;s.fighters[1].lives=1;clients.forEach(c=>service.input(c.ws,2,0,room.matchId));assert.equal(s.phase,'result');assert.equal(room.completedLogged,undefined);assert.equal(clients[0].messages.some(m=>m.type==='match-statistics'),false);
 // Advance remaining rounds through the normal tournament transition system.
 let frame=3;while(!s.tournament!.complete&&frame<2000){room.peers.forEach(p=>p.count=0);if(s.phase==='fight'){s.fighters[1].health=0;s.fighters[1].lives=1;}clients.forEach(c=>service.input(c.ws,frame,0,room.matchId));frame++;}
 assert.equal(s.tournament!.complete,true);assert.equal(clients[0].messages.filter(m=>m.type==='match-statistics').length,1);
});
