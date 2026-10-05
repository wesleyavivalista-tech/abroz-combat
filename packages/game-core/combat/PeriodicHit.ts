import {characters} from '../characters/registry.js';
import {consecutiveHitstun} from './HitstunSystem.js';
import type {Fighter,SimulationSnapshot} from '../types.js';
import {type DamageOptions,applyDamage} from './DamageSystem.js';
import {enter} from '../simulation/StateMachine.js';
export function periodicHit(s:SimulationSnapshot,f:Fighter,amount:number,direction:number,stun:number,push:number,onHit?:(f:Fighter)=>void,floorHeight=0,audio:DamageOptions={}):boolean {
 applyDamage(s,f,amount,{...audio,combo:'hit'});
 const reactionStun=consecutiveHitstun(s,f,stun,direction,floorHeight);
 if(characters[f.characterId].muscleFighter&&(f.move==='coolMuscles'||f.move==='gymBro')){onHit?.(f);return false;}
 if(!reactionStun){onHit?.(f);return false;}
 f.move=null;if(f.actionUntil)f.actionUntil=0;f.stun=reactionStun;f.vx=direction*push;
 enter(f,f.y>floorHeight?'AirHitStun':'HitStunStanding');onHit?.(f);return true;
}
