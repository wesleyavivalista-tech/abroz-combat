import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {RoomService} from '../apps/server/src/rooms.js';
import type {ServerMessage} from '../packages/shared/protocol.js';
import {currentMatches,matchToken} from '../packages/game-core/tournament/Championship.js';
function peer(){const messages:ServerMessage[]=[];return {messages,socket:{readyState:1,bufferedAmount:0,send:(text:string)=>messages.push(JSON.parse(text)),close(){},terminate(){}} as unknown as WebSocket};}
function pair(mode:'ffa'|'championship'='ffa'){
 const service=new RoomService(),a=peer(),b=peer();service.create(a.socket,'nikalz',2,mode);const room=[...service.rooms.values()][0];service.join(b.socket,room.code,'jopa');return {service,a,b,room};
}
test('ready is idempotent before and after match launch',()=>{
 const {service,a,b}=pair();service.ready(a.socket);const before=b.messages.length;
 for(let i=0;i<100;i++)service.ready(a.socket);assert.equal(b.messages.length,before);
 service.ready(b.socket);const started=b.messages.length;
 for(let i=0;i<100;i++)service.ready(a.socket);assert.equal(b.messages.length,started);
 assert.equal(b.messages.filter(m=>m.type==='start').length,1);
});
test('championship readiness cannot amplify duplicate acknowledgements',()=>{
 const {service,a,b,room}=pair('championship');service.ready(a.socket);service.ready(b.socket);
 const session=room.championship!,token=matchToken(currentMatches(session.bracket)[0]);
 service.championshipReady(a.socket,token);const before=b.messages.length;
 for(let i=0;i<100;i++)service.championshipReady(a.socket,token);assert.equal(b.messages.length,before);
 service.championshipReady(b.socket,token);assert.equal(session.duels.size,1);
});
test('arena IDs cannot use array-to-string coercion',()=>{
 const service=new RoomService(),a=peer();
 assert.throws(()=>service.create(a.socket,'nikalz',2,'ffa',undefined,undefined,['the-foundry'] as unknown as string),/arena/i);
 assert.equal(service.rooms.size,0);
});
test('invalid input cannot mutate progress or claim a different seat',()=>{
 const {service,a,b,room}=pair();service.ready(a.socket);service.ready(b.socket);
 const before=room.peers[0].lastFrame;
 for(const value of [NaN,Infinity,-Infinity,-1,2.5,10_000_001,'2',null,{}])assert.throws(()=>service.input(a.socket,value as number,0));
 for(const mask of [NaN,Infinity,-1,2048,1.5,'1',null,{}])assert.throws(()=>service.input(a.socket,2,mask as number));
 assert.equal(room.peers[0].lastFrame,before);
 const outsider=peer();assert.throws(()=>service.input(outsider.socket,2,0));
 service.input(a.socket,2,2047);assert.deepEqual(b.messages.at(-1),{type:'input',seat:0,frame:2,mask:2047});
 assert.throws(()=>service.input(a.socket,2,0),/order/);assert.equal(room.peers[1].lastFrame,1);
});
test('duplicate and stale hashes do not amplify traffic',()=>{
 const {service,a,b}=pair();service.ready(a.socket);service.ready(b.socket);
 const before=b.messages.length;service.relayHash(a.socket,0,'deadbeef');assert.equal(b.messages.length,before);
 for(let i=0;i<100;i++)service.relayHash(a.socket,0,'deadbeef');assert.equal(b.messages.length,before);
 for(let f=2;f<=60;f++){service.input(a.socket,f,0);service.input(b.socket,f,0);}
 const settled=b.messages.filter(m=>m.type==='hash');assert.ok(settled.some(m=>m.type==='hash'&&m.seat===-1&&m.frame===60));const after=b.messages.length;service.relayHash(a.socket,60,'123');assert.equal(b.messages.length,after);
 service.relayHash(a.socket,0,'bad');assert.equal(b.messages.length,after);
});

