import test from 'node:test';
import assert from 'node:assert/strict';
import type {VerifiedMatch} from '../apps/server/src/verifiedMatch.js';
import {Admission} from '../apps/server/src/admission.js';
import {StepMetrics} from '../apps/server/src/capacityMetrics.js';
import {RoomService} from '../apps/server/src/rooms.js';
import {connectionFailureReason} from '../apps/client/src/connectionStatus.js';
test('capacity explanations do not consume admission attempts or change limits',()=>{
 const a=new Admission(2,1,2);for(let i=0;i<10;i++)assert.equal(a.reason('a'),undefined);
 assert.equal(a.allow('a'),true);const release=a.connect('a');assert.match(a.reason('a')!,/connections from/);
 a.connect('b');assert.equal(a.reason('c'),'Server full');release();assert.equal(a.reason('c'),undefined);
 assert.equal(a.allow('c',1),true);assert.equal(a.allow('c',1),true);assert.match(a.reason('c',1)!,/attempts/);assert.equal(a.reason('c',60001),undefined);
});
test('step metrics have bounded storage and reset between reporting windows',()=>{
 const m=new StepMetrics();m.observe(2);m.observe(4);assert.deepEqual(m.snapshot(),{simulationSteps:2,simulationStepMeanMs:3,simulationStepMaxMs:4});m.reset();assert.equal(m.snapshot().simulationSteps,0);
});
test('room capacity snapshot distinguishes lobby, running match and results',()=>{
 const rooms=new RoomService();const socket={readyState:1,bufferedAmount:0,send(){}};
 rooms.create(socket as never,'nikalz');assert.equal(rooms.capacitySnapshot().waitingRooms,1);
 const room=[...rooms.rooms.values()][0];room.started=true;room.verification={simulation:{state:{phase:'playing'}}} as unknown as VerifiedMatch;
 assert.equal(rooms.capacitySnapshot().activeMatches,1);room.verification!.simulation.state.phase='result';assert.equal(rooms.capacitySnapshot().activeMatches,0);assert.equal(rooms.capacitySnapshot().resultRooms,1);
});
test('connection status only accepts known errors and safely handles unavailable endpoint',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(input,options)=>{assert.equal(String(input),'https://example.com/connection-status');assert.equal(options?.credentials,'omit');return new Response(JSON.stringify({reason:'Server full'}));};
  assert.equal(await connectionFailureReason('wss://example.com/'), 'Server full');
  globalThis.fetch=async()=>new Response(JSON.stringify({reason:'untrusted text'}));assert.equal(await connectionFailureReason('wss://example.com'),undefined);
  globalThis.fetch=async()=>{throw Error('Offline');};assert.equal(await connectionFailureReason('wss://example.com'),undefined);
 }finally{globalThis.fetch=original;}
});
