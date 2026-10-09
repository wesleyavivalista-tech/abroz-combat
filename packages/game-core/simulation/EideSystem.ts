import type {Fighter,HairClone,MoveDefinition,SimulationSnapshot,StageDefinition} from '../types.js';
import {createFighter} from './Fighter.js';
import {retainsOwnedEntities,isActive} from './LifeSystem.js';
import {initializeProjectile} from './ProjectilePool.js';
export const APPLIANCES=['Washing machine','Sofa','TV','Laptop','Refrigerator','Microwave','Office chair','Vacuum cleaner','Fan','Coffee machine'] as const;
export const EIDE={npcHealth:400,mutantFrames:1200,loveSpeed:1.4,loveDamage:1.5,loveDefense:.8,loveDash:3} as const;
export const inLove=(f:Fighter)=>!!f.loveMode&&!f.weaponUntil&&!f.loveNpc;
/** Per-fighter integer PRNG stored in snapshots; casting timing and seat seed it once. */
export function nextAppliance(f:Fighter,frame:number,owner:number):number{
 let x=f.applianceSeed??((Math.imul(frame+1,2654435761)^Math.imul(owner+1,1597334677))>>>0);
 x^=x<<13;x^=x>>>17;x^=x<<5;f.applianceSeed=x>>>0;return f.applianceSeed%APPLIANCES.length;
}
export function activateEide(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 if(m.eideAbility==='seller'||m.eideAbility==='bahia'){
  const variant=f.applianceVariant??nextAppliance(f,s.frame,owner),p=s.projectiles.find(p=>!p.active),arc=m.eideAbility==='bahia';
  if(p)initializeProjectile(p,{active:true,owner,x:f.x+f.facing*80,y:f.y+(arc?180:115),vx:f.facing*(arc?9:12),vy:arc?20:0,gravity:arc?.55:0,life:180,move:m.id,serial:f.attackSerial,variant});
  f.projectileSpawned=true;
 }
 if(m.eideAbility!=='love')return;
 s.clones=s.clones.filter(c=>c.owner!==owner||c.kind!=='blonde');
 const platforms=[...(stage.platforms??[])].sort((a,b)=>a.x-b.x);
 const authored=stage.eideLovePlatforms?.map(index=>stage.platforms?.[index]);
 const positions=authored?.every(p=>p!==undefined)?authored:platforms.length>=2?[platforms[0],platforms.at(-1)!]:[{x:stage.width*.2-60,y:stage.floorHeight,width:120},{x:stage.width*.8-60,y:stage.floorHeight,width:120}];
 for(let i=0;i<2;i++){
  const p=positions[i],direction=i===0?1:-1,fromX=i===0?24:stage.width-24;
  const targetX=p.x+p.width*(stage.eideLoveOffsets?.[i]??.5),edge=i===0?p.x:p.x+p.width;
  const npc=createFighter('eide',fromX,direction);
  Object.assign(npc,{y:stage.floorHeight,health:EIDE.npcHealth,lives:1,state:'WalkForward',loveNpc:true});
  if(p.motion)npc.npcPlatform=stage.eideLovePlatforms?.[i]??stage.platforms?.indexOf(p);
  npc.npcEntrance={fromX,takeoffX:p.y<=stage.floorHeight?targetX:Math.max(24,Math.min(stage.width-24,edge-direction*60)),landingX:p.y<=stage.floorHeight?targetX:edge+direction*Math.min(60,p.width/4),targetX,floorY:stage.floorHeight,targetY:p.y,elapsed:0,lastFrame:s.frame};
  s.clones.push({id:s.nextCloneId++,owner,fighter:npc,kind:'blonde',variant:i,maxHealth:EIDE.npcHealth});
 }
 f.loveMode=true;
}
export function keepEideNpc(c:HairClone,s:SimulationSnapshot):boolean{
 return c.kind==='blonde'&&retainsOwnedEntities(s.fighters[c.owner])&&(c.fighter.npcDefeatedAt===undefined||s.frame-c.fighter.npcDefeatedAt<36);
}
export function advanceEide(s:SimulationSnapshot,stage?:StageDefinition):void{
 for(const c of s.clones)if(c.kind==='blonde'){
  const f=c.fighter;f.vx=f.vy=0;f.move=null;f.buffer=[];
  if(f.health<=0){f.npcDefeatedAt??=s.frame;f.state='KO';f.stateFrame=s.frame-f.npcDefeatedAt;}
  else {
   const hit=f.npcHitAt!==undefined&&s.frame-f.npcHitAt<16,entry=f.npcEntrance;
   const platform=f.npcPlatform===undefined?undefined:stage?.platforms?.[f.npcPlatform];
   if(platform){
    // Intercept a moving deck over a fixed entrance, then ride its center.
    if(entry){
      const delta=Math.max(0,s.frame-entry.lastFrame);entry.lastFrame=s.frame;
      if(!hit&&!s.hitstop)entry.elapsed+=delta;
      const t=Math.min(1,entry.elapsed/120);
      f.x=entry.fromX+(platform.x+platform.width*(stage?.eideLoveOffsets?.[c.variant??0]??.5)-entry.fromX)*t;
      f.y=entry.floorY+(platform.y-entry.floorY)*t+1000*t*(1-t);
      f.state=t<.75?'Jump':'Fall';f.stateFrame=entry.elapsed;
      if(t===1){delete f.npcEntrance;f.state='Idle';}
    }else {f.x=platform.x+platform.width*(stage?.eideLoveOffsets?.[c.variant??0]??.5);f.y=platform.y;f.state='Idle';f.stateFrame=s.frame;}
   }else if(entry){
    // Called before and after combat: advance at most once per simulation frame.
    const delta=Math.max(0,s.frame-entry.lastFrame);entry.lastFrame=s.frame;
    if(!hit&&!s.hitstop)entry.elapsed+=delta;
    const speed=4,walkIn=Math.ceil(Math.abs(entry.takeoffX-entry.fromX)/speed),jump=entry.targetY>entry.floorY?48:0;
    const walkUp=Math.ceil(Math.abs(entry.targetX-entry.landingX)/speed),time=entry.elapsed;
    const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
    if(time<walkIn){f.x=mix(entry.fromX,entry.takeoffX,time/Math.max(1,walkIn));f.y=entry.floorY;f.state='WalkForward';}
    else if(time<walkIn+jump){const t=(time-walkIn)/jump;f.x=mix(entry.takeoffX,entry.landingX,t);f.y=mix(entry.floorY,entry.targetY,t)+960*t*(1-t);f.state=t<.75?'Jump':'Fall';}
    else if(time<walkIn+jump+walkUp){f.x=mix(entry.landingX,entry.targetX,(time-walkIn-jump)/Math.max(1,walkUp));f.y=entry.targetY;f.state='WalkForward';}
    else {f.x=entry.targetX;f.y=entry.targetY;f.state='Idle';delete f.npcEntrance;}
    f.stateFrame=time;
   }else {f.state='Idle';f.stateFrame=s.frame;}
   if(hit){f.state='HitStunStanding';f.stateFrame=s.frame-f.npcHitAt!;}
  }
 }
 for(let owner=0;owner<s.fighters.length;owner++)if(s.fighters[owner].loveMode&&!s.clones.some(c=>c.owner===owner&&c.kind==='blonde'&&isActive(c.fighter)))delete s.fighters[owner].loveMode;
}
