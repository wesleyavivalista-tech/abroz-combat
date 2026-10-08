import {hostile} from './Actors.js';
import {initializeProjectile} from './ProjectilePool.js';
import {type DamageOptions,applyDamage} from '../combat/DamageSystem.js';
import {finishProjectileMode} from './ReturningProjectileSystem.js';
import { actors } from "./Actors.js";
import type { Fighter, SimulationSnapshot } from "../types.js";
import { characters } from "../characters/registry.js";
import { isActive, isInvulnerable } from "./LifeSystem.js";
export const BURN_INTERVAL = 30;
export function igniteTarget(s: SimulationSnapshot, target: Fighter, owner: number, duration: number, damage: number, kind: "normal" | "purple" = "normal"): void {
  const seat = actors(s).find(a=>a.fighter===target)?.owner ?? -1;
  if (!isActive(target) || isInvulnerable(target, s.frame) || !hostile(s,owner,target,seat)) return;
  const burning=target.burnUntil>0 && target.burnUntil>=s.frame;
  // Ordinary fire cannot downgrade or extend the stronger super burn.
  if (burning && target.burnKind === "purple" && kind === "normal") return;
  if (!burning) target.burnDamage=0;
  target.burnKind=kind;
  // Refresh, never stack. Repeated aura contacts must not postpone the next tick.
  if (!target.burnUntil || target.burnUntil < s.frame) target.burnNextTick = s.frame + BURN_INTERVAL;
  target.burnUntil = Math.max(target.burnUntil, s.frame + duration);
  target.burnDamage = Math.max(target.burnDamage, damage);
  target.burnOwner = owner;
}
function damage(s: SimulationSnapshot, f: Fighter, amount: number, source:DamageOptions={source:f.burnOwner,move:'@burn'}): void {
  if (!isActive(f) || isInvulnerable(f, s.frame)) return;
  applyDamage(s,f,amount,source);
}
/** Absolute ticks keep effects deterministic during hitstop and rollback. No hitstun. */
export function advanceStatuses(s: SimulationSnapshot, arenaWidth=2400,floorHeight=0): void {
  for (const {fighter:f,owner,clone} of actors(s)) {
    if (f.burnUntil && s.frame <= f.burnUntil && s.frame >= f.burnNextTick) {
      damage(s, f, f.burnDamage);
      f.burnNextTick += BURN_INTERVAL;
    }
    if (s.frame > f.burnUntil) {
      f.burnUntil = f.burnNextTick = f.burnDamage = 0;
      f.burnOwner = -1;
      f.burnKind = "normal";
    }
    const expiredWeapon=f.weaponUntil>0&&s.frame>=f.weaponUntil;
    if (f.weaponUntil > 0 && s.frame >= f.weaponUntil) {
      f.weaponUntil=0;
      if(f.move && characters[f.characterId].weaponAttacks && [
        ...characters[f.characterId].weaponAttacks!.chain,characters[f.characterId].weaponAttacks!.heavy,characters[f.characterId].weaponAttacks!.kick,characters[f.characterId].weaponAttacks!.crouch,characters[f.characterId].weaponAttacks!.air,characters[f.characterId].weaponAttacks!.doubleJumpHeavy
      ].includes(f.move)){f.move=null;f.state=f.y>floorHeight?"Fall":"Idle";f.stateFrame=0;}
    }
    // Expiry throws once, including during hit-stop. Death/respawn never throws.
    if (expiredWeapon && !clone && isActive(f)) {
      if(characters[f.characterId].modeFinale)finishProjectileMode(s,owner);
      const id=characters[f.characterId].weaponExpiryMove;
      const spec=id?characters[f.characterId].moves[id].projectile:undefined;
      const slot=s.projectiles.find(p=>!p.active);
      if(id&&spec&&slot){
        f.attackSerial++;
        initializeProjectile(slot,{trajectory:undefined,active:true,owner,x:f.x,y:f.y+110,vx:spec.speed*f.facing,life:Math.ceil(arenaWidth/spec.speed)+2,move:id,serial:f.attackSerial});
        if(!f.stun&&!f.grappleUntil&&!f.trappedUntil&&!['Grappling','Knockdown','GetUp','AirHitStun'].includes(f.state)){
          f.move=id;f.moveFrame=0;f.state='SpecialMove';f.stateFrame=0;f.projectileSpawned=true;f.connected=false;f.hitTargets=[];f.speedRemainder=0;
        }
      }
    }
    if (s.frame >= f.armorUntil) f.armorUntil = 0;
    if (s.frame >= f.onFireUntil) f.onFireUntil = 0;
  }
  s.fighters.forEach((f, owner) => {
    if (!isActive(f) || !f.onFireUntil) return;
    actors(s).forEach(({fighter:d}) => {
      if (Math.abs(d.x - f.x) <= 72 && Math.abs(d.y - f.y) < 130)
        igniteTarget(s, d, owner, 240, 10);
    });
  });
  s.hazards = s.hazards.filter(h => s.frame < h.expiresAt);
  for (const h of s.hazards) {
    if(h.kind)continue;
    const spec = characters[s.fighters[h.owner].characterId].moves[h.move].hazard!;
    actors(s).forEach(({fighter:f, owner:i, clone}) => {
      if (!hostile(s,h.owner,f,i) || !isActive(f) || isInvulnerable(f, s.frame)) return;
      if(spec.burn&&Math.abs(f.x-h.x)<=spec.radius+25&&Math.abs(f.y-h.y)<=18)
        igniteTarget(s,f,h.owner,spec.burn.duration,spec.burn.damage,spec.burn.kind);
      if (Math.abs(f.x - h.x) <= spec.radius + 25 && Math.abs(f.y - h.y) <= 55 && s.frame >= (h.nextTicks[clone ? s.fighters.length+clone.id : i] ?? 0)) {
        damage(s, f, spec.damage,{source:h.owner,move:h.move});
        h.nextTicks[clone ? s.fighters.length+clone.id : i] = s.frame + spec.interval;
      }
    });
  }
}
