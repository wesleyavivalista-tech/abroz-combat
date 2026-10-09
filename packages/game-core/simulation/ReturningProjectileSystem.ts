import {hostile} from './Actors.js';
import {recordGameplayEvent} from '../combat/GameplayEvents.js';
import {deterministicHypot} from './DeterministicMath.js';
import {hitStructureProjectile} from './StructureSystem.js';
import {initializeProjectile} from './ProjectilePool.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import type {Fighter,SimulationSnapshot,StageDefinition,Projectile} from '../types.js';
import {characters} from '../characters/registry.js';
import {actors} from './Actors.js';
import {periodicHit} from '../combat/PeriodicHit.js';
import {retainsOwnedEntities} from './LifeSystem.js';
import {targetBoxes,sweptIntersects} from '../combat/CollisionSystem.js';
export function canSpawnReturningProjectile(s:SimulationSnapshot,owner:number,kind:string):boolean {
 const def=characters[s.fighters[owner].characterId],spec=def.returningPaths?.[kind];if(!spec)return false;
 const flying=s.projectiles.filter(p=>p.active&&p.owner===owner&&p.trajectory);
 return spec.weapon?!flying.some(p=>def.returningPaths?.[p.trajectory!]?.weapon):(!spec.exclusive||!flying.some(p=>p.trajectory===kind))&&flying.filter(p=>{const path=def.returningPaths?.[p.trajectory!];return !path?.weapon&&!path?.finale;}).length<(def.returningCapacity??4);
}
export function spawnReturningProjectile(s:SimulationSnapshot,owner:number,move:string,kind:string,index=0):void {
 const f=s.fighters[owner],def=characters[f.characterId],spec=def.returningPaths?.[kind],p=s.projectiles.find(p=>!p.active);if(!p||!spec)return;
 if(spec.weapon)f.returningWeaponOut=true;
 const velocity=spec.finale?def.modeFinale?.velocities[index]:undefined;
 initializeProjectile(p,{active:true,owner,move,serial:++f.attackSerial,trajectory:kind,x:f.x+f.facing*40,y:f.y+120,vx:velocity?.[0]??spec.speed*f.facing,vy:velocity?.[1]??spec.verticalSpeed,life:spec.life,age:0,returning:false,nextHits:{}});
}
export function finishProjectileMode(s:SimulationSnapshot,owner:number):void {
 const f=s.fighters[owner],def=characters[f.characterId],finale=def.modeFinale;if(!finale)return;
 f.modeFinaleUntil=s.frame+finale.duration;
 s.projectiles.forEach(p=>{if(p.owner===owner&&p.trajectory&&!def.returningPaths?.[p.trajectory]?.weapon)p.active=false;});
 for(let i=0;i<finale.velocities.length;i++)spawnReturningProjectile(s,owner,finale.move,finale.path,i);
}
export {periodicHit} from '../combat/PeriodicHit.js';
/** Absolute simulation ticks make return paths rollback-safe; all state is in snapshots. */
export function advanceReturningProjectiles(s:SimulationSnapshot,stage:StageDefinition,onHit?:(f:Fighter)=>void):void {
 for(const p of s.projectiles){
  if(!p.active||!p.trajectory)continue;
  const f=s.fighters[p.owner],def=characters[f.characterId],spec=def.returningPaths?.[p.trajectory];
  if(!spec){p.active=false;continue;}
  if(!retainsOwnedEntities(f)||--p.life<=0){p.active=false;if(spec.weapon)f.returningWeaponOut=false;continue;}
  p.age=(p.age??0)+1;
  if(p.returning){
   const dx=f.x-p.x,dy=f.y+110-p.y,d=deterministicHypot(dx,dy);
   if(d<25){p.active=false;if(spec.weapon)f.returningWeaponOut=false;continue;}
   p.vx=dx/d*22;p.vy=dy/d*22;
  }else if(spec.motion==='vertical'){
   p.vy=(p.vy??0)-spec.gravity;
   if((p.vy??0)<0&&p.y<=f.y+130)p.returning=true;
  }else if(spec.motion==='straight'){
   if(p.x<20||p.x>stage.width-20)p.returning=true;
  }else{
   p.vy=(p.vy??0)-spec.gravity;
   if(p.y<stage.floorHeight+20&&(p.vy??0)<0){p.y=stage.floorHeight+20;p.vy=27;recordGameplayEvent(s,'ObjectImpact',p.owner,p.move,undefined,{x:p.x});}
   if(p.x<20||p.x>stage.width-20){p.x=Math.max(20,Math.min(stage.width-20,p.x));p.vx=-p.vx;if(!spec.finale)p.returning=true;}
   const ceiling=Math.max(stage.floorHeight+700,...(stage.platforms??[]).map(platform=>platform.y+360));
   if(p.y>ceiling){p.y=ceiling;p.vy=-Math.abs(p.vy??0);}
   if(!spec.finale&&p.age>Math.ceil(stage.width/5))p.returning=true;
  }
  const oldX=p.x,oldY=p.y;p.x+=p.vx;p.y+=p.vy??0;
  hitStructureProjectile(s,p,{x:oldX,y:oldY},stage);
  hitReturningProjectile(s,p,oldX,oldY,onHit,undefined,stage.floorHeight,stage.width);

 }
}

/** Re-check moving targets after integration using relative motion, without double-hitting stationary contacts. */
export function hitReturningProjectile(s:SimulationSnapshot,p:Projectile,oldX:number,oldY:number,onHit?: (f:Fighter)=>void,previousTargets?:Map<Fighter,{x:number;y:number}>,floorHeight=0,arenaWidth=2400):void{
 const f=s.fighters[p.owner],def=characters[f.characterId],spec=def.returningPaths?.[p.trajectory??''];
 if(!p.active||!spec)return;
 for(const {fighter:d,owner,clone} of actors(s)){
  const key=clone?`c${clone.id}`:`p${owner}`,previous=previousTargets?.get(d);
  if(previousTargets&&(!previous||(previous.x===d.x&&previous.y===d.y)))continue;
  if(!hostile(s,p.owner,d,owner)||!canReceiveDirectHit(d,s.frame)||(p.nextHits?.[key]??0)>s.frame)continue;
  const x=oldX+(previous?d.x-previous.x:0),y=oldY+(previous?d.y-previous.y:0);
  if(!targetBoxes(d,'move').some(box=>sweptIntersects(box,x,y,p.x,p.y,spec.radius)))continue;
  periodicHit(s,d,def.moves[p.move].damage,Math.sign(p.vx)||f.facing,18,3,onHit,floorHeight,{source:p.owner,move:p.move},arenaWidth);(p.nextHits??={})[key]=s.frame+spec.hitInterval;
 }
}
