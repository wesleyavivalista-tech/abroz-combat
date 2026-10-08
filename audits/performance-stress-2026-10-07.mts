import {performance,PerformanceObserver} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {stages} from '../packages/game-core/stages/registry.js';
import {initializeProjectile} from '../packages/game-core/simulation/ProjectilePool.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
const gcEvents:number[]=[];const observer=new PerformanceObserver(list=>gcEvents.push(...list.getEntries().map(e=>e.duration)));observer.observe({entryTypes:['gc']});
const percentile=(a:number[],n:number)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*n)]??0;
let seed=1729;const random=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
const reports:unknown[]=[];const ids=Object.keys(characters);const heap:number[]=[];
for(const stage of Object.values(stages)){
 const times:number[]=[],snapshot:number[]=[],hash:number[]=[];let maxProjectiles=0,maxClones=0,maxHazards=0,maxStructures=0,maxBees=0,resets=0;
 const cpu=process.cpuUsage(),start=performance.now();
 for(let match=0;match<12;match++){
  const sim=new GameSimulation(Array.from({length:8},(_,i)=>ids[(match*3+i)%ids.length]),false,stage);sim.state.phase='fight';
  for(let frame=0;frame<900;frame++){
   sim.state.fighters.forEach(f=>{f.meter=100;if(frame%180===0)f.usedSupers=[];});
   const masks=sim.state.fighters.map(()=>random()%2048);
   let t=performance.now();sim.step(masks);times.push(performance.now()-t);
   if(frame%10===0){t=performance.now();const s=sim.snapshot();snapshot.push(performance.now()-t);t=performance.now();hashState(s);hash.push(performance.now()-t);}
   maxProjectiles=Math.max(maxProjectiles,sim.state.projectiles.filter(p=>p.active).length);maxClones=Math.max(maxClones,sim.state.clones.length);maxHazards=Math.max(maxHazards,sim.state.hazards.length);maxStructures=Math.max(maxStructures,sim.state.structures?.length??0);maxBees=Math.max(maxBees,sim.state.bees?.length??0);
   if(sim.state.phase==='result'||frame%300===299){sim.resetPositions();sim.state.phase='fight';sim.state.phaseFrame=0;resets++;if(sim.state.clones.length||sim.state.hazards.length||sim.state.projectiles.some(p=>p.active)||sim.state.structures?.length||sim.state.bees?.length)throw Error('Entities retained at reset');}
  }
 }
 await new Promise(resolve=>setImmediate(resolve));global.gc?.();heap.push(process.memoryUsage().heapUsed);
 reports.push({stage:stage.id,ticks:times.length,resets,stepP50:percentile(times,.5),stepP95:percentile(times,.95),stepP99:percentile(times,.99),stepMax:Math.max(...times),snapshotP95:percentile(snapshot,.95),hashP95:percentile(hash,.95),wallMs:performance.now()-start,cpuMs:Object.values(process.cpuUsage(cpu)).reduce((a,b)=>a+b,0)/1000,maxProjectiles,maxClones,maxHazards,maxStructures,maxBees,heapAfterGc:heap.at(-1)});
}
// Bounded retained history, then repeated disposal of complete rollback sessions.
const retained=[];for(let round=0;round<40;round++){
 const sim=new GameSimulation(ids.slice(0,8)),peer=new RollbackManager(sim,0);
 for(let frame=0;frame<240;frame++){peer.schedule(frame%17===0?512:0,()=>{});for(let seat=1;seat<8;seat++)peer.receive(frame+2,frame%29===0?1024:0,seat);peer.tick();peer.drainConfirmedImpacts();}
 if(round%5===4){global.gc?.();retained.push(process.memoryUsage().heapUsed);}
}
const longSim=new GameSimulation(Array(8).fill('tocha'),false,Object.values(stages)[2]);longSim.state.phase='fight';
const projectileMove=Object.values(characters.tocha.moves).find(m=>m.projectile)!;
const longTimes:number[]=[],longHeap:number[]=[];let serial=0;
for(let frame=0;frame<18000;frame++){
 longSim.state.fighters.forEach(f=>{f.health=characters.tocha.stats.maxHealth;f.lives=3;});
 longSim.state.projectiles.forEach((p,i)=>{if(!p.active)initializeProjectile(p,{active:true,owner:i%8,move:projectileMove.id,serial:++serial,x:100+i*33,y:80,vx:i%2?8:-8,life:180});});
 const t=performance.now();longSim.step(Array(8).fill(0));longTimes.push(performance.now()-t);
 if(frame%3000===2999){global.gc?.();longHeap.push(process.memoryUsage().heapUsed);await new Promise(resolve=>setImmediate(resolve));}
}
const longMatch={ticks:18000,simulatedMinutes:5,projectilePool:longSim.state.projectiles.length,stepP95:percentile(longTimes,.95),stepP99:percentile(longTimes,.99),stepMax:Math.max(...longTimes),heapAfterGc:longHeap};
await new Promise(resolve=>setTimeout(resolve,25));observer.disconnect();
const result={scope:'Node simulation/physics, snapshots, hashes and rollback retention; forced GC measurements; not browser/GPU. Meter and ultimate uses replenished in stress fixtures only.',reports,longMatch,rollbackHeapSamples:retained,gc:{count:gcEvents.length,totalMs:gcEvents.reduce((a,b)=>a+b,0),p95Ms:percentile(gcEvents,.95),maxMs:Math.max(0,...gcEvents)},rss:process.memoryUsage().rss};
writeFileSync('audits/evidence/2026-10-07-performance-core.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
