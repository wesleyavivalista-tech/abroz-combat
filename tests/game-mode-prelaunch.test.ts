import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {createChampionship,currentMatches,startBracketMatch,finishBracketMatch,withdrawEntrant,matchToken} from '../packages/game-core/tournament/Championship.js';
import {ELIMINATION_BREAK_FRAMES} from '../packages/game-core/simulation/EliminationSystem.js';
import {TOURNAMENT_BREAK_FRAMES} from '../packages/game-core/simulation/TournamentSystem.js';
import {RoomService} from '../apps/server/src/rooms.js';
import type {WebSocket} from 'ws';

for(let count=2;count<=16;count++)test(`${count}-entrant brackets finish after draws and withdrawal of any participant`,()=>{
 for(let departure=-1;departure<count;departure++){
  const b=createChampionship(Array.from({length:count},(_,id)=>({id,name:`P${id}`,character:'jopa',skin:'santos'})));
  let played=0;
  while(!b.complete){
   assert.ok(played++<count*2,'bracket must make progress');
   const m=currentMatches(b).find(m=>m.status==='ready');assert.ok(m,'next match must exist');
   startBracketMatch(b,m.id);const oldToken=matchToken(m);
   finishBracketMatch(b,m.id,null);assert.notEqual(matchToken(m),oldToken);
   if(departure>=0&&!b.entrants[departure].withdrawn)withdrawEntrant(b,departure);
   if(b.complete)break;
   const next=currentMatches(b).find(m=>m.status==='ready');assert.ok(next);
   startBracketMatch(b,next.id);finishBracketMatch(b,next.id,next.slots[played%2]);
  }
  assert.notEqual(b.champion,null);assert.ok(!b.entrants[b.champion!].withdrawn);
 }
});

for(let count=2;count<=8;count++)test(`${count}-player survival, first-to-three and elimination terminal/transition matrix`,()=>{
 for(const mode of [false,true,'elimination'] as const){
  const sim=new GameSimulation(Array(count).fill('jopa'),false,undefined,undefined,undefined,mode);
  const neutral=Array(count).fill(0);sim.state.phase='fight';
  // All final lives expire on the same simulation tick.
  sim.state.fighters.forEach(f=>{f.health=0;f.lives=1;});sim.step(neutral);
  assert.equal(sim.state.phase,'result');assert.equal(sim.state.winner,-1);
  assert.ok(sim.state.projectiles.every(p=>!p.active));assert.equal(sim.state.clones.length,0);
  if(mode===false){sim.step(neutral);assert.equal(sim.state.winner,-1);continue;}
  sim.state.phaseFrame=mode===true?TOURNAMENT_BREAK_FRAMES:ELIMINATION_BREAK_FRAMES;
  sim.step(neutral);assert.equal(sim.state.phase,'intro');assert.ok(sim.state.fighters.every(f=>f.lives===3));
  let fights=0;
  while(!(sim.state.tournament?.complete||sim.state.elimination?.complete)){
   assert.ok(fights++<count*count+5,'competition must finish');
   sim.state.phase='fight';const active=sim.state.elimination?.active??sim.state.fighters.map((_,i)=>i);
   const winner=active[0];for(const i of active)if(i!==winner){sim.state.fighters[i].health=0;sim.state.fighters[i].lives=1;}
   sim.step(neutral);assert.equal(sim.state.phase,'result');
   const copy=new GameSimulation(Array(count).fill('jopa'));copy.restore(sim.snapshot());
   sim.state.phaseFrame=mode===true?TOURNAMENT_BREAK_FRAMES:ELIMINATION_BREAK_FRAMES;copy.state.phaseFrame=sim.state.phaseFrame;
   sim.step(neutral);copy.step(neutral);assert.equal(hashState(sim.state),hashState(copy.state));
  }
  const result=hashState(sim.state);assert.ok(result);assert.ok(sim.state.winner>=0);
  const champion=sim.state.winner;for(let i=0;i<10;i++)sim.step(neutral);
  assert.equal(sim.state.winner,champion);assert.equal(sim.state.phase,'result');
 }
});

for(const count of [4,6])test(`${count/2}v${count/2} simultaneous team deaths and total draw`,()=>{
 for(const all of [false,true]){
  const teams=Array.from({length:count},(_,i)=>i%2),sim=new GameSimulation(Array(count).fill('jopa'),false,undefined,teams);
  sim.state.phase='fight';sim.state.fighters.forEach((f,i)=>{if(all||teams[i]===0){f.health=0;f.lives=1;}});
  sim.step(Array(count).fill(0));assert.equal(sim.state.phase,'result');assert.equal(sim.state.winner,all?-1:1);
 }
});

