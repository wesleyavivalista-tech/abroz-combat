import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import type {IncomingMessage} from 'node:http';
import {allowedOrigins,clientAddress} from '../apps/server/src/deployment.js';
import {contentVersion} from '../packages/shared/contentVersion.js';
test('production origins fail closed; development still supports local browser and desktop',()=>{
 assert.throws(()=>allowedOrigins(undefined,true));
 for(const value of ['*','http://localhost:5174','https://game.test/path','https://user:secret@game.test',''])assert.throws(()=>allowedOrigins(value,true));
 assert.deepEqual(allowedOrigins(' https://game.test,abroz://game ',true),['https://game.test','abroz://game']);
 assert.ok(allowedOrigins(undefined,false).includes('http://localhost:5174'));
});
test('proxy client identity must be explicitly enabled and a valid single IP',()=>{
 const req={headers:{'fly-client-ip':'203.0.113.7','x-forwarded-for':'1.1.1.1'},socket:{remoteAddress:'127.0.0.1'}} as unknown as IncomingMessage;
 assert.equal(clientAddress(req,false),'127.0.0.1');assert.equal(clientAddress(req,true),'203.0.113.7');
 for(const bad of ['203.0.113.7,1.1.1.1','not-an-ip',undefined,['203.0.113.7']]){req.headers['fly-client-ip']=bad;assert.equal(clientAddress(req,true),undefined);}
});
test('maintenance rejects new rooms but preserves existing socket input and health',{timeout:15000},async()=>{
 const child=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'0',NODE_ENV:'production',ALLOWED_ORIGINS:'https://game.test,abroz://game',TRUST_FLY_PROXY:'0'},stdio:['ignore','pipe','pipe']});
 const sockets:WebSocket[]=[];
 try{
  const port=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server boot timeout')),5000);child.once('error',reject);child.stdout.on('data',data=>{const m=String(data).match(/port (\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});});
  const base=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(base+'/readyz')).status,200);assert.equal((await fetch(base+'/missing')).status,404);
  for(let i=0;i<2;i++){const ws=new WebSocket(`ws://127.0.0.1:${port}`,{origin:'https://game.test'});sockets.push(ws);await once(ws,'open');}
  const queues=sockets.map(()=>[] as {type:string;code?:string;frame?:number}[]);sockets.forEach((s,i)=>s.on('message',raw=>queues[i].push(JSON.parse(String(raw)))));
  const next=async(i:number,type:string)=>{for(let n=0;n<200;n++){const found=queues[i].find(m=>m.type===type);if(found)return found;await new Promise(r=>setTimeout(r,5));}throw Error('Missing '+type);};
  sockets[0].send(JSON.stringify({type:'create',character:'nikalz',contentVersion:contentVersion()}));const room=await next(0,'room');
  sockets[1].send(JSON.stringify({type:'join',code:room.code,character:'jopa',contentVersion:contentVersion()}));await next(1,'room');
  sockets.forEach(s=>s.send(JSON.stringify({type:'ready'})));await next(0,'start');
  child.kill('SIGUSR2');
  for(let n=0;n<100;n++){if((await fetch(base+'/readyz')).status===503)break;await new Promise(r=>setTimeout(r,5));}
  assert.equal((await fetch(base+'/readyz')).status,503);assert.equal((await fetch(base+'/healthz')).status,200);
  sockets[0].send(JSON.stringify({type:'input',frame:2,mask:0}));assert.equal((await next(1,'input')).frame,2);
  sockets[0].send(JSON.stringify({type:'create',character:'nikalz',contentVersion:contentVersion()}));await next(0,'error');
  assert.equal((await (await fetch(base+'/healthz')).json() as {rooms:number}).rooms,1);
 }finally{sockets.forEach(s=>s.terminate());child.kill('SIGTERM');await once(child,'exit');}
});
