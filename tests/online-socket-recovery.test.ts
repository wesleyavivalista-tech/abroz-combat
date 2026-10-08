import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {contentVersion} from '../packages/shared/contentVersion.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {shoppingMall} from '../packages/game-core/stages/registry.js';
import {Button} from '../packages/game-core/types.js';
import type {ClientMessage,ServerMessage} from '../packages/shared/protocol.js';

const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
test('eight real sockets survive host loss; reconnect cannot duplicate a seat; survivors agree',async()=>{
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 const sockets:WebSocket[]=[];
 try{
  const port=await new Promise<number>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Server startup timeout')),8000);
   server.once('error',e=>{clearTimeout(timer);reject(e);});
   server.stdout.on('data',data=>{const match=String(data).match(/port (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  });
  const ids=['eide','jopa','nikalz','bozo','napa','biel','luizinho','astolfo'];
  const queues=new Map<WebSocket,ServerMessage[]>();
  const peers:RollbackManager[]=[];const inputs=ids.map(()=>new Map<number,number>());
  const departures=new Map<number,number>();
  const connect=async(seat?:number)=>{
   const socket=new WebSocket(`ws://127.0.0.1:${port}`,{origin:'http://localhost:5174'});sockets.push(socket);queues.set(socket,[]);
   socket.on('message',raw=>{
    const m=JSON.parse(String(raw)) as ServerMessage;queues.get(socket)!.push(m);
    if(seat===undefined||!peers[seat])return;
    if(m.type==='input')peers[seat].receive(m.frame,m.mask,m.seat);
    if(m.type==='left'){departures.set(m.seat,m.frame);peers[seat].disconnect(m.seat,m.frame);}
   });
   await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});return socket;
  };
  const send=(s:WebSocket,m:ClientMessage)=>s.send(JSON.stringify({...m,contentVersion:contentVersion()}));
  const next=async(s:WebSocket,type:ServerMessage['type'])=>{
   for(let n=0;n<600;n++){const q=queues.get(s)!,i=q.findIndex(m=>m.type===type);if(i>=0)return q.splice(i,1)[0];await pause(5);}throw Error(`Missing ${type}`);
  };
  const host=await connect(0);send(host,{type:'create',character:ids[0],capacity:8,stage:shoppingMall.id});
  const room=await next(host,'room');assert.equal(room.type,'room');if(room.type!=='room')return;
  for(let i=1;i<8;i++){const s=await connect(i);send(s,{type:'join',code:room.code,character:ids[i]});await next(s,'room');}
  for(const s of sockets)send(s,{type:'ready'});
  const starts=await Promise.all(sockets.map(s=>next(s,'start')));starts.forEach(s=>assert.deepEqual(s,starts[0]));
  peers.push(...ids.map((_,seat)=>new RollbackManager(new GameSimulation(ids,false,shoppingMall),seat)));
  const mask=(seat:number,frame:number)=>frame%37===seat?Button.Super1:frame%19===seat?Button.Special:frame%23===seat?Button.Super2:0;
  let hostGone=false;
  for(let clock=0;clock<1000&&peers.slice(1).some(p=>p.simulation.state.frame<320);clock++){
   if(!hostGone&&peers[0].simulation.state.frame>=260){host.terminate();hostGone=true;}
   peers.forEach((p,seat)=>{
    if(seat===0&&hostGone||p.simulation.state.frame>=320)return;
    p.schedule(mask(seat,p.simulation.state.frame+2),(frame,value)=>{inputs[seat].set(frame,value);send(sockets[seat],{type:'input',frame,mask:value});});p.tick();
   });
   await pause(10);
  }
  assert.ok(hostGone);assert.equal(departures.size,1);assert.ok(departures.has(0));
  const baseline=new GameSimulation(ids,false,shoppingMall);
  for(let f=0;f<320;f++)baseline.step(ids.map((_,seat)=>f>=(departures.get(seat)??Infinity)?0:inputs[seat].get(f)??0),[...departures].filter(([,frame])=>frame===f).map(([seat])=>seat));
  for(let seat=1;seat<8;seat++){
   assert.equal(peers[seat].simulation.state.frame,320);assert.equal(peers[seat].desync,'OK');
   assert.equal(hashState(peers[seat].simulation.state),hashState(baseline.state));
   assert.ok(!queues.get(sockets[seat])!.some(m=>m.type==='error'));
  }
  const replacement=await connect();send(replacement,{type:'join',code:room.code,character:ids[0]});
  const rejected=await next(replacement,'error');assert.equal(rejected.type,'error');if(rejected.type==='error')assert.match(rejected.message,/full/);
  assert.ok(!queues.get(replacement)!.some(m=>m.type==='room'||m.type==='start'));
  send(replacement,{type:'create',character:'gut'});const fresh=await next(replacement,'room');
  assert.equal(fresh.type,'room');if(fresh.type==='room'){assert.notEqual(fresh.code,room.code);assert.equal(fresh.seat,0);}
 }finally{for(const s of sockets)s.terminate();server.kill();}
});
