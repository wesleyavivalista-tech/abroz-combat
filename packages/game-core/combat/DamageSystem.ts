import {inLove,EIDE} from '../simulation/EideSystem.js';
import {receiveAngerHit} from '../simulation/AngerSystem.js';
import {type DamageSource,recordDamage} from './GameplayEvents.js';
import type {Fighter,SimulationSnapshot} from '../types.js';
import {characters} from '../characters/registry.js';
/** Multiplicative defense, rounded once after all modifiers (legacy behavior). */
export function damageMultiplier(f:Fighter,frame:number):number{
 const def=characters[f.characterId];
 return (inLove(f)?EIDE.loveDefense:1)*(characters[f.characterId].muscleFighter&&f.move==='coolMuscles'?.2:1)*(f.weaponUntil>frame?def.weaponModifiers?.damageTaken??1:1)*(f.armorUntil>frame?def.armorDamageTaken??.1:1)*(f.bloodMasterUntil>frame?.9:1);
}
export function protectedDamage(f:Fighter,frame:number,damage:number):number{return Math.ceil(damage*damageMultiplier(f,frame));}
export interface DamageOptions extends DamageSource{combo?:'hit'|'damage';receivedHit?:boolean;}
/** Eligibility/blocking belongs to contact resolution; all damage commits pass here. */
export function applyDamage(s:SimulationSnapshot,f:Fighter,base:number,options:DamageOptions={}):number{
 if(f.jopaTree!==undefined)return 0;
 if(f.jopaRide!==undefined){const mount=s.clones.find(c=>c.id===f.jopaRide);return mount?applyDamage(s,mount.fighter,base,options):0;}
 const damage=protectedDamage(f,s.frame,base);
 f.health=Math.max(s.training&&s.fighters.includes(f)?1:0,f.health-damage);
 f.lastDamage=damage;
 if(f.loveNpc&&damage>0)f.npcHitAt=s.frame;
 if(options.combo){f.comboDamage+=damage;if(options.combo==='hit')f.combo++;}
 if(damage>0&&(options.combo==='hit'||options.receivedHit))receiveAngerHit(f,s.frame);
 recordDamage(s,f,damage,options);
 return damage;
}
