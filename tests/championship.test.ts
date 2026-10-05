import test from 'node:test';
import assert from 'node:assert/strict';
import type { WebSocket } from 'ws';
import { createChampionship, currentMatches, startBracketMatch, finishBracketMatch, withdrawEntrant, matchToken, roundName } from '../packages/game-core/tournament/Championship.js';
import { RoomService } from '../apps/server/src/rooms.js';
import { GameSimulation, hashState } from '../packages/game-core/simulation/GameSimulation.js';
import type { ServerMessage } from '../packages/shared/protocol.js';
import { championshipBracket, championshipSetup } from '../apps/client/src/ui/Championship.js';
const entrants = (n: number) => Array.from({length:n}, (_,id) => ({id,name:`Player ${id+1}`,character:'jopa',skin:'santos'}));
for(let n=2;n<=16;n++) test(`${n} entrants: balanced byes, unique participants, n−1 wins and one champion`,()=>{
 const b=createChampionship(entrants(n));
 const size=2**Math.ceil(Math.log2(n));
 assert.equal(b.rounds[0].filter(m=>m.reason==='bye').length,size-n);
 assert.equal(new Set(b.rounds[0].flatMap(m=>m.slots).filter(id=>id!==null)).size,n);
 let wins=0;
 while(!b.complete){
  const round=b.round;
  const matches=currentMatches(b).filter(m=>m.status==='ready');
  for(let i=0;i<matches.length;i++){
   const m=startBracketMatch(b,matches[i].id);finishBracketMatch(b,m.id,m.slots[0]);wins++;
   if(i<matches.length-1)assert.equal(b.round,round,'round barrier');
  }
 }
 assert.equal(wins,n-1);assert.equal(b.champion,0);assert.equal(roundName(b,b.round),'Final');
});
test('bracket rejects invalid entrants, result injection and duplicate advancement; draw replays',()=>{
 for(const n of [0,1,17])assert.throws(()=>createChampionship(entrants(n)));
 assert.throws(()=>createChampionship([entrants(2)[0],entrants(2)[0]]));
 const b=createChampionship(entrants(2)),m=b.rounds[0][0];
 assert.throws(()=>finishBracketMatch(b,m.id,0));startBracketMatch(b,m.id);
 assert.throws(()=>finishBracketMatch(b,m.id,99));finishBracketMatch(b,m.id,null);
 assert.equal(m.status,'ready');assert.equal(m.attempt,1);assert.equal(b.complete,false);
 startBracketMatch(b,m.id);finishBracketMatch(b,m.id,1);assert.equal(b.champion,1);
 assert.throws(()=>finishBracketMatch(b,m.id,0));
});
test('withdrawals advance opponents, including a player who already won and is waiting',()=>{
 const b=createChampionship(entrants(4));const [first,second]=currentMatches(b);
 startBracketMatch(b,first.id);finishBracketMatch(b,first.id,first.slots[0]);
 assert.equal(b.rounds[1][0].slots[0],first.winner,'show known next-round entrant immediately');
 withdrawEntrant(b,first.winner!);startBracketMatch(b,second.id);finishBracketMatch(b,second.id,second.slots[0]);
 assert.equal(b.complete,true);assert.equal(b.champion,second.winner);
});
function client(){const messages:ServerMessage[]=[];const socket={readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close:()=>{},terminate:()=>{}} as unknown as WebSocket;return {socket,messages};}
function room(n=4){const rooms=new RoomService(),clients=Array.from({length:n},client);rooms.create(clients[0].socket,'jopa',n,'championship');const r=[...rooms.rooms.values()][0];for(const c of clients.slice(1))rooms.join(c.socket,r.code,'jopa');for(const c of clients)rooms.ready(c.socket);return {rooms,clients,r,session:r.championship!};}
function readyAll(t:ReturnType<typeof room>){for(const m of currentMatches(t.session.bracket).filter(m=>m.status==='ready'))for(const id of m.slots)t.rooms.championshipReady(t.clients[id!].socket,matchToken(m));}
function win(t:ReturnType<typeof room>,id:string,loser=1){const d=t.session.duels.get(id)!;d.simulation.state.phase='fight';d.simulation.state.fighters[loser].health=0;d.simulation.state.fighters[loser].lives=1;const frame=d.simulation.state.frame;d.players.forEach(n=>t.rooms.input(t.clients[n].socket,frame,0,d.token));}
test('online assigns independent duels, authoritatively advances rounds and declares champion',()=>{
 const t=room();readyAll(t);assert.equal(t.session.duels.size,2);
 const [first,second]=currentMatches(t.session.bracket);const d=t.session.duels.get(first.id)!;
 t.clients.forEach(c=>c.messages.length=0);
 t.rooms.input(t.clients[d.players[0]].socket,2,0,d.token);
 assert.equal(t.clients[d.players[1]].messages.filter(m=>m.type==='input').length,1);
 assert.equal(t.clients[second.slots[0]!].messages.length,0,'other duel sees no inputs');
 t.rooms.input(t.clients[d.players[1]].socket,2,0,d.token);
 win(t,first.id);assert.equal(t.session.bracket.round,0);assert.equal(t.session.duels.size,1);
 win(t,second.id);assert.equal(t.session.bracket.round,1);assert.equal(t.session.duels.size,0);
 readyAll(t);win(t,t.session.bracket.rounds[1][0].id);
 assert.equal(t.session.bracket.complete,true);assert.equal(t.session.bracket.champion,0);
 assert.ok(t.clients.every(c=>c.messages.some(m=>m.type==='championship'&&m.bracket.complete)));
});
test('server simulation matches client simulation for the same confirmed inputs',()=>{
 const t=room(2);readyAll(t);const d=[...t.session.duels.values()][0];const sim=new GameSimulation(['jopa','jopa'],false,undefined,undefined,d.simulation.state.skins);
 sim.step([0,0]);sim.step([0,0]);
 for(let frame=2;frame<360;frame++){const masks=[frame%80<20?2:16,frame%90<30?1:32];d.players.forEach((id,i)=>t.rooms.input(t.clients[id].socket,frame,masks[i],d.token));sim.step(masks);assert.equal(hashState(sim.state),hashState(d.simulation.state));}
});
test('completed match packets, forged results and spectator inputs cannot affect a new duel',()=>{
 const t=room();readyAll(t);const old=[...t.session.duels.values()][0];const oldId=currentMatches(t.session.bracket)[0].id;
 win(t,oldId);win(t,currentMatches(t.session.bracket)[1].id);readyAll(t);const final=[...t.session.duels.values()][0];
 t.rooms.input(t.clients[0].socket,999,0,old.token);t.rooms.input(t.clients[3].socket,2,0,final.token);t.rooms.finished(t.clients[0].socket,2);
 assert.equal(final.simulation.state.frame,2);assert.equal(t.session.bracket.complete,false);
 assert.throws(()=>t.rooms.input(t.clients[0].socket,20,0,final.token),/order/);
});
test('disconnect affects only assigned duel; withdrawn winners cannot block later rounds',()=>{
 const t=room();readyAll(t);const [m,other]=currentMatches(t.session.bracket);
 t.rooms.leave(t.clients[m.slots[1]!].socket);assert.equal(m.reason,'forfeit');assert.equal(t.session.duels.size,1);
 t.rooms.leave(t.clients[m.winner!].socket);win(t,other.id);
 assert.equal(t.session.bracket.complete,true);assert.equal(t.session.bracket.champion,other.winner);
 assert.equal(t.session.duels.size,0);
});
test('draw restarts readiness and changes token to exclude delayed inputs',()=>{
 const t=room(2);readyAll(t);const d=[...t.session.duels.values()][0];d.simulation.state.phase='fight';d.simulation.state.fighters.forEach(f=>{f.health=0;f.lives=1;});
 d.players.forEach(n=>t.rooms.input(t.clients[n].socket,2,0,d.token));
 assert.equal(t.session.bracket.complete,false);assert.equal(currentMatches(t.session.bracket)[0].attempt,1);readyAll(t);
 const replay=[...t.session.duels.values()][0];assert.notEqual(replay.token,d.token);
 t.rooms.input(t.clients[0].socket,3,0,d.token);assert.equal(replay.simulation.state.frame,2);
});
test('readiness timeout forfeits only unready participants; spectators never expire',()=>{
 const t=room(3);const m=currentMatches(t.session.bracket).find(m=>m.status==='ready')!;
 const ready=m.slots[0]!,late=m.slots[1]!;t.rooms.championshipReady(t.clients[ready].socket,matchToken(m));
 const expired=t.session.expired(Date.now()+120001);assert.deepEqual(expired,[t.clients[late].socket]);
 t.rooms.expireInactive(Date.now()+120001);assert.equal(m.reason,'forfeit');assert.equal(t.session.bracket.round,1);
});
test('championship capacity reaches 16 while existing versus capacity stays 8',()=>{
 const t=room(16);assert.equal(t.session.bracket.entrants.length,16);
 const outsider=client();assert.throws(()=>t.rooms.join(outsider.socket,t.r.code,'jopa'),/full/);
 assert.throws(()=>t.rooms.create(outsider.socket,'jopa',16,'ffa'),/2–8/);
 assert.throws(()=>t.rooms.create(outsider.socket,'jopa',17,'championship'),/2–16/);
 for(const c of t.clients)t.rooms.leave(c.socket);assert.equal(t.rooms.rooms.size,0);assert.equal(t.rooms.membership.size,0);
});
test('bracket escapes names and renders byes, controller assignments, champion and skins',()=>{
 const e=entrants(5);e[0].name='<script>attack</script>';const b=createChampionship(e);let html=championshipBracket(b,false,0,[]);
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('uses Player 1 controls'));assert.ok(html.includes('BYE'));
 assert.ok(championshipSetup(e).includes('Player 5 skin'));
 while(!b.complete){const m=currentMatches(b).find(m=>m.status==='ready')!;startBracketMatch(b,m.id);finishBracketMatch(b,m.id,m.slots[0]);}
 html=championshipBracket(b,false,0,[]);assert.ok(html.includes('TOURNAMENT CHAMPION'));
});
