import type {HairClone,MoveDefinition,SimulationSnapshot,StageDefinition} from '../types.js';
import {createFighter} from './Fighter.js';
import {enter} from './StateMachine.js';
import {resolveHit} from '../combat/CombatSystem.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {actors} from './Actors.js';
import {sweepEntry,targetBoxes} from '../combat/CollisionSystem.js';
import {structureSurfaces} from './StructureSystem.js';

export const INVASION={startFrames:180*60,intervalFrames:10*60,maxActive:16,maxBullets:24,bulletSpeed:4,bulletLife:360,enterFrames:60} as const;
export const INVASION_VARIANTS=['pt-normal','pt-flag','pt-heavy','br-normal','br-flag','br-revolver'] as const;
export type InvasionVariant=typeof INVASION_VARIANTS[number];
// Stack the additional 30% rate increase on the previous 10% timings.
const fasterAttack=(frames:number)=>Math.ceil(Math.ceil(frames/1.1)/1.3);
// A 40% attack-rate increase shortens the whole combo/cycle by 1 / 1.4.
export const HEAVY_ATTACK={contacts:[24,60,94].map(f=>fasterAttack(Math.ceil(f/1.4))),ends:[30,66,100].map(f=>fasterAttack(Math.ceil(f/1.4))),transitions:[40,76].map(f=>fasterAttack(Math.ceil(f/1.4)))};
// The opening lunge is attack movement; ordinary zombie shamble speed is unchanged.
export const HEAVY_DASH={start:5,distance:240,stopDistance:80} as const;
export const INVADER_STATS={
 'pt-normal':{health:340,range:105,height:95,cooldown:fasterAttack(90),end:fasterAttack(48)},
 'pt-flag':{health:420,range:165,height:120,cooldown:fasterAttack(108),end:fasterAttack(60)},
 'pt-heavy':{health:520,range:150+HEAVY_DASH.distance,height:120,cooldown:fasterAttack(Math.ceil(156/1.4)),end:fasterAttack(Math.ceil(116/1.4))},
 'br-normal':{health:340,range:105,height:95,cooldown:fasterAttack(90),end:fasterAttack(48)},
 'br-flag':{health:420,range:165,height:120,cooldown:fasterAttack(108),end:fasterAttack(60)},
 'br-revolver':{health:340,range:975,height:95,cooldown:fasterAttack(150),end:fasterAttack(78)},
} as const;
export interface InvasionBullet {id:number;sourceId:number;x:number;y:number;vx:number;life:number;}
export interface InvasionState {bullets:InvasionBullet[];nextBulletId:number;}
const strike=(id:string,damage:number,range:number):MoveDefinition=>({id,input:'',animation:'claw',state:'LightAttack',startupFrames:24,activeFrames:6,recoveryFrames:24,damage,hitstun:10,blockstun:6,knockback:3,launch:0,knockdown:false,meterGain:0,meterCost:0,priority:1,level:'mid',cancelRules:[],cancelFrame:0,hitboxes:[{x:0,y:25,w:range,h:120}],effects:'impact',events:[],poisonFrames:180,poisonDamage:10});
export const INVADER_MOVES={normal:strike('@invasion-claw',56,115),flag:strike('@invasion-flag',76,175),hammer:strike('@invasion-hammer',48,160),scythe:strike('@invasion-scythe',56,160),slam:strike('@invasion-slam',72,160),bullet:strike('@invasion-bullet',68,1)};
export function spawnInvader(s:SimulationSnapshot,stage:StageDefinition,variant:InvasionVariant,slot=0):HairClone{
 const left=variant.startsWith('pt-'),x=left?40+slot*75:stage.width-40-slot*75;
 const f=createFighter('gut',x,left?1:-1);f.y=stage.floorHeight;f.health=INVADER_STATS[variant].health;f.lives=1;f.meter=0;f.undead='rising';f.state='Idle';
 const c:HairClone={id:s.nextCloneId++,owner:-1,kind:'undead',invasion:variant,fighter:f,undead:{phaseAt:s.frame,target:-1,nextAttack:0,attackAt:0,attackFrame:0,hit:false,stuck:0,lastX:x,spawnX:x,spawnY:f.y}};
 s.clones.push(c);return c;
}
/** Uses fight-clock ticks, including hitstop; never wall time or client randomness. */
export function advanceInvasionWaves(s:SimulationSnapshot,stage:StageDefinition):void{
 if(s.training||s.phase!=='fight'||s.phaseFrame<INVASION.startFrames||(s.phaseFrame-INVASION.startFrames)%INVASION.intervalFrames!==0)return;
 s.invasion??={bullets:[],nextBulletId:0};
 const count=s.phaseFrame===INVASION.startFrames?2:1;
 let seed=(Math.imul(s.frame+s.nextCloneId*7919+s.fighters.reduce((n,f)=>n+Math.round(f.x),0),1664525)+1013904223)>>>0;
 for(let i=0;i<count;i++)for(const category of ['pt-','br-']){
  // Balanced per-side capacity. Skipped waves are never queued or burst-spawned later.
  if(s.clones.filter(c=>c.invasion).length>=INVASION.maxActive||s.clones.filter(c=>c.invasion?.startsWith(category)).length>=INVASION.maxActive/2)continue;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  spawnInvader(s,stage,INVASION_VARIANTS[(category==='pt-'?0:3)+seed%3],i);
 }
}
export function invaderAttackStart(variant:InvasionVariant):number {return variant==='pt-heavy'?HEAVY_ATTACK.contacts[0]:fasterAttack(variant==='br-revolver'?42:variant.endsWith('flag')?30:24);}
export function invaderAttackPhase(variant:InvasionVariant,age:number):{windup:number;contact:number;active:boolean}{
 if(variant==='pt-heavy'){
  const part=age<HEAVY_ATTACK.transitions[0]?0:age<HEAVY_ATTACK.transitions[1]?1:2,start=HEAVY_ATTACK.contacts[part];
  return {windup:[5,8,10][part],contact:[6,9,11][part],active:age>=start&&age<HEAVY_ATTACK.ends[part]};
 }
 const start=variant==='br-revolver'?42:variant.endsWith('flag')?30:24;
 return {windup:5,contact:6,active:age>=fasterAttack(start)&&age<fasterAttack(start+6)};
}
/** Invaders have no player owner: no rewards, team allegiance, or player cooldowns. */
export function advanceInvaderAttack(s:SimulationSnapshot,stage:StageDefinition,c:HairClone):void{
 const variant=c.invasion!,u=c.undead!,f=c.fighter,age=++u.attackFrame;
 enter(f,'LightAttack');
 if(variant==='pt-heavy'&&age>=HEAVY_DASH.start&&age<=HEAVY_ATTACK.contacts[0]){
  const target=s.fighters[u.target];
  const remaining=target?(target.x-f.x)*f.facing-HEAVY_DASH.stopDistance:0;
  const distance=Math.max(0,Math.min(HEAVY_DASH.distance/(HEAVY_ATTACK.contacts[0]-HEAVY_DASH.start+1),remaining));
  const nextX=Math.max(40,Math.min(stage.width-40,f.x+f.facing*distance));
  let fraction=1;
  // Sweep the full body so the dash cannot tunnel through built walls or turrets.
  for(const b of s.structures??[])if(b.phase==='built')for(const box of structureSurfaces(b)){
   const contact=sweepEntry({x:box.x-31,y:box.y-154,w:box.w+62,h:box.h+154},f.x,f.y,nextX,f.y,0);
   if(contact!==Infinity)fraction=Math.min(fraction,Math.max(0,contact-.001));
  }
  f.x+=(nextX-f.x)*fraction;
 }
 if(variant==='br-revolver'){
  if(age===invaderAttackStart(variant)){
   s.invasion??={bullets:[],nextBulletId:0};
   if(s.invasion.bullets.length<INVASION.maxBullets)s.invasion.bullets.push({id:s.invasion.nextBulletId++,sourceId:c.id,x:f.x+f.facing*40,y:f.y+100,vx:f.facing*INVASION.bulletSpeed,life:INVASION.bulletLife});
  }
 }else{
  const phase=invaderAttackPhase(variant,age);
  if(phase.active){
   const move=variant==='pt-heavy'?(phase.contact===6?INVADER_MOVES.hammer:phase.contact===9?INVADER_MOVES.scythe:INVADER_MOVES.slam):variant.endsWith('flag')?INVADER_MOVES.flag:INVADER_MOVES.normal;
   for(const a of actors(s)){
    const d=a.fighter,key=`${phase.contact}:${a.clone?`clone:${a.clone.id}`:`seat:${a.owner}`}`;
    if(d.undead||f.hitTargets.includes(key)||!canReceiveDirectHit(d,s.frame)||(d.x-f.x)*f.facing< -15||Math.abs(d.x-f.x)>move.hitboxes[0].w||Math.abs(d.y-f.y)>=INVADER_STATS[variant].height)continue;
    f.hitTargets.push(key);u.hit=true;resolveHit(s,stage,()=>{},-1,move,d.previousInput,false,a.owner,f.facing,f,d);
   }
  }
 }
 if(age>=INVADER_STATS[variant].end){u.attackAt=0;enter(f,'Idle');}
}
/** Separate bounded projectiles cannot consume fighter projectile slots or inherit a player's stats. */
export function advanceInvasionBullets(s:SimulationSnapshot,stage:StageDefinition):void{
 if(!s.invasion)return;
 const targets=actors(s).filter(a=>!a.fighter.undead&&canReceiveDirectHit(a.fighter,s.frame));
 for(const p of s.invasion.bullets){
  const source=s.clones.find(c=>c.id===p.sourceId&&c.invasion&&c.fighter.health>0&&c.fighter.undead==='zombie');
  if(!source){p.life=0;continue;}
  const old=p.x;p.x+=p.vx;p.life--;
  let first=Infinity,target:typeof targets[number]|undefined;
  for(const a of targets){const time=Math.min(...targetBoxes(a.fighter,'move').map(b=>sweepEntry(b,old,p.y,p.x,p.y,7)));if(time<first){first=time;target=a;}}
  // Solid structures stop bullets; one-way arena platforms do not block horizontal shots.
  for(const b of s.structures??[])if(b.phase==='built')for(const box of structureSurfaces(b))if(sweepEntry(box,old,p.y,p.x,p.y,7)!==Infinity&&sweepEntry(box,old,p.y,p.x,p.y,7)<=first){p.life=0;target=undefined;}
  if(target&&first!==Infinity){resolveHit(s,stage,()=>{},-1,INVADER_MOVES.bullet,target.fighter.previousInput,false,target.owner,Math.sign(p.vx),source.fighter,target.fighter);p.life=0;}
  if(p.x<0||p.x>stage.width)p.life=0;
 }
 s.invasion.bullets=s.invasion.bullets.filter(p=>p.life>0);
}
