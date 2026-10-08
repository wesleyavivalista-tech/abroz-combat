import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {trainingRoom,shoppingMall} from '../packages/game-core/stages/registry.js';
import {stageAtTick} from '../packages/game-core/stages/motion.js';
import {StageVisualEnvironment} from '../apps/client/src/rendering/StageVisualEnvironment.js';
import {EffectManager} from '../apps/client/src/rendering/EffectManager.js';
import type {VisualQuality} from '../apps/client/src/rendering/StageLighting.js';
const reports=[];
for(const quality of ['low','medium','high'] as VisualQuality[])for(const [label,count,extras,bursts] of [['1v1',2,0,0],['4 players',4,0,0],['6 players',6,0,0],['8 players',8,0,0],['projectile/explosion stress',8,0,32],['summon stress',8,24,16],['large moving arena',8,24,32]] as const){
 const stage=label==='large moving arena'?{...shoppingMall,width:4800}:trainingRoom;
 const g=new GameSimulation(Array.from({length:count},(_,i)=>['tocha','drupa','nikalz','gut'][i%4]));g.state.phase='fight';
 const env=new StageVisualEnvironment(stage);env.setQuality(quality);const effects=new EffectManager();effects.particleDensity=quality==='low'?.4:quality==='medium'?.7:1;
 const visuals=Array.from({length:count+extras},()=>{const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.PlaneGeometry(1,2),new THREE.MeshBasicMaterial({map:new THREE.Texture(),transparent:true})));return {root,shadow:new THREE.Mesh()};});
 const samples=[];let maxLights=0,maxShadows=0;
 for(let tick=0;tick<720;tick++){
  g.state.frame=tick;const dynamic=stageAtTick(stage,tick);const start=performance.now();
  if(tick%6===0)for(let j=0;j<bursts;j++){env.spawnDynamicLight({id:`${tick}-${j}`,x:j*90,y:100,radius:400,intensity:.4,color:'#ff9955',duration:.3});effects.spawn({id:`${tick}-${j}`,x:j*90,y:100,type:'fire-hit',power:4,player:0});}
  env.begin(g.state,dynamic,1/60,0,false);
  visuals.forEach((v,i)=>{v.shadow.visible=true;env.shader.apply(v.root);env.shadow(String(i),g.state.fighters[i%count],v,dynamic,g.state);});
  effects.update(1/60);env.finish(false,{} as THREE.WebGLRenderer);
  if(tick>=120)samples.push(performance.now()-start);maxLights=Math.max(maxLights,env.lights.count);maxShadows=Math.max(maxShadows,env.shadowCount);
 }
 samples.sort((a,b)=>a-b);reports.push({quality,scenario:label,cpuMeanMs:samples.reduce((a,b)=>a+b,0)/samples.length,cpuP95Ms:samples[Math.floor(samples.length*.95)],maxLights,maxShadows,particlePool:effects.pool.length});
 env.dispose();for(const v of visuals)v.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const m=o.material as THREE.MeshBasicMaterial;m.map?.dispose();m.dispose();}});
 effects.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
}
console.log(JSON.stringify({scope:'Node CPU-only manager + particles; excludes GPU shader compilation/draws, browser and Electron frame rate. Synthetic positions/events, not a full game benchmark.',reports},null,2));
