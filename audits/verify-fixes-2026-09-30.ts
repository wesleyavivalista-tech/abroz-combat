import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {Button} from '../packages/game-core/types.js';
function game(ids=['jopa','jomp']){const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=500+i*100;f.meter=100;});return g;}
let seed=9330;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};let frames=0;
for(let trial=0;trial<20;trial++){
const ids=Object.keys(characters);const g=game(Array.from({length:8},()=>ids[rand()%ids.length]));g.state.fighters.forEach(f=>{f.lives=20;f.x=300+rand()%1800;});
const masks=g.state.fighters.map(()=>0);
for(let frame=0;frame<1500;frame++){
if(frame%5===0)masks.forEach((_,i)=>masks[i]=rand()%2048);
g.step(masks);frames++;
for(const f of [...g.state.fighters,...g.state.clones.map(c=>c.fighter)])for(const key of ['x','y','vx','vy','health','stun','moveFrame'] as const)if(!Number.isFinite(f[key]))throw Error(`nonfinite ${trial} ${frame} ${key}`);
if(frame===700){const snap=g.snapshot();for(let n=0;n<10;n++)g.step(masks);const hash=hashState(g.state);g.restore(snap);for(let n=0;n<10;n++)g.step(masks);if(hashState(g.state)!==hash)throw Error('Replay mismatch');}
}
}
console.log('stressFrames',frames);
{
 const ids=['jopa','jomp','luizinho','roms','astolfo','napa'];const peers=ids.map((_,i)=>new RollbackManager(game(ids),i));
 const packets:{target:number;seat:number;frame:number;mask:number;due:number}[]=[];
 const mask=(seat:number,frame:number)=>frame===2?Button.Super1:frame===90?Button.Super2:((frame+seat*13)%80<20?Button.Right:0)|((frame+seat*7)%19===0?Button.Light:0);
 for(let clock=0;clock<1600&&peers.some(p=>p.simulation.state.frame<900);clock++){
  peers.forEach((p,seat)=>{if(p.simulation.state.frame<900)p.schedule(mask(seat,p.simulation.state.frame+2),(frame,input)=>peers.forEach((_,target)=>{if(target!==seat)packets.push({target,seat,frame,mask:input,due:clock+seat+(frame%3)});}));});
  for(let i=packets.length-1;i>=0;i--)if(packets[i].due<=clock){const p=packets.splice(i,1)[0];peers[p.target].receive(p.frame,p.mask,p.seat);}
  peers.forEach(p=>{if(p.simulation.state.frame<900)p.tick();});
 }
 packets.forEach(p=>peers[p.target].receive(p.frame,p.mask,p.seat));
 const hashes=peers.map(p=>hashState(p.simulation.state));assert.ok(peers.every(p=>p.desync==='OK'&&p.simulation.state.frame===900));assert.equal(new Set(hashes).size,1);console.log('sixPeerDelayedReplay',hashes[0]);
}
