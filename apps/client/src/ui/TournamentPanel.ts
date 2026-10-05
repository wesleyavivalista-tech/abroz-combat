import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {TOURNAMENT_BREAK_FRAMES} from '../../../../packages/game-core/simulation/TournamentSystem.js';
export function tournamentStandings(s:SimulationSnapshot):string{
 const t=s.tournament;if(!t)return '';
 return `<div class="tournament-standings">${t.wins.map((wins,i)=>`<span class="${t.withdrawn.includes(i)?'withdrawn':''}">P${i+1} ${characters[s.fighters[i].characterId].displayName} <b>${wins} / 3</b>${t.withdrawn.includes(i)?' · LEFT':''}</span>`).join('')}</div>`;
}
export function tournamentPanel(s:SimulationSnapshot,confirmed:boolean):string{
 const t=s.tournament;if(!t||t.complete)return '';
 const between=s.phase==='result';
 return `<aside class="tournament-panel ${between?'between-matches':''}" aria-label="Free-for-all tournament"><strong>FREE-FOR-ALL TOURNAMENT · MATCH ${t.round} · FIRST TO 3 WINS</strong>${between?`<h2>${confirmed?(s.winner<0?'DRAW — NO WIN AWARDED':`P${s.winner+1} WINS THE MATCH`):'CONFIRMING MATCH RESULT…'}</h2><p>Next match in ${Math.max(0,Math.ceil((TOURNAMENT_BREAK_FRAMES-s.phaseFrame)/60))}s</p>`:''}${tournamentStandings(s)}</aside>`;
}
