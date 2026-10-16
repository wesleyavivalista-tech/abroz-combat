import {character as nikalz} from './nikalz/character.js';
import {character as eide} from './eide/character.js';
import {character as biel} from './biel/character.js';
import {character as jopa} from './jopa/character.js';
import {character as astolfo} from './astolfo/character.js';
import {character as fausto} from './fausto/character.js';
import {character as napa} from './napa/character.js';
import {character as jomp} from './jomp/character.js';
import {character as dodo} from './dodo/character.js';
import {character as luizinho} from './luizinho/character.js';
import {character as roms} from './roms/character.js';
import {character as caio} from './caio/character.js';
import {character as drupa} from './drupa/character.js';
import { character as gut } from './gut/character.js';
import { character as bozo } from "./bozo/character.js";
import { character as tocha } from "./tocha/character.js";
import { basicAttacks } from "./common.js";
import type { CharacterDefinition } from "../types.js";
export const defaultRoster=["gut","tocha"] as const;
export const characters: Record<string, CharacterDefinition> = {
  [nikalz.id]: nikalz,
  [jopa.id]: jopa,
  [biel.id]: biel,
  [eide.id]: eide,
  [astolfo.id]: astolfo,
  [fausto.id]: fausto,
  [napa.id]: napa,
  [jomp.id]: jomp,
  [dodo.id]: dodo,
  [drupa.id]: drupa,
  [gut.id]: gut,
  [tocha.id]: tocha,
  [bozo.id]: bozo,
  [caio.id]: caio,
  [roms.id]: roms,
  [luizinho.id]: luizinho,
};
export function registerCharacter(character: CharacterDefinition): void {
  validateCharacter(character);
  if (Object.hasOwn(characters, character.id)) throw new Error("Duplicate character");
  characters[character.id] = character;
}

