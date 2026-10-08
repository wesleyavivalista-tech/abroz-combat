import {th} from '../i18n/index.js';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {TOURNAMENT_BREAK_FRAMES} from '../../../../packages/game-core/simulation/TournamentSystem.js';
export function tournamentStandings(s:SimulationSnapshot):string{
 const t=s.tournament;if(!t)return '';
 return `<div class="tournament-standings">${t.wins.map((wins,i)=>`<span class="${t.withdrawn.includes(i)?'withdrawn':''}">P${i+1} ${characters[s.fighters[i].characterId].displayName} <b>${wins} / 3</b>${t.withdrawn.includes(i)?th('tournament.left'):''}</span>`).join('')}</div>`;
}
export function tournamentPanel(s:SimulationSnapshot,confirmed:boolean):string{
 const t=s.tournament;if(!t||t.complete)return '';
 const between=s.phase==='result';
 return `<aside class="tournament-panel ${between?'between-matches':''}" aria-label="${th('tournament.nav')}"><strong>${th('tournament.heading',{round:t.round})}</strong>${between?`<h2>${confirmed?(s.winner<0?th('tournament.draw'):th('tournament.wins',{player:s.winner+1})):th('tournament.confirm')}</h2><p>${th('tournament.next',{seconds:Math.max(0,Math.ceil((TOURNAMENT_BREAK_FRAMES-s.phaseFrame)/60))})}</p>`:''}${tournamentStandings(s)}</aside>`;
}
