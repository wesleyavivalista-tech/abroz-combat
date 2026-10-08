import {hostile} from './Actors.js';
import {grounded} from './StageCollision.js';
import {deterministicHypot} from './DeterministicMath.js';
import {characters} from '../characters/registry.js';
import {Button,type Fighter,type HairClone,type SimulationSnapshot,type StageDefinition} from '../types.js';
import {actors} from './Actors.js';
import {isActive} from './LifeSystem.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {periodicHit} from '../combat/PeriodicHit.js';
export const MUSIC_RADIUS=260;
export const isLowProfile=(f:Fighter,frame:number)=>isActive(f)&&(f.invisibleUntil??0)>frame;
/** Music and invisibility use simulation time, including hit stop and rollback. */
export function advanceDodo(s:SimulationSnapshot,floorHeight:number,arenaWidth=2400):void{
 const contacts:{target:Fighter;owner:number;direction:number}[]=[];
 for(const [owner,f] of s.fighters.entries()){
  if(!characters[f.characterId].musicFighter)continue;
  if((f.invisibleUntil??0)<=s.frame)f.invisibleUntil=0;
  if((f.lowProfileNoticeUntil??0)<=s.frame)f.lowProfileNoticeUntil=0;
  if(!isActive(f)||f.weaponUntil<=s.frame){f.musicNextPulse=0;continue;}
  if(!f.musicNextPulse)f.musicNextPulse=s.frame;
  if(s.frame<f.musicNextPulse)continue;
  f.musicNextPulse=s.frame+30;
  for(const a of actors(s))if(hostile(s,owner,a.fighter,a.owner)&&canReceiveDirectHit(a.fighter,s.frame)&&deterministicHypot(a.fighter.x-f.x,a.fighter.y-f.y)<=MUSIC_RADIUS){
   contacts.push({target:a.fighter,owner,direction:Math.sign(a.fighter.x-f.x)||f.facing});
  }
 }
 for(const c of contacts)periodicHit(s,c.target,22,c.direction,6,10,undefined,floorHeight,{source:c.owner,move:'chord'},arenaWidth);
}
export function basketballInput(s:SimulationSnapshot,c:HairClone,stage:StageDefinition):number{
 const f=c.fighter;
 const t=actors(s).filter(a=>hostile(s,c.owner,a.fighter,a.owner)&&isActive(a.fighter)&&!isLowProfile(a.fighter,s.frame)).sort((a,b)=>Math.abs(a.fighter.x-f.x)+Math.abs(a.fighter.y-f.y)-Math.abs(b.fighter.x-f.x)-Math.abs(b.fighter.y-f.y))[0]?.fighter;
 if(!t)return 0;
 const dx=t.x-f.x,dy=t.y-f.y;
 let input=Math.abs(dx)>80?(dx>0?Button.Right:Button.Left):0;
 if(dy>60&&!(f.previousInput&Button.Up)&&(grounded(f,stage)||!f.airJumpUsed&&f.vy<8))input|=Button.Up;
 if(Math.abs(dx)<140&&Math.abs(dy)<110&&s.frame%8===c.id%8)input|=Button.Light|(dx>=0?Button.Right:Button.Left);
 else if(Math.abs(dx)>=140&&Math.abs(dx)<650&&Math.abs(dy)<90&&s.frame%100===(c.id*23)%100)input|=Button.Medium|(dx>=0?Button.Right:Button.Left);
 return input;
}
export function lowProfileMove(f:Fighter,frame:number):void{
 const m=f.move?characters[f.characterId].moves[f.move]:undefined;
 if(m?.invisibilityFrames){f.invisibleUntil=frame+m.invisibilityFrames;f.lowProfileNoticeUntil=frame+120;}
}
