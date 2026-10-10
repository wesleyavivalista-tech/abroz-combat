import {hostile} from './Actors.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {recordGameplayEvent} from '../combat/GameplayEvents.js';
import {Button,type Fighter,type MoveDefinition,type SimulationSnapshot,type StageDefinition,type BeeSwarm} from '../types.js';
import {bufferedButton} from '../input/InputBuffer.js';
import {actors} from './Actors.js';
import {retainsOwnedEntities,isActive,isInvulnerable} from './LifeSystem.js';
import {surfaceBelow} from './StageCollision.js';
import {enter} from './StateMachine.js';
import {periodicHit} from '../combat/PeriodicHit.js';
import {gainEnergy} from './EnergySystem.js';
import {damageStructure} from './StructureSystem.js';
export const MAX_BEE_SWARMS_PER_OWNER=100;
export const NIKALZ={boxHealth:550,boxSpawnLimit:10,spawnInterval:240,slowFrames:180,slowMultiplier:.65,swarmDamage:40,shockRange:290,shockDamage:125,stunFrames:120,meteorStun:360,honeyEnergy:25,honeyPoisonFrames:300,honeyPoisonDamage:10};
export function nikalzRequest(f:Fighter,frame:number):string|null|undefined{
 if(!f.beeBoxes)return undefined;
 return [Button.Light,Button.Medium,Button.Heavy].some(b=>bufferedButton(f.buffer,frame,b))?'placeBox':null;
}
export function spawnBees(s:SimulationSnapshot,owner:number,x:number,y:number,box?:{id:number;shots:number;facing:number}):void{
 s.bees??=[];s.nextBeeId??=0;
 // Keep missed swarms persistent while bounding long matches and rollback history.
 // Array order is spawn order and is part of the snapshot. Other owners are untouched.
 while(s.bees.filter(b=>b.owner===owner).length>=MAX_BEE_SWARMS_PER_OWNER)
  s.bees.splice(s.bees.findIndex(b=>b.owner===owner),1);
 const variant=box?box.shots+box.id*7:0;
 s.bees.push({id:s.nextBeeId++,owner,x,y,originX:x,originY:y,born:s.frame,range:box?180+(variant%5)*55:72,period:box?440+(variant%7)*68:400,direction:box?(variant%2?1:-1):s.fighters[owner].facing,vertical:box?18+(variant%4)*18:10});
}
/** Triangle paths use only integer arithmetic, with independent direction, range and period. */
export function beePosition(b:BeeSwarm,frame:number):{x:number;y:number}{
 const age=frame-b.born,phase=(age%b.period)/b.period;
 const triangle=phase<.25?phase*4:phase<.75?2-phase*4:phase*4-4;
 const lift=((age*3+b.id*11)%b.period)/b.period;
 return {x:b.originX+Math.round(triangle*b.range*b.direction),y:b.originY+Math.round((lift<.5?lift*2:2-lift*2)*b.vertical)};
}
export function meteorDamage(distance:number,range:number):number{const fraction=Math.max(0,1-distance/range);return Math.round(78+572*fraction*fraction*fraction);}
export function foreheadWave(s:SimulationSnapshot,owner:number,x:number,y:number,range:number,meteor=false):void{
 recordGameplayEvent(s,'GroundImpact',owner,meteor?'meteor':'testada');
 s.foreheadWaves??=[];s.foreheadWaves.push({owner,x,y,born:s.frame,range,speed:meteor?55:28,meteor,hits:[]});
}
export function activateNikalz(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 switch(m.nikalzAbility){
 case 'shock':foreheadWave(s,owner,f.x,f.y,NIKALZ.shockRange);break;
 case 'bees':spawnBees(s,owner,Math.max(30,Math.min(stage.width-30,f.x+f.facing*110)),f.y+85);break;
 case 'boxes':f.beeBoxes=5;break;
 case 'place':f.beeBoxes=Math.max(0,(f.beeBoxes??0)-1);break;
 case 'meteor':f.meteorStart=s.frame;f.meteorX=f.x;f.meteorY=f.y;f.vx=f.vy=0;break;
 }
}
/** Explicit ascent, offscreen pause, and forehead-first descent are rollback state. */
export function controlMeteor(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number):boolean{
 if(f.meteorStart===undefined)return false;
 if(f.move!=='meteor'||!isActive(f)||f.stun){delete f.meteorStart;delete f.meteorX;delete f.meteorY;return false;}
 const age=s.frame-f.meteorStart,base=f.meteorY??stage.floorHeight;
 f.x=f.meteorX??f.x;f.vx=f.vy=0;
 if(age<24)f.y=base+age*50;
 else if(age<54)f.y=base+1200;
 else if(age<74){const fraction=(age-54)/20;f.y=stage.floorHeight+(base+1200-stage.floorHeight)*(1-fraction*fraction);}
 else{
  f.y=stage.floorHeight;foreheadWave(s,owner,f.x,f.y,stage.width,true);
  delete f.meteorStart;delete f.meteorX;delete f.meteorY;
  f.moveFrame=25;f.airJumpUsed=false;f.airJumpsUsed=0;
 }
 return true;
}
export function advanceNikalz(s:SimulationSnapshot,stage:StageDefinition):void{
 if(s.phase!=='fight'){if(s.bees)s.bees=[];if(s.foreheadWaves)s.foreheadWaves=[];return;}
 if(!s.bees&&!s.foreheadWaves&&!s.structures?.some(b=>b.kind==='bee-box')&&!s.hazards.some(h=>h.kind==='honey')&&!actors(s).some(({fighter:f})=>f.beeBoxes||f.beeSlowUntil||f.nikalzStunUntil))return;
 for(const {fighter:f} of actors(s)){
  if(!isActive(f)){delete f.beeBoxes;delete f.beeSlowUntil;delete f.nikalzStunUntil;delete f.meteorStart;continue;}
  if(f.beeSlowUntil&&s.frame>=f.beeSlowUntil)delete f.beeSlowUntil;
  if(f.nikalzStunUntil){
   if(s.frame>=f.nikalzStunUntil){delete f.nikalzStunUntil;f.stun=Math.max(f.timedHitReaction??0,(f.loanStunUntil??0)>s.frame?f.loanStunUntil!-s.frame+1:0);if(!f.loanStunUntil)delete f.timedHitReaction;if(!f.stun){f.dazed=false;enter(f,f.y>surfaceBelow(stage,f.x,f.y)?'Fall':'Idle');}}
   else {f.move=null;f.stun=Math.max(f.timedHitReaction??0,f.nikalzStunUntil-s.frame+1);f.dazed=true;enter(f,f.y>surfaceBelow(stage,f.x,f.y)?'AirHitStun':'HitStunStanding');}
  }
 }
 for(const b of s.structures??[]){
  if(b.kind!=='bee-box'||b.phase!=='built'||!retainsOwnedEntities(s.fighters[b.owner])||s.frame<b.nextShot)continue;
  if(b.shots<NIKALZ.boxSpawnLimit){spawnBees(s,b.owner,b.x,b.y+50,b);b.shots++;b.nextShot=s.frame+NIKALZ.spawnInterval;}
  if(b.shots>=NIKALZ.boxSpawnLimit)damageStructure(s,b,b.health,'bee-box-exhausted',0,stage);
 }
 s.bees=(s.bees??[]).filter(b=>retainsOwnedEntities(s.fighters[b.owner]));
 for(const b of s.bees){
  const old={x:b.x,y:b.y};Object.assign(b,beePosition(b,s.frame));b.x=Math.max(25,Math.min(stage.width-25,b.x));
  const target=actors(s).find(a=>hostile(s,b.owner,a.fighter,a.owner)&&isActive(a.fighter)&&!isInvulnerable(a.fighter,s.frame)&&a.fighter.x>=Math.min(old.x,b.x)-55&&a.fighter.x<=Math.max(old.x,b.x)+55&&a.fighter.y<b.y+30&&a.fighter.y+150>b.y-30);
  if(target){periodicHit(s,target.fighter,NIKALZ.swarmDamage,Math.sign(target.fighter.x-b.x),10,2,undefined,stage.floorHeight,{source:b.owner,move:"bees"},stage.width);target.fighter.beeSlowUntil=s.frame+NIKALZ.slowFrames;b.owner=-1;}
 }
 s.bees=s.bees.filter(b=>b.owner>=0);
 for(const w of s.foreheadWaves??[]){
  const radius=Math.min(w.range,(s.frame-w.born+1)*w.speed),previousRadius=Math.max(0,(s.frame-w.born)*w.speed-35);
  for(const a of actors(s)){
   const d=a.fighter,key=a.clone?'clone:'+a.clone.id:'seat:'+a.owner,distance=Math.abs(d.x-w.x);
   if(w.hits.includes(key)||!hostile(s,w.owner,a.fighter,a.owner)||!canReceiveDirectHit(d,s.frame)||distance>radius||distance<previousRadius||d.y>w.y+(w.meteor?260:110)||d.y+150<w.y)continue;
   w.hits.push(key);const direction=d.x>=w.x?1:-1,stun=w.meteor?NIKALZ.meteorStun:NIKALZ.stunFrames;
   const reacts=periodicHit(s,d,w.meteor?meteorDamage(distance,w.range):NIKALZ.shockDamage,direction,stun,w.meteor?24:18,undefined,stage.floorHeight,{source:w.owner,move:w.meteor?"meteor":"testada"},stage.width);
   if(!reacts)continue;
   d.nikalzStunUntil=s.frame+stun;d.stun=stun;d.move=null;d.dazed=true;d.vx=direction*(w.meteor?24:18);d.vy=w.meteor?15:10;d.y+=1;enter(d,'AirHitStun');
  }
  for(const b of s.structures??[])if(b.phase==='built'&&s.teams[b.owner]!==s.teams[w.owner]&&Math.abs(b.x-w.x)<=radius&&Math.abs(b.x-w.x)>=previousRadius&&Math.abs(b.y-w.y)<260)damageStructure(s,b,w.meteor?meteorDamage(Math.abs(b.x-w.x),w.range):NIKALZ.shockDamage,`forehead:${w.owner}:${w.born}`,0,stage);
 }
 s.foreheadWaves=(s.foreheadWaves??[]).filter(w=>retainsOwnedEntities(s.fighters[w.owner])&&s.frame-w.born<Math.ceil(w.range/w.speed)+(w.meteor?100:35));
 for(const h of s.hazards){
  if(h.kind!=='honey'||s.frame-(h.createdAt??0)<24)continue;
  const seat=s.fighters.findIndex(f=>isActive(f)&&!isInvulnerable(f,s.frame)&&Math.abs(f.x-h.x)<40&&Math.abs(f.y-h.y)<50);
  if(seat<0)continue;
  const f=s.fighters[seat];
  if(s.teams[seat]===s.teams[h.owner])gainEnergy(f,NIKALZ.honeyEnergy,s.frame);
  else {f.poisonUntil=s.frame+NIKALZ.honeyPoisonFrames;f.poisonNextTick=s.frame+30;f.poisonDamage=NIKALZ.honeyPoisonDamage;f.poisonOwner=h.owner;}
  h.expiresAt=s.frame;
 }
}
