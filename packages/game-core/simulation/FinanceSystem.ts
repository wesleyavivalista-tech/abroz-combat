import {hasHitReactionArmor} from '../combat/ExecutionArmor.js';
import {hostile} from './Actors.js';
import {characters} from '../characters/registry.js';
import {Button,type Fighter,type MoveDefinition,type SimulationSnapshot,type StageDefinition} from '../types.js';
import {actors} from './Actors.js';
import {isActive} from './LifeSystem.js';
import {enter,locked} from './StateMachine.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {applyDamage} from '../combat/DamageSystem.js';
import {bufferedButton} from '../input/InputBuffer.js';
import {initializeProjectile} from './ProjectilePool.js';
import {surfaceBelow} from './StageCollision.js';
import {gainEnergy} from './EnergySystem.js';
export const FINANCE={loanFrames:1800,stunFrames:120,angelFrames:1500,rainFrames:240,bagFlightFrames:36,rainWidth:320,rainInterval:12,billEnergy:15,billSlowFrames:120,billLifetime:600,flightSpeed:6,flightCeiling:650} as const;
export function flying(f:Fighter,frame:number){return (f.angelUntil??0)>frame;}
export function financeRequest(f:Fighter,frame:number):string|null|undefined{
 const moves=characters[f.characterId].financeMoves;if(!moves)return undefined;
 const pressed=(button:number)=>bufferedButton(f.buffer,frame,button);
 if(f.stampAttempts!==undefined){return f.stampAttempts>0&&[Button.Light,Button.Medium,Button.Heavy].some(pressed)?moves.stamp:null;}
 if(flying(f,frame))return pressed(Button.Heavy)?moves.beam:pressed(Button.Medium)?moves.dive:pressed(Button.Light)?moves.feathers:null;
 return undefined;
}
export function startFinanceMove(f:Fighter,m:MoveDefinition):void{if(m.loanStamp&&f.stampAttempts!==undefined)f.stampAttempts=Math.max(0,f.stampAttempts-1);}
export function activateFinance(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,owner:number,m:MoveDefinition):void{
 if(m.financeAbility==='stamp-mode')f.stampAttempts=5;
 if(m.financeAbility==='angel'){
  delete f.stampAttempts;f.angelUntil=s.frame+FINANCE.angelFrames;f.angelBurstAt=s.frame;f.y=Math.max(f.y,stage.floorHeight+180);f.vx=f.vy=0;
 }
 if(m.financeAbility==='coins'){
  // Hold left/right during the throw to choose nearby, middle or far coverage.
  const dir=(f.previousInput&Button.Right?1:0)-(f.previousInput&Button.Left?1:0);
  const x=Math.max(60,Math.min(stage.width-60,f.x+f.facing*(dir===-f.facing?100:dir===f.facing?480:280)));
  if(s.hazards.filter(h=>h.kind==='coin-rain'&&h.owner===owner).length<6)s.hazards.push({kind:'coin-rain',owner,launchX:f.x+f.facing*35,launchY:f.y+180,x,y:surfaceBelow(stage,x,f.y),width:FINANCE.rainWidth,height:600,createdAt:s.frame,expiresAt:s.frame+FINANCE.bagFlightFrames+FINANCE.rainFrames,move:m.id,nextTicks:[]});
 }
 if(m.financeAbility==='feathers')for(let i=0;i<5;i++){
  const p=s.projectiles.find(p=>!p.active);if(!p)break;
  initializeProjectile(p,{active:true,owner,x:f.x+f.facing*25,y:f.y+65,vx:f.facing*(i-1)*3,vy:-11-i,life:90,move:m.id,serial:f.attackSerial});
 }
}
export function applyLoan(s:SimulationSnapshot,f:Fighter):void{
 f.loanUntil=s.frame+FINANCE.loanFrames;stunLoan(s,f);
}
function stunLoan(s:SimulationSnapshot,f:Fighter):void{
 if(hasHitReactionArmor(f,s.frame))return;
 f.loanStunUntil=s.frame+FINANCE.stunFrames;f.stun=FINANCE.stunFrames;f.move=null;f.actionUntil=0;f.vx=f.vy=0;f.buffer=[];f.dazed=true;enter(f,'HitStunStanding');
}
/** Called only after an unblocked contact; one success consumes the whole stamp mode. */
export function financeHit(s:SimulationSnapshot,a:Fighter,d:Fighter,m:MoveDefinition):void{
 if(m.slowFrames)d.movementSlowUntil=s.frame+m.slowFrames;
 if(m.loanStamp&&a.stampAttempts!==undefined&&isActive(d)){
  applyLoan(s,d);delete a.stampAttempts;
  a.move=null;a.actionUntil=0;a.buffer=[];enter(a,'Idle');
 }
}
export function advanceFinance(s:SimulationSnapshot,stage:StageDefinition):void{
 for(const {fighter:f} of actors(s)){
  if(!isActive(f)){delete f.loanUntil;delete f.loanStunUntil;delete f.stampAttempts;delete f.angelUntil;delete f.movementSlowUntil;continue;}
  if(f.loanUntil&&s.frame>=f.loanUntil){delete f.loanUntil;stunLoan(s,f);}
  if(f.loanStunUntil){
   if(s.frame<f.loanStunUntil){f.move=null;f.actionUntil=0;f.vx=f.vy=0;f.stun=Math.max(f.timedHitReaction??0,f.loanStunUntil-s.frame+1);f.dazed=true;enter(f,'HitStunStanding');}
   else {delete f.loanStunUntil;f.stun=Math.max(f.timedHitReaction??0,(f.nikalzStunUntil??0)>s.frame?f.nikalzStunUntil!-s.frame+1:0);if(!f.nikalzStunUntil)delete f.timedHitReaction;if(!f.stun){f.dazed=false;enter(f,f.y>stage.floorHeight?'Fall':'Idle');}}
  }
  if(f.movementSlowUntil&&s.frame>=f.movementSlowUntil)delete f.movementSlowUntil;
  if(f.stampAttempts===0&&!f.move)delete f.stampAttempts;
  if(f.jopaRide!==undefined||f.jopaTree!==undefined){delete f.stampAttempts;delete f.angelUntil;}
  if(f.angelUntil&&s.frame>=f.angelUntil){
   delete f.angelUntil;f.angelBurstAt=s.frame;f.move=null;f.actionUntil=0;f.buffer=[];f.vx=f.vy=0;if(!f.stun)enter(f,'Fall');
   const owner=s.fighters.indexOf(f);if(owner<0)continue;
   for(let i=0;i<5;i++){
    // Fixed integer hash: deterministic under rollback, without a shared RNG stream.
    const seed=(Math.imul(s.frame+owner*7919+i*104729,1664525)+1013904223)>>>0;
    const x=60+seed%Math.max(1,Math.floor(stage.width-120));
    s.hazards.push({kind:'money-bill',owner,x,y:surfaceBelow(stage,x,stage.floorHeight+FINANCE.flightCeiling)+25,createdAt:s.frame,expiresAt:s.frame+FINANCE.billLifetime,move:'',nextTicks:[]});
   }
  }
 }
 for(const h of s.hazards){
  if(h.expiresAt<=s.frame)continue;
  if(h.kind==='coin-rain'){
   const rainAge=s.frame-(h.createdAt??0)-FINANCE.bagFlightFrames;
   if(rainAge<0||rainAge%FINANCE.rainInterval)continue;
   for(const {fighter:f,owner} of actors(s))if(hostile(s,h.owner,f,owner)&&canReceiveDirectHit(f,s.frame)&&Math.abs(f.x-h.x)<=FINANCE.rainWidth/2+25&&f.y+150>=h.y&&f.y<h.y+600){
    if(applyDamage(s,f,characters[s.fighters[h.owner].characterId].moves[h.move].damage,{owned:true,receivedHit:true,source:h.owner,move:h.move})>0)f.coinHitAt=s.frame;
   }
  }
  if(h.kind==='money-bill')for(let i=0;i<s.fighters.length;i++){
   const f=s.fighters[i];if(!isActive(f)||Math.abs(f.x-h.x)>40||h.y<f.y-15||h.y>f.y+170)continue;
   if(s.teams[i]===s.teams[h.owner])gainEnergy(f,FINANCE.billEnergy,s.frame,s);else f.movementSlowUntil=s.frame+FINANCE.billSlowFrames;
   h.expiresAt=s.frame;break;
  }
 }
 s.hazards=s.hazards.filter(h=>h.expiresAt>s.frame);
}
/** Return true to bypass gravity. Hit reactions remain airborne but cannot steer. */
export function controlFlight(s:SimulationSnapshot,stage:StageDefinition,f:Fighter,input:number,speed:number):boolean{
 if(!flying(f,s.frame))return false;
 const m=f.move?characters[f.characterId].moves[f.move]:undefined;
 // A channeled beam anchors the angel throughout startup, channel and recovery.
 if(!m?.beam?.holdButton&&!locked(f)&&f.grappleUntil<=s.frame&&f.trappedUntil<=s.frame){
  if(m?.financeAbility==='dive'&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames){
   f.y-=28;f.x+=f.facing*8;
   if(f.y<=stage.floorHeight+20){f.y=stage.floorHeight+20;f.moveFrame=m.startupFrames+m.activeFrames;}
  }else{
   f.x+=((input&Button.Right?1:0)-(input&Button.Left?1:0))*FINANCE.flightSpeed*speed;
   f.y+=((input&Button.Up?1:0)-(input&Button.Down?1:0))*FINANCE.flightSpeed*speed;
  }
 }
 f.x=Math.round(Math.max(40,Math.min(stage.width-40,f.x))*10)/10;
 f.y=Math.round(Math.max(stage.floorHeight+20,Math.min(stage.floorHeight+FINANCE.flightCeiling,f.y))*10)/10;
 f.vx=f.vy=0;return true;
}
