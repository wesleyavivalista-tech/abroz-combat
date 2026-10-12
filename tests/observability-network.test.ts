import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {contentVersion} from '../packages/shared/contentVersion.js';
test('real sockets retain join behavior and emit private lifecycle diagnostics',{timeout:15000},async()=>{
 const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','apps/server/src/index.ts'],{env:{...process.env,NODE_ENV:'production',PORT:'0',ALLOWED_ORIGINS:'https://abrozcombat.com',ABROZ_BUILD_VERSION:'diagnostic-test',TRUST_FLY_PROXY:'0'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',b=>output+=b);let errors='';child.stderr.on('data',b=>errors+=b);
 const wait=async(fn:()=>boolean)=>{const until=Date.now()+5000;while(!fn()){if(Date.now()>until)throw Error('Timed out '+errors);await new Promise(r=>setTimeout(r,10));}};
 const peers:WebSocket[]=[];
 try{
 await wait(()=>output.includes('listening on port'));const port=output.match(/listening on port (\d+)/)![1];
 for(let i=0;i<2;i++){const ws=new WebSocket('ws://127.0.0.1:'+port,{origin:'https://abrozcombat.com'});peers.push(ws);await once(ws,'open');}
 const messages:{type:string;code?:string;message?:string}[][]=[[],[]];peers.forEach((p,i)=>p.on('message',data=>messages[i].push(JSON.parse(String(data)))));
 peers[0].send(JSON.stringify({type:'create',character:'nikalz',contentVersion:contentVersion()}));await wait(()=>messages[0].some(m=>m.type==='room'));
 const code=messages[0].find(m=>m.type==='room')!.code!;
 peers[1].send(JSON.stringify({type:'join',code:'ZZZZZ',character:'jopa',contentVersion:contentVersion()}));await wait(()=>messages[1].some(m=>m.type==='error'));
 assert.equal(messages[1].find(m=>m.type==='error')?.message,'Room not found');
 peers[1].send(JSON.stringify({type:'join',code,character:'jopa',contentVersion:contentVersion()}));await wait(()=>messages[1].some(m=>m.type==='room'));
 peers.forEach(p=>p.send(JSON.stringify({type:'ready'})));peers[1].send(JSON.stringify({type:'ping',sent:1}));await wait(()=>messages[1].some(m=>m.type==='pong'));peers[0].send(JSON.stringify({type:'start-match'}));await wait(()=>messages.every(ms=>ms.some(m=>m.type==='start')));
 peers[0].send('{"private":"do-not-log-secret"');await wait(()=>output.includes('SyntaxError'));
 peers.forEach(p=>p.close());await wait(()=>output.includes('room-closed'));
 assert.doesNotMatch(output,new RegExp(code+'|ZZZZZ|do-not-log-secret'));
 const events=output.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
 for(const event of ['server-start','connection-open','message-failed','room-created','room-joined','match-started','connection-close','room-closed'])assert.ok(events.some(e=>e.event===event),event);
 assert.ok(events.every(e=>e.build==='diagnostic-test'&&e.timestamp&&e.contentVersion));
 }finally{peers.forEach(p=>p.terminate());child.kill('SIGTERM');await once(child,'exit');}
});
