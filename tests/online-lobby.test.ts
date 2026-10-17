import test from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {RoomService} from '../apps/server/src/rooms.js';
import type {ServerMessage,OnlineMode} from '../packages/shared/protocol.js';
import {SpectatorPlayback} from '../apps/client/src/networkSpectator.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {matchToken} from '../packages/game-core/tournament/Championship.js';
const client=()=>{const messages:ServerMessage[]=[];return {messages,ws:{readyState:1,bufferedAmount:0,send:(text:string)=>messages.push(JSON.parse(text)),close(){},terminate(){}} as unknown as WebSocket};};
function setup(mode:OnlineMode='ffa',count=3,capacity=count){const service=new RoomService(()=>{},true),clients=Array.from({length:count},client);service.create(clients[0].ws,'nikalz',capacity,mode,undefined,undefined,undefined,'Friday fights','public');const room=[...service.rooms.values()][0];clients.slice(1).forEach(c=>service.join(c.ws,room.code,'jopa'));return {service,clients,room};}
function begin(x:ReturnType<typeof setup>){x.clients.forEach(c=>x.service.ready(c.ws));assert.equal(x.room.started,false);x.service.startMatch(x.clients[0].ws);}
function finish(x:ReturnType<typeof setup>){const s=x.room.verification!.simulation.state;s.phase='fight';s.fighters.slice(1).forEach(f=>{f.health=0;f.lives=1;});x.clients.forEach(c=>x.service.input(c.ws,2,0,x.room.matchId));assert.equal(x.room.completedLogged,true);}
test('readiness is explicit, reversible, self scoped; only owner starts and capacity is a maximum',()=>{
 const x=setup('ffa',2,8),{service,clients,room}=x;
 assert.throws(()=>service.startMatch(clients[1].ws),/Owner/);assert.throws(()=>service.startMatch(clients[0].ws),/ready/);
 service.ready(clients[0].ws);assert.equal(room.peers[1].ready,false);service.ready(clients[0].ws,false);assert.equal(room.peers[0].ready,false);
 begin(x);assert.equal(room.started,true);assert.equal(room.verification!.simulation.state.fighters.length,2);
 service.startMatch(clients[0].ws);assert.equal(clients[0].messages.filter(m=>m.type==='start').length,1);
});
test('public directory hides private rooms, reports statuses and exposes no seat secrets',()=>{
 const x=setup('ffa',2,3),viewer=client();x.service.create(client().ws,'gut',2,'ffa',undefined,undefined,undefined,'Secret','private');
 x.service.list(viewer.ws);const list=viewer.messages.at(-1);assert.ok(list?.type==='rooms');assert.equal(list.rooms.length,1);assert.equal(list.rooms[0].status,'waiting');assert.equal(JSON.stringify(list).includes('socket'),false);assert.equal(JSON.stringify(list).includes('token'),false);
 x.service.configure(x.clients[0].ws,{capacity:2});x.service.list(viewer.ws);assert.equal((viewer.messages.at(-1) as Extract<ServerMessage,{type:'rooms'}>).rooms[0].status,'full');
 begin(x);x.service.list(viewer.ws);assert.equal((viewer.messages.at(-1) as Extract<ServerMessage,{type:'rooms'}>).rooms[0].status,'playing');assert.throws(()=>x.service.join(viewer.ws,x.room.code,'gut'),/started/);
});
test('settings are atomic, validated and owner-only; fighter changes reset only that fighter',()=>{
 const {service,clients,room}=setup();clients.forEach(c=>service.ready(c.ws));
 assert.throws(()=>service.configure(clients[1].ws,{stage:'rooftop'}),/Owner/);
 service.choose(clients[1].ws,'gut');assert.equal(room.peers[1].ready,false);assert.equal(room.peers[0].ready,true);
 assert.throws(()=>service.choose(clients[1].ws,'__proto__'),/Unknown/);
 assert.throws(()=>service.configure(clients[0].ws,{stage:[room.stage] as unknown as string}),/arena/);
 const before=room.capacity;assert.throws(()=>service.configure(clients[0].ws,{capacity:2}),/size/);assert.equal(room.capacity,before);
 service.configure(clients[0].ws,{visibility:'private',name:'Rivals',mode:'championship',capacity:16});assert.ok(room.peers.every(p=>!p.ready));assert.equal(room.name,'Rivals');
 assert.throws(()=>service.configure(clients[0].ws,{visibility:'secret' as 'private'}),/privacy/);
});
test('independent results return preserves frozen results, code, capacity, owner and settings',()=>{
 const x=setup('ffa',3,8);begin(x);finish(x);const {service,clients,room}=x,code=room.code,stats=structuredClone(room.verification!.simulation.state.statistics);
 service.returnToRoom(clients[0].ws,room.matchId);assert.ok(clients[0].messages.some(m=>m.type==='room-returned'));assert.equal(clients[1].messages.some(m=>m.type==='room-returned'),false);
 const view=clients[0].messages.filter(m=>m.type==='room-state').at(-1);assert.ok(view?.type==='room-state');assert.equal(view.room.players[1].status,'results');assert.match(view.room.startReason,/results/);
 service.choose(clients[0].ws,'gut');assert.deepEqual(room.verification!.simulation.state.statistics,stats);
 service.leave(clients[1].ws);assert.deepEqual(room.verification!.simulation.state.statistics,stats);
 service.returnToRoom(clients[2].ws,room.matchId);assert.equal(room.started,false);assert.equal(room.code,code);assert.equal(room.capacity,8);assert.equal(room.name,'Friday fights');assert.equal(room.owner,0);assert.ok(room.peers.every(p=>!p.ready));
 room.peers.forEach(p=>service.ready(p.socket));service.startMatch(clients[0].ws);assert.equal(room.verification!.simulation.state.fighters[0].characterId,'gut');assert.equal(room.verification!.simulation.state.statistics?.finalized,false);
});
test('owner transfer follows membership in lobby and results, then empty room is removed',()=>{
 const x=setup();x.service.leave(x.clients[0].ws);assert.equal(x.room.owner,0);assert.equal(x.room.peers[0].socket,x.clients[1].ws);x.service.configure(x.clients[1].ws,{name:'New owner'});
 x.service.ready(x.clients[1].ws);x.service.ready(x.clients[2].ws);x.service.startMatch(x.clients[1].ws);
 const s=x.room.verification!.simulation.state;s.phase='fight';s.fighters[1].health=0;s.fighters[1].lives=1;x.clients.slice(1).forEach(c=>x.service.input(c.ws,2,0));
 x.service.returnToRoom(x.clients[2].ws);x.service.leave(x.clients[1].ws);assert.equal(x.room.owner,0);assert.equal(x.room.started,false);assert.equal(x.room.peers[0].socket,x.clients[2].ws);
 x.service.leave(x.clients[2].ws);assert.equal(x.service.rooms.size,0);
});
for(const mode of ['2v2','elimination-party'] as const)test(`${mode} requires the full format and supports results return`,()=>{
 const x=setup(mode,mode==='2v2'?4:6);x.service.leave(x.clients.at(-1)!.ws);x.room.peers.forEach(p=>x.service.ready(p.socket));assert.throws(()=>x.service.startMatch(x.clients[0].ws),/Waiting/);
 x.service.join(x.clients.at(-1)!.ws,x.room.code,'gut');begin(x);
 const s=x.room.verification!.simulation.state;s.phase='result';if(s.elimination)s.elimination.complete=true;
 x.clients.forEach(c=>x.service.returnToRoom(c.ws,x.room.matchId));assert.equal(x.room.started,false);assert.equal(x.room.mode,mode);assert.equal(x.room.capacity,mode==='2v2'?4:6);
});
test('championship completion permits independent room returns and resets only the next tournament',()=>{
 const x=setup('championship',2);begin(x);const session=x.room.championship!,m=session.bracket.rounds[0][0];x.clients.forEach(c=>x.service.championshipReady(c.ws,matchToken(m)));
 const duel=session.duels.get(m.id)!;duel.simulation.state.phase='fight';duel.simulation.state.fighters[1].health=0;duel.simulation.state.fighters[1].lives=1;
 x.clients.forEach(c=>x.service.input(c.ws,2,0,matchToken(m)));assert.equal(session.bracket.complete,true);const bracket=structuredClone(session.bracket);
 x.service.returnToRoom(x.clients[1].ws);assert.equal(x.room.started,true);x.service.returnToRoom(x.clients[0].ws);assert.equal(x.room.started,false);assert.deepEqual(session.bracket,bracket);
 begin(x);assert.equal(x.room.championship!.bracket.complete,false);
});
test('championship eliminated viewer gets read-only snapshot + input stream matching authority',()=>{
 const x=setup('championship',4);begin(x);const session=x.room.championship!,matches=session.bracket.rounds[0];
 for(const m of matches)for(const n of m.slots)x.service.championshipReady(x.clients[n!].ws,matchToken(m));
 const first=session.duels.get(matches[0].id)!;first.simulation.state.phase='fight';first.simulation.state.fighters[1].health=0;first.simulation.state.fighters[1].lives=1;
 first.players.forEach(n=>x.service.input(x.clients[n].ws,2,0,first.token));const viewer=x.clients[first.players[1]],start=viewer.messages.find(m=>m.type==='spectate-start');assert.ok(start?.type==='spectate-start');
 const sim=new GameSimulation(['nikalz','jopa']),playback=new SpectatorPlayback(sim,start.state),other=session.duels.get(matches[1].id)!;
 for(let frame=2;frame<30;frame++)other.players.forEach(n=>x.service.input(x.clients[n].ws,frame,0,other.token));
 for(const m of viewer.messages)if(m.type==='input'&&m.matchId===start.matchId)playback.receive(m.seat,m.frame,m.mask);
 while(playback.tick()){/* Consume every complete authoritative frame. */}assert.equal(hashState(sim.state),hashState(other.simulation.state));
 const before=other.last.slice();x.service.input(viewer.ws,30,2047,other.token);assert.deepEqual(other.last,before);
});
test('early returned player reconnects to lobby, preserving others on results',()=>{
 const x=setup();begin(x);finish(x);const token=x.clients[0].messages.find(m=>m.type==='resume-token');assert.ok(token?.type==='resume-token');x.service.returnToRoom(x.clients[0].ws);x.service.detach(x.clients[0].ws,'peer-closed');const next=client();x.service.resume(next.ws,token.token);assert.ok(next.messages.some(m=>m.type==='room-returned'));assert.equal(x.room.started,true);
});

test('disconnect during the final animation continues neutral input without changing finalized results',()=>{
 const x=setup('ffa',2);begin(x);finish(x);const stats=structuredClone(x.room.verification!.simulation.state.statistics);
 x.service.detach(x.clients[1].ws,'peer-closed',1000);
 for(let frame=3;frame<100;frame++){x.service.input(x.clients[0].ws,frame,0,x.room.matchId);x.service.recoveryTick(1001);}
 assert.equal(x.room.verification!.simulation.state.frame,100);assert.deepEqual(x.room.verification!.simulation.state.statistics,stats);
});

for(const mode of ['ffa','2v2','3v3'] as const)test(`${mode}: selected arena is preserved for all peers and authority`,()=>{
 const x=setup(mode,mode==='2v2'?4:mode==='3v3'?6:2);x.service.configure(x.clients[0].ws,{stage:'shopping-mall'});begin(x);
 assert.equal(x.room.stage,'shopping-mall');assert.equal(x.room.verification!.simulation.stage.id,'shopping-mall');
 for(const c of x.clients)assert.ok(c.messages.some(m=>m.type==='start'&&m.stage==='shopping-mall'));
});
