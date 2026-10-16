import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {WebSocket} from 'ws';
import {contentVersion} from '../packages/shared/contentVersion.js';
import type {ServerMessage,ClientMessage} from '../packages/shared/protocol.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';
test('actual server dispatcher persists championships across process restart and rejects forged results',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'abroz-pc-server-'));let child:ChildProcess|undefined;const sockets:WebSocket[]=[];
 const boot=()=>new Promise<number>((resolve,reject)=>{child=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'0',NODE_ENV:'test',TRUST_FLY_PROXY:'0',ABROZ_RECOVERY_ENABLED:'0',ABROZ_CHAMPIONSHIP_PATH:join(dir,'history.sqlite')},stdio:['ignore','pipe','pipe']});let output='';const timeout=setTimeout(()=>reject(Error('Server startup timed out')),10000);child.stdout!.on('data',chunk=>{output+=chunk.toString();const found=output.match(/listening on port (\d+)/);if(found){clearTimeout(timeout);resolve(Number(found[1]));}});child.on('error',reject);child.on('exit',code=>{if(!output.includes('listening on port')){clearTimeout(timeout);reject(Error('Server failed to start: '+code));}});});
 const stop=async()=>{if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}};
 const connect=async(port:number)=>{const socket=new WebSocket(`ws://127.0.0.1:${port}`);sockets.push(socket);const messages:ServerMessage[]=[];socket.on('message',raw=>messages.push(JSON.parse(raw.toString())));await once(socket,'open');return {socket,messages,send:(m:ClientMessage)=>socket.send(JSON.stringify({...m,contentVersion:contentVersion()}))};};
 const wait=async<T>(get:()=>T|undefined):Promise<T>=>{const end=Date.now()+5000;for(;;){const value=get();if(value!==undefined)return value;if(Date.now()>end)throw Error('Missing server response');await new Promise(r=>setTimeout(r,10));}};
 try{const port=await boot(),a=await connect(port);a.send({type:'persistent',action:'create',config:{name:'Server restart cup',mode:'1v1',stage:trainingRoom.id,competitors:['nikalz','jopa','bozo','napa'].map(f=>({name:f,fighters:[f]}))}});const created=await wait(()=>a.messages.find(m=>m.type==='persistent-created'));assert.equal(created.type,'persistent-created');if(created.type!=='persistent-created')return;const id=created.tournament.id,seriesId=created.tournament.series[0].id;
 const b=await connect(port);for(const [i,p] of [a,b].entries())p.send({type:'persistent',action:'claim',id,seriesId,slot:i,session:`server-session-000${i}`});await wait(()=>b.messages.find(m=>m.type==='persistent-detail'&&m.lobbies[0].slots.every(s=>s.occupied)));for(const p of [a,b])p.send({type:'persistent',action:'ready',ready:true});await wait(()=>a.messages.find(m=>m.type==='persistent-start'));
 a.send({type:'finished',frame:42});a.socket.send(JSON.stringify({type:'persistent-result',winner:0,id,seriesId}));await wait(()=>a.messages.find(m=>m.type==='error'));await stop();const port2=await boot(),c=await connect(port2);c.send({type:'persistent',action:'open',id});const detail=await wait(()=>c.messages.find(m=>m.type==='persistent-detail'));if(detail.type!=='persistent-detail')throw Error('missing detail');assert.deepEqual(detail.tournament.series[0].score,[0,0]);assert.equal(detail.tournament.fights.length,0);assert.ok(detail.lobbies.every(l=>!l.attempt&&l.slots.every(s=>!s.occupied)));
 }finally{for(const s of sockets)s.terminate();await stop();rmSync(dir,{recursive:true,force:true});}
});
