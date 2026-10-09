import {characters} from '../characters/registry.js';
import {enter} from './StateMachine.js';
import type {Fighter,SimulationSnapshot} from '../types.js';
/** Shared terminal cleanup for ordinary rounds, competition breaks and forfeits. */
export function clearCombatEntities(s:SimulationSnapshot):void{
 s.fighters.forEach(f=>{clearFighterCombat(f);f.respawnAt=0;if(!['MatchWin','KO'].includes(f.state))enter(f,f.lives>0?'Idle':'KO');});
 s.projectiles.forEach(p=>p.active=false);
 s.hazards=[];s.clones=[];
 if(s.structures)s.structures=[];
 if(s.bees)s.bees=[];
 if(s.foreheadWaves)s.foreheadWaves=[];
}

/** Clear transient combat state without changing health, lives, meter or spent supers. */
export function clearFighterCombat(f:Fighter):void{
 delete f.beeBoxes;delete f.beeSlowUntil;delete f.nikalzStunUntil;delete f.diveStunImmuneUntil;delete f.meteorStart;delete f.meteorX;delete f.meteorY;delete f.loveMode;delete f.loanUntil;delete f.loanStunUntil;delete f.timedHitReaction;delete f.beamPulse;delete f.stampAttempts;delete f.angelUntil;delete f.angelBurstAt;delete f.movementSlowUntil;
 delete f.jopaStunUntil;
 if(f.talkUntil!==undefined)f.talkUntil=0;
 if(f.talkNextDrain!==undefined)f.talkNextDrain=0;
 if(f.talkNextPulse!==undefined)f.talkNextPulse=0;
 if(f.talkSlow!==undefined)f.talkSlow=1;
 if(f.sadnessUntil!==undefined)f.sadnessUntil=0;
 if(f.angerUntil!==undefined){f.angerUntil=0;f.angerStacks=0;}
 if(f.cloudSlow!==undefined)f.cloudSlow=1;
 if(characters[f.characterId].muscleFighter){f.gymTarget=-1;f.gymStartedAt=f.gymNextRep=f.flexNextDrain=0;}
 if(f.gymLandingStun)f.gymLandingStun=false;
 if(f.gymStunnedUntil)f.gymStunnedUntil=0;
 if(characters[f.characterId].musicFighter){f.invisibleUntil=f.lowProfileNoticeUntil=f.musicNextPulse=f.chargeStartedAt=f.chargeButton=0;}
 f.burnUntil = f.burnNextTick = f.burnDamage = f.onFireUntil = 0;
 f.poisonUntil = f.bloodSlowUntil = f.bloodMasterUntil = f.airJumpsUsed = 0;
 f.areaSlow = 1;
 f.poisonNextTick=f.poisonDamage=0;f.poisonOwner=-1;f.floodSpeed=1;
 f.returningWeaponOut=false;f.modeFinaleUntil=f.actionUntil=0;
 f.burnOwner = -1;
 f.burnKind = "normal";
 f.trappedUntil = f.armorUntil = f.weaponUntil = f.grappleUntil = f.grappleNextTick = 0;
 f.grappleOwner=-1;f.hitTargets=[];
 delete f.jopaRide;delete f.jopaTree;
 f.move=null;f.stun=0;f.dazed=false;f.vx=f.vy=0;f.buffer=[];f.previousInput=0;
}

/** Permanent owner departure only. Neutral graves/zombies have their own lifecycle. */
export function clearOwnedEntities(s:SimulationSnapshot,owner:number):void{
 const removed=new Set(s.clones.filter(c=>c.owner===owner&&!c.undead).map(c=>c.id));
 for(const f of s.fighters){
  if(f.jopaRide!==undefined&&removed.has(f.jopaRide)){
   delete f.jopaRide;f.move=null;f.buffer=[];
   if(f.health>0&&f.lives>0&&!f.respawnAt)enter(f,'Fall');
  }
  if(f.jopaTree!==undefined&&removed.has(f.jopaTree))delete f.jopaTree;
 }
 s.clones=s.clones.filter(c=>c.owner!==owner||!!c.undead);
 s.projectiles.forEach(p=>{if(p.owner===owner)p.active=false;});
 s.hazards=s.hazards.filter(h=>h.owner!==owner);
 if(s.structures)s.structures=s.structures.filter(b=>b.owner!==owner);
 if(s.bees)s.bees=s.bees.filter(b=>b.owner!==owner);
 if(s.foreheadWaves)s.foreheadWaves=s.foreheadWaves.filter(w=>w.owner!==owner);
 // Applied damage-over-time retains ownership even after its emitting object expires.
 for(const f of [...s.fighters,...s.clones.map(c=>c.fighter)]){
  if(f.burnOwner===owner){f.burnUntil=f.burnNextTick=f.burnDamage=0;f.burnOwner=-1;f.burnKind='normal';}
  if(f.poisonOwner===owner){f.poisonUntil=f.poisonNextTick=f.poisonDamage=0;f.poisonOwner=-1;}
 }
}
