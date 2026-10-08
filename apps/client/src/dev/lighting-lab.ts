import {SceneRenderer} from '../rendering/SceneRenderer.js';
import {readVisualQuality,type VisualQuality} from '../rendering/StageLighting.js';
import {GameSimulation} from '../../../../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {trainingRoom,shoppingMall,stages} from '../../../../packages/game-core/stages/registry.js';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
const status=document.querySelector('#status')!,results=document.querySelector('#results')!;
const run=document.querySelector<HTMLButtonElement>('#run')!;
const workloads=[['1v1',2,0,0],['4 fighters',4,0,0],['6 fighters',6,0,0],['8 fighters',8,0,0],['projectiles / explosions',8,0,32],['24 zombies / lights',8,24,16],['large moving arena',8,24,32]] as const;
let stopped=false,running=false;
const nextFrame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
function populate(s:SimulationSnapshot,count:number,extra:number,bursts:number,width:number){
 s.phase='fight';
 s.fighters.forEach((f,i)=>{f.x=width*(i+1)/(count+1);f.y=0;f.respawnAt=0;});
 for(let i=0;i<extra;i++){
  const fighter=structuredClone(s.fighters[i%count]);fighter.x=width*(i+1)/(extra+1);fighter.undead='zombie';
  s.clones.push({id:i+100,owner:i%count,kind:'undead',fighter,undead:{phaseAt:0,target:-1,nextAttack:999999,attackAt:0,attackFrame:0,hit:false,stuck:0,lastX:fighter.x,spawnX:fighter.x,spawnY:0}});
 }
 if(bursts)for(let i=0;i<48;i++){
  const owner=i%count,move=Object.entries(characters[s.fighters[owner].characterId].moves).find(([,m])=>m.projectile);
  if(move)s.projectiles.push({owner,move:move[0],serial:i+10000,active:true,x:width*(i+1)/49,y:80+i%5*60,vx:0,life:999999});
 }
}
async function profile(){
 if(running)return;running=true;run.disabled=true;stopped=false;results.textContent='';status.textContent='Loading fighter and zombie artwork…';
 const original=readVisualQuality(),reports:unknown[]=[];let renderer:SceneRenderer|undefined;
 try{
  renderer=new SceneRenderer(document.querySelector('canvas')!);
  await renderer.prepareFighters(['nikalz','jopa','drupa','tocha']);
  for(const quality of ['low','medium','high'] as VisualQuality[])for(const [name,count,extra,bursts] of workloads){
   if(stopped)break;
   status.textContent=`Measuring ${name} / ${quality}`;
   const stage=name==='large moving arena'?{...shoppingMall,width:4800,cameraBounds:[200,4600] as [number,number]}:trainingRoom;
   const sim=new GameSimulation(Array.from({length:count},(_,i)=>['nikalz','jopa','drupa','tocha'][i%4]),true,stage);
   populate(sim.state,count,extra,bursts,stage.width);
   renderer.setVisualQuality(quality);renderer.environment.reset();renderer.effects.hidePlayers([0,1,2,3,4,5,6,7]);
   renderer.draw(sim.state,0,0,false,stage);await renderer.stage.ready;
   const frameMs:number[]=[],drawMs:number[]=[];let tick=0,maxCalls=0,maxLights=0,maxShadows=0;
   let previous=await nextFrame(),start=previous;const memoryStart={...renderer.renderer.info.memory};
   while(!stopped){
    const now=await nextFrame(),delta=now-previous;previous=now;
    if(document.hidden){start=now;frameMs.length=0;drawMs.length=0;continue;}
    if(now-start>4000)break;
    sim.state.frame=++tick;sim.state.platformTick=tick;
    sim.state.fighters.forEach((f,i)=>{f.stateFrame=tick;f.y=i%2?Math.max(0,Math.sin(tick*.045+i)*380):0;});
    sim.state.clones.forEach(c=>{c.fighter.stateFrame=tick;c.fighter.state='WalkForward';});
    sim.state.projectiles.forEach((p,i)=>{p.x=(tick*8+i*89)%stage.width;});
    if(bursts&&tick%12===0)for(let i=0;i<bursts;i++)renderer.consume([{id:`${quality}-${name}-${tick}-${i}`,x:stage.width*(i+1)/(bursts+1),y:30+i%3*80,type:'fire-hit',power:4,player:i%count}]);
    const before=performance.now();renderer.draw(sim.state,Math.min(.05,delta/1000),now/1000,false,stage);const cpu=performance.now()-before;
    if(now-start>1000){frameMs.push(delta);drawMs.push(cpu);
    maxCalls=Math.max(maxCalls,renderer.renderer.info.render.calls);maxLights=Math.max(maxLights,renderer.environment.lights.count);maxShadows=Math.max(maxShadows,renderer.environment.shadowCount);}
   }
   const percentile=(values:number[],fraction:number)=>[...values].sort((a,b)=>a-b)[Math.floor(values.length*fraction)]??0;
   reports.push({name,quality,frames:frameMs.length,fps:frameMs.length?1000/(frameMs.reduce((a,b)=>a+b,0)/frameMs.length):0,frameP95Ms:percentile(frameMs,.95),drawCpuP95Ms:percentile(drawMs,.95),maxCalls,maxLights,maxShadows,programs:renderer.renderer.info.programs?.length,memoryStart,memoryEnd:{...renderer.renderer.info.memory},projectiles:sim.state.projectiles.filter(p=>p.active).length});
   results.textContent=JSON.stringify({scope:'Browser rAF and renderer.draw CPU time; actual renderer and assets, synthetic positions/projectiles/zombies/events. 1s warmup + 3s measured; not GPU timer queries or multiplayer.',viewport:'960x540 CSS pixels; preset DPR',reports},null,2);
  }
  status.textContent=stopped?'Stopped':'Completed';
 }catch(error){status.textContent=`Failed: ${String(error)}`;throw error;}
 finally{renderer?.setVisualQuality(original);renderer?.dispose();running=false;run.disabled=false;}
}
if((import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV){run.onclick=()=>void profile();document.querySelector('#stop')!.addEventListener('click',()=>{stopped=true;});}
else{run.disabled=true;status.textContent='Development builds only';}


/** Reuse one renderer, as the game does across matches, and record comparable
 * resource counts after warm-up on each arena. No gameplay settings are saved. */
async function rematchProfile(){
 if(running)return;running=true;stopped=false;run.disabled=true;results.textContent='';
 const reports:unknown[]=[];let renderer:SceneRenderer|undefined;
 try{
  renderer=new SceneRenderer(document.querySelector('canvas')!);
  const ids=['nikalz','jopa','drupa','tocha'];await renderer.prepareFighters(ids);
  const arenas=Object.values(stages);
  for(let round=0;round<32&&!stopped;round++){
   const stage=arenas[round%arenas.length];status.textContent=`Rematch ${round+1}/32 / ${stage.name}`;
   const sim=new GameSimulation(Array.from({length:8},(_,i)=>ids[i%4]),true,stage);
   populate(sim.state,8,24,32,stage.width);
   renderer.draw(sim.state,0,0,false,stage);await renderer.stage.ready;
   for(let tick=0;tick<16&&!stopped;tick++){
    const now=await nextFrame();sim.state.frame++;sim.state.platformTick=sim.state.frame;
    renderer.consume([{id:`rematch-${round}-${tick}`,x:stage.width/2,y:80,type:'fire-hit',power:4,player:0}]);
    renderer.draw(sim.state,1/60,now/1000,false,stage);
   }
   sim.resetPositions();renderer.effects.hidePlayers([0,1,2,3,4,5,6,7]);
   for(let tick=0;tick<4;tick++)renderer.draw(sim.state,1/60,tick/60,false,stage);
   reports.push({round:round+1,stage:stage.id,memory:{...renderer.renderer.info.memory},programs:renderer.renderer.info.programs?.length,drawCalls:renderer.renderer.info.render.calls,sceneChildren:renderer.scene.children.length,clones:sim.state.clones.length,projectiles:sim.state.projectiles.filter(p=>p.active).length});
   results.textContent=JSON.stringify({scope:'32 synthetic rematches in one renderer with arena transitions, eight fighters, 24 zombies, projectiles and bursts; resource counters after reset. Not heap or GPU byte measurements.',reports},null,2);
  }
  status.textContent=stopped?'Stopped':'Completed rematches';
 }catch(error){status.textContent=String(error);throw error;}
 finally{renderer?.dispose();running=false;run.disabled=false;}
}
const rematches=document.querySelector<HTMLButtonElement>('#rematches');
if(rematches){rematches.disabled=!(import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV;rematches.onclick=()=>void rematchProfile();}
