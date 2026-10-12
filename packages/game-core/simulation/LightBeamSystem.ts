import {hoseOrigin} from './HoseAim.js';
import {hasExecutionArmor} from '../combat/ExecutionArmor.js';
import {hostile} from './Actors.js';
import {deterministicSin,deterministicCos} from './DeterministicMath.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {applyDamage} from '../combat/DamageSystem.js';
import type {Box,Fighter,MoveDefinition,SimulationSnapshot} from '../types.js';
import {characters} from '../characters/registry.js';
import {targetBoxes} from '../combat/CollisionSystem.js';
import {actors} from './Actors.js';
import {isActive} from './LifeSystem.js';
export type BeamRay={x:number;y:number;dx:number;dy:number;length:number;width:number;water?:boolean};
export function lightBeam(f:Fighter,width:number,floorHeight=0):BeamRay|null{
 const m=f.move?characters[f.characterId].moves[f.move]:undefined,b=m?.beam;
 if(!m||!b||f.moveFrame<m.startupFrames||f.moveFrame>=m.startupFrames+m.activeFrames)return null;
 const angle=b.downward?-Math.PI/2:b.upward?Math.PI/2:f.beamAim*Math.PI/180;
 const dx=deterministicCos(angle)*f.facing,dy=deterministicSin(angle),length=width+1000;
 const origin=b.originProfile==='hose'?hoseOrigin(f.beamAim):{x:b.originX??0,y:b.originY};
 const ray:BeamRay={x:f.x+origin.x*f.facing,y:f.y+origin.y,dx,dy,length,width:b.width};
 if(b.clipToArena){
  ray.water=b.targetProfile==='lower-stance';
  if(dx>0)ray.length=Math.min(ray.length,(width-ray.x)/dx);else if(dx<0)ray.length=Math.min(ray.length,-ray.x/dx);
  if(dy<0)ray.length=Math.min(ray.length,(floorHeight-ray.y)/dy);
  ray.length=Math.max(0,ray.length);
 }
 return ray;
}
/** Slab intersection against an expanded hurtbox: rendering and damage share the same ray. */
export function beamIntersects(ray:NonNullable<ReturnType<typeof lightBeam>>,box:Box):boolean{
 let near=0,far=ray.length;
 for(const [origin,dir,lo,hi] of [[ray.x,ray.dx,box.x-ray.width/2,box.x+box.w+ray.width/2],[ray.y,ray.dy,box.y-ray.width/2,box.y+box.h+ray.width/2]]){
  if(Math.abs(dir)<1e-9){if(origin<lo||origin>hi)return false;continue;}
  const a=(lo-origin)/dir,b=(hi-origin)/dir;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return false;
 }
 return true;
}
/** Water catches the spread of the stance below the knees as well as the torso. */
export function beamHitsFighter(ray:BeamRay,f:Fighter):boolean{
 return targetBoxes(f,ray.water?'lower-stance':'move').some(b=>beamIntersects(ray,b));
}
export function advanceBeams(s:SimulationSnapshot,width:number,hit?:(owner:number,target:number,m:MoveDefinition,f:Fighter,d:Fighter)=>void, floorHeight=0):void{
 const all=actors(s);
 for(const source of all){
  const f=source.fighter,ray=lightBeam(f,width,floorHeight);if(!ray||!isActive(f))continue;
  const m=characters[f.characterId].moves[f.move!],b=m.beam!;
  if(!b.push){
   const index=Math.floor((f.moveFrame-m.startupFrames)/b.interval);
   const previous=f.beamPulse;
   if(previous?.serial===f.attackSerial&&previous.move===m.id&&previous.index>=index)continue;
   f.beamPulse={serial:f.attackSerial,move:m.id,index};
  }
  for(const target of all){
   const d=target.fighter;
   if(!hostile(s,source.owner,d,target.owner)||!canReceiveDirectHit(d,s.frame)||!beamHitsFighter(ray,d))continue;
   if(!b.continuous&&hit){hit(source.owner,target.owner,m,f,d);continue;}
   if(b.push){
    if(!hasExecutionArmor(d)){
     d.x=Math.max(40,Math.min(width-40,d.x+ray.dx*b.push));
     d.y=Math.max(floorHeight,d.y+ray.dy*b.push);
    }
    if(s.frame%b.interval)continue;
   }
   applyDamage(s,d,m.damage,{owned:!!source.clone,neutral:!!f.undead,receivedHit:true,source:source.owner,move:m.id});
   // Continuous light never causes hitstop, hitstun or movement interruption.
  }
 }
}
