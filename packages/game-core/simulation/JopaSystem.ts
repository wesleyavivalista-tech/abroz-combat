import {hostile} from './Actors.js';
import {recordGameplayEvent} from '../combat/GameplayEvents.js';
import {gainEnergy} from './EnergySystem.js';
import {Button,type Fighter,type HairClone,type MoveDefinition,type SimulationSnapshot,type StageDefinition} from '../types.js';
import {characters} from '../characters/registry.js';
import {createFighter} from './Fighter.js';
import {actors} from './Actors.js';
import {retainsOwnedEntities,isActive} from './LifeSystem.js';
import {grounded,surfaceBelow} from './StageCollision.js';
import {enter,locked} from './StateMachine.js';
import {consumeButtons} from '../input/InputBuffer.js';
import {initializeProjectile} from './ProjectilePool.js';
import {applyDamage} from '../combat/DamageSystem.js';
import {consecutiveHitstun} from '../combat/HitstunSystem.js';
import {structureSurfaces,damageStructure} from './StructureSystem.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {sweepEntry,targetBoxes} from '../combat/CollisionSystem.js';
export const JOPA={footballFrames:120,chessStun:60,knightStun:60,knightRecovery:90,knightSpeed:0.9,treeLifetime:4200,treeDeathFrames:60,treeHealth:.7,tentacleHealth:.1,knightHealth:700,tentacleInterval:180,knightDamage:170,maxTentacles:10};
const clamp=(x:number,stage:StageDefinition)=>Math.max(70,Math.min(stage.width-70,x));
function summon(s:SimulationSnapshot,stage:StageDefinition,owner:number,kind:'tree'|'tentacle'|'knight',x:number,y:number):HairClone{
 const f=createFighter('jopa',clamp(x,stage),s.fighters[owner].facing);
 const health=kind==='knight'?JOPA.knightHealth:Math.round(characters.jopa.stats.maxHealth*(kind==='tree'?JOPA.treeHealth:JOPA.tentacleHealth));
 f.y=surfaceBelow(stage,f.x,y);f.health=health;f.lives=1;f.meter=0;f.state='Idle';f.jopaSummon=kind;
 const c:HairClone={id:s.nextCloneId++,owner,fighter:f,kind,maxHealth:f.health,nextAction:s.frame+(kind==='tree'?180:45),bornAt:s.frame};s.clones.push(c);return c;
}
function spawnTentacle(s:SimulationSnapshot,stage:StageDefinition,owner:number,x:number,y:number):void{
 if(s.clones.filter(c=>c.kind==='tentacle'&&isActive(c.fighter)&&retainsOwnedEntities(s.fighters[c.owner])).length<JOPA.maxTentacles)summon(s,stage,owner,'tentacle',x,y);
}
function mount(s:SimulationSnapshot,c:HairClone,seat:number):void{
 const f=s.fighters[seat];c.rider=seat;f.jopaRide=c.id;f.move=null;f.stun=0;f.vx=f.vy=0;f.buffer=[];f.grappleUntil=f.trappedUntil=0;syncRider(s,c);
}
function release(s:SimulationSnapshot,c:HairClone,stage:StageDefinition):void{
 if(c.rider===undefined)return;const f=s.fighters[c.rider];
 delete f.jopaRide;if(isActive(f)){f.x=clamp(c.fighter.x+c.fighter.facing*135,stage);f.y=Math.max(stage.floorHeight,c.fighter.y+30);f.vy=5;f.vx=0;f.move=null;f.buffer=[];enter(f,'Fall');}delete c.rider;c.nextAction=s.frame+45;
}
function syncRider(s:SimulationSnapshot,c:HairClone):void{
 if(c.rider===undefined)return;const f=s.fighters[c.rider],k=c.fighter;f.x=k.x-35*k.facing;f.y=k.y+115;f.facing=k.facing;f.vx=f.vy=0;f.move=null;enter(f,'Idle');
}
export function activateJopa(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 const kind=m.jopaAbility;if(!kind)return;
 if(kind==='football'||kind==='chess'){
  const p=s.projectiles.find(p=>!p.active);if(!p)return;
  initializeProjectile(p,{active:true,owner,x:f.x+f.facing*(kind==='chess'?110:70),y:f.y+24,vx:f.facing*(kind==='football'?16:5),vy:0,life:kind==='football'?JOPA.footballFrames:900,expiresAt:s.frame+(kind==='football'?JOPA.footballFrames:900),nextHop:s.frame+8,jopaKind:kind,variant:kind==='chess'?(f.chessIndex??0)%5:undefined,move:m.id,serial:f.attackSerial,nextHits:kind==='football'?{['seat:'+owner]:s.frame+8}:{}});
  if(kind==='chess')f.chessIndex=((f.chessIndex??0)+1)%5;return;
 }
 if(kind==='tree'){
  const tree=summon(s,stage,owner,'tree',f.x,f.y);f.jopaTree=tree.id;f.move=null;f.vx=f.vy=0;f.buffer=[];
 }else if(kind==='knight')mount(s,summon(s,stage,owner,'knight',f.x,f.y),owner);
}
/** Runs before both companion pruning sites, so defeated trees release exactly once. */
export function cleanupJopa(s:SimulationSnapshot,stage:StageDefinition):void{
 if(s.treeDeaths)s.treeDeaths=s.treeDeaths.filter(d=>s.frame-d.startedAt<JOPA.treeDeathFrames);
 for(const c of [...s.clones]){
  if(!c.fighter.jopaSummon)continue;
  if(c.kind==='tree'&&s.frame-(c.bornAt??s.frame)>=JOPA.treeLifetime)c.fighter.health=0;
  if(isActive(c.fighter)&&retainsOwnedEntities(s.fighters[c.owner]))continue;
  if(c.kind==='tree'&&c.pattern!==-1){
   c.pattern=-1;(s.treeDeaths??=[]).push({id:c.id,x:c.fighter.x,y:c.fighter.y,facing:c.fighter.facing,startedAt:s.frame});const f=s.fighters[c.owner],possessed=f.jopaTree===c.id;if(possessed)delete f.jopaTree;
   if(possessed&&isActive(f)){f.move=null;f.buffer=[];enter(f,'Idle');}if(retainsOwnedEntities(f)){for(let i=0;i<5;i++)spawnTentacle(s,stage,c.owner,c.fighter.x+(i-2)*100,c.fighter.y);}
  }
  if(c.kind==='knight')release(s,c,stage);
 }
 for(const f of s.fighters){
  if(f.jopaTree!==undefined&&!s.clones.some(c=>c.id===f.jopaTree&&isActive(c.fighter))){delete f.jopaTree;f.move=null;enter(f,'Idle');}
  if(f.jopaRide!==undefined&&!s.clones.some(c=>c.id===f.jopaRide&&isActive(c.fighter))){delete f.jopaRide;f.move=null;enter(f,'Fall');}
 }
}
/** Shared by input handling and the nearby mount prompt. */
export function mountableKnight(s:SimulationSnapshot,stage:StageDefinition,seat:number):HairClone|undefined{
 const f=s.fighters[seat];
 if(!isActive(f)||locked(f)||f.grappleUntil>s.frame||f.trappedUntil>s.frame||f.move||f.jopaRide!==undefined||f.jopaTree!==undefined||!grounded(f,stage))return;
 return s.clones.find(c=>c.kind==='knight'&&c.rider===undefined&&isActive(c.fighter)&&retainsOwnedEntities(s.fighters[c.owner])&&s.teams[c.owner]===s.teams[seat]&&Math.abs(c.fighter.y-f.y)<45&&(f.x-c.fighter.x)*c.fighter.facing>=0&&Math.abs(c.fighter.x-f.x)<=170);
}
/** The second basic is a fresh press; holding it cannot repeatedly mount/dismount. */
export function controlJopa(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,seat:number):boolean{
 if(f.jopaSummon)return true;
 if(s.fighters[seat]!==f)return false;
 if(f.jopaTree!==undefined){const c=s.clones.find(c=>c.id===f.jopaTree);if(c){f.x=c.fighter.x;f.y=c.fighter.y;f.move=null;f.vx=f.vy=0;f.buffer=[];return true;}}
 const pressed=f.buffer.at(-1)?.pressed??0;
 if(f.jopaRide!==undefined){const c=s.clones.find(c=>c.id===f.jopaRide);if(c){if(pressed&Button.Medium)release(s,c,stage);else syncRider(s,c);consumeButtons(f.buffer);return true;}}
 if(!locked(f)&&!f.move&&grounded(f,stage)&&(pressed&Button.Medium)){
  const c=mountableKnight(s,stage,seat);
  if(c){mount(s,c,seat);return true;}
 }
 return false;
}
function strike(s:SimulationSnapshot,source:Fighter,owner:number,target:Fighter,damage:number,stun:number,floorHeight:number,move:string,arenaWidth:number):void{
 if(!canReceiveDirectHit(target,s.frame))return;
 applyDamage(s,target,damage,{owned:true,combo:'hit',source:owner,move});
 const duration=Math.max(stun,target.stun),eligible=consecutiveHitstun(s,target,stun,Math.sign(target.x-source.x)||source.facing,floorHeight,arenaWidth);
 if(eligible&&!target.jopaSummon){target.move=null;target.actionUntil=0;target.vx=target.vy=0;target.stun=duration;target.dazed=duration>=120;target.jopaStunUntil=s.frame+duration;target.buffer=[];enter(target,'HitStunStanding');}
 // Main-fighter projectiles use the owner itself as their source. Credit it once.
 gainEnergy(source,3,s.frame,s);if(source!==s.fighters[owner])gainEnergy(s.fighters[owner],3,s.frame,s);
}
export function advanceJopa(s:SimulationSnapshot,stage:StageDefinition,impact?:(f:Fighter,owner:number)=>void):void{
 cleanupJopa(s,stage);
 for(const {fighter:f} of actors(s))if(f.jopaStunUntil!==undefined){
  if(!isActive(f)||f.state!=='HitStunStanding'||f.move||f.grappleUntil>s.frame||f.trappedUntil>s.frame){delete f.jopaStunUntil;continue;}
  f.stun=Math.max(0,f.jopaStunUntil-s.frame);if(!f.stun){delete f.jopaStunUntil;f.dazed=false;enter(f,grounded(f,stage)?'Idle':'Fall');}
 }
 for(const p of s.projectiles)if(p.active&&p.jopaKind){
  p.life=Math.max(0,(p.expiresAt??s.frame)-s.frame);if(!p.life||!retainsOwnedEntities(s.fighters[p.owner]))p.active=false;
 }
 if(s.hitstop)return;
 for(const c of [...s.clones]){
  if(!c.fighter.jopaSummon||!isActive(c.fighter))continue;
  const f=c.fighter;f.stateFrame++;f.move=null;f.stun=0;
  if(c.kind==='tree'){
   if(s.frame>=(c.nextAction??0)){spawnTentacle(s,stage,c.owner,f.x+((s.nextCloneId%2)?1:-1)*130,f.y);c.nextAction=s.frame+180;}continue;
  }
  const enemies=actors(s).filter(a=>hostile(s,c.owner,a.fighter,a.owner)&&canReceiveDirectHit(a.fighter,s.frame));
  const target=enemies.sort((a,b)=>Math.abs(a.fighter.x-f.x)-Math.abs(b.fighter.x-f.x))[0]?.fighter;
  if(c.kind==='tentacle'){
   if(target){
    let destination=target.x;
    const onGround=grounded(f,stage),above=target.y>f.y+100;
    const platform=above?(stage.platforms??[]).filter(p=>p.y>f.y+60&&p.y-f.y<=420).sort((a,b)=>Math.abs(a.x+a.width/2-target.x)-Math.abs(b.x+b.width/2-target.x))[0]:undefined;
    if(platform)destination=Math.max(platform.x+35,Math.min(platform.x+platform.width-35,target.x));
    if(onGround&&target.y<f.y-100){const current=(stage.platforms??[]).find(p=>p.y===f.y&&f.x>=p.x&&f.x<=p.x+p.width);if(current)destination=target.x<f.x?current.x-40:current.x+current.width+40;}
    const dx=destination-f.x;if(Math.abs(dx)>5)f.facing=dx<0?-1:1;
    if(onGround&&platform&&f.x>=platform.x-70&&f.x<=platform.x+platform.width+70&&s.frame>=(c.nextJump??0)){f.vy=29;f.y+=1;c.nextJump=s.frame+70;}
    f.x=clamp(f.x+f.facing*(Math.abs(dx)>(platform||target.y!==f.y?5:100)?2.5:0),stage);
   }
   if(!grounded(f,stage)||f.vy>0){const oldY=f.y;f.y+=f.vy;f.vy-=1;const floor=surfaceBelow(stage,f.x,oldY);if(f.vy<=0&&f.y<=floor){f.y=floor;f.vy=0;enter(f,'Idle');}else enter(f,f.vy>0?'Jump':'Fall');}
   if(target){
    if(Math.abs(target.x-f.x)<155&&Math.abs(target.y-f.y)<170&&s.frame>=(c.nextAction??0)){strike(s,f,c.owner,target,35,18,stage.floorHeight,'tree',stage.width);c.nextAction=s.frame+60;enter(f,'HeavyAttack');}else if(grounded(f,stage)&&s.frame>(c.nextAction??0)-42)enter(f,'Idle');
   }
   continue;
  }
  if(c.rider!==undefined&&!isActive(s.fighters[c.rider]))release(s,c,stage);
  const rider=c.rider===undefined?undefined:s.fighters[c.rider],input=rider?.previousInput??0;
  const dx=target?target.x-f.x:0;
  const horizontal=rider?((input&Button.Right?1:0)-(input&Button.Left?1:0)):target&&Math.abs(dx)>70?Math.sign(dx):0;
  if(horizontal)f.facing=horizontal<0?-1:1;
  const onGround=grounded(f,stage);if(onGround)f.airJumpsUsed=0;
  const rebounding=s.frame<(c.reboundUntil??0);
  const recovering=s.frame<(c.recoveryUntil??0);
  const jump=!rebounding&&!recovering&&(rider?!!((rider.buffer.at(-1)?.pressed??0)&Button.Up):!!target&&s.frame>=(c.nextAction??0));
  if(jump&&(onGround||f.airJumpsUsed<1)){if(!onGround)f.airJumpsUsed++;f.vy=24;f.y+=1;c.nextAction=s.frame+75;enter(f,'Jump');}
  const oldX=f.x,oldY=f.y;
  const airborne=!grounded(f,stage)||f.vy>0;
  if(airborne)f.x=clamp(f.x+(rebounding?f.vx:horizontal*(recovering?3:6))*JOPA.knightSpeed,stage);
  for(const b of s.structures??[])if(b.phase==='built'&&f.y<b.y+b.height&&f.y+270>b.y&&Math.abs(f.x-b.x)<b.width/2+65)f.x=oldX;
  if(!grounded(f,stage)||f.vy>0){f.y+=f.vy;f.vy-=1;const floor=surfaceBelow(stage,f.x,oldY);
   if(f.vy<=0&&f.y<=floor){
    f.y=floor;f.vy=0;enter(f,'Land');let hit=false;
    if(s.frame>=(c.landingHitReadyAt??0))for(const a of enemies)if(Math.abs(a.fighter.x-f.x)<140&&Math.abs(a.fighter.y-f.y)<170){strike(s,f,c.owner,a.fighter,JOPA.knightDamage,JOPA.knightStun,stage.floorHeight,'knight',stage.width);hit=true;}
    if(hit){impact?.(f,c.owner);c.impactAt=s.frame;c.reboundUntil=s.frame+30;c.recoveryUntil=s.frame+JOPA.knightRecovery;c.landingHitReadyAt=c.recoveryUntil;f.vx=-f.facing*5;f.vy=12;f.y+=1;enter(f,'Jump');}
   }
   else enter(f,f.vy>0?'Jump':'Fall');
  }else if(f.state!=='Land'||f.stateFrame>8)enter(f,'Idle');
  syncRider(s,c);
 }
 for(const p of s.projectiles){
  if(!p.active||!p.jopaKind)continue;
  const f=s.fighters[p.owner],oldX=p.x,oldY=p.y,r=p.jopaKind==='football'?22:25;
  if(p.jopaKind==='chess'){
   const floor=surfaceBelow(stage,p.x,p.y-r)+r;
   if(p.y<=floor&&s.frame>=(p.nextHop??0)){
    p.vy=10;p.nextHop=s.frame+20;
   }
   p.y+=p.vy??0;p.vy=(p.vy??0)-1;if(p.y<floor){if((p.vy??0)<0)recordGameplayEvent(s,'ObjectImpact',p.owner,p.move,undefined,{x:p.x});p.y=floor;p.vy=0;}
  }
  p.x+=p.vx;
  if(p.x<r||p.x>stage.width-r){if(p.jopaKind==='chess'){p.active=false;continue;}p.x=Math.max(r,Math.min(stage.width-r,p.x));p.vx=-p.vx;recordGameplayEvent(s,'ObjectImpact',p.owner,p.move,undefined,{x:p.x});}
  let contact:{time:number;target?:Fighter;friendly?:boolean;key:string;structure?:NonNullable<SimulationSnapshot['structures']>[number]}|undefined;
  for(const b of s.structures??[])if(b.phase==='built'){
   const time=Math.min(...structureSurfaces(b).map(box=>sweepEntry(box,oldX,oldY,p.x,p.y,r)));if(time<Infinity&&(!contact||time<contact.time))contact={time,key:'structure:'+b.id,structure:b};
  }
  for(const a of actors(s)){
   const friendly=!hostile(s,p.owner,a.fighter,a.owner);
   if(friendly?(p.jopaKind!=='football'||!isActive(a.fighter)||a.fighter.jopaTree!==undefined||a.fighter.jopaRide!==undefined):!canReceiveDirectHit(a.fighter,s.frame))continue;
   const key=a.clone?'clone:'+a.clone.id:'seat:'+a.owner;
   // -1 latches a football contact until separation. A real return hit can
   // happen sooner than twelve frames; continuous overlap is still one hit.
   if(p.nextHits?.[key]===-1){
    if(targetBoxes(a.fighter).some(b=>sweepEntry(b,oldX,oldY,oldX,oldY,r)<Infinity))continue;
    delete p.nextHits[key];
   }
   if((p.nextHits?.[key]??0)>s.frame)continue;
   const time=Math.min(...targetBoxes(a.fighter).map(b=>sweepEntry(b,oldX,oldY,p.x,p.y,r)));if(time<Infinity&&(!contact||time<contact.time))contact={time,target:a.fighter,key,friendly};
  }
  if(contact){
   if(contact.friendly||contact.structure)recordGameplayEvent(s,'ObjectImpact',p.owner,p.move,undefined,{x:p.x});
   if(contact.target&&!contact.friendly)strike(s,f,p.owner,contact.target,p.jopaKind==='football'?characters.jopa.moves.football.damage:80,p.jopaKind==='football'?12:JOPA.chessStun,stage.floorHeight,p.move,stage.width);
   if(contact.structure&&s.teams[contact.structure.owner]!==s.teams[p.owner]&&(p.nextHits?.[contact.key]??0)<=s.frame){damageStructure(s,contact.structure,p.jopaKind==='football'?characters.jopa.moves.football.damage:65,'jopa:'+p.owner+':'+p.serial,12,stage);}
   if(p.jopaKind==='chess')p.active=false;
   else {p.nextHits??={};p.nextHits[contact.key]=contact.structure?s.frame+12:-1;p.x=oldX+(p.x-oldX)*Math.max(0,contact.time-.02);p.vx=-p.vx;}
  }
 }
}
