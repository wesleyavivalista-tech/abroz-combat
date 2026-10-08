import {COUNTDOWN_BEAT_FRAMES,FIGHT_BANNER_FRAMES} from '../../../../packages/game-core/simulation/MatchIntro.js';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';

/** Use the same beats as the protected simulation intro. */
export function matchCountdown(s:Pick<SimulationSnapshot,'phase'|'phaseFrame'|'training'>):string {
  if(s.training)return '';
  if(s.phase==='intro')return String(3-Math.min(2,Math.floor(s.phaseFrame/COUNTDOWN_BEAT_FRAMES)));
  return s.phase==='fight'&&s.phaseFrame<FIGHT_BANNER_FRAMES?'FIGHT!':'';
}
