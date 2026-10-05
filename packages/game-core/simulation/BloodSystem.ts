import {refreshTrail} from './TrailSystem.js';
import {characters} from '../characters/registry.js';
import {applyDamage} from '../combat/DamageSystem.js';
import type {Fighter,MoveDefinition,SimulationSnapshot,StageDefinition} from '../types.js';
import {actors} from './Actors.js';
import {isActive,isInvulnerable} from './LifeSystem.js';
import {grounded,surfaceBelow} from './StageCollision.js';
/** Strongest slow wins. Poison only affects movement; blood also affects attacks. */
export const attackSlow=(f:Fighter,frame:number):number=>Math.min(f.areaSlow,f.bloodSlowUntil>frame?.5:1);
export const movementSlow=(f:Fighter,frame:number):number=>Math.min(attackSlow(f,frame),(f.beeSlowUntil??0)>frame?.7:1,(f.movementSlowUntil??0)>frame?.8:1,f.poisonUntil>frame?.8:1,f.cloudSlow??1,f.talkSlow??1,(f.sadnessUntil??0)>frame?.4:1)*f.floodSpeed*(f.bloodMasterUntil>frame?1.05:1);
export function activateBlood(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 if(m.bloodMasterFrames)f.bloodMasterUntil=s.frame+m.bloodMasterFrames;
 if(m.bloodPoolFrames && s.hazards.filter(h=>h.kind==='blood-pool').length<96){
  const y=surfaceBelow(stage,f.x,f.y);
  s.hazards.push({kind:'blood-pool',owner,x:f.x,y,width:320,createdAt:s.frame,expiresAt:s.frame+m.bloodPoolFrames,move:m.id,nextTicks:[]});
 }
 if(m.bloodFloodFrames){
  const platforms=stage.platforms?.map(p=>p.y)??[];
  const height=Math.max(60,Math.min(...(platforms.length?platforms:[stage.floorHeight+260]))-stage.floorHeight-18);
  s.hazards.push({kind:'blood-flood',owner,x:stage.width/2,y:stage.floorHeight,width:stage.width,height,createdAt:s.frame,expiresAt:s.frame+m.bloodFloodFrames,move:m.id,nextTicks:[]});
 }
}
export function floodHeight(h:{height?:number;createdAt?:number},frame:number):number{
 return (h.height??240)*Math.min(1,Math.max(0,(frame-(h.createdAt??frame))/90));
}
export function advanceBlood(s:SimulationSnapshot,stage:StageDefinition):void{
 const all=actors(s);
 s.hazards=s.hazards.filter(h=>h.expiresAt>s.frame);
 for(const {fighter:f} of all){
  f.areaSlow=1;f.floodSpeed=1;
  if(f.poisonUntil && s.frame<=f.poisonUntil && f.poisonNextTick>0 && s.frame>=f.poisonNextTick){
   if(isActive(f)&&!isInvulnerable(f,s.frame)){
    const source=s.fighters[f.poisonOwner];
    applyDamage(s,f,f.poisonDamage*(source&&source.bloodMasterUntil>s.frame?1.05:1),{source:f.poisonOwner,move:'@poison'});
   }
   f.poisonNextTick+=30;
  }
  if(f.poisonUntil<=s.frame){f.poisonUntil=f.poisonNextTick=f.poisonDamage=0;f.poisonOwner=-1;}
  if(f.bloodSlowUntil<=s.frame)f.bloodSlowUntil=0;
  if(f.bloodMasterUntil<=s.frame)f.bloodMasterUntil=0;
 }
 s.fighters.forEach((f,owner)=>{
  if(!isActive(f)||!f.bloodMasterUntil)return;
  if(grounded(f,stage)){
   const x=Math.floor(f.x/48)*48+24;
   refreshTrail(s,{kind:'blood-trail',owner,x,y:f.y,width:48,createdAt:s.frame,expiresAt:s.frame+120,move:'master',nextTicks:[]},384);
  }
  for(const {fighter:d,owner:other} of all){
   if(s.teams[owner]!==s.teams[other]&&isActive(d)&&!isInvulnerable(d,s.frame)&&Math.abs(d.x-f.x)<75&&Math.abs(d.y-f.y)<150)d.bloodSlowUntil=s.frame+120;
  }
 });
 for(const h of s.hazards){
  if(!h.kind?.startsWith('blood-'))continue;
  for(const {fighter:f,owner} of all){
   if(!isActive(f))continue;
   const inside=h.kind==='blood-flood'?f.y<h.y+floodHeight(h,s.frame):Math.abs(f.x-h.x)<(h.width??48)/2+25&&Math.abs(f.y-h.y)<18;
   if(inside&&h.kind==='blood-flood'&&owner===h.owner)f.floodSpeed=characters[f.characterId].moves[h.move]?.ownerFloodSpeed??1;
   if(isInvulnerable(f,s.frame)||s.teams[owner]===s.teams[h.owner])continue;
   if(inside)f.areaSlow=Math.min(f.areaSlow,h.kind==='blood-flood'?.1:.5);
  }
 }
}
