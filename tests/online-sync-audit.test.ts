import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {Button} from '../packages/game-core/types.js';

const attacks=[Button.Light,Button.Heavy,Button.Medium,Button.Special,Button.Special2,Button.Super1,Button.Super2];
const roster=Object.keys(characters);
for(const stage of Object.values(stages))for(const scenario of ['roster-1','roster-2','teams','elimination'] as const){
 test(`${stage.id}/${scenario}: asymmetric delayed streams converge through duplicate inputs and a delivery blackout`,()=>{
  const ids=scenario==='roster-2'?roster.slice(8):roster.slice(0,scenario==='teams'||scenario==='elimination'?6:8);
  const teams=scenario==='teams'?[0,1,0,1,0,1]:undefined;
  const create=()=>{
   const sim=new GameSimulation(ids,false,stage,teams,undefined,scenario==='elimination'?'elimination-party':false,0xfedcba98);
   // Start at combat so this bounded test exercises abilities rather than the countdown.
   sim.state.phase='fight';sim.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});
   return sim;
  };
  const peers=ids.map((_,seat)=>new RollbackManager(create(),seat));
  const baseline=create(),end=360;
  const input=(seat:number,frame:number)=>frame<2?0:frame%29===seat?attacks[Math.floor(frame/29)%attacks.length]:frame%53===seat?Button.Up:frame%60<20?(seat%2?Button.Left:Button.Right):0;
  const queue:{due:number;target:number;seat:number;frame:number;mask:number}[]=[];
  const delivery=ids.map(()=>ids.map(()=>0));let stalls=0,duplicates=0;
  for(let clock=0;clock<3000&&peers.some(p=>p.simulation.state.frame<end);clock++){
   peers.forEach((p,seat)=>{
    if(p.simulation.state.frame>=end)return;
    p.schedule(input(seat,p.simulation.state.frame+2),(frame,mask)=>{
     peers.forEach((_,target)=>{
      if(target===seat)return;
      // WebSocket/TCP preserves order: loss manifests as delayed delivery, not skipped input.
      const delay=(seat*5+target*3)%14+(frame%4);
      const due=Math.max(clock+delay,delivery[seat][target],clock>=70&&clock<100?115:0);
      delivery[seat][target]=due;queue.push({due,target,seat,frame,mask});
     });
    });
   });
   for(let i=0;i<queue.length;){
    if(queue[i].due>clock){i++;continue;}
    const packet=queue.splice(i,1)[0],p=peers[packet.target];
    p.receive(packet.frame,packet.mask,packet.seat);
    if(packet.frame%31===0){p.receive(packet.frame,packet.mask,packet.seat);duplicates++;}
   }
   peers.forEach(p=>{if(p.simulation.state.frame<end&&!p.tick())stalls++;assert.equal(p.desync,'OK');});
  }
  queue.sort((a,b)=>a.frame-b.frame).forEach(p=>peers[p.target].receive(p.frame,p.mask,p.seat));
  for(let frame=0;frame<end;frame++)baseline.step(ids.map((_,seat)=>input(seat,frame)));
  assert.ok(stalls>0);assert.ok(duplicates>0);
  for(const p of peers){assert.equal(p.simulation.state.frame,end);assert.equal(p.desync,'OK');assert.equal(hashState(p.simulation.state),hashState(baseline.state));}
 });
}
