import {spendEnergy} from './MatchStatistics.js';
import {hostile} from './Actors.js';
import {Button,type Fighter,type MoveDefinition,type SimulationSnapshot,type StageDefinition} from '../types.js';
import {characters} from '../characters/registry.js';
import {createFighter} from './Fighter.js';
import {actors} from './Actors.js';
import {retainsOwnedEntities,isActive} from './LifeSystem.js';
import {grounded,surfaceBelow} from './StageCollision.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {applyDamage} from '../combat/DamageSystem.js';
import {igniteTarget} from './StatusSystem.js';
import {sweepEntry} from '../combat/CollisionSystem.js';
import {consumeButtons} from '../input/InputBuffer.js';

export const ASTOLFO={talkRange:300,talkHeight:190,auraRange:250,pulseInterval:15,drainInterval:6,drainAmount:2,spiderSpeed:4,deathRadius:260,sadSlow:.4};
export const personalityMovementSpeed=(f:Fighter)=>f.personality==='sad'?.648:personalitySpeed(f);
export const personalitySpeed=(f:Fighter)=>f.personality==='angry'?1.5:f.personality==='sad'?.9:1;
export const personalityDamage=(f:Fighter)=>f.personality==='angry'?1.4:f.personality==='sad'?.5:1;
export function isTalking(f:Fighter,frame=0):boolean{const m=f.move?characters[f.characterId].moves[f.move]:undefined;return !!m?.talking&&f.moveFrame>=m.startupFrames&&!!(f.previousInput&Button.Special)&&f.meter>0&&isActive(f)&&!f.stun&&f.grappleUntil<=frame&&f.trappedUntil<=frame;}
export function activateAstolfo(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 if(m.talking){f.talkNextDrain=s.frame+ASTOLFO.drainInterval;f.talkNextPulse=s.frame;}
 if(m.talkAuraFrames){f.talkUntil=s.frame+m.talkAuraFrames;f.talkNextPulse=s.frame;}
 if(m.spider&&s.hazards.filter(h=>h.kind==='spider'&&h.owner===owner).length<16){
  const x=Math.max(20,Math.min(stage.width-20,f.x+f.facing*45));
  s.hazards.push({kind:'spider',owner,x,y:surfaceBelow(stage,x,f.y),variant:f.facing,createdAt:s.frame,expiresAt:s.frame+Math.ceil(stage.width/ASTOLFO.spiderSpeed)+60,move:m.id,nextTicks:[]});
 }
 if(m.personalitySplit&&!s.clones.some(c=>c.owner===owner&&(c.kind==='sad'||c.kind==='angry'))){
  for(const kind of ['sad','angry'] as const){
   const clone=createFighter(f.characterId,Math.max(40,Math.min(stage.width-40,f.x+(kind==='sad'?-85:85))),f.facing);
   clone.personality=kind;clone.health=Math.floor(characters[f.characterId].stats.maxHealth*(kind==='sad'?1:.5))-(kind==='angry'?260:0);clone.y=f.y;clone.state='Idle';clone.meter=0;clone.lives=1;
   s.clones.push({id:s.nextCloneId++,owner,kind,fighter:clone,maxHealth:clone.health});
  }
 }
}
/** Holds stop even in hitstop. All deadlines and pulse timing are snapshot-owned. */
export function advanceAstolfo(s:SimulationSnapshot,stage:StageDefinition):void{
 const all=actors(s);
 for(const {fighter:f} of all){
  if(f.talkSlow!==undefined)f.talkSlow=1;
  if(f.talkUntil!==undefined&&f.talkUntil<=s.frame)f.talkUntil=0;
  if(f.sadnessUntil!==undefined&&f.sadnessUntil<=s.frame)f.sadnessUntil=0;
  const move=f.move?characters[f.characterId].moves[f.move]:undefined;
  if(move?.talking){
   if(!(f.previousInput&Button.Special)||f.meter<=0||f.stun||f.grappleUntil>s.frame||f.trappedUntil>s.frame){f.move=null;f.talkNextDrain=0;consumeButtons(f.buffer);if(!f.stun&&f.grappleUntil<=s.frame&&f.trappedUntil<=s.frame){f.state=grounded(f,stage)?'Idle':'Fall';f.stateFrame=0;}}
   else if(isTalking(f,s.frame)&&s.frame>=(f.talkNextDrain??s.frame)){spendEnergy(s,f,ASTOLFO.drainAmount);f.talkNextDrain=s.frame+ASTOLFO.drainInterval;if(!f.meter){f.move=null;consumeButtons(f.buffer);f.state=grounded(f,stage)?'Idle':'Fall';f.stateFrame=0;}}
  }else if(f.talkNextDrain)f.talkNextDrain=0;
 }
 // Compute contacts first so simultaneous talking pulses do not favor seat order.
 const damage:{owned:boolean;target:Fighter;amount:number;source:number;move:string}[]=[];
 for(const {fighter:f,owner} of all){
  if(!isActive(f))continue;
  const aura=(f.talkUntil??0)>s.frame,held=isTalking(f,s.frame);if(!aura&&!held)continue;
  const pulse=s.frame>=(f.talkNextPulse??0);
  for(const a of all){
   const d=a.fighter,dx=(d.x-f.x)*f.facing;
   if(!hostile(s,owner,a.fighter,a.owner)||!canReceiveDirectHit(d,s.frame)||Math.abs(d.y-f.y)>=ASTOLFO.talkHeight)continue;
   const inAura=aura&&Math.abs(dx)<ASTOLFO.auraRange+25,inCone=held&&dx>=-25&&dx<ASTOLFO.talkRange+25;
   if(!inAura&&!inCone)continue;
   d.talkSlow=Math.min(d.talkSlow??1,inAura?.3:.4);
   const spec=inAura?Object.values(characters[f.characterId].moves).find(m=>m.talkAuraFrames):f.move?characters[f.characterId].moves[f.move]:undefined;
   if(pulse&&spec)damage.push({owned:!s.fighters.includes(f),target:d,amount:spec.damage,source:owner,move:spec.id});
  }
  if(pulse)f.talkNextPulse=s.frame+ASTOLFO.pulseInterval;
 }
 for(const d of damage)applyDamage(s,d.target,d.amount,{owned:d.owned,receivedHit:true,source:d.source,move:d.move});
}
/** Swept floor contact catches a dash across the spider between ticks. */
export function advanceSpiders(s:SimulationSnapshot,stage:StageDefinition,previous:Map<Fighter,{x:number;y:number}>):void{
 const bites:SimulationSnapshot['hazards']=[];
 for(const h of s.hazards){
  if(h.kind!=='spider'||h.expiresAt<=s.frame)continue;
  const x=h.x,y=h.y;h.x+=(h.variant??1)*ASTOLFO.spiderSpeed;h.y=surfaceBelow(stage,h.x,h.y);
  const contacts=actors(s).filter(a=>hostile(s,h.owner,a.fighter,a.owner)&&canReceiveDirectHit(a.fighter,s.frame)).map(a=>{
   const f=a.fighter,p=previous.get(f)??f;
   return {f,t:sweepEntry({x:f.x-25,y:f.y,w:50,h:145},x+f.x-p.x,y+12+f.y-p.y,h.x,h.y+12,12)};
  }).filter(c=>Number.isFinite(c.t)).sort((a,b)=>a.t-b.t);
  const d=contacts[0]?.f;
  if(d){
   const m=characters[s.fighters[h.owner].characterId].moves[h.move];applyDamage(s,d,m.damage,{owned:true,receivedHit:true,source:h.owner,move:h.move});
   if(d.poisonUntil<s.frame||!d.poisonUntil)d.poisonNextTick=s.frame+30;
   d.poisonUntil=Math.max(d.poisonUntil,s.frame+(m.poisonFrames??180));d.poisonDamage=Math.max(d.poisonDamage,m.poisonDamage??10);d.poisonOwner=h.owner;d.poisonOwned=true;d.poisonNeutral=false;
   h.expiresAt=s.frame;bites.push({...h,kind:'spider-bite',x:d.x,y:d.y,createdAt:s.frame,expiresAt:s.frame+18});
  }else if(h.x<0||h.x>stage.width)h.expiresAt=s.frame;
 }
 s.hazards=s.hazards.filter(h=>h.expiresAt>s.frame).concat(bites);
}
/** Run before removing dead clones; pattern is a snapshot-owned once-only flag. */
export function burstPersonalities(s:SimulationSnapshot):void{
 for(const c of s.clones){
  if((c.kind!=='sad'&&c.kind!=='angry')||c.fighter.health>0||c.pattern===-1||!retainsOwnedEntities(s.fighters[c.owner]))continue;
  c.pattern=-1;
  for(const a of actors(s))if(hostile(s,c.owner,a.fighter,a.owner)&&canReceiveDirectHit(a.fighter,s.frame)&&Math.abs(a.fighter.x-c.fighter.x)<ASTOLFO.deathRadius&&Math.abs(a.fighter.y-c.fighter.y)<190){
   if(c.kind==='sad')a.fighter.sadnessUntil=Math.max(a.fighter.sadnessUntil??0,s.frame+300);
   else igniteTarget(s,a.fighter,c.owner,300,10,'normal',true);
  }
  s.hazards.push({kind:c.kind==='sad'?'sad-burst':'angry-burst',owner:c.owner,x:c.fighter.x,y:c.fighter.y,createdAt:s.frame,expiresAt:s.frame+30,move:'bipolar',nextTicks:[]});
 }
}
