import {characters} from '../characters/registry.js';
import type {Fighter,SimulationSnapshot} from '../types.js';
import {enter} from '../simulation/StateMachine.js';
export const HIT_SEQUENCE_WINDOW = 60;
export const HITSTUN_IMMUNITY_FRAMES = 45;
/** Returns zero when a contact must deal damage without interrupting control. */
export function consecutiveHitstun(s:SimulationSnapshot,f:Fighter,stun:number,direction:number,floorHeight=0):number {
 if(characters[f.characterId].muscleFighter&&(f.move==='coolMuscles'||f.move==='gymBro')||f.grappleUntil>s.frame&&s.fighters[f.grappleOwner]?.move==='gymBro')return 0;
 if(s.frame<(f.gymStunnedUntil??0))return 0;
 if(s.frame<f.hitstunImmuneUntil)return 0;
 delete f.jopaStunUntil;
 if(s.frame-f.lastStunHitFrame>=HIT_SEQUENCE_WINDOW)f.consecutiveHits=0;
 f.lastStunHitFrame=s.frame;
 f.consecutiveHits++;
 if(f.consecutiveHits<5)return Math.max(1,Math.ceil(stun*(1-.2*(f.consecutiveHits-1))));
 f.consecutiveHits=0;
 f.hitstunImmuneUntil=s.frame+HITSTUN_IMMUNITY_FRAMES;
 f.lastStunHitFrame=-HIT_SEQUENCE_WINDOW;
 delete f.nikalzStunUntil;
 f.stun=0;f.dazed=false;f.move=null;f.actionUntil=0;
 f.trappedUntil=f.grappleUntil=f.grappleNextTick=0;f.grappleOwner=-1;
 f.vx=f.vy=0;
 // Displace immediately so the escape never requires a locked reaction frame.
 f.x+= (direction||-f.facing)*40;
 enter(f,f.y>floorHeight?'Fall':'Idle');
 return 0;
}
