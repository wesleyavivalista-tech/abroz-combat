import {INVADER_STATS,advanceInvaderAttack} from './InvasionSystem.js';
import type {MoveDefinition,SimulationSnapshot,StageDefinition} from '../types.js';
import {createFighter} from './Fighter.js';
import {isActive} from './LifeSystem.js';
import {grounded,surfaceBelow} from './StageCollision.js';
import {enter} from './StateMachine.js';
import {resolveHit} from '../combat/CombatSystem.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {deterministicSin} from './DeterministicMath.js';
import {movementSlow} from './BloodSystem.js';
export const FINAL_DEATH_FRAMES=18;
export const FINAL_DEATH_SPEED=.3;
export const GRAVE_HP=1000;
export const ZOMBIE_RISE_FRAMES=60;
export const ZOMBIE_DEATH_FRAMES=45;
export const ZOMBIE_MOVEMENT_MULTIPLIER=.49;
export const ZOMBIE_CLAW:MoveDefinition={id:'@zombie-claw',input:'',animation:'claw',state:'LightAttack',startupFrames:18,activeFrames:6,recoveryFrames:48,damage:48,hitstun:12,blockstun:8,knockback:4,launch:0,knockdown:false,meterGain:0,meterCost:0,priority:1,level:'mid',cancelRules:[],cancelFrame:0,hitboxes:[{x:0,y:30,w:115,h:110}],effects:'impact',events:[],poisonFrames:180,poisonDamage:10};
export const finalDeathActive=(s:SimulationSnapshot)=>s.finalDeaths?.some(d=>s.frame>=d.frame&&s.frame<d.frame+FINAL_DEATH_FRAMES)??false;
/** Countdown in simulation ticks; slowing the fixed-step clock slows *all* timers equally. */
export const matchTimeScale=(s:SimulationSnapshot)=>finalDeathActive(s)?FINAL_DEATH_SPEED:1;
export function advanceAfterlife(s:SimulationSnapshot):void {
 if(!s.finalDeaths)return;
 for(const d of s.finalDeaths){
  if(d.spawned||s.frame<d.frame+FINAL_DEATH_FRAMES)continue;
  d.spawned=true;
  if(s.phase!=='fight'||s.training||s.fighters.length<3)continue;
  const f=createFighter(s.fighters[d.seat].characterId,d.x,d.facing);
  f.y=d.y;f.health=GRAVE_HP;f.lives=1;f.meter=0;f.undead='grave';f.state='Idle';
  s.clones.push({id:s.nextCloneId++,owner:d.seat,kind:'undead',fighter:f,undead:{phaseAt:s.frame,target:-1,nextAttack:0,attackAt:0,attackFrame:0,hit:false,stuck:0,lastX:f.x,spawnX:f.x,spawnY:f.y}});
 }
 // At most one recent event per seat. No unbounded event history in snapshots.
 s.finalDeaths=s.finalDeaths.filter(d=>s.frame<d.frame+FINAL_DEATH_FRAMES||!d.spawned);
 if(!s.finalDeaths.length)delete s.finalDeaths;
}
export function advanceUndead(s:SimulationSnapshot,stage:StageDefinition):void {
 for(const c of s.clones){
  const u=c.undead;if(!u)continue;const f=c.fighter,profile=c.invasion?INVADER_STATS[c.invasion]:undefined;
  if(f.undead==='grave'){
   // Gravestones cannot be launched, grabbed, or pushed away from the death location.
   f.x=u.spawnX;f.y=u.spawnY;f.vx=f.vy=f.stun=0;f.move=null;f.state='Idle';
   if(f.health<=0){
    const fresh=createFighter(f.characterId,f.x,f.facing);fresh.y=f.y;fresh.lives=1;fresh.meter=0;fresh.undead='rising';fresh.state='Idle';
    c.fighter=fresh;u.phaseAt=s.frame;u.spawnX=f.x;u.spawnY=f.y;
   }
   continue;
  }
  if(f.undead==='rising'){
   if(s.frame-u.phaseAt>=ZOMBIE_RISE_FRAMES){f.undead='zombie';u.phaseAt=s.frame;u.nextAttack=s.frame+30;}
   continue;
  }
  if(f.undead==='dying')continue;
  if(f.health<=0){f.undead='dying';f.lives=0;f.move=null;f.vx=f.vy=0;u.phaseAt=s.frame;enter(f,'KO');continue;}
  if(u.attackAt&&f.state!=='LightAttack')u.attackAt=0;
  f.stateFrame++;f.move=null;f.previousInput=0;f.buffer=[];
  if(f.grappleUntil>s.frame||f.trappedUntil>s.frame){u.attackAt=0;continue;}
  const living=s.fighters.map((fighter,seat)=>({fighter,seat})).filter(a=>isActive(a.fighter));
  const nearest=living.sort((a,b)=>(Math.abs(a.fighter.x-f.x)+Math.abs(a.fighter.y-f.y)*1.4)-(Math.abs(b.fighter.x-f.x)+Math.abs(b.fighter.y-f.y)*1.4)||a.seat-b.seat)[0];
  const old=living.find(a=>a.seat===u.target);
  // Modest hysteresis avoids flickering targets when two fighters cross.
  if(!old||nearest&&Math.abs(nearest.fighter.x-f.x)+Math.abs(nearest.fighter.y-f.y)+100<Math.abs(old.fighter.x-f.x)+Math.abs(old.fighter.y-f.y))u.target=nearest?.seat??-1;
  const target=s.fighters[u.target];
  const onGround=grounded(f,stage);if(onGround){f.airJumpsUsed=0;if(!f.stun){f.combo=0;f.comboDamage=0;}}
  if(f.stun>0){f.stun--;u.attackAt=0;f.x+=f.vx;f.vx*=.8;}
  else if(target&&isActive(target)){
   const dx=target.x-f.x,dy=target.y-f.y;
   if(!u.attackAt)f.facing=dx>=0?1:-1;
   if(u.attackAt&&c.invasion){advanceInvaderAttack(s,stage,c);}
   else if(u.attackAt){
    const age=++u.attackFrame;
    enter(f,'LightAttack');
    if(age>=ZOMBIE_CLAW.startupFrames&&age<ZOMBIE_CLAW.startupFrames+ZOMBIE_CLAW.activeFrames){
     s.fighters.forEach((d,seat)=>{if(!f.hitTargets.includes(`seat:${seat}`)&&canReceiveDirectHit(d,s.frame)&&(d.x-f.x)*f.facing>=-15&&Math.abs(d.x-f.x)<=115&&Math.abs(d.y-f.y)<110){
      f.hitTargets.push(`seat:${seat}`);u.hit=true;
      resolveHit(s,stage,()=>{},c.owner,ZOMBIE_CLAW,d.previousInput,false,seat,f.facing,f,d);
     }});
    }
    if(age>=36){u.attackAt=0;enter(f,'Idle');}
   }else if(Math.abs(dx)<(profile?.range??105)&&Math.abs(dy)<(profile?.height??95)&&s.frame>=u.nextAttack){u.attackAt=s.frame;u.attackFrame=0;u.hit=false;f.hitTargets=[];u.nextAttack=s.frame+(profile?.cooldown??84);enter(f,'LightAttack');}
   else {
    let goal=target.x,goalY=target.y;
    if(dy>90){
     const landing=(p:NonNullable<StageDefinition['platforms']>[number])=>Math.max(p.x+60,Math.min(p.x+p.width-60,f.x));
     const cost=(p:NonNullable<StageDefinition['platforms']>[number])=>Math.abs(landing(p)-f.x)+Math.abs(target.y-p.y)*.5;
     const platforms=(stage.platforms??[]).filter(p=>p.y>f.y+30&&p.y<=target.y+10&&p.y-f.y<=640).sort((a,b)=>cost(a)-cost(b)||a.x-b.x);
     const next=platforms[0];if(next){goal=landing(next);goalY=next.y;}
    }else if(dy< -100&&f.vy<=0){const p=stage.platforms?.find(p=>p.y===f.y&&f.x>=p.x-50&&f.x<=p.x+p.width+50);if(p)goal=target.x<p.x+p.width/2?p.x-50:p.x+p.width+50;}
    const direction=Math.abs(goal-f.x)>24?Math.sign(goal-f.x):0;
    u.stuck=direction&&Math.abs(f.x-u.lastX)<.5?u.stuck+1:0;u.lastX=f.x;
    if(onGround&&((goalY>f.y+70&&Math.abs(goal-f.x)<160)||u.stuck>20)){f.vy=23;f.airJumpsUsed=0;u.stuck=0;enter(f,'Jump');}
    else if(!onGround&&goalY>f.y+60&&f.vy<2&&!f.airJumpsUsed){f.vy=23;f.airJumpsUsed=1;enter(f,'Jump');}
    // Alternating planted-foot and dragging-foot phases; deterministic and unique per corpse.
    const shamble=.7+.6*(.5+.5*deterministicSin((s.frame+c.id*17)*.12));
    f.x+=direction*(onGround?2.2*shamble:3.8)*ZOMBIE_MOVEMENT_MULTIPLIER*movementSlow(f,s.frame);
    if(onGround&&f.vy===0)enter(f,direction?'WalkForward':'Idle');
   }
  }
  if(!grounded(f,stage)||f.vy>0){const previousY=f.y;f.y+=f.vy;f.vy-=.8;const floor=surfaceBelow(stage,f.x,previousY);if(f.vy<=0&&f.y<=floor){f.y=floor;f.vy=0;f.airJumpsUsed=0;if(!u.attackAt)enter(f,'Idle');}else if(!u.attackAt&&!f.stun)enter(f,f.vy>0?'Jump':'Fall');}
  f.x=Math.max(40,Math.min(stage.width-40,Math.round(f.x*10)/10));
 }
 s.clones=s.clones.filter(c=>!c.undead||c.fighter.undead!=='dying'||s.frame-c.undead.phaseAt<ZOMBIE_DEATH_FRAMES);
}
