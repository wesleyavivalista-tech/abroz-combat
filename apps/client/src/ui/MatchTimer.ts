import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {INVASION} from '../../../../packages/game-core/simulation/InvasionSystem.js';
/** The authoritative fight clock also drives invasion waves; never use wall time. */
export function matchTimer(s:Pick<SimulationSnapshot,'phase'|'phaseFrame'|'training'>){
 const frames=s.phase==='fight'?Math.max(0,s.phaseFrame):0;
 const seconds=Math.floor(frames/60);
 return {text:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,danger:!s.training&&s.phase==='fight'&&frames>=INVASION.startFrames,hidden:s.phase==='result'};
}
