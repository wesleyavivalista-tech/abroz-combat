import {MATCH_INTRO_FRAMES} from '../packages/game-core/simulation/MatchIntro.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {ELIMINATION_BREAK_FRAMES,type EliminationMode} from '../packages/game-core/simulation/EliminationSystem.js';
import {eliminationPanel} from '../apps/client/src/ui/Elimination.js';
import {resultScreen} from '../apps/client/src/ui/ResultScreen.js';
import {RoomService} from '../apps/server/src/rooms.js';
import type {WebSocket} from 'ws';
const make=(n=4,mode:EliminationMode='elimination',seed=123)=>{const g=new GameSimulation(Array(n).fill('gut'),false,undefined,undefined,undefined,mode,seed);g.state.phase='fight';return g;};
function win(g:GameSimulation,seat:number){const s=g.state,t=s.elimination!;for(const i of t.active)if(s.teams[i]!==s.teams[seat]){s.fighters[i].lives=1;s.fighters[i].health=0;}g.step(s.fighters.map(()=>0));}
function next(g:GameSimulation){g.state.phaseFrame=ELIMINATION_BREAK_FRAMES;g.step(g.state.fighters.map(()=>0));for(let i=0;i<MATCH_INTRO_FRAMES+1;i++)g.step(g.state.fighters.map(()=>0));}
function out(g:GameSimulation,seats:number[]){for(const i of seats){g.state.fighters[i].lives=1;g.state.fighters[i].health=0;}g.step(g.state.fighters.map(()=>0));}
test('standard elimination saves successive winners, removes last unsaved, restores saved players, and crowns final champion',()=>{
 const g=make(),t=g.state.elimination!;win(g,0);assert.deepEqual(t.saved,[0]);assert.deepEqual(t.next?.active,[1,2,3]);assert.match(eliminationPanel(g.state,true),/P1 is safe/);next(g);assert.equal(g.state.fighters[0].lives,0);assert.deepEqual(t.active,[1,2,3]);win(g,2);next(g);assert.deepEqual(t.active,[1,3]);win(g,1);assert.deepEqual(t.eliminated,[3]);next(g);assert.deepEqual(t.active,[0,1,2]);assert.equal(t.round,2);assert.ok(t.active.every(i=>g.state.fighters[i].lives===3));assert.deepEqual(t.saved,[]);win(g,2);next(g);win(g,0);next(g);assert.deepEqual(t.remaining,[0,2]);assert.equal(t.stage,'final');win(g,2);assert.equal(t.champion,2);assert.equal(t.complete,true);assert.deepEqual(t.eliminated,[3,1,0]);assert.match(resultScreen(g.state,'local','GUT',()=>''),/CHAMPION/);
});
test('party follows random 3v3, losing trio, duel, five-player first-out, random 2v2, losing duel, three-player saves and final',()=>{
 const g=make(6,'elimination-party'),s=g.state,t=s.elimination!;assert.equal(t.stage,'teams');assert.equal(s.teams.filter(i=>i===0).length,3);const blue=t.active.filter(i=>s.teams[i]===0);win(g,blue[0]);assert.deepEqual(t.saved,blue);next(g);assert.equal(t.active.length,3);assert.equal(s.teamMatch,false);const safe=t.active[0];win(g,safe);next(g);const eliminated=t.active[1];win(g,t.active[0]);assert.deepEqual(t.eliminated,[eliminated]);next(g);assert.equal(t.stage,'first-out');assert.equal(t.active.length,5);
 const first=t.active[2];out(g,[first]);assert.equal(s.phase,'result');assert.equal(t.eliminated.at(-1),first);next(g);assert.equal(t.stage,'teams');assert.equal(t.active.length,4);assert.equal(t.active.filter(i=>s.teams[i]===0).length,2);win(g,t.active[0]);next(g);assert.equal(t.active.length,2);win(g,t.active[0]);next(g);assert.equal(t.remaining.length,3);assert.equal(t.stage,'save');win(g,t.active[0]);next(g);win(g,t.active[0]);next(g);assert.equal(t.stage,'final');win(g,t.active[1]);assert.equal(t.complete,true);assert.equal(t.remaining.length,1);assert.equal(t.eliminated.length,5);
});
test('party first-out means losing the final life; ties challenge only tied players',()=>{
 const g=make(6,'elimination-party'),t=g.state.elimination!;win(g,t.active[0]);next(g);win(g,t.active[0]);next(g);win(g,t.active[0]);next(g);const active=[...t.active];g.state.fighters[active[0]].health=0;g.step(Array(6).fill(0));assert.equal(t.stage,'first-out');assert.equal(g.state.phase,'fight');assert.equal(t.remaining.length,5);out(g,[active[1],active[2]]);assert.deepEqual(t.next?.active,[active[1],active[2]]);assert.equal(t.remaining.length,5);next(g);win(g,active[1]);assert.deepEqual(t.remaining,active.filter(i=>i!==active[2]));next(g);assert.equal(t.stage,'teams');
});
test('draw replays without saving or eliminating anyone; seat identity and skins survive resets',()=>{
 const g=make(3),t=g.state.elimination!;out(g,[0,1,2]);assert.deepEqual(t.remaining,[0,1,2]);assert.deepEqual(t.saved,[]);assert.match(t.message,/Draw/);const frame=g.state.frame;next(g);assert.ok(g.state.frame>frame);assert.deepEqual(t.active,[0,1,2]);assert.equal(t.round,1);assert.equal(t.fight,2);
});
test('departures from safe and active groups persist and final connected player wins',()=>{
 const g=make(),t=g.state.elimination!;win(g,0);next(g);g.step([0,0,0,0],[0]);assert.ok(t.eliminated.includes(0));next(g);assert.equal(g.state.fighters[0].lives,0);g.step([0,0,0,0],[1,2]);assert.equal(t.champion,3);assert.equal(t.complete,true);
});
test('party assignments use snapshot-seeded randomness and round changes replay exactly',()=>{
 const a=make(6,'elimination-party',88),b=make(6,'elimination-party',88),c=make(6,'elimination-party',91);assert.deepEqual(a.state.teams,b.state.teams);assert.notDeepEqual(a.state.teams,c.state.teams);win(a,a.state.elimination!.active[0]);const snap=a.snapshot();next(a);const hash=hashState(a.state);a.restore(snap);next(a);assert.equal(hashState(a.state),hash);
});
test('party validates six entrants and online rooms share one seed and unique initial seats',()=>{
 assert.throws(()=>make(5,'elimination-party'),/exactly 6/);const r=new RoomService(),messages:Record<string,unknown>[]=[];const sockets=Array.from({length:6},()=>({readyState:1,send:(data:string)=>messages.push(JSON.parse(data))}) as unknown as WebSocket);r.create(sockets[0],'gut',2,'elimination-party');const room=[...r.rooms.values()][0];assert.equal(room.capacity,6);sockets.slice(1).forEach(s=>r.join(s,room.code,'gut'));sockets.forEach(s=>r.ready(s));r.startMatch(sockets[0]);const starts=messages.filter(m=>m.type==='start');assert.equal(starts.length,6);assert.equal(new Set(starts.map(m=>m.seed)).size,1);assert.equal(starts[0].mode,'elimination-party');assert.deepEqual(starts[0].teams,[0,1,2,3,4,5]);
});
test('delayed remote input rolls back across a Party stage change without changing teams or saved players',async()=>{
 const {RollbackManager}=await import('../packages/networking/RollbackManager.js');const base=make(6,'elimination-party');win(base,base.state.elimination!.active[0]);base.state.phaseFrame=ELIMINATION_BREAK_FRAMES-2;const sim=make(6,'elimination-party');sim.restore(base.snapshot());const rb=new RollbackManager(sim,0,0,8);rb.confirmed=0;rb.remotes.forEach(r=>r.set(0,0));for(let n=0;n<180;n++){const frame=base.state.frame,mask=n%7===0?2:0;base.step([0,mask,0,0,0,0]);rb.local.set(frame,0);for(let seat=2;seat<6;seat++)rb.receive(frame,0,seat);assert.equal(rb.tick(),true);rb.receive(frame,mask,1);}assert.equal(hashState(sim.state),hashState(base.state));assert.equal(sim.state.elimination!.active.length,3);assert.equal(rb.desync,'OK');
});
