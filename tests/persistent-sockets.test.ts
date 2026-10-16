import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket,WebSocketServer} from 'ws';
import {ChampionshipStore} from '../apps/server/src/persistent/store.js';
import {PersistentChampionshipService} from '../apps/server/src/persistent/service.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';
import type {ServerMessage,ClientMessage} from '../packages/shared/protocol.js';
for(const size of [1,2,3] as const)test(`${size}v${size}: real sockets, fresh simulations, server hashes and disconnect recovery`,async()=>{
 const db=new ChampionshipStore(':memory:'),wss=new WebSocketServer({port:0});await once(wss,'listening');
 const service=new PersistentChampionshipService(db,(s,m)=>{if(s.readyState===1)s.send(JSON.stringify(m));});
 const failures:unknown[]=[];
 wss.on('connection',socket=>{socket.on('message',raw=>{try{const m=JSON.parse(raw.toString()) as ClientMessage;if(m.type==='persistent')service.command(socket,m,'test');if(m.type==='input')service.input(socket,m.frame,m.mask,m.matchId);}catch(e){failures.push(e);}});socket.on('close',()=>service.leave(socket));});
 const t=db.create({name:'Socket cup',mode:({1:'1v1',2:'2v2',3:'3v3'} as const)[size],stage:trainingRoom.id,competitors:Array.from({length:4},(_,i)=>({name:`Team ${i}`,fighters:['nikalz','jopa','bozo'].slice(0,size).map(id=>size===1?['nikalz','jopa','bozo','napa'][i]:id)}))}).tournament;
 const peers=Array.from({length:size*2},()=>new WebSocket(`ws://127.0.0.1:${(wss.address() as {port:number}).port}`));
 const messages:ServerMessage[][]=peers.map(()=>[]);peers.forEach((s,i)=>s.on('message',raw=>messages[i].push(JSON.parse(raw.toString()))));
 const wait=async(check:()=>boolean)=>{const until=Date.now()+5000;while(!check()){if(Date.now()>until)throw Error('Socket assertion timed out');await new Promise(r=>setTimeout(r,5));}};
 try{
  await Promise.all(peers.map(s=>once(s,'open')));
  peers.forEach((s,i)=>s.send(JSON.stringify({type:'persistent',action:'claim',id:t.id,seriesId:t.series[0].id,slot:i,session:`socket-session-${i}`})));
  await wait(()=>messages.every(ms=>ms.some(m=>m.type==='persistent-detail'&&m.lobbies[0].slots.every(s=>s.occupied))));
  peers.forEach(s=>s.send(JSON.stringify({type:'persistent',action:'ready',ready:true})));
  await wait(()=>messages.every(ms=>ms.some(m=>m.type==='persistent-start')));
  const start=messages[0].find(m=>m.type==='persistent-start')!;if(start.type!=='persistent-start')throw Error('not started');
  const simulation=new GameSimulation(start.characters,false,trainingRoom,start.teams,start.skins,false,start.seed);
  const rollback=new RollbackManager(simulation,0,2,8);assert.ok(rollback);simulation.step(Array(size*2).fill(0));simulation.step(Array(size*2).fill(0));
  // Identical neutral input streams exercise normal introduction and fight transitions.
  for(let frame=2;frame<180;frame++){simulation.step(Array(size*2).fill(0));peers.forEach(s=>s.send(JSON.stringify({type:'input',frame,mask:0,matchId:start.matchId})));if(frame%30===29)await new Promise(r=>setTimeout(r,10));}
  await wait(()=>messages[0].some(m=>m.type==='hash'&&m.frame===180));
  const hash=messages[0].find(m=>m.type==='hash'&&m.frame===180);assert.equal(hash?.type,'hash');if(hash?.type==='hash')assert.equal(hash.hash,hashState(simulation.state));
  peers[0].close();await wait(()=>messages[1].some(m=>m.type==='persistent-ended'&&m.cancelled));
  assert.deepEqual(db.get(t.id).series[0].score,[0,0]);assert.equal(db.get(t.id).fights.length,0);assert.deepEqual(failures,[]);
 }finally{const serverClosed=[...wss.clients].map(s=>s.readyState===WebSocket.CLOSED?Promise.resolve():once(s,'close'));await Promise.all(peers.map(async s=>{if(s.readyState===WebSocket.CLOSED)return;const closed=once(s,'close');s.close();await closed;}));await Promise.all(serverClosed);await new Promise<void>(r=>wss.close(()=>r()));db.close();}
});
