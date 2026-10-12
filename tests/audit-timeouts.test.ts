import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {RoomService} from '../apps/server/src/rooms.js';
function setup(t:TestContext){
 let now=1000;t.mock.method(Date,'now',()=>now);
 const rooms=new RoomService();
 const clients=Array.from({length:3},()=>{const messages:{type:string;seat?:number;frame?:number;seconds?:number}[]=[];return {messages,socket:{readyState:1,send:(text:string)=>messages.push(JSON.parse(text)),close(){}} as unknown as WebSocket};});
 rooms.create(clients[0].socket,'roms',3);const code=[...rooms.rooms.keys()][0];
 for(const c of clients.slice(1))rooms.join(c.socket,code,'gut');
 clients.forEach(c=>rooms.ready(c.socket));rooms.startMatch(clients[0].socket);
 return {rooms,clients,advance:(ms:number)=>{now+=ms;rooms.expireInactive(now);}};
}
test('initial loading gets 120 seconds; only the slowest seat forfeits, blocked peers survive',t=>{
 const {rooms,clients,advance}=setup(t);
 for(let frame=2;frame<=10;frame++)for(const c of clients.slice(1))rooms.input(c.socket,frame,0);
 advance(89_999);assert.ok(!clients[0].messages.some(m=>m.type==='input-wait'));
 advance(1);assert.equal(clients[1].messages.at(-1)?.type,'input-wait');
 advance(30_000);assert.ok(!rooms.membership.has(clients[0].socket));assert.equal(rooms.membership.size,2);
 assert.deepEqual(clients[1].messages.filter(m=>m.type==='left').at(-1),{type:'left',seat:0,frame:2});
 rooms.input(clients[1].socket,11,0);rooms.input(clients[2].socket,11,0);assert.equal(rooms.membership.size,2);
});
test('active input timeout warns at 30 seconds, resets on progress and forfeits at 60',t=>{
 const {rooms,clients,advance}=setup(t);clients.forEach(c=>rooms.input(c.socket,2,0));
 for(const c of clients.slice(1))rooms.input(c.socket,3,0);
 advance(30_000);assert.equal(clients[1].messages.at(-1)?.type,'input-wait');
 rooms.input(clients[0].socket,3,0);assert.ok(clients[1].messages.some(m=>m.type==='input-wait'&&m.seconds===0));
 for(const c of clients.slice(1))rooms.input(c.socket,4,0);
 advance(59_999);assert.equal(rooms.membership.size,3);advance(1);assert.equal(rooms.membership.size,2);
 assert.deepEqual(clients[1].messages.filter(m=>m.type==='left').at(-1),{type:'left',seat:0,frame:4});
});
test('finished matches do not time out on the result screen',t=>{
 const {rooms,clients,advance}=setup(t);clients.forEach(c=>{rooms.input(c.socket,2,0);rooms.finished(c.socket,2);});
 [...rooms.rooms.values()][0].verification!.simulation.state.phase='result';
 advance(300_000);assert.equal(rooms.membership.size,3);assert.ok(!clients[0].messages.some(m=>m.type==='input-wait'));
});
test('finished room retention is bounded and repeated claims cannot extend it',t=>{
 const {rooms,clients,advance}=setup(t);clients.forEach(c=>{rooms.input(c.socket,2,0);rooms.finished(c.socket,2);});
 [...rooms.rooms.values()][0].verification!.simulation.state.phase='result';
 advance(899_999);assert.equal(rooms.membership.size,3);
 clients.forEach(c=>rooms.finished(c.socket,2));advance(1);
 assert.equal(rooms.membership.size,0);assert.equal(rooms.rooms.size,0);
});

test('matching forged completion claims cannot bypass authoritative inactivity',t=>{const {rooms,clients,advance}=setup(t);clients.forEach(c=>{rooms.input(c.socket,2,0);rooms.finished(c.socket,2);});assert.notEqual([...rooms.rooms.values()][0].verification!.simulation.state.phase,'result');advance(60_000);assert.equal(rooms.membership.size,0);assert.equal(rooms.rooms.size,0);});