test('championship hashes and inputs are scoped to socket ownership and attempt',()=>{
 const {service,a,b,room}=pair('championship');service.ready(a.socket);service.ready(b.socket);
 const session=room.championship!,token=matchToken(currentMatches(session.bracket)[0]);
 service.championshipReady(a.socket,token);service.championshipReady(b.socket,token);
 const duel=[...session.duels.values()][0],before=duel.simulation.snapshot(),count=b.messages.length;
 service.input(a.socket,2,0,'wrong-attempt');service.relayHash(a.socket,0,'123','wrong-attempt');
 service.finished(a.socket,0);assert.deepEqual(duel.simulation.snapshot(),before);assert.equal(b.messages.length,count);
 const hashed=b.messages.length;service.relayHash(a.socket,0,'123',token);assert.equal(b.messages.length,hashed);service.relayHash(a.socket,0,'456',token);assert.equal(b.messages.length,hashed);
 for(const value of [NaN,Infinity,-1,2048])assert.throws(()=>service.input(a.socket,2,value,token));
 service.input(a.socket,2,0,token);assert.deepEqual(duel.last,[2,1]);
});

import {spawn} from 'node:child_process';
import {contentVersion} from '../packages/shared/contentVersion.js';
test('real sockets reject malformed commands, ignore stat/seat forgery, and disconnect message floods',{timeout:15000},async()=>{
 const child=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 const sockets:WebSocket[]=[];const queues=new Map<WebSocket,ServerMessage[]>();
 try{
  const port=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),8000);child.once('error',reject);child.stdout.on('data',data=>{const m=String(data).match(/port (\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});});
  const connect=async()=>{const s=new WebSocket(`ws://127.0.0.1:${port}`);sockets.push(s);queues.set(s,[]);s.on('message',raw=>queues.get(s)!.push(JSON.parse(String(raw))));await new Promise<void>((r,j)=>{s.once('open',r);s.once('error',j);});return s;};
  const next=async(s:WebSocket,type:string)=>{for(let i=0;i<400;i++){const q=queues.get(s)!,n=q.findIndex(m=>m.type===type);if(n>=0)return q.splice(n,1)[0];await new Promise(r=>setTimeout(r,5));}throw Error(`Missing ${type}`);};
  const a=await connect(),b=await connect();
  for(const payload of ['{','null','[]','{"type":"heal","hp":999999}','{"type":"create","character":"__proto__","contentVersion":'+JSON.stringify(contentVersion())+'}']){a.send(payload);await next(a,'error');}
  a.send(JSON.stringify({type:'create',character:'nikalz',contentVersion:contentVersion()}));const room=await next(a,'room');assert.equal(room.type,'room');if(room.type!=='room')return;
  b.send(JSON.stringify({type:'join',code:room.code,character:'jopa',contentVersion:contentVersion()}));await next(b,'room');
  a.send('{"type":"ready"}');b.send('{"type":"ready"}');await next(a,'start');await next(b,'start');
  a.send('{"type":"input","frame":2,"mask":16,"seat":1,"hp":999999,"damage":99999,"x":999999}');
  assert.deepEqual(await next(b,'input'),{type:'input',seat:0,frame:2,mask:16});
  for(const payload of ['{"type":"input","frame":3,"mask":1e999}','{"type":"input","frame":3,"mask":-1}','{"type":"input","frame":2,"mask":0}']){a.send(payload);await next(a,'error');}
  a.send('{"type":"input","frame":3,"mask":0}');assert.deepEqual(await next(b,'input'),{type:'input',seat:0,frame:3,mask:0});
  const flood=await connect();const closed=new Promise<void>(r=>flood.once('close',()=>r()));for(let i=0;i<300;i++)flood.send('{"type":"ping","sent":1}');await closed;
  assert.ok(queues.get(flood)!.filter(m=>m.type==='pong').length<=240);
  b.send('{"type":"ping","sent":123}');assert.deepEqual(await next(b,'pong'),{type:'pong',sent:123});
 }finally{sockets.forEach(s=>s.terminate());child.kill();}
});
