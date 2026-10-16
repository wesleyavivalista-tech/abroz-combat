import {performance} from 'node:perf_hooks';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {Button} from '../packages/game-core/types.js';
const roster=['nikalz','luizinho','bozo','jopa','caio','dodo','napa','roms'];
const profiles=[{rtt:30,jitter:0,retransmit:false},{rtt:80,jitter:0,retransmit:false},{rtt:150,jitter:0,retransmit:false},{rtt:240,jitter:0,retransmit:false},{rtt:150,jitter:40,retransmit:true}];
const mask=(seat:number,frame:number)=>frame%120<35?(seat%2?Button.Left:Button.Right):frame%41===0?Button.Special2:frame%67===0?Button.Super1:frame%29===0?Button.Special:frame%17===0?Button.Light:0;
const quantile=(a:number[],q:number)=>a.slice().sort((x,y)=>x-y)[Math.floor((a.length-1)*q)]??0;
const results=[];
for(const count of [2,4,6,8])for(const profile of profiles){
 const make=()=>{const g=new GameSimulation(roster.slice(0,count));g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.meter=100;f.x=500+i*95;f.health=100000;});return g;};
 const peers=Array.from({length:count},(_,seat)=>new RollbackManager(make(),seat));
 const frames=600,queue:{due:number;seat:number;frame:number;mask:number}[]=[],lastDue=Array(count).fill(0),cost:number[]=[];
 let stalls=0,clock=0,messages=0;
 for(;clock<6000&&peers.some(p=>p.simulation.state.frame<frames);clock++){
  for(const [seat,p] of peers.entries())if(p.simulation.state.frame<frames)p.schedule(mask(seat,p.simulation.state.frame),(frame,input)=>{
   // Reliable ordered WebSocket transport: loss delays subsequent packets until retransmission.
   const loss=profile.retransmit&&frame%97===0?100:0;
   const delay=Math.ceil((profile.rtt+(frame*7+seat*11)% (profile.jitter+1)+loss)/(1000/60));
   const due=lastDue[seat]=Math.max(lastDue[seat],clock+delay);queue.push({due,seat,frame,mask:input});messages+=count-1;
  });
  for(let i=0;i<queue.length;)if(queue[i].due<=clock){const item=queue.splice(i,1)[0];for(const p of peers)if(p.seat!==item.seat)p.receive(item.frame,item.mask,item.seat,true);}else i++;
  for(const p of peers)if(p.simulation.state.frame<frames){const start=performance.now();if(!p.tick())stalls++;cost.push(performance.now()-start);}
 }
 for(const item of queue)for(const p of peers)if(p.seat!==item.seat)p.receive(item.frame,item.mask,item.seat,true);
 peers.forEach(p=>p.flushPending());
 const authoritative=make();for(let frame=0;frame<frames;frame++)authoritative.step(Array.from({length:count},(_,seat)=>frame<2?0:mask(seat,frame-2)));
 const hash=hashState(authoritative.state);
 if(peers.some(p=>p.desync!=='OK'||hashState(p.simulation.state)!==hash))throw Error(`Divergence: ${count} / ${JSON.stringify(profile)}`);
 results.push({players:count,...profile,frames,clock,stalls,relayedMessages:messages,rollbackCount:peers.reduce((n,p)=>n+p.rollbackCount,0),tickMeanMs:cost.reduce((a,b)=>a+b,0)/cost.length,tickP50Ms:quantile(cost,.5),tickP95Ms:quantile(cost,.95),hash});
}
console.log(JSON.stringify({environment:process.version,description:'Synthetic full peer-to-peer relay delay in ms; reliable ordered retransmission model, not real Internet measurements. Tick costs include replay and snapshot history; exclude rendering.',results},null,2));
