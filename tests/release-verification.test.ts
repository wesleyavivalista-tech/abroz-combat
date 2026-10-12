import test from 'node:test';
import assert from 'node:assert/strict';
import {Admission,positiveLimit} from '../apps/server/src/admission.js';
import {VerifiedMatch} from '../apps/server/src/verifiedMatch.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';

test('admission caps aggregate and per-address sockets, releases once, and expires attempt budgets',()=>{
 const a=new Admission(3,2,4);assert.ok(a.allow('a',0));const release=a.connect('a');a.connect('a');
 assert.equal(a.allow('a',0),false);assert.ok(a.allow('b',0));const releaseB=a.connect('b');assert.equal(a.allow('c',0),false);
 release();release();assert.ok(a.allow('a',0));releaseB();assert.ok(a.allow('c',0));
 const b=new Admission(8,8,2);assert.ok(b.allow('x',0));assert.ok(b.allow('x',0));assert.equal(b.allow('x',1),false);assert.ok(b.allow('x',60000));
 assert.equal(positiveLimit(undefined,32),32);for(const value of ['0','-1','NaN','Infinity','1.5'])assert.throws(()=>positiveLimit(value,32));
});
for(const mode of [false,true,'elimination','elimination-party'] as const)test(`settled server hashes match client simulation with reordered inputs and departure: ${mode}`,()=>{
 const roster=mode==='elimination-party'?['nikalz','jopa','biel','eide','gut','drupa']:['nikalz','jopa'];
 const create=()=>new GameSimulation(roster,false,trainingRoom,roster.map((_,i)=>i),undefined,mode,12345);
 const client=create(),hashes=new Map<number,string>(),verified=new VerifiedMatch(create(),(frame,hash)=>hashes.set(frame,hash));
 client.step(roster.map(()=>0));client.step(roster.map(()=>0));
 for(let frame=2;frame<1200;frame++){
  const masks=roster.map((_,i)=>frame%(13+i)===0?1:0);
  if(frame===900)verified.leave(1,900);
  for(let seat=1;seat<roster.length;seat++)if(seat!==1||frame<900)verified.receive(seat,frame,masks[seat]);
  verified.receive(0,frame,masks[0]);
  client.step(masks.map((mask,i)=>i===1&&frame>=900?0:mask),frame===900?[1]:[]);
  if(client.state.frame%60===0)assert.equal(hashes.get(client.state.frame),hashState(client.state));
 }
 for(let seat=0;seat<roster.length;seat++)if(seat!==1)verified.leave(seat,1200);assert.equal(verified.simulation.state.frame,1200);
});

import {RoomService} from '../apps/server/src/rooms.js';
import {currentMatches,matchToken} from '../packages/game-core/tournament/Championship.js';
import {stages} from '../packages/game-core/stages/registry.js';
import type {WebSocket} from 'ws';
import type {OnlineMode,ServerMessage} from '../packages/shared/protocol.js';
for(const mode of ['ffa','ffa-tournament','elimination','elimination-party','2v2','3v3','championship'] as OnlineMode[])test(`room-generated checksums use the launched mode, teams and seed: ${mode}`,()=>{
 const service=new RoomService(),count=mode==='2v2'?4:mode==='3v3'||mode==='elimination-party'?6:2;
 const peers=Array.from({length:count},()=>{const messages:ServerMessage[]=[];return {messages,socket:{readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s))} as unknown as WebSocket};});
 service.create(peers[0].socket,'nikalz',count,mode);const room=[...service.rooms.values()][0];
 for(const p of peers.slice(1))service.join(p.socket,room.code,'jopa');for(const p of peers)service.ready(p.socket);service.startMatch(peers[0].socket);
 if(mode==='championship'){
  const token=matchToken(currentMatches(room.championship!.bracket)[0]);for(const p of peers)service.championshipReady(p.socket,token);
  for(let frame=2;frame<60;frame++)for(const p of peers)service.input(p.socket,frame,0,token);
  const duel=[...room.championship!.duels.values()][0];const expected=hashState(duel.simulation.state);
  for(const p of peers)assert.ok(p.messages.some(m=>m.type==='hash'&&m.seat===-1&&m.frame===60&&m.matchId===token&&m.hash===expected));
 }else{
  const start=peers[0].messages.find(m=>m.type==='start');assert.ok(start?.type==='start');
  const client=new GameSimulation(start.characters,false,stages[start.stage??trainingRoom.id],start.teams,start.skins,mode==='elimination'||mode==='elimination-party'?mode:mode==='ffa-tournament',start.seed);
  client.step(peers.map(()=>0));client.step(peers.map(()=>0));
  for(let frame=2;frame<60;frame++){for(const p of peers)service.input(p.socket,frame,0);client.step(peers.map(()=>0));}
  for(const p of peers)assert.ok(p.messages.some(m=>m.type==='hash'&&m.seat===-1&&m.frame===60&&m.hash===hashState(client.state)));
 }
});
