import test from 'node:test';
import assert from 'node:assert/strict';
import {LobbyBudget,RoomlessDeadline} from '../apps/server/src/lobbyProtection.js';
import {RoomService} from '../apps/server/src/rooms.js';
test('roomless deadline permits loading, expires without membership, and ignores active rooms',()=>{
 const clock=new RoomlessDeadline(0);assert.equal(clock.expired(false,119999),false);assert.equal(clock.expired(false,120000),true);
 assert.equal(clock.expired(true,120001),false);assert.equal(clock.expired(true,900000),false);
 assert.equal(clock.expired(false,900001),false);assert.equal(clock.expired(false,1020001),true);
});
test('lobby commands have an independent refillable per-socket budget',()=>{
 const b=new LobbyBudget(),s={};for(let i=0;i<10;i++)assert.equal(b.allow(s,'a',0),true);
 assert.equal(b.allow(s,'a',0),false);assert.equal(b.allow(s,'a',2999),false);assert.equal(b.allow(s,'a',3000),true);
 assert.equal(b.allow({},'a',3000),true);
});
test('address budget survives reconnects while allowing 64 simultaneous local participants',()=>{
 const b=new LobbyBudget();for(let i=0;i<128;i++)assert.equal(b.allow({},'a',0),true);
 assert.equal(b.allow({},'a',0),false);assert.equal(b.allow({},'b',0),true);assert.equal(b.allow({},'a',500),true);
 assert.equal(b.allow({},'a',600001),true);
});
test('waiting-room expiration removes membership and closes its sockets',t=>{
 let now=0;t.mock.method(Date,'now',()=>now);const rooms=new RoomService();let closed=0;
 const s={readyState:1,bufferedAmount:0,send(){},close(){closed++;}};rooms.create(s as never,'nikalz');
 now=900001;rooms.expire();assert.equal(closed,1);assert.equal(rooms.rooms.size,0);assert.equal(rooms.membership.size,0);
});
