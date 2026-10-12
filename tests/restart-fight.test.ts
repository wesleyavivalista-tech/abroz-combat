import test from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {RoomService} from '../apps/server/src/rooms.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {spawnInvader} from '../packages/game-core/simulation/InvasionSystem.js';
import {matchToken,currentMatches} from '../packages/game-core/tournament/Championship.js';
import type {OnlineMode,ServerMessage} from '../packages/shared/protocol.js';
function client(){const messages:ServerMessage[]=[];return {messages,ws:{readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},terminate(){}} as unknown as WebSocket};}
function setup(mode:OnlineMode='ffa',n=2){const rooms=new RoomService(()=>{},true),clients=Array.from({length:n},client);rooms.create(clients[0].ws,'nikalz',n,mode);const room=[...rooms.rooms.values()][0];clients.slice(1).forEach(c=>rooms.join(c.ws,room.code,'jopa'));clients.forEach(c=>rooms.ready(c.ws));rooms.startMatch(clients[0].ws);return {rooms,clients,room};}
for(const [mode,n] of [['ffa',2],['ffa',8],['ffa-tournament',4],['2v2',4],['3v3',6],['elimination',4],['elimination-party',6]] as const)test(`restart ${mode}/${n} clears complete combat state and retains initial settings`,()=>{
 const {rooms,clients,room}=setup(mode,n),original=room.verification!,fresh=original.simulation.snapshot();
 const s=original.simulation.state;s.phase='fight';s.phaseFrame=10801;s.frame=12000;
 s.fighters[0].health=10;s.fighters[0].lives=1;s.fighters[0].meter=0;s.fighters[0].state='Special';s.fighters[0].invulnerableUntil=99999;
 s.projectiles[0].active=true;s.projectiles[0].life=900;
 spawnInvader(s,original.simulation.stage,'br-revolver');s.invasion={nextBulletId:1,bullets:[{id:0,sourceId:0,x:200,y:100,vx:4,life:240}]};
 rooms.restart(clients[0].ws);
 assert.notEqual(room.verification,original);assert.deepEqual(room.verification!.simulation.snapshot(),fresh);
 for(const [seat,c] of clients.entries()){
  const m=[...c.messages].reverse().find(m=>m.type==='fight-restarted');assert.ok(m?.type==='fight-restarted');assert.equal(m.seat,seat);
  const rollback=new RollbackManager(new GameSimulation(Array(n).fill('nikalz')),seat);rollback.restoreRecovery(m.state);assert.equal(hashState(rollback.simulation.state),hashState(room.verification!.simulation.state));
 }
 const token=room.matchId;assert.ok(token);
 // Packets queued before restart, including duplicates, cannot affect the new simulation.
 rooms.input(clients[0].ws,12001,16);rooms.finished(clients[0].ws,1);rooms.restart(clients[0].ws);
 assert.equal(room.matchId,token);assert.equal(room.peers[0].lastFrame,1);assert.equal(room.peers[0].finishedFrame,undefined);
 for(let frame=2;frame<65;frame++)clients.forEach(c=>rooms.input(c.ws,frame,0,token));
 assert.equal(room.verification!.simulation.state.frame,65);assert.ok(clients[0].messages.some(m=>m.type==='hash'&&m.matchId===token));
 rooms.expireInactive(Date.now()+31_000);assert.ok(clients[0].messages.some(m=>m.type==='input-wait'&&m.matchId===token&&m.seconds>0));
});
test('only connected host can restart an active fight; rejected requests do not mutate it',()=>{
 const {rooms,clients,room}=setup();const original=room.verification;
 rooms.restart(clients[1].ws);assert.equal(room.verification,original);assert.equal(clients[1].messages.at(-1)?.type,'restart-denied');
 rooms.detach(clients[1].ws,'peer-closed');rooms.restart(clients[0].ws);assert.equal(room.verification,original);
 const token=clients[1].messages.find(m=>m.type==='resume-token');assert.ok(token?.type==='resume-token');rooms.resume(clients[1].ws,token.token);
 room.verification!.simulation.state.phase='result';rooms.restart(clients[0].ws);assert.equal(room.verification,original);
});
test('restart generation survives checkpoint and reconnect; disconnect applies to the fresh fight',()=>{
 const {rooms,clients,room}=setup();rooms.restart(clients[0].ws);const generation=room.matchId;
 const restored=new RoomService(()=>{},true);restored.restoreCheckpoint(rooms.checkpoint(),Date.now());
 const fresh=client(),token=clients[0].messages.find(m=>m.type==='resume-token');assert.ok(token?.type==='resume-token');restored.resume(fresh.ws,token.token);
 const resume=fresh.messages.find(m=>m.type==='resume');assert.ok(resume?.type==='resume');assert.equal(resume.matchId,generation);
 rooms.leave(clients[1].ws);const left=[...clients[0].messages].reverse().find(m=>m.type==='left');assert.ok(left?.type==='left');assert.equal(left.matchId,generation);assert.equal(left.frame,2);
});
test('championship restart preserves prior results, other duels and progression; old packets are ignored',()=>{
 const {rooms,clients,room}=setup('championship',4),session=room.championship!;
 for(const m of currentMatches(session.bracket))for(const id of m.slots)rooms.championshipReady(clients[id!].ws,matchToken(m));
 const [first,second]=[...session.duels.entries()];
 // Finish one simultaneous semifinal normally.
 first[1].simulation.state.phase='fight';first[1].simulation.state.fighters[1].health=0;first[1].simulation.state.fighters[1].lives=1;
 first[1].players.forEach(id=>rooms.input(clients[id].ws,2,0,first[1].token));
 const prior=structuredClone(session.bracket.rounds[0][0]),duel=second[1],old=duel.token,host=clients[duel.players[0]],opponent=clients[duel.players[1]];
 rooms.restart(opponent.ws,old);assert.equal(session.duels.get(second[0]),duel);
 rooms.restart(host.ws,old);const current=session.duels.get(second[0])!;assert.notEqual(current,duel);assert.notEqual(current.token,old);
 assert.deepEqual(session.bracket.rounds[0][0],prior);assert.equal(session.bracket.round,0);assert.equal(session.bracket.complete,false);assert.equal(session.bracket.rounds[0][1].status,'playing');
 rooms.input(host.ws,900,1024,old);rooms.restart(host.ws,old);assert.equal(session.duels.get(second[0]),current);
 current.simulation.state.phase='fight';current.simulation.state.fighters[1].health=0;current.simulation.state.fighters[1].lives=1;
 current.players.forEach(id=>rooms.input(clients[id].ws,2,0,current.token));assert.equal(session.bracket.round,1);assert.equal(session.duels.size,0);
});
