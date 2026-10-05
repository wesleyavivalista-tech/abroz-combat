import type {Fighter,SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {JOMP} from '../../../../packages/game-core/simulation/JompSystem.js';
/** Presentation derives from synchronized state, including rollback and spectators. */
export function jompStatus(s:SimulationSnapshot,f:Fighter):string{
 if((f.gymStunnedUntil??0)>s.frame)return `STUNNED · ${Math.ceil((f.gymStunnedUntil!-s.frame)/60)}s`;
 if(!characters[f.characterId].muscleFighter)return '';
 if(f.move==='coolMuscles')return 'COOL MUSCLES · HOLD · −80% DAMAGE';
 if(f.move==='perfection'&&f.moveFrame<240)return `PUSH-UPS · ${Math.min(4,Math.floor(f.moveFrame/60)+1)}/4`;
 if(f.move==='gymBro'&&(f.gymTarget??-1)>=0){
  if(!f.gymStartedAt)return `GYM BRO · LOCKED P${f.gymTarget!+1}`;
  const rep=Math.min(8,Math.floor((s.frame-f.gymStartedAt)/JOMP.repFrames));
  return `${['BICEP CURL','BENCH PRESS','LEG PRESS'][Math.floor(rep/3)]} · ${rep%3+1}/3`;
 }
 return '';
}
