import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {decodeSnapshot} from '../packages/shared/recovery.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {contentVersion} from '../packages/shared/contentVersion.js';
import type {ServerMessage} from '../packages/shared/protocol.js';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function boot(recoveryPath?:string){
 // No inherited credentials, fixed loopback clients, ephemeral port; never Fly.
 const child=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{PATH:process.env.PATH,PORT:'0',NODE_ENV:'test',MAX_CONNECTIONS:'2',MAX_CONNECTIONS_PER_ADDRESS:'2',TRUST_FLY_PROXY:'0',...(recoveryPath?{ABROZ_RECOVERY_ENABLED:'1',ABROZ_RECOVERY_PATH:recoveryPath}:{})},stdio:['ignore','pipe','pipe']});
 let output='';
 const port=await new Promise<number>((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Local boot timeout'));},8000);
  child.once('error',e=>{clearTimeout(timer);reject(e);});
  child.stdout.on('data',raw=>{output+=String(raw);const m=output.match(/port (\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});
 });
 return {child,base:`http://127.0.0.1:${port}`,url:`ws://127.0.0.1:${port}`};
}
async function stop(child:ChildProcess){if(child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill('SIGCONT');child.kill('SIGTERM');await exit;}}
async function client(url:string){
 assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+$/);
 const ws=new WebSocket(url),queue:ServerMessage[]=[];ws.on('error',()=>{});ws.on('message',raw=>queue.push(JSON.parse(String(raw))));await once(ws,'open');
 return {ws,async next(type:ServerMessage['type']){for(let n=0;n<400;n++){const at=queue.findIndex(m=>m.type===type);if(at>=0)return queue.splice(at,1)[0];await delay(5);}throw Error('Missing '+type);}};
}
test('isolated crash loses old rooms; a replacement process accepts fresh rooms',{timeout:20000},async()=>{
 const first=await boot();const peers:WebSocket[]=[];let replacement:Awaited<ReturnType<typeof boot>>|undefined;
 try{
  const a=await client(first.url);peers.push(a.ws);
  a.ws.send(JSON.stringify({type:'create',character:'nikalz',contentVersion:contentVersion(),recovery:1}));const room=await a.next('room');assert.equal(room.type,'room');
  const closed=new Promise(r=>a.ws.once('close',r));const exited=once(first.child,'exit');first.child.kill('SIGKILL');await exited;await closed;
  replacement=await boot();const b=await client(replacement.url);peers.push(b.ws);
  if(room.type==='room')b.ws.send(JSON.stringify({type:'join',code:room.code,character:'jopa',contentVersion:contentVersion(),recovery:1}));
  const error=await b.next('error');assert.ok(error.type==='error'&&error.message==='Room not found');
  b.ws.send(JSON.stringify({type:'create',character:'jopa',contentVersion:contentVersion(),recovery:1}));await b.next('room');
 }finally{peers.forEach(p=>p.terminate());await stop(first.child);if(replacement)await stop(replacement.child);}
});
test('isolated process hang times out health; continuation restores health without restart',{timeout:15000,skip:process.platform==='win32'},async()=>{
 const server=await boot();try{
  server.child.kill('SIGSTOP');
  await assert.rejects(fetch(server.base+'/healthz',{signal:AbortSignal.timeout(250)}));
  server.child.kill('SIGCONT');
  assert.equal((await fetch(server.base+'/healthz',{signal:AbortSignal.timeout(3000)})).status,200);
 }finally{await stop(server.child);}
});
test('isolated connection cap rejects newcomer; closed room clears and capacity recovers',{timeout:15000},async()=>{
 const server=await boot(),sockets:WebSocket[]=[];
 try{
  const a=await client(server.url),b=await client(server.url);sockets.push(a.ws,b.ws);
  a.ws.send(JSON.stringify({type:'create',character:'nikalz',contentVersion:contentVersion(),recovery:1}));await a.next('room');
  const rejected=new WebSocket(server.url);sockets.push(rejected);rejected.on('error',()=>{});await new Promise(r=>rejected.once('close',r));
  assert.equal((await (await fetch(server.base+'/healthz')).json()).connections,2);
  a.ws.terminate();b.ws.terminate();
  for(let n=0;n<200;n++){const h=await (await fetch(server.base+'/healthz')).json();if(h.connections===0){assert.equal(h.rooms,0);break;}if(n===199)assert.fail('Cleanup timeout');await delay(5);}
  const c=await client(server.url);sockets.push(c.ws);c.ws.send(JSON.stringify({type:'create',character:'nikalz',contentVersion:contentVersion(),recovery:1}));await c.next('room');
 }finally{sockets.forEach(s=>s.terminate());await stop(server.child);}
});

