import {inLove,EIDE} from '../simulation/EideSystem.js';
import {financeHit} from '../simulation/FinanceSystem.js';
import {gainEnergy} from '../simulation/EnergySystem.js';
import {personalityDamage} from '../simulation/AstolfoSystem.js';
import {angerMultiplier} from '../simulation/AngerSystem.js';
import {gymReserved} from '../simulation/JompSystem.js';
import {characters} from '../characters/registry.js';
import {consecutiveHitstun} from './HitstunSystem.js';
import {canReceiveDirectHit} from './ContactPolicy.js';
import {Button,type Fighter,type SimulationSnapshot,type StageDefinition,type MoveDefinition} from '../types.js';
import {applyDamage} from './DamageSystem.js';
import {scaledDamage} from './CollisionSystem.js';
import {actors} from '../simulation/Actors.js';
import {grounded} from '../simulation/StageCollision.js';
import {enter} from '../simulation/StateMachine.js';
import {igniteTarget} from '../simulation/StatusSystem.js';
export const DIVE_STUN_RECOVERY_FRAMES=60;
export function resolveHit(s:SimulationSnapshot,stage:StageDefinition,emit:(type:string,f:Fighter,power?:number,player?:number)=>void,
    attacker: number,
    m: MoveDefinition,
    input: number,
    counter: boolean,
    defender = 1 - attacker,
    impactDirection: number = s.fighters[attacker].facing,
    source?: Fighter,
    target?: Fighter,
  ): void {
    const a = source ?? s.fighters[attacker],
      d = target ?? s.fighters[defender];
    if (s.teams[attacker] === s.teams[defender] || !canReceiveDirectHit(d,s.frame)) return;
    if(m.loanStamp && a.stampAttempts===undefined)return;
    // Summons can strike in a staggered swarm. Their contacts must not pause
    // unrelated players (or repeatedly shake everyone's camera).
    if(m.grappleFrames && (gymReserved(s,d)||d.grappleUntil>s.frame || actors(s).some(v=>v.fighter.grappleOwner===attacker&&v.fighter.grappleUntil>s.frame)))return;
    const companionContact = !s.fighters.includes(a) || !s.fighters.includes(d);
    const back = impactDirection > 0 ? Button.Right : Button.Left;
    const crouch = !!(input & Button.Down);
    const canBlock =
      grounded(d, stage) &&
      d.trappedUntil <= s.frame && d.grappleUntil <= s.frame &&
      !d.move &&
      (!d.stun || d.state.startsWith("Block"));
    const blocked =
      canBlock &&
      (input & (Button.Left|Button.Right)) === back &&
      (m.level === "mid" || (m.level === "low" ? crouch : !crouch));
    // Both double-jump dives share defender-side protection, including team follow-ups.
    const stunDive=!!m.dive&&!!m.fixedStun;
    const protectedDive=stunDive&&(d.stun>0||d.dazed||s.frame<(d.diveStunImmuneUntil??0));
    const reactionStun = blocked ? m.blockstun : protectedDive?0:consecutiveHitstun(s,d,m.hitstun+(counter&&!m.fixedStun?4:0),impactDirection,stage.floorHeight);
    const stanceArmor=(characters[d.characterId].muscleFighter&&(d.move==='coolMuscles'||d.move==='gymBro'));
    const reacts = !d.loveNpc && !d.jopaSummon && !stanceArmor && (blocked || reactionStun > 0);
    const outgoing=(a.bloodMasterUntil>s.frame?1.05:1)*(inLove(a)?EIDE.loveDamage:1)*personalityDamage(a)*angerMultiplier(a,s.frame)*(a.weaponUntil>s.frame?characters[a.characterId].weaponModifiers?.damage??1:1);
    if(reacts){
      d.move=null;
      if(d.actionUntil)d.actionUntil=0;
      d.vx=impactDirection*(blocked?Math.ceil(m.knockback/2):m.knockback);
      d.dazed=!blocked&&!!m.fixedStun;
      if(!blocked&&stunDive){d.nikalzStunUntil=s.frame+reactionStun;d.diveStunImmuneUntil=d.nikalzStunUntil+DIVE_STUN_RECOVERY_FRAMES;}
      d.stun=reactionStun;
    }
    if (blocked) {
      // Guard absorbs 60%; existing defensive modifiers also apply to chip damage.
      applyDamage(s,d,scaledDamage(m.damage*outgoing,d.combo,false)*.4,{source:attacker,move:m.id,blocked:true});
      enter(d, crouch ? "BlockCrouching" : "BlockStanding");
      gainEnergy(d,3,s.frame);
      emit("block", d, 1, defender);
    } else {
      applyDamage(s,d,scaledDamage(m.damage*outgoing,d.combo,counter),{combo:'hit',source:attacker,move:m.id});
      if (m.poisonFrames) {
        if(d.poisonUntil<=s.frame)d.poisonNextTick=s.frame+30;
        d.poisonUntil=s.frame+m.poisonFrames;d.poisonDamage=m.poisonDamage??0;d.poisonOwner=attacker;
      }
      if (reacts && m.trapFrames) d.trappedUntil = s.frame + m.trapFrames;
      if (m.burn) igniteTarget(s, d, attacker, m.burn.duration, m.burn.damage, m.burn.kind);
      if (reacts) {
      if (d.trappedUntil > s.frame) {
        enter(d, "HairTrapped");
      } else if(m.fixedStun){d.vx=d.vy=0;enter(d,"HitStunStanding");
      } else if (m.launch || !grounded(d, stage) || m.knockdown) {
        d.vy = m.launch || 9;
        d.y += 1;
        enter(d, "AirHitStun");
      } else enter(d, crouch ? "HitStunCrouching" : "HitStunStanding");
      }
      financeHit(s,a,d,m);
      gainEnergy(a,m.meterGain,s.frame);
      gainEnergy(d,4,s.frame);
      emit(counter ? "counter" : m.effects, d, companionContact ? 1 : m.priority, defender);
    }
    if (reacts && d.trappedUntil > s.frame) {d.vx=d.vy=0;d.stun=0;d.buffer=[];enter(d,"HairTrapped");}
    if(reacts&&!blocked&&m.grappleFrames&&d.health>0){
      d.grappleOwner=attacker;d.grappleUntil=s.frame+m.grappleFrames;d.grappleNextTick=s.frame+30;d.stun=0;d.move=null;d.vx=d.vy=0;d.buffer=[];
      a.move=m.id;a.vx=a.vy=0;a.stun=0;enter(a,"Grappling");enter(d,"Grappled");d.x=a.x+a.facing*42;d.y=a.y;
    }
    if (reacts && !companionContact) s.hitstop = Math.max(s.hitstop, blocked ? 4 : m.priority + 5);
}
