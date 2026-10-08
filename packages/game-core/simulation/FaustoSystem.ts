import {hostile} from './Actors.js';
import {characters} from '../characters/registry.js';
import type {Fighter,MoveDefinition,SimulationSnapshot,StageDefinition} from '../types.js';
import {actors} from './Actors.js';
import {isActive,isInvulnerable} from './LifeSystem.js';
import {surfaceBelow} from './StageCollision.js';
import {resolveHit} from '../combat/CombatSystem.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {sweepEntry} from '../combat/CollisionSystem.js';
export const FAUSTO={cloudWidth:300,cloudHeight:190,cloudSlow:.6,trapLimit:128};
export function isFlashDashing(f:Fighter):boolean{const m=f.move?characters[f.characterId].moves[f.move]:undefined;return !!m?.flashDash&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames;}
export function activateFausto(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 if(m.origamiTrap&&s.hazards.filter(h=>h.kind==='origami'&&h.owner===owner).length<FAUSTO.trapLimit){
  // Snapshot-owned PRNG: restoring mid-fold reproduces the same next design.
  f.origamiSeed=(Math.imul(f.origamiSeed??(owner+1)*7919,1664525)+1013904223)>>>0;
  const x=Math.max(30,Math.min(stage.width-30,f.x+f.facing*48));
  s.hazards.push({kind:'origami',variant:f.origamiSeed%5,owner,x,y:surfaceBelow(stage,x,f.y),createdAt:s.frame,expiresAt:Number.MAX_SAFE_INTEGER,move:m.id,nextTicks:[]});
 }
 if(m.whiteCloudFrames)s.hazards.push({kind:'white-cloud',owner,x:f.x,y:f.y,width:FAUSTO.cloudWidth,height:FAUSTO.cloudHeight,createdAt:s.frame,expiresAt:s.frame+m.whiteCloudFrames,move:m.id,nextTicks:[]});
 if(m.angerFrames){f.angerUntil=s.frame+m.angerFrames;f.angerStacks=0;}
}
/** Movement-only slow is independent of the shared attack-speed debuffs. */
export function advanceFausto(s:SimulationSnapshot):void{
 for(const a of actors(s)){
  const f=a.fighter;
  if((f.angerUntil??0)>0&&f.angerUntil!<=s.frame){f.angerUntil=0;f.angerStacks=0;}
  if(f.cloudSlow!==undefined)f.cloudSlow=1;
  if(!isActive(f)||isInvulnerable(f,s.frame))continue;
  for(const h of s.hazards)if(h.kind==='white-cloud'&&h.expiresAt>s.frame&&hostile(s,h.owner,a.fighter,a.owner)&&Math.abs(f.x-h.x)<(h.width??FAUSTO.cloudWidth)/2+25&&f.y<h.y+(h.height??FAUSTO.cloudHeight)&&f.y+150>h.y)f.cloudSlow=FAUSTO.cloudSlow;
 }
}
/** Swept contact catches fast dashes over a trap; jumps above it remain safe. */
export function triggerOrigami(s:SimulationSnapshot,stage:StageDefinition,previous:Map<Fighter,{x:number;y:number}>,emit:(type:string,f:Fighter,power?:number,player?:number)=>void):void{
 const bursts:SimulationSnapshot['hazards']=[];
 for(const h of s.hazards){
  if(h.kind!=='origami'||h.expiresAt<=s.frame)continue;
  const candidates=actors(s).filter(a=>hostile(s,h.owner,a.fighter,a.owner)&&canReceiveDirectHit(a.fighter,s.frame)).map(a=>{const f=a.fighter,p=previous.get(f)??f;return {a,t:sweepEntry({x:h.x-25,y:h.y-10,w:50,h:35},p.x,p.y,f.x,f.y,20)};}).filter(c=>Number.isFinite(c.t)).sort((a,b)=>a.t-b.t);
  const a=candidates[0]?.a;if(!a)continue;
  const source=s.fighters[h.owner],target=a.fighter;
  resolveHit(s,stage,emit,h.owner,characters[source.characterId].moves[h.move],target.previousInput,!!target.move,a.owner,Math.sign(target.x-h.x)||source.facing,source,target);
  h.expiresAt=s.frame;bursts.push({...h,kind:'paper-burst',createdAt:s.frame,expiresAt:s.frame+30});
 }
 s.hazards=s.hazards.filter(h=>h.expiresAt>s.frame).concat(bursts);
}