test('real local WebSockets reconnect and recover a fresh checkpoint after process crash',{timeout:20000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'abroz-recovery-wire-')),path=join(dir,'checkpoint');
 const first=await boot(path),sockets:WebSocket[]=[];let second:Awaited<ReturnType<typeof boot>>|undefined;
 try{
  const a=await client(first.url),b=await client(first.url);sockets.push(a.ws,b.ws);
  a.ws.send(JSON.stringify({type:'create',character:'nikalz',contentVersion:contentVersion(),recovery:1}));const room=await a.next('room');assert.ok(room.type==='room');
  b.ws.send(JSON.stringify({type:'join',code:room.code,character:'jopa',contentVersion:contentVersion(),recovery:1}));await b.next('room');
  a.ws.send(JSON.stringify({type:'ready'}));b.ws.send(JSON.stringify({type:'ready'}));b.ws.send(JSON.stringify({type:'ping',sent:1}));await b.next('pong');a.ws.send(JSON.stringify({type:'start-match'}));await a.next('start');await b.next('start');
  const tokenA=await a.next('resume-token');assert.ok(tokenA.type==='resume-token');
  const tokenB=await b.next('resume-token');assert.ok(tokenB.type==='resume-token');
  a.ws.send(JSON.stringify({type:'input',frame:2,mask:0}));b.ws.send(JSON.stringify({type:'input',frame:2,mask:0}));await a.next('input');
  const gone=new Promise(r=>b.ws.once('close',r));b.ws.terminate();await gone;await delay(20);
  a.ws.send(JSON.stringify({type:'input',frame:3,mask:0}));const neutral=await a.next('input');assert.ok(neutral.type==='input'&&neutral.mask===0&&neutral.frame===3);
  const c=await client(first.url);sockets.push(c.ws);c.ws.send(JSON.stringify({type:'resume',token:tokenB.token,contentVersion:contentVersion(),recovery:1}));const resumed=await c.next('resume');assert.ok(resumed.type==='resume'&&resumed.state);assert.equal(decodeSnapshot(resumed.state.snapshot).frame,4);
  // Wait for a completed atomic checkpoint, never kill production or an external PID.
  for(let n=0;n<100;n++){try{await stat(path);break;}catch{await delay(20);}}
  await delay(1100);
  const exit=once(first.child,'exit');first.child.kill('SIGKILL');await exit;
  second=await boot(path);const recovered=await client(second.url);sockets.push(recovered.ws);
  recovered.ws.send(JSON.stringify({type:'resume',token:tokenA.token,contentVersion:contentVersion(),recovery:1}));
  const restored=await recovered.next('resume');assert.ok(restored.type==='resume'&&restored.state);assert.ok(decodeSnapshot(restored.state.snapshot).frame>=4);
  const counts=await (await fetch(second.base+'/healthz')).json();assert.equal(counts.rooms,1);assert.equal(counts.connections,1);
 }finally{sockets.forEach(s=>s.terminate());await stop(first.child);if(second)await stop(second.child);await rm(dir,{recursive:true,force:true});}
});
