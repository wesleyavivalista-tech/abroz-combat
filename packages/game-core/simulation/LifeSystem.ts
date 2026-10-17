import {hasMoveImmunity} from '../combat/MoveImmunity.js';
import {trackKnockout} from './MatchStatistics.js';
import {FINAL_DEATH_FRAMES} from './UndeadSystem.js';
import {clearCombatEntities,clearFighterCombat,clearOwnedEntities} from './CombatLifecycle.js';
import type { Fighter, SimulationSnapshot } from "../types.js";
import { TICK_RATE } from "../types.js";
import { createFighter } from "./Fighter.js";
import { enter } from "./StateMachine.js";
export const RESPAWN_FRAMES = 2 * TICK_RATE;
export const INVULNERABLE_FRAMES = 3 * TICK_RATE;
export function isActive(f: Fighter): boolean {
  return f.lives > 0 && f.health > 0 && f.respawnAt === 0;
}
/** Ownership survives a lost life, including the frame before KO resolution.
 * A pending final death cannot emit new effects before permanent cleanup. */
export function retainsOwnedEntities(f:Fighter|undefined):boolean {
  return !!f && f.lives>0 && (f.health>0||f.respawnAt>0||f.lives>1);
}
export function isInvulnerable(f: Fighter, frame: number): boolean {
  return hasMoveImmunity(f,frame)||f.undead==='rising'||f.undead==='dying'||f.jopaTree!==undefined || f.jopaRide!==undefined || frame < f.invulnerableUntil;
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
    // Love belongs to the surviving companions, not to this individual life.
    if(f.loveMode)fresh.loveMode=true;
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
export function resolveKnockouts(s: SimulationSnapshot,cinematic=true): number[] {
  const lost: number[] = [];
  for (let i = 0; i < s.fighters.length; i++) {
    const f = s.fighters[i];
    if (f.health > 0 || f.respawnAt !== 0 || f.lives === 0) continue;
    f.lives--;
    trackKnockout(s,i);
    if(cinematic&&!f.lives&&!s.training){
      s.finalDeaths??=[];
      s.finalDeaths.push({seat:i,x:f.x,y:f.y,frame:s.frame,facing:f.facing});
      s.finalDeaths=s.finalDeaths.filter(d=>s.frame-d.frame<=FINAL_DEATH_FRAMES);
    }
    const loveMode=f.loveMode;
    clearFighterCombat(f);
    if(f.lives>0&&loveMode)f.loveMode=true;
    if(!f.lives)clearOwnedEntities(s,i);
    if(s.structures)for(const b of s.structures)b.trapped=b.trapped.filter(key=>key!==`seat:${i}`);
    if(f.productIndex!==undefined)f.productIndex=0;
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
    lost.push(i);
  }
  if (lost.length && new Set(s.fighters.flatMap((f, i) => f.lives > 0 ? [s.teams[i]] : [])).size <= 1) {
    s.phase = "result";
    s.phaseFrame = 0;
    s.endedAt = s.frame;
    s.winner = s.fighters.findIndex((f) => f.lives > 0);
    s.fighters.forEach((f, i) => {
      enter(f, s.winner >= 0 && s.teams[i] === s.teams[s.winner] && f.lives > 0 ? "MatchWin" : "KO");
    });
    clearCombatEntities(s);
  }
  return lost;
}
