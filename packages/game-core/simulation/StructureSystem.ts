import {hostile} from './Actors.js';
import {deterministicHypot} from './DeterministicMath.js';
import type {Box,Fighter,MoveDefinition,Projectile,SimulationSnapshot,StageDefinition,Structure} from '../types.js';
import {characters} from '../characters/registry.js';
import {actors} from './Actors.js';
import {surfaceBelow} from './StageCollision.js';
import {retainsOwnedEntities,isActive} from './LifeSystem.js';
import {hurtbox,hitboxes,intersects,sweepEntry,targetBoxes} from '../combat/CollisionSystem.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {periodicHit} from '../combat/PeriodicHit.js';
import {initializeProjectile} from './ProjectilePool.js';
import {lightBeam,beamIntersects} from './LightBeamSystem.js';
const actorKey=(owner:number,clone?:{id:number})=>clone?`clone:${clone.id}`:`seat:${owner}`;
const projectileKey=(p:Projectile)=>`projectile:${p.owner}:${p.move}:${p.serial}${p.companionId===undefined?'':`:clone:${p.companionId}`}`;
export const HOUSE_WALL_THICKNESS=22;
export const structureBox=(b:Structure):Box=>({x:b.x-b.width/2,y:b.y,w:b.width,h:b.height});
export function markedStructure(s:SimulationSnapshot,owner:number,move?:string):Structure|undefined{return s.structures?.find(b=>b.owner===owner&&b.phase==='marked'&&(!move||b.move===move));}
export function activateStructure(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 if(m.buildMarkedStructure){
  const b=markedStructure(s,owner);if(!b)return;
  b.phase='built';b.createdAt=s.frame;
  b.trapped=actors(s).filter(a=>isActive(a.fighter)&&intersects(hurtbox(a.fighter),structureBox(b))).map(a=>actorKey(a.owner,a.clone));
  return;
 }
 const spec=m.structure;if(!spec)return;
 s.structures??=[];s.nextStructureId??=0;
 // One of each structure per owner bounds memory even with infinite training energy.
 if(spec.kind!=='bee-box')s.structures=s.structures.filter(b=>b.owner!==owner||b.kind!==spec.kind);
 const maxHealth=Math.ceil(characters[f.characterId].stats.maxHealth*spec.healthRatio);
 const width=Math.min(spec.width,stage.width-80);
 const support=surfaceBelow(stage,f.x,f.y);
 let x=Math.max(width/2+40,Math.min(stage.width-width/2-40,f.x+f.facing*spec.offset));
 // Keep the entire wall on the same supporting platform, including edge casts.
 if(spec.kind==='wall'||stage.platforms?.some(p=>p.motion&&p.y===support)){
  const platform=stage.platforms?.find(p=>p.y===support&&f.x>=p.x&&f.x<=p.x+p.width);
  if(platform&&platform.width>=width)x=Math.max(platform.x+width/2,Math.min(platform.x+platform.width-width/2,x));
 }
 const y=spec.kind==='house'?stage.floorHeight:support;
 s.structures.push({id:s.nextStructureId++,owner,move:m.id,kind:spec.kind,phase:spec.kind==='house'?'marked':'built',x,y,width,height:spec.height,health:maxHealth,maxHealth,createdAt:s.frame,expiresAt:spec.duration?s.frame+spec.duration:0,nextShot:s.frame+(spec.interval??60),shots:0,trapped:[],hits:{},facing:f.facing});
}
export function advanceStructures(s:SimulationSnapshot,_stage:StageDefinition):void{
 if(!s.structures)return;
 // Expired wall/turret debris is visual only: collision and firing stop immediately.
 for(const b of s.structures)if(b.phase==='built'&&b.kind!=='house'&&b.expiresAt&&s.frame>=b.expiresAt){b.phase='collapsed';b.createdAt=b.expiresAt;b.expiresAt+=45;}
 s.structures=s.structures.filter(b=>retainsOwnedEntities(s.fighters[b.owner])&&(!b.expiresAt||s.frame<b.expiresAt));
 if(s.phase!=='fight'){s.structures=[];return;}
 for(const b of s.structures){
  if(b.kind!=='turret'||b.phase!=='built')continue;
  const def=characters[s.fighters[b.owner].characterId],spec=def.moves[b.move].structure!;
  const target=actors(s).filter(a=>hostile(s,b.owner,a.fighter,a.owner)&&isActive(a.fighter)).sort((a,c)=>deterministicHypot(a.fighter.x-b.x,a.fighter.y-b.y)-deterministicHypot(c.fighter.x-b.x,c.fighter.y-b.y))[0]?.fighter;
  if(!target)continue;
  b.facing=target.x>=b.x?1:-1;
  const pivotX=b.x-b.facing*b.width*.18,pivotY=b.y+85;
  const dx=target.x-pivotX,dy=target.y+Math.min(85,hurtbox(target).h/2+8)-pivotY,length=deterministicHypot(dx,dy)||1;
  b.aimX=Math.round(dx/length*1000000)/1000000;b.aimY=Math.round(dy/length*1000000)/1000000;
  if(s.frame<b.nextShot)continue;
  b.nextShot=s.frame+spec.interval!;
  const slot=s.projectiles.find(p=>!p.active),shot=def.moves[spec.shotMove!];if(!slot)continue;
  // Aim at release, then travel straight: opponents can still dodge after firing.
  const barrel=b.width*.68+18;
  initializeProjectile(slot,{active:true,owner:b.owner,x:pivotX+b.aimX*barrel,y:pivotY+b.aimY*barrel,vx:b.aimX*shot.projectile!.speed,vy:b.aimY*shot.projectile!.speed,life:shot.projectile!.lifetime,move:shot.id,serial:1000000+b.id*10000+b.shots++});
 }
}
function canDamage(s:SimulationSnapshot,b:Structure,owner:number):boolean{return b.phase==='built'&&(b.kind==='house'||s.teams[b.owner]!==s.teams[owner]);}
export function damageStructure(s:SimulationSnapshot,b:Structure,amount:number,key:string,interval:number,stage:StageDefinition,impact?:{x:number;y:number}):void{
 if(b.phase!=='built'||s.frame<(b.hits[key]??-1))return;
 b.hits[key]=interval?s.frame+interval:Number.MAX_SAFE_INTEGER;
 b.health=Math.max(0,b.health-amount);b.lastHitAt=s.frame;b.hitX=Math.max(b.x-b.width/2,Math.min(b.x+b.width/2,impact?.x??b.x));b.hitY=Math.max(b.y,Math.min(b.y+b.height,impact?.y??b.y+b.height/2));
 if(b.health)return;
 const spec=characters[s.fighters[b.owner].characterId].moves[b.move].structure!;
 b.phase='collapsed';b.createdAt=s.frame;b.expiresAt=s.frame+45;
 if(b.kind==='bee-box')s.hazards.push({kind:'honey',owner:b.owner,x:b.x,y:b.y,createdAt:s.frame,expiresAt:Number.MAX_SAFE_INTEGER,move:b.move,nextTicks:[]});
 if(b.kind!=='house')return;
 for(const a of actors(s)){
  const f=a.fighter;
  if(!intersects(hurtbox(f),structureBox(b))||!canReceiveDirectHit(f,s.frame))continue;
  const reacts=periodicHit(s,f,spec.collapseDamage??0,0,spec.collapseStun??240,0,undefined,stage.floorHeight,{source:b.owner,move:b.move},stage.width);
  if(reacts&&s.frame>=f.hitstunImmuneUntil){f.vx=f.vy=0;f.dazed=true;}
 }
}
/** Authoritative surfaces shared by projectile blocking and fighter collision. */
export function structureSurfaces(b:Structure):Box[]{
 if(b.kind!=='house')return [structureBox(b)];
 const box=structureBox(b),wall=HOUSE_WALL_THICKNESS;
 return [{x:box.x,y:box.y,w:wall,h:box.h},{x:box.x+box.w-wall,y:box.y,w:wall,h:box.h},{x:box.x,y:box.y+box.h-wall,w:box.w,h:wall}];
}
export function hitStructureProjectile(s:SimulationSnapshot,p:Projectile,from:{x:number;y:number},stage:StageDefinition,previousPositions?:ReadonlyMap<Fighter,{x:number;y:number}>):boolean{
 const move=characters[s.fighters[p.owner].characterId].moves[p.move];
 const radius=move.projectile?.radius??(p.trajectory?characters[s.fighters[p.owner].characterId].returningPaths?.[p.trajectory]?.radius:22)??22;
 if(p.trajectory&&p.returning)return false;
 const candidates=(s.structures??[]).filter(b=>canDamage(s,b,p.owner)).map(b=>({b,time:Math.min(...structureSurfaces(b).map(box=>sweepEntry(box,from.x,from.y,p.x,p.y,radius)))})).filter(c=>c.time<Infinity).sort((a,b)=>a.time-b.time||a.b.id-b.b.id);
 const contact=candidates[0];if(!contact)return false;
 // A normal projectile must hit a fighter standing before the blocking surface first.
 if(!p.trajectory&&actors(s).some(a=>{
  if(!hostile(s,p.owner,a.fighter,a.owner)||!canReceiveDirectHit(a.fighter,s.frame))return false;
  const previous=previousPositions?.get(a.fighter)??a.fighter;
  return targetBoxes(a.fighter,'move').some(box=>sweepEntry(box,from.x+a.fighter.x-previous.x,from.y+a.fighter.y-previous.y,p.x,p.y,radius)<contact.time);
 }))return false;
 const {b,time}=contact;
 damageStructure(s,b,move.damage,projectileKey(p),p.trajectory?24:0,stage,{x:from.x+(p.x-from.x)*time,y:from.y+(p.y-from.y)*time});
 p.x=from.x+(p.x-from.x)*time;p.y=from.y+(p.y-from.y)*time;
 if(p.trajectory){p.returning=true;p.vx=-p.vx;}else p.active=false;
 return true;
}
export function attackStructures(s:SimulationSnapshot,stage:StageDefinition):void{
 for(const b of s.structures??[]){
  if(b.phase!=='built')continue;
  for(const a of actors(s)){
   const f=a.fighter,m=f.move?characters[f.characterId].moves[f.move]:undefined;
   if(!m||!isActive(f)||!canDamage(s,b,a.owner))continue;
   const key=`${actorKey(a.owner,a.clone)}:${f.attackSerial}`;
   if(hitboxes(f,m).some(box=>structureSurfaces(b).some(surface=>intersects(box,surface))))damageStructure(s,b,m.damage,key,0,stage,{x:Math.max(b.x-b.width/2,Math.min(b.x+b.width/2,f.x)),y:Math.max(b.y,Math.min(b.y+b.height,f.y+85))});
   const active=f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames;
   // An active airborne strike touching the inside ceiling can damage it. Body
   // collision stops the head at the ceiling before a horizontal attack box reaches it.
   const body=hurtbox(f),ceiling=b.y+b.height-HOUSE_WALL_THICKNESS;
   if(b.kind==='house'&&active&&m.state==='AirAttack'&&f.y>b.y&&f.y<ceiling&&Math.abs(f.y+body.h-ceiling)<1&&hitboxes(f,m).some(box=>box.x<b.x+b.width/2-HOUSE_WALL_THICKNESS&&box.x+box.w>b.x-b.width/2+HOUSE_WALL_THICKNESS))damageStructure(s,b,m.damage,key,0,stage,{x:f.x,y:ceiling});
   if(active&&m.periodicMelee&&intersects({x:f.x-m.periodicMelee.rangeX,y:f.y,w:m.periodicMelee.rangeX*2,h:m.periodicMelee.rangeY},structureBox(b)))damageStructure(s,b,m.damage,key,m.periodicMelee.interval,stage);
   const beam=lightBeam(f,stage.width,stage.floorHeight);
   if(beam&&structureSurfaces(b).some(box=>beamIntersects(beam,box)))damageStructure(s,b,m.damage,key,m.beam?.interval??12,stage);
  }
  // Only live attack serials need their per-structure hit stamps retained.
  if(Object.keys(b.hits).length>256){const live=new Set([...actors(s).map(a=>`${actorKey(a.owner,a.clone)}:${a.fighter.attackSerial}`),...s.projectiles.filter(p=>p.active).map(p=>projectileKey(p))]);for(const key of Object.keys(b.hits))if(!live.has(key))delete b.hits[key];}
 }
}
export function collideStructures(s:SimulationSnapshot,previous:Map<Fighter,{x:number;y:number}>,width=Infinity):Fighter[]{
 const blocked:Fighter[]=[];
 for(const a of actors(s)){
  const f=a.fighter;if(f.undead&&f.undead!=='zombie'||!isActive(f))continue;
  const old=previous.get(f)??{x:f.x,y:f.y},body=hurtbox(f),half=body.w/2,attemptedX=f.x;
  for(const b of s.structures??[]){
   if(b.phase!=='built'||b.kind==='turret'||b.kind==='bee-box')continue;
   if(b.kind==='wall'&&!hostile(s,b.owner,a.fighter,a.owner))continue;
   const left=b.x-b.width/2,right=b.x+b.width/2,top=b.y+b.height;
   if(b.kind==='house'&&b.trapped.includes(actorKey(a.owner,a.clone))){
    f.x=Math.max(left+HOUSE_WALL_THICKNESS+half,Math.min(right-HOUSE_WALL_THICKNESS-half,f.x));
    if(f.y+body.h>top-HOUSE_WALL_THICKNESS){f.y=Math.max(b.y,top-HOUSE_WALL_THICKNESS-body.h);f.vy=Math.min(0,f.vy);}
    if(f.y<b.y){f.y=b.y;f.vy=0;}
    continue;
   }
   if(old.y>=top-1&&f.y<=top&&f.x+half>left&&f.x-half<right){f.y=top;f.vy=0;continue;}
   if(f.y>=top||f.y+body.h<=b.y)continue;
   if(old.x<=left-half&&f.x>left-half){f.x=left-half;f.vx=0;}
   else if(old.x>=right+half&&f.x<right+half){f.x=right+half;f.vx=0;}
   else if(f.x+half>left&&f.x-half<right){f.x=f.x<b.x?left-half:right+half;f.vx=0;}
  }
  // An edge wall must eject toward the arena, never into the outer boundary.
  if(f.x<40||f.x>width-40){
   const surfaces=(s.structures??[]).filter(b=>b.phase==='built'&&(b.kind==='house'||b.kind==='wall'&&hostile(s,b.owner,a.fighter,a.owner))&&f.y<b.y+b.height&&f.y+body.h>b.y);
   const candidates=[40,width-40,...surfaces.flatMap(b=>[b.x-b.width/2-half,b.x+b.width/2+half])];
   const valid=candidates.filter(x=>x>=40&&x<=width-40&&surfaces.every(b=>x+half<=b.x-b.width/2||x-half>=b.x+b.width/2));
   valid.sort((a,b)=>Math.abs(a-attemptedX)-Math.abs(b-attemptedX)||a-b);
   if(valid.length)f.x=valid[0];
   else {f.x=Math.max(40,Math.min(width-40,f.x));f.y=Math.max(f.y,...surfaces.map(b=>b.y+b.height));f.vy=0;}
  }
  if(f.x!==attemptedX)blocked.push(f);
 }
 return blocked;
}
