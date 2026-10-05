import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {RoomService} from '../apps/server/src/rooms.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {resolveKnockouts} from '../packages/game-core/simulation/LifeSystem.js';
import {Button} from '../packages/game-core/types.js';
import type {ServerMessage} from '../packages/shared/protocol.js';
const ids=Object.keys(characters).slice(0,8);
test('eight-player FFA waits for everyone, relays seat eight, rejects a ninth, and handles disconnect',()=>{
 const rooms=new RoomService();const clients=Array.from({length:9},()=>{const messages:ServerMessage[]=[];return {messages,socket:{readyState:1,send:(data:string)=>messages.push(JSON.parse(data))} as unknown as WebSocket};});
 rooms.create(clients[0].socket,ids[0],8);const code=[...rooms.rooms.keys()][0];rooms.ready(clients[0].socket);
 for(let i=1;i<8;i++){assert.ok(!clients[0].messages.some(m=>m.type==='start'));rooms.join(clients[i].socket,code,ids[i]);rooms.ready(clients[i].socket);}
 for(const c of clients.slice(0,8)){const start=c.messages.find(m=>m.type==='start');assert.ok(start?.type==='start');assert.deepEqual(start.characters,ids);assert.deepEqual(start.teams,[0,1,2,3,4,5,6,7]);}
 assert.throws(()=>rooms.join(clients[8].socket,code,ids[0]),/full/);
 rooms.input(clients[7].socket,2,Button.Light);assert.deepEqual(clients[0].messages.at(-1),{type:'input',seat:7,frame:2,mask:Button.Light});
 rooms.leave(clients[7].socket);assert.equal(rooms.membership.size,7);assert.equal(clients[0].messages.at(-1)?.type,'left');
});
test('seven and eight FFA spawns are distinct, last seat can win, and ninth fighter is rejected',()=>{
 for(const count of [7,8]){const s=new GameSimulation(ids.slice(0,count));assert.equal(new Set(s.state.fighters.map(f=>f.x)).size,count);assert.equal(s.state.projectiles.length,count*8);s.state.phase='fight';for(let i=0;i<count-1;i++){Object.assign(s.state.fighters[i],{health:0,lives:1});resolveKnockouts(s.state);}assert.equal(s.state.winner,count-1);}
 assert.throws(()=>new GameSimulation([...ids,ids[0]]),/2–8/);
 assert.throws(()=>new GameSimulation(ids,false,undefined,[0,0,0,0,1,1,1,1]),/2v2 or 3v3/);
});
test('all eight peers converge after delayed inputs and a last-seat disconnect',()=>{
 const make=()=>{const s=new GameSimulation(ids);s.state.phase='fight';s.state.fighters.forEach(f=>f.state='Idle');return s;};
 const baseline=make();const peers=ids.map((_,seat)=>new RollbackManager(make(),seat,0,8));
 const input=(frame:number,seat:number)=>frame%37===0?Button.Light:frame%53===0?Button.Up:frame%80<20?(seat<4?Button.Right:Button.Left):0;
 for(let frame=0;frame<180;frame++){
  baseline.step(ids.map((_,seat)=>input(frame,seat)),frame>=120?[7]:[]);
  for(const p of peers){if(p.seat===7&&frame>=120)continue;p.local.set(frame,input(frame,p.seat));for(let seat=0;seat<8;seat++){if(seat===p.seat)continue;const due=frame-(seat%3);if(due>=0&&!(seat===7&&due>=120))p.receive(due,input(due,seat),seat);}if(frame===123)p.disconnect(7,120);assert.equal(p.tick(),true);}
 }
 for(const p of peers.slice(0,7)){for(let seat=0;seat<8;seat++)if(seat!==p.seat&&seat!==7)for(let frame=177;frame<180;frame++)p.receive(frame,input(frame,seat),seat);assert.equal(p.desync,'OK');assert.equal(hashState(p.simulation.state),hashState(baseline.state));}
});
