import {spendEnergy} from './MatchStatistics.js';
import {hasHitReactionArmor} from '../combat/ExecutionArmor.js';
import {deterministicHypot,deterministicCos} from './DeterministicMath.js';
import {characters} from '../characters/registry.js';
import {Button,type Fighter,type SimulationSnapshot,type StageDefinition} from '../types.js';
import {applyDamage} from '../combat/DamageSystem.js';
import {isActive,isInvulnerable} from './LifeSystem.js';
import {enter} from './StateMachine.js';
export const JOMP={drainInterval:5,repFrames:36,reps:9,repDamage:43.2,throwDamage:180,landingStun:120,homingSpeed:28} as const;
export const coolMuscles=(f:Fighter)=>characters[f.characterId].muscleFighter&&f.move==='coolMuscles';
export const gymHolding=(f:Fighter)=>characters[f.characterId].muscleFighter&&f.move==='gymBro'&&(f.gymTarget??-1)>=0;
/** A lock reserves its victim throughout startup and homing. */
export function gymReserved(s:SimulationSnapshot,target:Fighter,except?:Fighter):boolean{
 const seat=s.fighters.indexOf(target);
 return seat>=0&&s.fighters.some(a=>a!==except&&isActive(a)&&gymHolding(a)&&a.gymTarget===seat);
}
export function gymTarget(s:SimulationSnapshot,f:Fighter):number{
 if(gymReserved(s,f))return -1;
 const owner=s.fighters.indexOf(f);
 return s.fighters.map((d,i)=>({d,i})).filter(({d,i})=>s.teams[i]!==s.teams[owner]&&isActive(d)&&!hasHitReactionArmor(d,s.frame)&&!gymHolding(d)&&d.grappleUntil<=s.frame&&!isInvulnerable(d,s.frame)&&!gymReserved(s,d,f))
 .sort((a,b)=>Number((b.d.x-f.x)*f.facing>=0)-Number((a.d.x-f.x)*f.facing>=0)||deterministicHypot(a.d.x-f.x,a.d.y-f.y)-deterministicHypot(b.d.x-f.x,b.d.y-f.y)||a.i-b.i)[0]?.i??-1;
}
export function startJomp(s:SimulationSnapshot,f:Fighter):void{
 if(!characters[f.characterId].muscleFighter)return;
 if(f.move==='coolMuscles')f.flexNextDrain=s.frame+JOMP.drainInterval;
 if(f.move==='gymBro'){f.gymTarget=gymTarget(s,f);const d=s.fighters[f.gymTarget];if(d&&d.x!==f.x)f.facing=d.x>f.x?1:-1;f.gymStartedAt=0;f.gymNextRep=0;}
}
function release(s:SimulationSnapshot,a:Fighter,d?:Fighter):void{
 if(d&&d.grappleOwner===s.fighters.indexOf(a)){d.grappleUntil=0;d.grappleOwner=-1;d.grappleNextTick=0;d.buffer=[];if(d.state==='Grappled')enter(d,'Fall');}
 a.gymTarget=-1;a.gymStartedAt=a.gymNextRep=0;
 if(a.move==='gymBro'){a.move=null;a.buffer=[];enter(a,'Idle');}
}
/** Absolute tick timers survive hit stop, resimulation, target movement and disconnects. */
export function advanceJomp(s:SimulationSnapshot,stage:StageDefinition,impact?:(target:Fighter)=>void):void{
 for(const a of s.fighters){
  if(a.gymStunnedUntil){
   if(s.frame<a.gymStunnedUntil&&isActive(a)){a.move=null;a.vx=a.vy=0;a.stun=a.gymStunnedUntil-s.frame+1;a.dazed=true;enter(a,'HitStunStanding');}
   else{a.gymStunnedUntil=0;a.stun=0;a.dazed=false;if(a.state==='HitStunStanding')enter(a,'Idle');}
  }
  if(coolMuscles(a)){
   if(!isActive(a)||!(a.previousInput&Button.Special)||a.meter<=0){a.move=null;a.flexNextDrain=0;a.buffer=[];enter(a,'Idle');}
   else{a.vx=a.vy=0;if(s.frame>=(a.flexNextDrain??0)){spendEnergy(s,a,.3,true);a.flexNextDrain=s.frame+JOMP.drainInterval;if(a.meter===0){a.move=null;enter(a,'Idle');}}}
  }
  if((a.gymTarget??-1)<0)continue;
  const d=s.fighters[a.gymTarget!];
  if(!gymHolding(a)||!isActive(a)||!d||!isActive(d)||hasHitReactionArmor(d,s.frame)||isInvulnerable(d,s.frame)||(d.grappleUntil>s.frame&&d.grappleOwner!==s.fighters.indexOf(a))||s.phase!=='fight'){release(s,a,d);continue;}
  a.vx=a.vy=0;a.stun=0;
  if(a.moveFrame<18&&!a.gymStartedAt)continue;
  if(!a.gymStartedAt){
   const dx=d.x-a.x,dy=d.y-a.y,distance=deterministicHypot(dx,dy);
   a.x+=dx/Math.max(1,distance)*Math.min(JOMP.homingSpeed,distance);
   a.y+=dy/Math.max(1,distance)*Math.min(JOMP.homingSpeed,distance);
   if(distance>55+JOMP.homingSpeed)continue;
   a.gymStartedAt=s.frame;a.gymNextRep=s.frame+JOMP.repFrames;
   d.grappleOwner=s.fighters.indexOf(a);d.grappleUntil=s.frame+JOMP.repFrames*JOMP.reps+1;
  }
  const elapsed=s.frame-a.gymStartedAt;
  const phase=Math.floor(elapsed/(JOMP.repFrames*3));
  const lift=(1-deterministicCos(elapsed/JOMP.repFrames*Math.PI*2))/2;
  a.moveFrame=18+elapsed;a.y=stage.floorHeight;
  enter(a,'GymBro');
  d.move=null;d.stun=0;d.vx=d.vy=0;d.buffer=[];enter(d,'Grappled');
  d.x=Math.max(40,Math.min(stage.width-40,a.x+a.facing*(phase===0?65:phase===1?10:55+lift*30)));
  d.y=a.y+(phase===0?65+lift*55:phase===1?65+lift*65:85+lift*85);
  if(s.frame>=(a.gymNextRep??Infinity)){
   applyDamage(s,d,JOMP.repDamage*(a.weaponUntil>s.frame?1.5:1),{combo:'damage',receivedHit:true,source:s.fighters.indexOf(a),move:'gymBro'});
   impact?.(d);a.gymNextRep!+=JOMP.repFrames;
  }
  if(elapsed>=JOMP.repFrames*JOMP.reps){
   applyDamage(s,d,JOMP.throwDamage*(a.weaponUntil>s.frame?1.5:1),{combo:'damage',receivedHit:true,source:s.fighters.indexOf(a),move:'gymBro'});
   impact?.(d);release(s,a,d);d.vx=a.facing*18;d.vy=16;d.stun=1;d.gymLandingStun=true;enter(d,'AirHitStun');
  }
 }
}
