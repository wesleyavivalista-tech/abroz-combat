import {hurtbox} from './CollisionSystem.js';
import {structureSurfaces} from '../simulation/StructureSystem.js';
import {hostile} from '../simulation/Actors.js';
import {characters} from '../characters/registry.js';
import type {Fighter,SimulationSnapshot} from '../types.js';
import {enter} from '../simulation/StateMachine.js';
export const HIT_SEQUENCE_WINDOW = 60;
export const HITSTUN_IMMUNITY_FRAMES = 45;
/** Returns zero when a contact must deal damage without interrupting control. */
export function consecutiveHitstun(s:SimulationSnapshot,f:Fighter,stun:number,direction:number,floorHeight=0,arenaWidth=2400):number {
 if(f.undead==='grave')return 0;
 if(characters[f.characterId].muscleFighter&&(f.move==='coolMuscles'||f.move==='gymBro')||f.grappleUntil>s.frame&&s.fighters[f.grappleOwner]?.move==='gymBro')return 0;
 if(s.frame<(f.gymStunnedUntil??0))return 0;
 if(s.frame<f.hitstunImmuneUntil)return 0;
 delete f.jopaStunUntil;
 if(s.frame-f.lastStunHitFrame>=HIT_SEQUENCE_WINDOW)f.consecutiveHits=0;
 f.lastStunHitFrame=s.frame;
 f.consecutiveHits++;
 if(f.consecutiveHits<5){
  const reaction=Math.max(1,Math.ceil(stun*(1-.2*(f.consecutiveHits-1))));
  if(f.loanStunUntil||f.nikalzStunUntil)f.timedHitReaction=reaction;
  return reaction;
 }
 f.consecutiveHits=0;
 f.hitstunImmuneUntil=s.frame+HITSTUN_IMMUNITY_FRAMES;
 f.lastStunHitFrame=-HIT_SEQUENCE_WINDOW;
 delete f.nikalzStunUntil;
 delete f.loanStunUntil;
 delete f.timedHitReaction;
 f.stun=0;f.dazed=false;f.move=null;f.actionUntil=0;
 f.trappedUntil=f.grappleUntil=f.grappleNextTick=0;f.grappleOwner=-1;
 f.vx=f.vy=0;
 // Displace immediately so the escape never requires a locked reaction frame.
 const before=f.x,body=hurtbox(f),half=body.w/2;
 let destination=Math.max(40,Math.min(arenaWidth-40,before+(direction||-f.facing)*40));
 const owner=s.fighters.indexOf(f)>=0?s.fighters.indexOf(f):s.clones.find(c=>c.fighter===f)?.owner??-1;
 for(const b of s.structures??[]){
  if(b.phase!=='built'||!(b.kind==='house'||b.kind==='wall'&&hostile(s,b.owner,f,owner)))continue;
  for(const box of structureSurfaces(b)){
   if(body.y>=box.y+box.h||body.y+body.h<=box.y)continue;
   const left=box.x-half,right=box.x+box.w+half;
   if(before<=left&&destination>left)destination=left;
   else if(before>=right&&destination<right)destination=right;
   else if(before>left&&before<right)destination=before;
  }
 }
 f.x=Math.max(40,Math.min(arenaWidth-40,destination));
 enter(f,f.y>floorHeight?'Fall':'Idle');
 return 0;
}