for(let count=2;count<=16;count++)test(`${count}-player online championship advances all duels and clears room ownership`,()=>{
 const rooms=new RoomService();
 const clients=Array.from({length:count},()=>({readyState:1,bufferedAmount:0,send(){},close(){},terminate(){}} as unknown as WebSocket));
 rooms.create(clients[0],'jopa',count,'championship');const room=[...rooms.rooms.values()][0];
 clients.slice(1).forEach(c=>rooms.join(c,room.code,'jopa'));clients.forEach(c=>rooms.ready(c));rooms.startMatch(clients[0]);const session=room.championship!;
 let attempts=0;
 while(!session.bracket.complete){
  assert.ok(attempts++<count*2);
  for(const m of [...currentMatches(session.bracket)].filter(m=>m.status==='ready')){
   for(const seat of m.slots)rooms.championshipReady(clients[seat!],matchToken(m));
   const duel=session.duels.get(m.id)!;assert.ok(duel);
   duel.simulation.state.phase='fight';duel.simulation.state.fighters[1].health=0;duel.simulation.state.fighters[1].lives=1;
   duel.players.forEach(p=>rooms.input(clients[p],2,0,duel.token));
  }
 }
 assert.equal(session.duels.size,0);assert.equal(session.ready.size,0);assert.equal(session.expired(Date.now()+999999).length,0);
 clients.forEach(c=>rooms.leave(c));assert.equal(rooms.rooms.size,0);assert.equal(rooms.membership.size,0);
});

for(const mode of [true,'elimination','elimination-party'] as const)test(`${mode}: departures during fight and exactly at the break deadline`,()=>{
 for(const duringBreak of [false,true])for(const everyone of [false,true]){
  const sim=new GameSimulation(Array(6).fill('jopa'),false,undefined,undefined,undefined,mode,90210);
  const neutral=Array(6).fill(0);sim.state.phase='fight';
  if(duringBreak){
   const winningTeam=sim.state.teams[0];
   sim.state.fighters.forEach((f,i)=>{if(sim.state.teams[i]!==winningTeam){f.health=0;f.lives=1;}});
   sim.step(neutral);assert.equal(sim.state.phase,'result');
   sim.state.phaseFrame=mode===true?TOURNAMENT_BREAK_FRAMES:ELIMINATION_BREAK_FRAMES;
  }
  const departures=Array.from({length:everyone?6:5},(_,i)=>i);
  const copy=new GameSimulation(Array(6).fill('jopa'));copy.restore(sim.snapshot());
  sim.step(neutral,departures);copy.step(neutral,departures);
  assert.equal(hashState(sim.state),hashState(copy.state));assert.equal(sim.state.phase,'result');
  assert.equal(sim.state.winner,everyone?-1:5);assert.ok(sim.state.tournament?.complete||sim.state.elimination?.complete);
  for(let i=0;i<3;i++)sim.step(neutral,departures);
  assert.equal(sim.state.winner,everyone?-1:5);
 }
});

test('party first-out simultaneous deaths resolve tied contestants and terminate',()=>{
 for(const tied of [2,3,4,5]){
  const sim=new GameSimulation(Array(6).fill('jopa'),false,undefined,undefined,undefined,'elimination-party',123);
  const neutral=Array(6).fill(0);
  // A departure legally advances the party to its five-player first-out stage.
  sim.step(neutral,[5]);sim.state.phaseFrame=ELIMINATION_BREAK_FRAMES;sim.step(neutral);
  assert.equal(sim.state.elimination!.stage,'first-out');sim.state.phase='fight';
  for(let i=0;i<tied;i++){sim.state.fighters[i].health=0;sim.state.fighters[i].lives=1;}
  sim.step(neutral);assert.deepEqual(sim.state.elimination!.next!.active,Array.from({length:tied},(_,i)=>i));
  let fights=0;
  while(!sim.state.elimination!.complete){
   assert.ok(fights++<40);
   sim.state.phaseFrame=ELIMINATION_BREAK_FRAMES;sim.step(neutral);sim.state.phase='fight';
   const active=sim.state.elimination!.active;
   if(sim.state.elimination!.stage==='first-out'){
    const f=sim.state.fighters[active.at(-1)!];f.health=0;f.lives=1;
   }else{
    const team=sim.state.teams[active[0]];
    for(const seat of active)if(sim.state.teams[seat]!==team){sim.state.fighters[seat].health=0;sim.state.fighters[seat].lives=1;}
   }
   sim.step(neutral);
  }
  assert.ok(sim.state.elimination!.champion>=0);assert.ok(!sim.state.elimination!.remaining.includes(5));
 }
});
