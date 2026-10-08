import {t} from '../i18n/index.js';
import type {Fighter,SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {JOMP} from '../../../../packages/game-core/simulation/JompSystem.js';
/** Presentation derives from synchronized state, including rollback and spectators. */
export function jompStatus(s:SimulationSnapshot,f:Fighter):string{
 if((f.gymStunnedUntil??0)>s.frame)return t('jomp.stunned',{seconds:Math.ceil((f.gymStunnedUntil!-s.frame)/60)});
 if(!characters[f.characterId].muscleFighter)return '';
 if(f.move==='coolMuscles')return t('jomp.cool');
 if(f.move==='perfection'&&f.moveFrame<240)return t('jomp.pushUps',{count:Math.min(4,Math.floor(f.moveFrame/60)+1)});
 if(f.move==='gymBro'&&(f.gymTarget??-1)>=0){
  if(!f.gymStartedAt)return t('jomp.locked',{player:f.gymTarget!+1});
  const rep=Math.min(8,Math.floor((s.frame-f.gymStartedAt)/JOMP.repFrames));
  return `${t((['jomp.curl','jomp.bench','jomp.leg'] as const)[Math.floor(rep/3)])} · ${rep%3+1}/3`;
 }
 return '';
}
