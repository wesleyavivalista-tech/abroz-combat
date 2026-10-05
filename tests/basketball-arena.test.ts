import {stageAtTick} from '../packages/game-core/stages/motion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {basketballCourt,trainingRoom,stages} from '../packages/game-core/stages/registry.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {surfaceBelow} from '../packages/game-core/simulation/StageCollision.js';
import {activateEide} from '../packages/game-core/simulation/EideSystem.js';
import {RoomService} from '../apps/server/src/rooms.js';
import {currentMatches,matchToken} from '../packages/game-core/tournament/Championship.js';
import type {ServerMessage} from '../packages/shared/protocol.js';

test('court has three equal-width platforms, with the top centered above the lower pair',()=>{
 const [a,b,c]=basketballCourt.platforms!;
 assert.equal(a.width,b.width);assert.equal(b.width,c.width);
 assert.equal(a.y,b.y);assert.ok(c.y>a.y);
 assert.equal(c.x+c.width/2,basketballCourt.width/2);
 assert.equal(surfaceBelow(basketballCourt,1200,599),0);
 assert.equal(surfaceBelow(basketballCourt,1200,600),600);
 assert.equal(surfaceBelow(basketballCourt,540,600),300);
});

test('every fighter lands on each court platform and can double-jump from lower to upper height',()=>{
 for(const id of Object.keys(characters))for(const p of basketballCourt.platforms!){
  const g=new GameSimulation([id,'gut'],false,basketballCourt);g.state.phase='fight';
  const f=g.state.fighters[0];Object.assign(f,{x:p.x+p.width/2,y:p.y+100,vy:-1,state:'Fall'});
  for(let i=0;i<40;i++)g.step([0,0]);
  assert.equal(f.y,p.y,id);assert.equal(f.vy,0,id);
  let peak=f.y;
  for(let i=0;i<70;i++){g.step([i===0||i===16?Button.Up:0,0]);peak=Math.max(peak,f.y);}
  assert.ok(peak>p.y+300,`${id} can reach next tier`);
 }
});

test('Eide companions use each arena layout and replay their entrances exactly',()=>{
 for(const stage of Object.values(stages)){
  const g=new GameSimulation(['eide','gut'],false,stage);g.state.phase='fight';
  activateEide(g.state,stage,g.state.fighters[0],0,characters.eide.moves.love);
  for(let i=0;i<25;i++)g.step([0,0]);const snapshot=g.snapshot();
  for(let i=0;i<300;i++)g.step([0,0]);const expected=hashState(g.state);
  assert.deepEqual(g.state.clones.map(c=>[c.fighter.x,c.fighter.y]),stage.eideLovePlatforms!.map((i,seat)=>{const p=stageAtTick(stage,g.state.platformTick??0).platforms![i];return [p.x+p.width*(stage.eideLoveOffsets?.[seat]??.5),p.y];}));
  g.restore(snapshot);for(let i=0;i<300;i++)g.step([0,0]);assert.equal(hashState(g.state),expected);
 }
});

test('all fighters and skins can execute every special and ultimate at every court tier with deterministic recovery',()=>{
 const inputs=[Button.Special,Button.Special2,Button.Super1,Button.Super2];
 for(const c of Object.values(characters))for(const skin of c.skins??[{id:'original'}])for(const y of [0,300,600])for(const button of inputs){
  const g=new GameSimulation([c.id,'gut'],false,basketballCourt,undefined,[skin.id,'original']);g.state.phase='fight';
  const f=g.state.fighters[0],d=g.state.fighters[1];
  Object.assign(f,{x:y===300?500:1100,y,state:'Idle',meter:100});
  Object.assign(d,{x:f.x+150,y,state:'Idle'});
  g.step([button,0]);assert.ok(f.move,`${c.id}/${skin.id} ${button} at ${y}`);
  for(let i=0;i<110;i++)g.step([0,0]);const snapshot=g.snapshot();
  const run=()=>{for(let i=0;i<170;i++)g.step([0,0]);};run();
  for(const actor of [...g.state.fighters,...g.state.clones.map(c=>c.fighter)]){
   for(const key of ['x','y','vx','vy','health','meter'] as const)assert.ok(Number.isFinite(actor[key]),`${c.id} ${key}`);
   assert.ok(actor.y>=basketballCourt.floorHeight);
  }
  for(const p of g.state.projectiles.filter(p=>p.active))assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
  const hash=hashState(g.state);g.restore(snapshot);run();assert.equal(hashState(g.state),hash,`${c.id}/${skin.id} ${button} ${y}`);
 }
});

function client(){const messages:ServerMessage[]=[];const socket={readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),terminate(){}} as unknown as WebSocket;return {socket,messages};}
test('host arena is shared by every peer and championship authority; invalid arenas are rejected',()=>{
 for(const arena of Object.values(stages))for(const mode of ['ffa','championship'] as const){
  const service=new RoomService(),a=client(),b=client();
  assert.throws(()=>service.create(a.socket,'eide',2,mode,undefined,undefined,'unknown'),/Invalid arena/);
  service.create(a.socket,'eide',2,mode,undefined,undefined,arena.id);
  const room=[...service.rooms.values()][0];service.join(b.socket,room.code,'gut');
  service.ready(a.socket);service.ready(b.socket);
  for(const c of [a,b])assert.ok(c.messages.some(m=>m.type==='roster'&&m.stage===arena.id));
  if(mode==='championship'){
   const session=room.championship!,m=currentMatches(session.bracket)[0];
   for(const c of [a,b])session.acknowledge(c.socket,matchToken(m));
   assert.equal([...session.duels.values()][0].simulation.stage,arena);
   for(const c of [a,b])assert.ok(c.messages.some(m=>m.type==='championship-start'&&m.stage===arena.id));
  }else for(const c of [a,b])assert.ok(c.messages.some(m=>m.type==='start'&&m.stage===arena.id));
 }
 const g=new GameSimulation();assert.equal(g.stage,trainingRoom);
});
