import {clearCombatEntities} from './CombatLifecycle.js';
import type {SimulationSnapshot} from '../types.js';
export const TOURNAMENT_WINS=3;
export const TOURNAMENT_BREAK_FRAMES=480;
/** Tournament state is part of rollback snapshots; the input clock never resets. */
export function advanceTournament(s:SimulationSnapshot,forfeits:number[],reset:()=>void):void{
 const t=s.tournament;if(!t||t.complete)return;
 for(const seat of forfeits)if(s.fighters[seat]&&!t.withdrawn.includes(seat))t.withdrawn.push(seat);
 t.withdrawn.sort((a,b)=>a-b);
 const remaining=s.fighters.map((_,i)=>i).filter(i=>!t.withdrawn.includes(i));
 if(remaining.length<2){clearCombatEntities(s);t.complete=true;t.byForfeit=true;t.champion=remaining[0]??-1;s.winner=t.champion;s.phase='result';s.phaseFrame=0;s.endedAt=s.frame;return;}
 if(s.phase==='result'&&s.phaseFrame>=TOURNAMENT_BREAK_FRAMES){
  reset();t.round++;s.winner=-1;s.endedAt=0;s.phase='intro';s.phaseFrame=0;
  for(const seat of t.withdrawn){const f=s.fighters[seat];f.lives=0;f.health=0;f.state='KO';}
 }
}
export function scoreTournament(s:SimulationSnapshot):void{
 const t=s.tournament;if(!t||t.complete||s.phase!=='result'||t.scoredRound===t.round)return;
 t.scoredRound=t.round;
 if(s.winner>=0){t.wins[s.winner]++;if(t.wins[s.winner]>=TOURNAMENT_WINS){t.complete=true;t.champion=s.winner;}}
}