/** Fail at registration rather than midway through a fight. */
export function validateCharacter(c: CharacterDefinition): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id)) throw new Error("Invalid fighter ID");
  if (c.skins && (!c.skins.length || new Set(c.skins.map(s => s.id)).size !== c.skins.length || c.skins.some(s => !/^[a-z0-9][a-z0-9-]*$/.test(s.id) || !s.name.trim()))) throw new Error("Invalid fighter skins");
  // Every numeric definition value reaches gameplay or presentation eventually.
  const finiteTree=(value:unknown,path:string):void=>{
    if(typeof value==='number'&&!Number.isFinite(value))throw new Error(`${c.id}: non-finite ${path}`);
    if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))finiteTree(child,path+'.'+key);
  };
  if(c.financeMoves)for(const move of Object.values(c.financeMoves))if(!c.moves[move])throw new Error(`${c.id}: unknown finance move ${move}`);
  const basic = basicAttacks(c);
  const weapon=c.weaponAttacks;
  const required = [...(c.weaponExpiryMove?[c.weaponExpiryMove]:[]),...(basic.doubleJumpHeavy?[basic.doubleJumpHeavy]:[]),...(weapon?[...weapon.chain,weapon.heavy,weapon.kick,weapon.crouch,weapon.air,...(weapon.doubleJumpHeavy?[weapon.doubleJumpHeavy]:[])]:[]),...basic.chain, basic.heavy, basic.kick, basic.crouch, basic.air, ...c.specialButtons, ...c.superButtons, ...c.specialMoves.map(m => m.move)];
  if (basic.chain.length < 3 || new Set(basic.chain).size !== basic.chain.length || c.specialButtons.length !== 2 || new Set(c.specialButtons).size !== 2 || c.superButtons.length !== 2 || new Set(c.superButtons).size !== 2) throw new Error("Fighter needs three chain moves, two specials and two distinct supers");
  for (const id of required) if (!Object.hasOwn(c.moves, id)) throw new Error(`${c.id}: missing move ${id}`);
  for (const [id, m] of Object.entries(c.moves)) {
    if(m.suction&&(m.suction.range<=0||m.suction.strength<=0)||m.snotFrames!==undefined&&m.snotFrames<=0)throw new Error(`${c.id}: invalid area ability`);
    for(const next of m.cancelRules)if(!Object.hasOwn(c.moves,next))throw new Error(`${c.id}: unknown cancel move ${next}`);
    if (id !== m.id) throw new Error(`${c.id}: mismatched move ID ${id}`);
    for (const n of [m.startupFrames, m.activeFrames, m.recoveryFrames, m.damage, m.hitstun, m.blockstun, m.meterCost])
      if (!Number.isInteger(n) || n < 0) throw new Error(`${c.id}: invalid timing/damage in ${id}`);
    if (m.activeFrames < 1) throw new Error(`${c.id}: move ${id} has no active frames`);
  }
  const positive=(n:number,label:string)=>{if(!Number.isFinite(n)||n<=0)throw new Error(`${c.id}: invalid ${label}`);};
  for(const [id,m] of Object.entries(c.moves)){
    if(m.reactivation&&!c.moves[m.reactivation])throw new Error(`${c.id}: missing reactivation`);
    if(m.structure){const b=m.structure;for(const n of [b.width,b.height,b.healthRatio])positive(n,'structure dimension/health');if(b.health!==undefined)positive(b.health,'structure health');if(b.duration<0)throw new Error('Invalid structure duration');if(b.shotMove&&!c.moves[b.shotMove])throw new Error('Unknown structure shot');if(b.kind==='turret'&&(!b.shotMove||!c.moves[b.shotMove]?.projectile||!b.interval||b.interval<1))throw new Error('Invalid turret');}
    if(m.projectile?.variants!==undefined&&(!Number.isInteger(m.projectile.variants)||m.projectile.variants<1))throw new Error('Invalid projectile variants');
    if(m.allowedStates&&(!m.allowedStates.length||m.allowedStates.some(state=>!state.trim())))throw new Error(`${c.id}: invalid allowed states in ${id}`);
    for(const b of [...m.hitboxes,...m.hurtboxes??[]])if([b.x,b.y,b.w,b.h].some(n=>!Number.isFinite(n))||b.w<=0||b.h<=0)throw new Error(`${c.id}: invalid collision box in ${id}`);
    if(m.returningProjectile&&!c.returningPaths?.[m.returningProjectile])throw new Error(`${c.id}: unknown returning path in ${id}`);
    if(m.beam){positive(m.beam.width,'beam width');positive(m.beam.interval,'beam interval');}
    if(m.periodicMelee){for(const key of ['interval','rangeX','rangeY'] as const)positive(m.periodicMelee[key],key);}
    if(m.durationClock&&!['move','simulation'].includes(m.durationClock))throw new Error(`${c.id}: unknown duration clock`);
  }
  for(const [id,path] of Object.entries(c.returningPaths??{})){
    for(const key of ['radius','hitInterval','life'] as const)positive(path[key],`${id}.${key}`);
    if(!['vertical','straight','bounce'].includes(path.motion)||Object.values(path).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw new Error(`${c.id}: invalid returning path ${id}`);
  }
  const integer=(n:number,label:string,min=0)=>{if(!Number.isInteger(n)||n<min)throw new Error(`${c.id}: invalid ${label}`);};
  for(const [id,m] of Object.entries(c.moves)){
    for(const key of ['priority','meterGain','cancelFrame'] as const)integer(m[key],id+'.'+key);
    for(const key of ['priority','meterGain','cancelFrame','poisonFrames','poisonDamage','bloodPoolFrames','bloodFloodFrames','bloodMasterFrames','auraFrames','armorFrames','trapFrames','summonClones','grappleFrames','weaponFrames'] as const)if(m[key]!==undefined)integer(m[key]!,id+'.'+key);
    for(const key of ['knockback','launch'] as const)if(!Number.isFinite(m[key])||m[key]<0)throw new Error(`${c.id}: invalid ${key}`);
    if(m.projectile){positive(m.projectile.speed,'projectile speed');integer(m.projectile.lifetime,'projectile lifetime',1);if(m.projectile.radius!==undefined)positive(m.projectile.radius,'projectile radius');}
    for(const spec of [m.hazard,m.burn])if(spec){integer(spec.duration,'status duration',1);integer(spec.damage,'status damage');}
    if(m.hazard){positive(m.hazard.radius,'hazard radius');integer(m.hazard.interval,'hazard interval',1);if(m.hazard.startFrame!==undefined)integer(m.hazard.startFrame,'hazard start frame');if(m.hazard.burn){integer(m.hazard.burn.duration,'ground burn duration',1);integer(m.hazard.burn.damage,'ground burn damage');}}
    if(m.beam){integer(m.beam.interval,'beam interval',1);if(!Number.isFinite(m.beam.originY))throw new Error(`${c.id}: invalid beam origin`);}
    if(m.periodicMelee){integer(m.periodicMelee.interval,'periodic interval',1);integer(m.periodicMelee.hitstun,'periodic stun');if(m.periodicMelee.push<0)throw new Error(`${c.id}: invalid periodic push`);}
    if(m.channelHeal){integer(m.channelHeal.interval,'heal interval',1);integer(m.channelHeal.amount,'healing');integer(m.channelHeal.button,'heal button',1);}
    if(m.dive){positive(m.dive.speed,'dive speed');}
    if(m.ownerFloodSpeed!==undefined)positive(m.ownerFloodSpeed,'flood speed');
    for(const event of m.events)integer(event.frame,'event frame');
  }
  if(c.companionHealth){positive(c.companionHealth.ratio,'companion health ratio');if(!Number.isInteger(c.companionHealth.offset)||Math.floor(c.stats.maxHealth*c.companionHealth.ratio)+c.companionHealth.offset<=0)throw new Error('Invalid companion health');}
  if(c.returningCapacity!==undefined)integer(c.returningCapacity,'return capacity',1);
  if(c.maxAirJumps!==undefined)integer(c.maxAirJumps,'air jumps');
  if(c.dashMultiplier!==undefined)positive(c.dashMultiplier,'dash multiplier');
  if(c.weaponModifiers){for(const key of ['damage','attackSpeed','dash'] as const)if(c.weaponModifiers[key]!==undefined)positive(c.weaponModifiers[key]!,key);if(c.weaponModifiers.airJumps!==undefined)integer(c.weaponModifiers.airJumps,'mode air jumps');positive(c.weaponModifiers.speed,'weapon speed');positive(c.weaponModifiers.bodyScale,'body scale');if(c.weaponModifiers.damageTaken<0||c.weaponModifiers.damageTaken>1)throw new Error(`${c.id}: invalid weapon defense`);}
  for(const path of Object.values(c.returningPaths??{})){integer(path.hitInterval,'return hit interval',1);integer(path.life,'return lifetime',1);if(!Number.isFinite(path.speed)||!Number.isFinite(path.verticalSpeed)||!Number.isFinite(path.gravity)||path.speed<0||path.gravity<0)throw new Error(`${c.id}: invalid path speed/gravity`);}
  if(c.modeFinale&&(!c.moves[c.modeFinale.move]||!c.returningPaths?.[c.modeFinale.path]||!c.modeFinale.velocities.length||c.modeFinale.velocities.some(v=>v.length!==2||v.some(n=>!Number.isFinite(n)))))throw new Error(`${c.id}: invalid mode finale`);
  if(c.modeFinale)positive(c.modeFinale.duration,'finale duration');
  if(c.auraTrailMove&&!c.moves[c.auraTrailMove])throw new Error(`${c.id}: unknown aura trail move`);
  if(c.armorDamageTaken!==undefined&&(!Number.isFinite(c.armorDamageTaken)||c.armorDamageTaken<0||c.armorDamageTaken>1))throw new Error(`${c.id}: invalid armor multiplier`);
  finiteTree(c,c.id);
  if (c.stats.maxHealth <= 0 || c.stats.gravity <= 0 || Object.values(c.stats).some(n => !Number.isFinite(n) || !Number.isInteger(n) || n < 0)) throw new Error(`${c.id}: invalid stats`);
}
Object.values(characters).forEach(validateCharacter);
