import test from 'node:test';
import assert from 'node:assert/strict';
import {ReconnectSeats} from '../apps/server/src/reconnectSeats.js';
test('a random credential reserves only its own seat for thirty seconds',()=>{
 const seats=new ReconnectSeats(),token=seats.issue('room',1);assert.match(token,/^[a-f0-9]{64}$/);
 assert.equal(seats.claim(token,0),undefined);
 seats.reserve('room',1,100);assert.equal(seats.claim('0'.repeat(64),101),undefined);
 const resumed=seats.claim(token,30099)!;assert.equal(resumed.room,'room');assert.equal(resumed.seat,1);assert.equal(resumed.token,token);
 assert.equal(seats.claim(token,30099),undefined);assert.equal(seats.claim(resumed.token,30099),undefined);
});
test('expiry cannot be extended by repeated reserve or malformed attempts',()=>{
 const seats=new ReconnectSeats(),token=seats.issue('room',0);seats.reserve('room',0,0);seats.reserve('room',0,29999);
 for(const value of [null,{},[],123,'x'.repeat(10000)])assert.equal(seats.claim(value,1),undefined);
 assert.equal(seats.claim(token,30000),undefined);
 assert.deepEqual(seats.expire(30000),[{room:'room',seat:0}]);
 assert.deepEqual(seats.expire(30001),[]);
});
test('intentional leave and room cleanup invalidate all associated credentials',()=>{
 const seats=new ReconnectSeats(),a=seats.issue('r',0),b=seats.issue('r',1),c=seats.issue('other',0);
 seats.reserve('r',0,0);seats.reserve('r',1,0);seats.reserve('other',0,0);seats.revoke('r');
 assert.equal(seats.claim(a,1),undefined);assert.equal(seats.claim(b,1),undefined);assert.ok(seats.claim(c,1));
});
test('expiry reports each reserved seat exactly once',()=>{
 const seats=new ReconnectSeats();seats.issue('r',0);seats.reserve('r',0,0);
 assert.deepEqual(seats.expire(29999),[]);assert.deepEqual(seats.expire(30000),[{room:'r',seat:0}]);assert.deepEqual(seats.expire(30001),[]);
});
