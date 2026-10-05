import type {Fighter,SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {moveAudio} from './FighterAudio.js';
export interface AudioPresence {id:string;character:string;move:string;x:number;phase?:string;health?:number;bounces?:number;}
/** Snapshot reconciliation does not infer an impact from a projectile disappearing. */
export function audioPresence(s:SimulationSnapshot):AudioPresence[]{
 if(s.phase!=='fight')return [];
 const result:AudioPresence[]=[];
 const add=(id:string,owner:number,move:string,x:number,phase?:string)=>{
  const f=s.fighters[owner];if(f&&moveAudio(f.characterId,move))return result.push({id,character:f.characterId,move,x,phase});
 };
 const actor=(f:Fighter,owner:number,id:string)=>{
  if(f.health<=0||f.lives<=0)return;
  const c=characters[f.characterId],m=f.move?c.moves[f.move]:undefined;
  if(m?.chargeFrames&&moveAudio(f.characterId,m.id)?.charge&&f.moveFrame>=0&&f.moveFrame<m.startupFrames)add(`${id}:charge:${f.attackSerial}`,owner,m.id,f.x);
  if(m&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames&&(m.activeFrames>=45||m.beam||m.talking||m.channelHeal||m.holdInvisible))add(`${id}:channel:${f.attackSerial}`,owner,m.id,f.x);
  for(const move of Object.values(c.moves)){
   const active=move.angerFrames&&(f.angerUntil??0)>s.frame||move.weaponFrames&&f.weaponUntil>s.frame||move.armorFrames&&f.armorUntil>s.frame||move.bloodMasterFrames&&f.bloodMasterUntil>s.frame||move.auraFrames&&f.onFireUntil>s.frame||move.talkAuraFrames&&(f.talkUntil??0)>s.frame||move.invisibilityFrames&&(f.invisibleUntil??0)>s.frame;
   if(active)add(`${id}:mode:${move.id}`,owner,move.id,f.x);
  }
  if((f.angelUntil??0)>s.frame)add(`${id}:angel`,owner,'angel',f.x);
  if((f.loanUntil??0)>s.frame)add(`${id}:loan`,owner,'loan',f.x);
  if(f.beeBoxes)add(`${id}:boxes`,owner,'beeHouse',f.x);
  if(f.loveMode)add(`${id}:love`,owner,'love',f.x);
 };
 s.fighters.forEach((f,i)=>actor(f,i,`fighter:${i}`));
 for(const [slot,p] of s.projectiles.entries())if(p.active){const added=add(`projectile:${slot}:${p.owner}:${p.serial}:${p.move}`,p.owner,p.move,p.x);if(added)result[added-1].bounces=p.bounces;}
 for(const b of s.bees??[])if(b.owner>=0)add(`bee:${b.id}`,b.owner,'bees',b.x);
 for(const b of s.structures??[]){const added=add(`structure:${b.id}`,b.owner,b.move,b.x,b.phase);if(added)result[added-1].health=b.health;}
 for(const h of s.hazards)if(h.expiresAt>s.frame)add(`hazard:${h.owner}:${h.move}:${h.createdAt??h.expiresAt}:${h.kind}`,h.owner,h.move,h.x);
 const summonMove:Record<string,string>={'cookie-monster':'cookieMonster',basketball:'painKillers',tree:'tree',tentacle:'tree',knight:'knight',sad:'bipolar',angry:'bipolar',blonde:'clones'};
 for(const c of s.clones)if(c.fighter.health>0){add(`summon:${c.id}`,c.owner,summonMove[c.kind??'blonde']??'clones',c.fighter.x);actor(c.fighter,c.owner,`summon:${c.id}`);}
 return result;
}
