import type {Fighter,MoveDefinition,Projectile,SimulationSnapshot,StageDefinition} from '../types.js';
import {characters} from '../characters/registry.js';
import {actors,hostile} from './Actors.js';
import {initializeProjectile} from './ProjectilePool.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {sweepEntry,targetBoxes} from '../combat/CollisionSystem.js';
import {hitStructureProjectile} from './StructureSystem.js';

export const SOUND_WAVE={maxChainTargets:64,maxActive:32} as const;
function burst(s:SimulationSnapshot,p:Projectile,speed:number):void{
 const slots=s.projectiles.filter(p=>!p.active);
 if(slots.length<4||s.projectiles.filter(p=>p.active&&p.soundWave).length+4>SOUND_WAVE.maxActive)return;
 for(const [i,[dx,dy]] of [[1,0],[-1,0],[0,1],[0,-1]].entries())initializeProjectile(slots[i],{...p,vx:dx*speed,vy:dy*speed,soundWave:{...p.soundWave!,hits:[...p.soundWave!.hits],visited:[...p.soundWave!.visited]}});
}
/** Each emission uses the existing directional wave effect in four cardinal directions. */
export function spawnSoundWave(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 const spec=m.projectile!;
 burst(s,{active:true,owner,x:f.x,y:f.y+100,vx:0,vy:0,life:Math.ceil((spec.arenaRange?stage.width:spec.speed*spec.lifetime)/spec.speed),move:m.id,serial:f.attackSerial,
  soundWave:{chain:`${owner}:${s.frame}:${f.attackSerial}`,travel:0,range:spec.arenaRange?stage.width:spec.speed*spec.lifetime,generation:0,continuous:f.weaponUntil>s.frame,burst:'root',hits:[],visited:[]}},spec.speed);
}
/** Fixed order and snapshot-owned chain history; secondary bursts start next tick. */
export function advanceSoundWaves(s:SimulationSnapshot,stage:StageDefinition,hit:(p:Projectile,d:Fighter,seat:number,direction:number)=>void):void{
 const waves=s.projectiles.filter(p=>p.active&&p.soundWave),targets=actors(s);
 for(const p of waves){
  if(!p.active)continue;
  const wave=p.soundWave!,spec=characters[s.fighters[p.owner].characterId].moves[p.move].projectile!;
  const from={x:p.x,y:p.y},step=Math.min(spec.speed,wave.range-wave.travel);
  p.x+=Math.sign(p.vx)*step;p.y+=Math.sign(p.vy??0)*step;wave.travel+=step;p.life--;
  if(hitStructureProjectile(s,p,from,stage))continue;
  let nearest=Infinity,target:typeof targets[number]|undefined;
  for(const a of targets){
   const d=a.fighter,key=a.clone?`clone:${a.clone.id}`:`seat:${a.owner}`;
   if(wave.hits.includes(key)||wave.hits.length>=SOUND_WAVE.maxChainTargets||!hostile(s,p.owner,d,a.owner)||!canReceiveDirectHit(d,s.frame))continue;
   const time=Math.min(...targetBoxes(d,'move').map(box=>sweepEntry(box,from.x,from.y,p.x,p.y,spec.radius??48)));
   if(time<nearest){nearest=time;target=a;}
  }
  if(target){
   const d=target.fighter,key=target.clone?`clone:${target.clone.id}`:`seat:${target.owner}`,x=d.x,y=d.y+100;
   // Damage is per explosion; propagation is limited once per target for the entire chain.
   const canPropagate=!wave.visited.includes(key)&&wave.visited.length<SOUND_WAVE.maxChainTargets;
   for(const peer of s.projectiles)if(peer.active&&peer.soundWave?.chain===wave.chain){
    if(!peer.soundWave.visited.includes(key)&&peer.soundWave.visited.length<SOUND_WAVE.maxChainTargets)peer.soundWave.visited.push(key);
    if(peer.soundWave.burst===wave.burst)peer.soundWave.hits.push(key);
   }
   const health=d.health;hit(p,d,target.owner,Math.sign(p.vx)||Math.sign(x-from.x)||s.fighters[p.owner].facing);
   p.active=false;
   if(d.health<health&&canPropagate&&(wave.continuous||wave.generation===0))burst(s,{...p,active:true,x,y,life:Math.ceil(wave.range/spec.speed),soundWave:{...wave,travel:0,range:wave.range,generation:wave.generation+1,burst:key,hits:[key],visited:[...wave.visited]}},spec.speed);
  }else if(p.life<=0||wave.travel>=wave.range||p.x<0||p.x>stage.width)p.active=false;
 }
}
