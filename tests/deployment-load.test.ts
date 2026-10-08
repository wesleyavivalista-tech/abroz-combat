import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {contentVersion} from '../packages/shared/contentVersion.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {stages} from '../packages/game-core/stages/registry.js';
import type {ServerMessage} from '../packages/shared/protocol.js';

test('beta admission: 64 real sockets, eight rooms, settled combat hashes and cleanup',{timeout:40000},async()=>{
 const child=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'0',MAX_CONNECTIONS:'64',MAX_CONNECTIONS_PER_ADDRESS:'64',TRUST_FLY_PROXY:'0',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
 const sockets:WebSocket[]=[],queues:ServerMessage[][]=[],receivedHashes:Map<number,string>[]=[];let inputMessages=0;const errors:string[]=[];
 const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
 try{
  const port=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Boot timeout')),5000);child.once('error',reject);child.stdout.on('data',raw=>{const m=String(raw).match(/port (\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});});
  const next=async(i:number,type:ServerMessage['type'])=>{for(let attempt=0;attempt<400;attempt++){const idx=queues[i].findIndex(m=>m.type===type);if(idx>=0)return queues[i].splice(idx,1)[0];await pause(5);}throw Error('Missing '+type);};
  const simulations:GameSimulation[]=[];
  for(let room=0;room<8;room++){
   let code='';
   for(let seat=0;seat<8;seat++){
    const i=sockets.length,ws=new WebSocket(`ws://127.0.0.1:${port}`,{origin:'http://localhost:5174'});queues.push([]);receivedHashes.push(new Map());sockets.push(ws);
    ws.on('message',raw=>{const m=JSON.parse(String(raw)) as ServerMessage;if(m.type==='input')inputMessages++;else if(m.type==='hash')receivedHashes[i].set(m.frame,m.hash);else if(m.type==='error')errors.push(m.message);else if(m.type!=='roster')queues[i].push(m);});await once(ws,'open');
    const character=['nikalz','jopa','eide','tocha','napa','biel','drupa','gut'][seat];
    ws.send(JSON.stringify({type:seat?'join':'create',code,character,capacity:8,contentVersion:contentVersion()}));
    const joined=await next(i,'room');assert.equal(joined.type,'room');if(joined.type==='room')code=joined.code;
   }
   sockets.slice(room*8,room*8+8).forEach(s=>s.send(JSON.stringify({type:'ready'})));
   const start=await next(room*8,'start');assert.ok(start.type==='start');
   const simulation=new GameSimulation(start.characters,false,stages[start.stage??'the-foundry'],start.teams,start.skins,false,start.seed);
   simulation.step(Array(8).fill(0));simulation.step(Array(8).fill(0));simulations.push(simulation);
  }
  const health=()=>fetch(`http://127.0.0.1:${port}/healthz`).then(r=>r.json()) as Promise<{connections:number;rooms:number}>;
  assert.equal((await health()).connections,64);
  const status=await fetch(`http://127.0.0.1:${port}/connection-status`,{headers:{Origin:'http://localhost:5174'}});
  assert.equal(status.headers.get('Access-Control-Allow-Origin'),'http://localhost:5174');
  assert.equal((await status.json()).reason,'Server full');
  assert.equal((await fetch(`http://127.0.0.1:${port}/connection-status`,{headers:{Origin:'https://untrusted.invalid'}})).status,403);
  assert.equal((await fetch(`http://127.0.0.1:${port}/capacity-test`)).status,404);
  const counts=await (await fetch(`http://127.0.0.1:${port}/healthz`)).json();assert.equal(counts.activeMatches,8);assert.equal(counts.waitingRooms,0);
  const excess=new WebSocket(`ws://127.0.0.1:${port}`);excess.on('error',()=>{});await new Promise(resolve=>excess.once('close',resolve));assert.equal((await health()).connections,64);
  for(let frame=2;frame<602;frame++){
   const masks=Array.from({length:8},(_,seat)=>frame%29===seat?16:frame%47===seat?128:0);
   sockets.forEach((s,i)=>s.send(JSON.stringify({type:'input',frame,mask:masks[i%8]})));
   simulations.forEach(s=>s.step(masks));await pause(17);
   if((frame+1)%60===0){
    for(let attempt=0;attempt<200&&!receivedHashes.every(h=>h.has(frame+1));attempt++)await pause(5);
    for(let i=0;i<64;i++)assert.equal(receivedHashes[i].get(frame+1),hashState(simulations[Math.floor(i/8)].state));
   }
  }
  assert.equal(errors.length,0,errors.join('; '));assert.equal(inputMessages,600*64*7);
  sockets.forEach(s=>s.terminate());
  for(let attempt=0;attempt<100&&(await health()).connections;attempt++)await pause(10);
  assert.deepEqual({connections:(await health()).connections,rooms:(await health()).rooms},{connections:0,rooms:0});
 }finally{sockets.forEach(s=>s.terminate());child.kill('SIGTERM');await once(child,'exit');}
});
