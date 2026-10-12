import {healTo} from './MatchStatistics.js';
import {hasExecutionArmor} from '../combat/ExecutionArmor.js';
import {hostile} from './Actors.js';
import {deterministicHypot} from './DeterministicMath.js';
import {Button,type Fighter,type HairClone,type MoveDefinition,type SimulationSnapshot,type StageDefinition} from '../types.js';
import {characters} from '../characters/registry.js';
import {createFighter} from './Fighter.js';
import {actors} from './Actors.js';
import {retainsOwnedEntities,isActive,isInvulnerable} from './LifeSystem.js';
import {grounded,surfaceBelow} from './StageCollision.js';
import {enter,locked} from './StateMachine.js';
import {initializeProjectile} from './ProjectilePool.js';
import {isLowProfile} from './DodoSystem.js';
export const NAPA={summonFrames:180,snotFrames:5100,slow:.3,poisonFrames:300,poisonDamage:10,monsterHealth:.6,monsterBonusHealth:300,snotWidth:720,snotHeight:56,heal:.05};
/** Derived from active casters, so attack blocking ends immediately with the effect. */
export function sniffSuppresses(s:SimulationSnapshot,d:Fighter):boolean {
 if(!isActive(d)||hasExecutionArmor(d)||isInvulnerable(d,s.frame)||isLowProfile(d,s.frame)||d.grappleUntil>s.frame)return false;
 const all=actors(s),target=all.find(a=>a.fighter===d);
 return !!target&&all.some(a=>{
  const f=a.fighter,m=f.move?characters[f.characterId].moves[f.move]:undefined;
  return isActive(f)&&!!m?.suction&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames&&hostile(s,a.owner,d,target.owner)&&deterministicHypot(d.x-f.x,d.y-f.y)<=m.suction.range;
 });
}
export function monsterSpawnX(f:Fighter,stage:StageDefinition):number{return Math.max(80,Math.min(stage.width-80,f.x+f.facing*150));}
export function activateNapa(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 if(m.summonCookieMonster&&!s.clones.some(c=>c.owner===owner&&c.kind==='cookie-monster')){
  const boss=createFighter(f.characterId,monsterSpawnX(f,stage),f.facing);
  boss.y=surfaceBelow(stage,boss.x,f.y);boss.cookieBoss=true;boss.health=Math.floor(characters[f.characterId].stats.maxHealth*NAPA.monsterHealth)+NAPA.monsterBonusHealth;boss.lives=1;boss.meter=0;boss.state='Idle';
  s.clones.push({id:s.nextCloneId++,owner,fighter:boss,kind:'cookie-monster',maxHealth:boss.health,nextAction:s.frame+45,pattern:0});
 }
 if(m.snotFrames){const width=Math.min(NAPA.snotWidth,stage.width),x=Math.max(width/2,Math.min(stage.width-width/2,f.x+f.facing*200));s.hazards.push({kind:'snot',createdAt:s.frame,owner,x,y:surfaceBelow(stage,x,f.y),width,height:NAPA.snotHeight,expiresAt:s.frame+m.snotFrames,move:m.id,nextTicks:[]});}
 if(f.cookieBoss&&m.id==='bossBarrage'){
  const clone=s.clones.find(c=>c.fighter===f);
  for(const [vx,vy,bounces] of [[-7,0,0],[7,0,0],[-6,7,1],[6,7,1],[f.facing*8,-3,2]]){
   const slot=s.projectiles.find(p=>!p.active);if(!slot)break;
   initializeProjectile(slot,{active:true,owner,companionId:clone?.id,x:f.x+Math.sign(vx)*75,y:f.y+160,vx,vy,gravity:bounces?.3:0,bounces,life:180,move:'bossCookie',serial:f.attackSerial});
  }
 }
}
/** All area effects and AI deadlines live in snapshots, so rollback cannot leave timers behind. */
export function advanceNapa(s:SimulationSnapshot,stage:StageDefinition):void{
 s.hazards=s.hazards.filter(h=>h.expiresAt>s.frame);
 for(const h of s.hazards){
  if(h.kind==='snot')for(const a of actors(s))if(hostile(s,h.owner,a.fighter,a.owner)&&isActive(a.fighter)&&!isInvulnerable(a.fighter,s.frame)&&Math.abs(a.fighter.x-h.x)<(h.width??NAPA.snotWidth)/2+25&&Math.abs(a.fighter.y-h.y)<(h.height??NAPA.snotHeight))a.fighter.areaSlow=Math.min(a.fighter.areaSlow,NAPA.slow);
  if(h.kind==='cookie-drop'){
   // Seat order resolves simultaneous pickups identically on every client.
   const f=s.fighters.find(f=>isActive(f)&&Math.abs(f.x-h.x)<35&&Math.abs(f.y-h.y)<45);if(!f)continue;
   const max=characters[f.characterId].stats.maxHealth;
   if(s.teams[s.fighters.indexOf(f)]===s.teams[h.owner]&&Object.values(characters[f.characterId].moves).some(m=>m.summonCookieMonster))healTo(s,f,Math.min(max,f.health+Math.ceil(max*NAPA.heal)));
   else if(!isInvulnerable(f,s.frame)){f.poisonUntil=s.frame+NAPA.poisonFrames;f.poisonNextTick=s.frame+30;f.poisonDamage=NAPA.poisonDamage;f.poisonOwner=h.owner;f.poisonOwned=true;f.poisonNeutral=false;}
   h.expiresAt=s.frame;
  }
 }
 s.hazards=s.hazards.filter(h=>h.expiresAt>s.frame);
 for(const {fighter:d} of actors(s))if(sniffSuppresses(s,d)){
  d.buffer=[];
  if(d.move){d.move=null;d.actionUntil=0;d.chargeStartedAt=undefined;d.chargeButton=undefined;if(!locked(d))enter(d,grounded(d,stage)?'Idle':'Fall');}
 }
 // Suction runs in movement ticks, respecting hitstop and ending instantly on interruption.
 if(s.hitstop)return;
 for(const source of actors(s)){
  const f=source.fighter,m=f.move?characters[f.characterId].moves[f.move]:undefined;
  if(!isActive(f)||!m?.suction||f.moveFrame<m.startupFrames||f.moveFrame>=m.startupFrames+m.activeFrames)continue;
  for(const a of actors(s)){
   const d=a.fighter,dx=d.x-f.x,dy=d.y-f.y,distance=deterministicHypot(dx,dy);
   if(!hostile(s,source.owner,a.fighter,a.owner)||!isActive(d)||hasExecutionArmor(d)||isInvulnerable(d,s.frame)||isLowProfile(d,s.frame)||d.grappleUntil>s.frame||distance<=85||distance>m.suction.range)continue;
   const amount=Math.min(m.suction.strength,distance-85)/distance;
   const nextX=Math.max(40,Math.min(stage.width-40,d.x-dx*amount));
   const nextY=Math.max(surfaceBelow(stage,nextX,d.y),d.y-dy*amount);
   // Keep the whole swept body outside solid structures; platforms remain one-way.
   const blocked=(s.structures??[]).some(b=>b.phase==='built'&&Math.min(d.y,nextY)<b.y+b.height&&Math.max(d.y,nextY)+154>b.y&&Math.min(nextX,d.x)-31<b.x+b.width/2&&Math.max(nextX,d.x)+31>b.x-b.width/2);
   if(!blocked){d.x=nextX;d.y=nextY;if(dy<0)d.vy=Math.max(0,d.vy);}

  }
 }
}
export function cookieMonsterInput(s:SimulationSnapshot,c:HairClone,stage:StageDefinition):number{
 const f=c.fighter;if(f.move){c.nextAction=s.frame+45;return 0;}if(!isActive(f)||locked(f)||f.trappedUntil>s.frame||f.grappleUntil>s.frame||sniffSuppresses(s,f))return 0;
 const target=actors(s).filter(a=>hostile(s,c.owner,a.fighter,a.owner)&&isActive(a.fighter)&&!isLowProfile(a.fighter,s.frame)).sort((a,b)=>Math.abs(a.fighter.x-f.x)-Math.abs(b.fighter.x-f.x))[0]?.fighter;
 if(!target)return 0;
 const dx=target.x-f.x,dy=target.y-f.y;f.facing=dx<0?-1:1;
 if(s.frame>=(c.nextAction??0)&&grounded(f,stage)){
  const pattern=c.pattern??0,id=['bossBarrage','bossSlam','bossChomp'][pattern%3],m=characters[f.characterId].moves[id];
  const inRange=id==='bossBarrage'?Math.abs(dx)<1100&&Math.abs(dy)<180:Math.abs(dx)<145&&Math.abs(dy)<120;
  if(!inRange)return Math.abs(dx)>100?(dx>0?Button.Right:Button.Left):0;
  f.move=id;f.moveFrame=-1;f.stateFrame=0;f.attackSerial++;f.hitTargets=[];f.connected=false;f.projectileSpawned=false;f.speedRemainder=0;enter(f,m.state);
  c.pattern=(pattern+1)%3;c.nextAction=s.frame+m.startupFrames+m.activeFrames+m.recoveryFrames+45;return 0;
 }
 return Math.abs(dx)>115?(dx>0?Button.Right:Button.Left):0;
}
/** Call before pruning dead companions, exactly once per defeat. */
export function dropMonsterCookies(s:SimulationSnapshot,stage:StageDefinition):void{
 for(const c of s.clones){
  if(c.kind!=='cookie-monster'||c.fighter.health>0||!retainsOwnedEntities(s.fighters[c.owner])||c.pattern===-1)continue;
  c.pattern=-1;
  let seed=(Math.imul(c.id+1,1103515245)+s.frame)>>>0;
  for(let i=0;i<5;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const x=50+(i+(seed%1000)/1000)*(stage.width-100)/5;
   s.hazards.push({kind:'cookie-drop',createdAt:s.frame,owner:c.owner,x,y:stage.floorHeight,expiresAt:Number.MAX_SAFE_INTEGER,move:'cookieMonster',nextTicks:[]});
  }
  s.hazards.push({kind:'cookie-crumbs',createdAt:s.frame,owner:c.owner,x:c.fighter.x,y:c.fighter.y,expiresAt:s.frame+45,move:'cookieMonster',nextTicks:[]});
 }
}
