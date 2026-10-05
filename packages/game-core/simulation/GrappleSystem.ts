import {characters} from '../characters/registry.js';
import {applyDamage} from '../combat/DamageSystem.js';
import type { SimulationSnapshot } from '../types.js';
import { actors } from './Actors.js';
import { isActive } from './LifeSystem.js';
import { enter } from './StateMachine.js';
/** A non-sexual bear hug: one target, fixed duration, releases if the holder is interrupted. */
export function advanceGrapples(s:SimulationSnapshot,floorHeight=0):void {
 for(const {fighter:d} of actors(s)){
  if(!d.grappleUntil)continue;
  const a=s.fighters[d.grappleOwner];
  if(a&&characters[a.characterId].muscleFighter&&a.move==="gymBro")continue;
  if(!a||!isActive(a)||!isActive(d)||(!a.move||!characters[a.characterId].moves[a.move].grappleFrames)||a.state!=='Grappling'||a.trappedUntil>s.frame||s.frame>d.grappleUntil){
   d.grappleUntil=d.grappleNextTick=0;d.grappleOwner=-1;d.buffer=[];
   if(d.state==='Grappled')enter(d,d.y>floorHeight?'Fall':'Idle');
   if(a?.state==='Grappling'){a.move=null;a.buffer=[];enter(a,a.y>floorHeight?'Fall':'Idle');}
   continue;
  }
  d.x=a.x+a.facing*42;d.y=a.y;d.vx=d.vy=a.vx=a.vy=0;d.move=null;d.stun=0;d.buffer=[];enter(d,'Grappled');
  if(s.frame>=d.grappleNextTick){applyDamage(s,d,24,{combo:'damage',receivedHit:true,source:d.grappleOwner,move:a.move??'hug'});d.grappleNextTick+=30;}
 }
 s.fighters.forEach((a,owner)=>{
  if(a.state==='Grappling'&&!actors(s).some(v=>v.fighter.grappleOwner===owner&&v.fighter.grappleUntil>=s.frame&&isActive(v.fighter))){a.move=null;a.buffer=[];enter(a,a.y>floorHeight?'Fall':'Idle');}
 });
}
