import {MATCH_INTRO_FRAMES} from '../packages/game-core/simulation/MatchIntro.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {TOURNAMENT_BREAK_FRAMES} from '../packages/game-core/simulation/TournamentSystem.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {tournamentPanel} from '../apps/client/src/ui/TournamentPanel.js';
import {resultScreen} from '../apps/client/src/ui/ResultScreen.js';
import {RoomService} from '../apps/server/src/rooms.js';
import type {WebSocket} from 'ws';
const make=()=>{const s=new GameSimulation(['dodo','drupa','gut'],false,undefined,undefined,undefined,true);s.state.phase='fight';s.state.fighters.forEach(f=>f.state='Idle');return s;};
function win(s:GameSimulation,seat:number){s.state.fighters.forEach((f,i)=>{if(i!==seat){f.health=0;f.lives=1;}});s.step([0,0,0]);}
function next(s:GameSimulation){for(let i=0;i<TOURNAMENT_BREAK_FRAMES+MATCH_INTRO_FRAMES+1;i++)s.step([0,0,0]);}
test('first to three match wins ends tournament; every round restores lives and retains scores',()=>{
 const s=make();win(s,1);assert.deepEqual(s.state.tournament!.wins,[0,1,0]);assert.equal(s.state.tournament!.complete,false);const frame=s.state.frame;
 next(s);assert.ok(s.state.frame>frame);assert.equal(s.state.phase,'fight');assert.equal(s.state.tournament!.round,2);assert.ok(s.state.fighters.every(f=>f.lives===3&&f.health>0));
 win(s,0);next(s);win(s,1);next(s);win(s,1);assert.equal(s.state.tournament!.champion,1);assert.equal(s.state.tournament!.complete,true);assert.deepEqual(s.state.tournament!.wins,[1,3,0]);next(s);assert.equal(s.state.phase,'result');assert.equal(s.state.tournament!.round,4);assert.deepEqual(s.state.tournament!.wins,[1,3,0]);
 assert.match(resultScreen(s.state,'online','DRUPA',()=>''),/TOURNAMENT WINNER/);
});
test('draw grants no wins, break displays standings and countdown, and restarts',()=>{
 const s=make();s.state.fighters.forEach(f=>{f.health=0;f.lives=1;});s.step([0,0,0]);assert.deepEqual(s.state.tournament!.wins,[0,0,0]);assert.match(tournamentPanel(s.state,true),/DRAW — NO WIN AWARDED/);assert.match(tournamentPanel(s.state,true),/Next match in 8s/);next(s);assert.equal(s.state.tournament!.round,2);
});
test('departures persist across matches and last connected player wins by forfeit',()=>{
 const s=make();s.step([0,0,0],[2]);win(s,0);next(s);assert.equal(s.state.fighters[2].lives,0);s.step([0,0,0],[1,2]);assert.equal(s.state.tournament!.champion,0);assert.equal(s.state.tournament!.byForfeit,true);assert.equal(s.state.phase,'result');
});
test('tournament scores and round transitions replay deterministically after rollback',()=>{
 const base=make();win(base,1);base.state.phaseFrame=TOURNAMENT_BREAK_FRAMES-2;const snapshot=base.snapshot();const sim=make();sim.restore(snapshot);const rb=new RollbackManager(sim,0,0,8);rb.confirmed=0;rb.remotes.forEach(remote=>remote.set(0,0));
 for(let n=0;n<MATCH_INTRO_FRAMES+20;n++){const frame=base.state.frame;const remote=n%7===0?2:0;base.step([0,remote,0]);rb.local.set(frame,0);rb.receive(frame,0,2);assert.equal(rb.tick(),true);rb.receive(frame,remote,1);}
 assert.equal(hashState(sim.state),hashState(base.state));assert.equal(sim.state.tournament!.round,2);assert.deepEqual(sim.state.tournament!.wins,[0,1,0]);
});
test('eight-player tournament room broadcasts tournament mode and unique FFA teams',()=>{
 const r=new RoomService();const messages:Record<string,unknown>[]=[];const sockets=Array.from({length:8},()=>({readyState:1,send:(data:string)=>messages.push(JSON.parse(data))}) as unknown as WebSocket);
 r.create(sockets[0],'dodo',8,'ffa-tournament');const code=[...r.rooms.keys()][0];for(let i=1;i<8;i++)r.join(sockets[i],code,'dodo');sockets.forEach(s=>r.ready(s));const start=messages.find(m=>m.type==='start');assert.equal(start?.mode,'ffa-tournament');assert.deepEqual(start?.teams,[0,1,2,3,4,5,6,7]);
});
