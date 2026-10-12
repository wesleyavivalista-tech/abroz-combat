import {characters} from '../characters/registry.js';
import type {Fighter} from '../types.js';

/** Derived from the live action, never from a transformation or effect lifetime. */
export function hasExecutionArmor(f:Fighter):boolean {
 if(!f.move||f.health<=0||f.lives<=0||f.respawnAt!==0)return false;
 const def=characters[f.characterId],m=def.moves[f.move];
 if(!m||m.executionArmor===false||!(f.state===m.state||f.state==='Grappling'||f.state==='GymBro'))return false;
 // Follow-up casts and a dedicated ending animation belong to the ability;
 // transformed basic attacks do not, even when they use SpecialMove state.
 return def.specialButtons.includes(f.move)||def.superButtons.includes(f.move)||
  def.superButtons.some(id=>def.moves[id].reactivation===f.move)||
  def.weaponExpiryMove===f.move||!!m.loanStamp||m.nikalzAbility==='place';
}

/** Giant Buda explicitly retains hit-reaction armor after its activation finishes. */
export function hasHitReactionArmor(f:Fighter,frame:number):boolean {
 return hasExecutionArmor(f)||(!!characters[f.characterId].weaponModifiers?.hitReactionArmor&&f.weaponUntil>frame&&f.health>0&&f.lives>0&&f.respawnAt===0);
}
