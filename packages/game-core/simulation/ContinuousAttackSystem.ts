import {hostile} from './Actors.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import type {Fighter,SimulationSnapshot} from '../types.js';
import {characters} from '../characters/registry.js';
import {actors} from './Actors.js';
import {isActive} from './LifeSystem.js';
import {periodicHit} from '../combat/PeriodicHit.js';
export function advanceContinuousAttacks(s:SimulationSnapshot,onHit?:(f:Fighter)=>void,floorHeight=0,arenaWidth=2400):void{
 const all=actors(s);
 const contacts:{source:number;move:string;target:Fighter;damage:number;direction:number;stun:number;push:number}[]=[];
 for(const {fighter:f,owner} of all){
  const m=f.move?characters[f.characterId].moves[f.move]:undefined,spec=m?.periodicMelee;
  if(!m||!spec||!isActive(f))continue;
  if(f.moveFrame<m.startupFrames||f.moveFrame>=m.startupFrames+m.activeFrames||s.frame%spec.interval)continue;
  for(const {fighter:d,owner:other} of all){
   if(hostile(s,owner,d,other)&&canReceiveDirectHit(d,s.frame)&&Math.abs(d.x-f.x)<spec.rangeX&&Math.abs(d.y-f.y)<spec.rangeY)contacts.push({source:owner,move:m.id,target:d,damage:m.damage,direction:Math.sign(d.x-f.x)||f.facing,stun:spec.hitstun,push:spec.push});
  }
 }
 for(const c of contacts)periodicHit(s,c.target,c.damage,c.direction,c.stun,c.push,onHit,floorHeight,{source:c.source,move:c.move},arenaWidth);
}
