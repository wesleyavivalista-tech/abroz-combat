import type {Fighter,SimulationSnapshot} from '../types.js';
import {characters} from '../characters/registry.js';
export const deadlineReached=(frame:number,deadline:number):boolean=>deadline>0&&frame>=deadline;
export const frameCrossed=(previous:number,current:number,threshold:number):boolean=>previous<threshold&&current>=threshold;
export function advanceAbilityTimers(s:SimulationSnapshot):void{
 for(const f of s.fighters){
  if(!f.move && f.actionUntil)f.actionUntil=0;
  if(deadlineReached(s.frame,f.modeFinaleUntil??0))f.modeFinaleUntil=0;
  if(deadlineReached(s.frame,f.actionUntil??0)){
   const m=f.move?characters[f.characterId].moves[f.move]:undefined;
   if(m?.durationClock==='simulation')f.moveFrame=m.startupFrames+m.activeFrames;
   f.actionUntil=0;
  }
 }
}
export function activateTimedMove(f:Fighter,frame:number,m:import('../types.js').MoveDefinition):void{
 if(m.durationClock==='simulation')f.actionUntil=frame+m.activeFrames;
}
