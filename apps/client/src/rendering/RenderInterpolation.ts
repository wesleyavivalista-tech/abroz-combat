import type {Fighter,SimulationSnapshot} from '../../../../packages/game-core/types.js';

import {characters} from '../../../../packages/game-core/characters/registry.js';
import {setDisplayTicks} from './AnimationPlayback.js';

const locomotionStates=new Set(['Idle','WalkForward','WalkBackward','Jump','Fall','DashForward','DashBackward']);
const attachedStates=new Set(['Grappled','Grappling','HairTrapped','GymBro','KO','Respawning']);
const meleeStates=new Set(['LightAttack','MediumAttack','HeavyAttack','CrouchingAttack','AirAttack']);
type Sample=Pick<Fighter,'characterId'|'x'|'y'|'state'|'move'|'attackSerial'|'health'|'lives'|'respawnAt'|'facing'|'jopaRide'|'jopaTree'|'lastStunHitFrame'|'stateFrame'|'moveFrame'|'weaponUntil'|'armorUntil'|'personality'|'bloodMasterUntil'|'angerUntil'|'angelUntil'|'loveMode'|'onFireUntil'|'beeBoxes'>;
const sample=(f:Fighter):Sample=>({characterId:f.characterId,x:f.x,y:f.y,state:f.state,move:f.move,attackSerial:f.attackSerial,health:f.health,lives:f.lives,respawnAt:f.respawnAt,facing:f.facing,jopaRide:f.jopaRide,jopaTree:f.jopaTree,lastStunHitFrame:f.lastStunHitFrame,stateFrame:f.stateFrame,moveFrame:f.moveFrame,weaponUntil:f.weaponUntil,armorUntil:f.armorUntil,personality:f.personality,bloodMasterUntil:f.bloodMasterUntil,angerUntil:f.angerUntil,angelUntil:f.angelUntil,loveMode:f.loveMode,onFireUntil:f.onFireUntil,beeBoxes:f.beeBoxes});
/** Presentation-only interpolation. Never pass the returned view back to simulation/networking. */
export class RenderInterpolation {
 private source:SimulationSnapshot|undefined;
 private frame=-1;
 private fighters:Sample[]=[];
 private clones=new Map<number,Sample>();
 private skins='';
 private phase='';
 private hitstop=0;
 private cosmeticTicks=0;
 private cosmeticAdvances=false;
 /** Commit one successful live tick, never rollback replay ticks or wall-clock time. */
 complete(s:SimulationSnapshot):void {
  this.cosmeticAdvances=s===this.source&&s.frame===this.frame+1&&s.phase==='fight'&&this.phase===s.phase&&s.hitstop===0&&this.hitstop===0;
  if(this.cosmeticAdvances)this.cosmeticTicks++;
 }
 /** Continuous effect clock: state changes do not restart breathing, auras or performance loops. */
 seconds(alpha=1):number {
  const t=Number.isFinite(alpha)?Math.max(0,Math.min(1,alpha)):1;
  return (this.cosmeticTicks-(this.cosmeticAdvances?1-t:0))/60;
 }
 reset():void{this.cosmeticAdvances=false;this.source=undefined;this.frame=-1;this.fighters=[];this.clones.clear();}
 /** Capture just before each fixed step, including catch-up steps. */
 capture(s:SimulationSnapshot):void{
  this.cosmeticAdvances=false;this.source=s;this.frame=s.frame;this.phase=s.phase;this.hitstop=s.hitstop;this.skins=s.skins.join('|');
  this.fighters=s.fighters.map(sample);this.clones.clear();
  for(const c of s.clones)this.clones.set(c.id,sample(c.fighter));
 }
 view(s:SimulationSnapshot,alpha:number,immediateSeat?:number):SimulationSnapshot{
  if(s!==this.source||s.frame!==this.frame+1||s.phase!=='fight'||this.phase!==s.phase||s.hitstop>0||this.hitstop>0||this.skins!==s.skins.join('|'))return s;
  const t=Number.isFinite(alpha)?Math.max(0,Math.min(1,alpha)):1;
  return {...s,fighters:s.fighters.map((f,i)=>this.project(f,this.fighters[i],t,i===immediateSeat)),clones:s.clones.map(c=>({...c,fighter:this.project(c.fighter,this.clones.get(c.id),t)}))};
 }
 private project(f:Fighter,p:Sample|undefined,t:number,immediatePosition=false):Fighter{
  // Only interpolate continuous motion. Discrete combat/mode events remain exact.
  const sameState=p?.state===f.state;
  const safeTransition=!!p&&!p.move&&!f.move&&locomotionStates.has(p.state)&&locomotionStates.has(f.state);
  const move=f.move?characters[f.characterId]?.moves[f.move]:undefined;
  // Keep the entire impact pose (including its intentional early/late hold) exact.
  const impact=(tick:number)=>!!move&&tick>=Math.max(0,move.startupFrames-2)&&tick<move.startupFrames+move.activeFrames+3;
  const fixedAttack=!!f.move&&(!move||!meleeStates.has(f.state)||impact(f.moveFrame)||impact(p?.moveFrame??f.moveFrame)||!!move.beam||!!move.dive||!!move.grappleFrames||!!move.periodicMelee);
  if(!p||attachedStates.has(f.state)||f.jopaRide!==undefined||f.jopaTree!==undefined||p.characterId!==f.characterId||p.lastStunHitFrame!==f.lastStunHitFrame||(!sameState&&!safeTransition)||p.move!==f.move||p.attackSerial!==f.attackSerial||p.health!==f.health||p.lives!==f.lives||p.respawnAt!==f.respawnAt||f.respawnAt||p.facing!==f.facing||p.weaponUntil!==f.weaponUntil||p.armorUntil!==f.armorUntil||p.personality!==f.personality||p.bloodMasterUntil!==f.bloodMasterUntil||p.angerUntil!==f.angerUntil||p.angelUntil!==f.angelUntil||p.loveMode!==f.loveMode||p.onFireUntil!==f.onFireUntil||p.beeBoxes!==f.beeBoxes||p.jopaRide!==f.jopaRide||p.jopaTree!==f.jopaTree||Math.abs(f.x-p.x)>64||Math.abs(f.y-p.y)>64)return f;
  const stateAdvances=sameState&&f.stateFrame===p.stateFrame+1;
  const moveAdvances=!fixedAttack&&sameState&&!!f.move&&f.moveFrame===p.moveFrame+1;
  if(p.x===f.x&&p.y===f.y&&!stateAdvances&&!moveAdvances)return f;
  // The locally controlled online fighter uses its latest predicted position.
  // Remote fighters and animation playback retain interpolation.
  const positionT=fixedAttack||immediatePosition?1:t;
  const display={...f,x:p.x+(f.x-p.x)*positionT,y:p.y+(f.y-p.y)*positionT};
  setDisplayTicks(display,{
   stateFrame:stateAdvances?p.stateFrame+t:f.stateFrame,
   moveFrame:moveAdvances?p.moveFrame+t:f.moveFrame,
  });
  return display;
 }
}
