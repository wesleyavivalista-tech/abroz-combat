import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {contentVersion} from '../packages/shared/contentVersion.js';
import type {ServerMessage} from '../packages/shared/protocol.js';
import {decodeSnapshot} from '../packages/shared/recovery.js';

test('real loopback server synchronizes restart, rejects non-host and excludes old-generation inputs',{timeout:15000},async()=>{
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{PATH:process.env.PATH,PORT:'0',NODE_ENV:'test',TRUST_FLY_PROXY:'0'},stdio:['ignore','pipe','pipe']});
 const sockets:WebSocket[]=[];
 try{
  const port=await new Promise<number>((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Local server boot timeout')),5000);server.once('error',e=>{clearTimeout(timer);reject(e);});server.stdout.on('data',s=>{out+=s;const match=out.match(/port (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});});
  async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${port}`),messages:ServerMessage[]=[];sockets.push(ws);ws.on('message',s=>messages.push(JSON.parse(s.toString())));await once(ws,'open');return {ws,messages,send:(m:object)=>ws.send(JSON.stringify(m)),next:async(type:ServerMessage['type'])=>{for(let i=0;i<300;i++){const index=messages.findIndex(m=>m.type===type);if(index>=0)return messages.splice(index,1)[0];await new Promise(r=>setTimeout(r,5));}throw Error('Missing '+type);}};}
  const a=await connect(),b=await connect();
  a.send({type:'create',character:'nikalz',contentVersion:contentVersion()});const room=await a.next('room');assert.ok(room.type==='room');
  b.send({type:'join',character:'jopa',code:room.code,contentVersion:contentVersion()});await b.next('room');a.send({type:'ready'});b.send({type:'ready'});b.send({type:'ping',sent:1});await b.next('pong');a.send({type:'start-match'});await a.next('start');await b.next('start');
  b.send({type:'restart-fight'});await b.next('restart-denied');
  a.send({type:'input',frame:2,mask:0});b.send({type:'input',frame:2,mask:0});await a.next('input');await b.next('input');
  a.send({type:'restart-fight'});const ra=await a.next('fight-restarted'),rb=await b.next('fight-restarted');assert.ok(ra.type==='fight-restarted'&&rb.type==='fight-restarted');assert.equal(ra.matchId,rb.matchId);assert.deepEqual(ra.state,rb.state);assert.equal(decodeSnapshot(ra.state.snapshot).frame,2);
  a.send({type:'input',frame:3,mask:16});b.send({type:'input',frame:3,mask:16});a.send({type:'restart-fight'});
  a.send({type:'input',matchId:ra.matchId,frame:2,mask:0});b.send({type:'input',matchId:ra.matchId,frame:2,mask:0});
  const inputA=await a.next('input'),inputB=await b.next('input');assert.ok(inputA.type==='input'&&inputB.type==='input');assert.equal(inputA.matchId,ra.matchId);assert.equal(inputA.frame,2);assert.equal(inputB.frame,2);
  assert.equal(a.messages.some(m=>m.type==='error'||m.type==='fight-restarted'),false);assert.equal(b.messages.some(m=>m.type==='error'||m.type==='fight-restarted'),false);
 }finally{sockets.forEach(s=>s.terminate());if(server.exitCode===null){const exit=once(server,'exit');server.kill('SIGTERM');await exit;}}
});
