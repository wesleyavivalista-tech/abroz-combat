/** Owns an isolated local server. No remote target option; never connects to production. */
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {contentVersion} from '../packages/shared/contentVersion.js';
const args=process.argv.slice(2);
if(args.some(a=>!['--execute','--quick'].includes(a)))throw Error('Only --execute and --quick are accepted. Remote targets are forbidden.');
const ramp=args.includes('--quick')?[2]:[2,8,16,25,32,48,64];
const seconds=args.includes('--quick')?3:60;
console.log(JSON.stringify({environment:'isolated local child process',players:ramp,secondsPerLevel:seconds,limits:{cpuPercent:85,eventLoopP95Ms:100,rssMiB:1536}}));
if(!args.includes('--execute'))process.exit(0);
const env={...process.env,NODE_ENV:'test',ABROZ_CAPACITY_TEST:'1',PORT:'0',TRUST_FLY_PROXY:'0',MAX_CONNECTIONS:'64',MAX_CONNECTIONS_PER_ADDRESS:'64',MAX_UPGRADES_PER_MINUTE:'1000',FLY_APP_NAME:''};
const child=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
const sockets:WebSocket[]=[];
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
let stopped=false;
process.once('SIGINT',()=>{stopped=true;});process.once('SIGTERM',()=>{stopped=true;});
let failure:string|undefined;
child.stderr.on('data',()=>{failure='Server stderr output; inspect locally before continuing';});
try{
 const port=await new Promise<number>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server boot timeout')),10000);child.once('error',reject);child.stdout.on('data',raw=>{const m=String(raw).match(/listening on port (\d+)/);if(m){clearTimeout(timeout);resolve(Number(m[1]));}});});
 const metrics=async()=>{const r=await fetch(`http://127.0.0.1:${port}/capacity-test`,{signal:AbortSignal.timeout(2000),redirect:'error'});if(!r.ok)throw Error('Isolated metrics unavailable');const m=await r.json();if(m.pid!==child.pid)throw Error('Server ownership mismatch');return m;};
 await metrics();
 for(const players of ramp){
  if(stopped)break;
  const timers:ReturnType<typeof setInterval>[]=[];
  try{
   for(let seat=0;seat<players;seat++){
    const socket=new WebSocket(`ws://127.0.0.1:${port}`);sockets.push(socket);
    socket.on('error',()=>{failure='Socket error';});
    socket.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='error')failure='Server rejected test command';});
    await once(socket,'open');
   }
   // Two-player matches exercise the largest number of authoritative simulations.
   for(let i=0;i+1<players;i+=2){
    const pair=sockets.slice(i,i+2);
    const waitMessage=(s:WebSocket,type:string)=>new Promise<Record<string,unknown>>((resolve,reject)=>{
     const timer=setTimeout(()=>{s.off('message',listener);reject(Error('Message timeout: '+type));},3000);
     const listener=(raw:unknown)=>{const m=JSON.parse(String(raw));if(m.type===type){clearTimeout(timer);s.off('message',listener);resolve(m);}};s.on('message',listener);
    });
    const room=waitMessage(pair[0],'room');pair[0].send(JSON.stringify({type:'create',character:'nikalz',capacity:2,contentVersion:contentVersion()}));
    const code=(await room).code;const joined=waitMessage(pair[1],'room');pair[1].send(JSON.stringify({type:'join',character:'drupa',code,contentVersion:contentVersion()}));await joined;
    const start=waitMessage(pair[0],'start');pair.forEach(s=>s.send(JSON.stringify({type:'ready'})));await start;
    let frame=2;
    timers.push(setInterval(()=>{pair.forEach((s,seat)=>s.send(JSON.stringify({type:'input',frame,mask:frame%29===seat?16:0})));frame++;},1000/60));
   }
   let previous=await metrics(),at=performance.now();
   for(let second=0;second<seconds&&!stopped;second++){
    await pause(1000);const current=await metrics(),now=performance.now();
    const cpuPercent=((current.cpu.user+current.cpu.system)-(previous.cpu.user+previous.cpu.system))/((now-at)*10);
    console.log(JSON.stringify({players,cpuPercent,...current}));previous=current;at=now;
    if(failure||cpuPercent>85||current.eventLoopP95Ms>100||current.rss>1536*1048576)throw Error(failure??'Safety threshold reached');
   }
  }finally{timers.forEach(clearInterval);sockets.splice(0).forEach(s=>s.terminate());}
  for(let attempt=0;attempt<100;attempt++){const m=await metrics();if(m.connections===0&&m.activeRooms===0&&m.waitingRooms===0)break;if(attempt===99)throw Error('Cleanup did not complete');await pause(20);}
 }
}finally{sockets.forEach(s=>s.terminate());const exited=once(child,'exit');child.kill('SIGTERM');await exited;}
