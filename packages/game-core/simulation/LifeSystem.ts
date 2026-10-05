import {clearCombatEntities} from './CombatLifecycle.js';
import {characters} from '../characters/registry.js';
import type { Fighter, SimulationSnapshot } from "../types.js";
import { TICK_RATE } from "../types.js";
import { createFighter } from "./Fighter.js";
import { enter } from "./StateMachine.js";
export const RESPAWN_FRAMES = 2 * TICK_RATE;
export const INVULNERABLE_FRAMES = 2 * TICK_RATE;
export function isActive(f: Fighter): boolean {
  return f.lives > 0 && f.health > 0 && f.respawnAt === 0;
}
export function isInvulnerable(f: Fighter, frame: number): boolean {
  return f.jopaTree!==undefined || f.jopaRide!==undefined || frame < f.invulnerableUntil;
}

/** Absolute simulation-frame deadlines keep both timers independent of hit stop. */
export function advanceRespawns(s: SimulationSnapshot,floorHeight=0): number[] {
  const spawned: number[] = [];
  for (let i = 0; i < s.fighters.length; i++) {
    const f = s.fighters[i];
    if (f.respawnAt === 0 || s.frame < f.respawnAt || f.lives === 0) continue;
    // Position remains frozen while waiting, including airborne defeat locations.
    const fresh = createFighter(
      f.characterId,
      f.x,
      f.facing,
    );
    fresh.y = f.y;
    fresh.lives = f.lives;
    fresh.usedSupers = [...f.usedSupers];
    fresh.meter = f.meter;
    fresh.attackSerial = f.attackSerial + 1;
    fresh.invulnerableUntil = s.frame + INVULNERABLE_FRAMES;
    fresh.state = fresh.y > floorHeight ? "Fall" : "Idle";
    // Preserve actor identity, but remove optional state from the previous life.
    for(const key of Object.keys(f))Reflect.deleteProperty(f,key);
    Object.assign(f, fresh);
    spawned.push(i);
  }
  return spawned;
}
/** Resolve both deaths together so equal-priority lethal trades remain symmetric. */
export function resolveKnockouts(s: SimulationSnapshot): number[] {
  const lost: number[] = [];
  for (let i = 0; i < s.fighters.length; i++) {
    const f = s.fighters[i];
    if (f.health > 0 || f.respawnAt !== 0 || f.lives === 0) continue;
    f.lives--;
    delete f.beeBoxes;delete f.beeSlowUntil;delete f.nikalzStunUntil;delete f.diveStunImmuneUntil;delete f.meteorStart;delete f.meteorX;delete f.meteorY;delete f.loveMode;delete f.loanUntil;delete f.loanStunUntil;delete f.stampAttempts;delete f.angelUntil;delete f.angelBurstAt;delete f.movementSlowUntil;
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
    s.clones = s.clones.filter(c => c.owner !== i);
    if(s.bees)s.bees=s.bees.filter(b=>b.owner!==i);
    if(s.foreheadWaves)s.foreheadWaves=s.foreheadWaves.filter(w=>w.owner!==i);
    if(s.structures){s.structures=s.structures.filter(b=>b.owner!==i);for(const b of s.structures)b.trapped=b.trapped.filter(key=>key!==`seat:${i}`);}
    if(f.productIndex!==undefined)f.productIndex=0;
    s.hazards = s.hazards.filter(h => h.owner !== i || h.kind==='cookie-drop');
    f.health = 0;
    f.move = null;
    f.stun = 0;
    f.consecutiveHits=0;f.lastStunHitFrame=-60;f.hitstunImmuneUntil=0;
    f.vx = 0;
    f.vy = 0;
    f.combo = 0;
    f.comboDamage = 0;
    f.buffer = [];
    f.previousInput = 0;
    f.invulnerableUntil = 0;
    f.respawnAt = f.lives > 0 ? s.frame + RESPAWN_FRAMES : 0;
    enter(f, f.lives > 0 ? "Respawning" : "KO");
    for (const p of s.projectiles) if (p.owner === i) p.active = false;
    lost.push(i);
  }
  if (lost.length && new Set(s.fighters.flatMap((f, i) => f.lives > 0 ? [s.teams[i]] : [])).size <= 1) {
    s.phase = "result";
    s.phaseFrame = 0;
    s.endedAt = s.frame;
    s.winner = s.fighters.findIndex((f) => f.lives > 0);
    s.fighters.forEach((f, i) => {
      delete f.beeBoxes;delete f.beeSlowUntil;delete f.nikalzStunUntil;delete f.diveStunImmuneUntil;delete f.meteorStart;delete f.meteorX;delete f.meteorY;delete f.loveMode;delete f.loanUntil;delete f.loanStunUntil;delete f.stampAttempts;delete f.angelUntil;delete f.angelBurstAt;delete f.movementSlowUntil;
      f.move = null;
      f.respawnAt = 0;
      enter(f, s.winner >= 0 && s.teams[i] === s.teams[s.winner] && f.lives > 0 ? "MatchWin" : "KO");
    });
    clearCombatEntities(s);
  }
  return lost;
}
