import {onlineText} from './OnlineLobby.js';
import {th} from '../i18n/index.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import type {Championship} from '../../../../packages/game-core/tournament/Championship.js';
import {escapeMarkup as esc,fighterPresentation} from './FighterPresentation.js';
/** Separate from ordinary victory portraits; filenames are stable across skins. */
export const championshipArtwork:Readonly<Record<string,string>>=Object.fromEntries(['astolfo','biel','bozo','caio','dodo','drupa','eide','fausto','gut','jomp','jopa','luizinho','napa','nikalz','roms','tocha'].map(id=>[id,`/art/championship/${id}.jpg`]));
export function championshipSummary(b:Championship){
 const winner=b.complete?b.entrants.find(e=>e.id===b.champion):undefined;
 const final=b.rounds.at(-1)?.[0],opponent=winner?b.entrants.find(e=>e.id!==winner.id&&final?.slots.includes(e.id)):undefined;
 const victories=winner?b.rounds.flat().filter(m=>m.status==='complete'&&m.winner===winner.id):[];
 return {winner,opponent,participants:b.entrants.length,wins:victories.filter(m=>m.reason==='played').length,byes:victories.filter(m=>m.reason==='bye').length,forfeits:victories.filter(m=>m.reason==='forfeit').length};
}
const preloaded=new Set<string>();
export function preloadChampionshipArtwork(b:Championship):void{
 const ids=b.complete?[b.champion]:b.rounds.at(-1)?.[0]?.slots??[];
 for(const id of ids){const entrant=b.entrants.find(e=>e.id===id),url=entrant&&championshipArtwork[entrant.character];if(url&&!preloaded.has(url)){preloaded.add(url);const image=new Image();image.src=url;}}
}
export function championshipVictory(b:Championship,online:boolean):string{
 const {winner,opponent,participants,wins,byes,forfeits}=championshipSummary(b);
 if(!b.complete||!winner)return '';
 const fallback=fighterPresentation(winner.character,winner.skin).portrait,art=championshipArtwork[winner.character];
 return `<main class="championship-victory ${art?'':'art-fallback'}"><img class="champion-art" src="${art??fallback}" data-fallback="${fallback}" alt="" decoding="async"><div class="champion-shade"></div><div class="champion-sparks" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--n:${i}"></i>`).join('')}</div><section class="champion-panel" aria-labelledby="champion-title"><span class="champion-kicker">ABROZ COMBAT / ${th('local.champion.title')}</span><div class="champion-rule"></div><h1 id="champion-title">${th('champion.title')}</h1><h2>${characters[winner.character].displayName}</h2><p class="champion-player">${esc(winner.name)}</p><div class="champion-results"><div><span>${th('champion.participants')}</span><strong>${participants}</strong></div><div><span>${th('champion.wins')}</span><strong>${wins}</strong></div><div class="champion-opponent"><span>${th('champion.opponent')}</span><strong>${opponent?characters[opponent.character].displayName:'—'}</strong>${opponent?`<small>${esc(opponent.name)}</small>`:''}</div></div>${byes||forfeits?`<p class="champion-advances">${th('champion.advances',{byes,forfeits})}</p>`:''}<div class="champion-actions"><button class="primary" data-action="champion-bracket" data-champion-default>${th('champion.bracket')} <span aria-hidden="true">↗</span></button>${online?`<button data-action="online-continue">${onlineText('Continue in Room','Continuar na sala')}</button>`:`<button data-action="champion-again">${th('champion.again')}</button>`}<button data-action="home">${th('nav.menu')}</button></div>${online?`<p class="champion-online-note">${th('champion.onlineAgain')}</p>`:''}</section></main>`;
}
/** Failed artwork never blocks navigation or leaves a broken-image icon. */
export function bindChampionshipArtwork(root:HTMLElement):void{
 const image=root.querySelector<HTMLImageElement>('.champion-art');if(!image)return;
 const fallback=()=>{root.querySelector('.championship-victory')?.classList.add('art-fallback');if(image.dataset.fallback){const url=image.dataset.fallback;delete image.dataset.fallback;image.src=url;}else image.hidden=true;};
 image.addEventListener('error',fallback);if(image.complete&&!image.naturalWidth)fallback();
}
