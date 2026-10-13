import {characters} from '../../../../packages/game-core/characters/registry.js';
import {fighterSkins,resolveSkin} from '../../../../packages/game-core/characters/skins.js';
import {fighterPresentation,escapeMarkup as esc} from './FighterPresentation.js';
import {skinName} from '../i18n/content.js';
import {getLocale} from '../i18n/index.js';
const text=(en:string,pt:string)=>getLocale()==='pt-BR'?pt:en;
export type SelectionAction='left'|'right'|'up'|'down'|'confirm'|'back'|'previous'|'next';
export type SelectionPhase='fighter'|'skin'|'ready';
export const playerColors=['#ff902e','#20bdff','#ff4949','#56dc70','#b794ff','#ff83c3','#ffd765','#50e1cc'];
/** Seat-local state: no DOM focus or shared cursor participates in selection. */
export class MultiplayerSelection {
 readonly phases:SelectionPhase[];
 readonly roster=[...Object.keys(characters),'random'];
 readonly cursors:string[];
 mouseSeat=0;
 constructor(readonly ids:string[],readonly skins:string[]){this.phases=ids.map(()=> 'fighter');this.cursors=[...ids];}
 get ready(){return this.phases.length>0&&this.phases.every(p=>p==='ready');}
 pick(seat:number,id:string){
  if(this.phases[seat]!=='fighter'||!this.roster.includes(id))return;
  this.cursors[seat]=id;if(id==='random')return;
  if(this.ids[seat]!==id){this.ids[seat]=id;this.skins[seat]=resolveSkin(characters[id]);}
 }
 handle(seat:number,action:SelectionAction,columns=8):boolean{
  const phase=this.phases[seat];if(!phase)return false;
  if(action==='back'){if(phase==='fighter')return false;this.phases[seat]=phase==='ready'?'skin':'fighter';return true;}
  if(action==='confirm'){if(phase==='ready')return false;if(phase==='fighter'&&this.cursors[seat]==='random')this.pick(seat,Object.keys(characters)[Math.floor(Math.random()*Object.keys(characters).length)]);this.phases[seat]=phase==='fighter'?'skin':'ready';return true;}
  if(phase==='ready')return false;
  const direction=action==='left'||action==='previous'||action==='up'?-1:1;
  if(phase==='skin'){
   const skins=fighterSkins(characters[this.ids[seat]]),index=skins.findIndex(s=>s.id===this.skins[seat]);
   this.skins[seat]=skins[(index+direction+skins.length)%skins.length].id;
  }else{
   const step=action==='up'||action==='down'?columns:1;
   this.pick(seat,this.roster[(this.roster.indexOf(this.cursors[seat])+direction*step+this.roster.length)%this.roster.length]);
  }
  return true;
 }
}
export function multiplayerSelection(model:MultiplayerSelection,title:string,teams?:number[],elimination=false):string{
 const count=model.ids.length;
 const color=(seat:number)=>teams?(teams[seat]===0?'#20bdff':'#ff4949'):playerColors[seat];
 return `<main class="ac-selection mp-selection" data-count="${count}" aria-label="${text('Multiplayer fighter selection','Seleção de lutadores multiplayer')}">
 <header class="mp-heading"><div><small>ABROZ COMBAT / ${esc(title)}</small><h2>${text('CHOOSE YOUR FIGHTER','ESCOLHA SEU LUTADOR')}</h2></div><button class="secondary" data-action="local">${text('Back','Voltar')}</button><button class="secondary" data-action="controllers">${text('Controllers','Controles')}</button></header>
 <div class="mp-previews" style="--players:${count}">${model.ids.map((id,i)=>{
  const p=fighterPresentation(id,model.skins[i]),phase=model.phases[i],skins=fighterSkins(characters[id]);
  return `<section class="mp-preview ${phase==='ready'?'is-ready':''} ${model.mouseSeat===i?'is-mouse-seat':''}" style="--player-color:${color(i)}" data-player-slot="${i}" data-selection-key="${id}:${esc(model.skins[i])}:${phase}:${model.mouseSeat===i}:${teams?.[i]??'solo'}">
   <button class="mp-player" data-mp-seat="${i}" aria-label="${text('Mouse controls player','Mouse controla jogador')} ${i+1}"><svg class="mp-pad-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h10c3 0 5 9 4 11s-3 0-5-2H8c-2 2-4 4-5 2S4 6 7 6Z" fill="currentColor"/><path d="M7 8v5M4.5 10.5h5" stroke="#071019" stroke-width="1.7"/><circle cx="16" cy="9" r="1" fill="#071019"/><circle cx="18" cy="12" r="1" fill="#071019"/></svg><strong>P${i+1}</strong><span>${teams?text('TEAM','TIME')+' '+(teams[i]===0?text('BLUE','AZUL'):text('RED','VERMELHO')):text('FIGHTER','LUTADOR')}</span><small data-device-slot="${i}"></small><small data-mp-keyboard="${i}"></small></button>
   <div class="mp-art"><img src="${esc(p.portrait)}" alt="${esc(characters[id].displayName)}" style="--portrait-scale:${p.previewScale??1};--portrait-offset-y:${p.previewOffsetY??0}%;transform:scaleX(${p.facing==='right'?1:-1})"></div>
   <div class="mp-identity"><h3>${esc(characters[id].displayName)}</h3>${phase!=='ready'?`<span class="mp-status">${phase==='skin'?text('02 / CHOOSE SKIN','02 / ESCOLHA O VISUAL'):text('01 / CHOOSE FIGHTER','01 / ESCOLHA O LUTADOR')}</span>`:''}
   ${phase==='skin'?`<div class="mp-skins">${skins.map(s=>`<button data-mp-skin="${esc(s.id)}" data-mp-player="${i}" aria-pressed="${s.id===model.skins[i]}">${esc(skinName(id,s))}</button>`).join('')}</div>`:`<p class="mp-skin-label"><span>SKIN</span><b>${esc(skinName(id,skins.find(s=>s.id===model.skins[i])??skins[0]))}</b></p>`}
   ${phase==='ready'?`<div class="mp-ready-banner"><span aria-hidden="true">✓</span><div><strong>${text('READY','PRONTO')}</strong><small>${text('FIGHTER CONFIRMED','LUTADOR CONFIRMADO')}</small></div></div>`:''}
   ${phase!=='fighter'?`<button class="mp-back" data-mp-back="${i}">${phase==='ready'?text('Change selection','Alterar seleção'):text('← Fighters','← Lutadores')}</button>`:''}
   ${teams&&phase==='fighter'?`<button class="mp-team" data-mp-team="${i}">${text('LB / RB · Switch team','LB / RB · Trocar time')}</button>`:''}</div></section>`;
 }).join('')}</div>
 <section class="ac-selection-console mp-console"><div class="ac-roster"><span>${text('SHARED ROSTER · EVERY PLAYER HAS THEIR OWN CURSOR','ELENCO COMPARTILHADO · CADA JOGADOR TEM SEU CURSOR')}</span><div>${model.roster.map(id=>{
 const seats=model.cursors.flatMap((chosen,i)=>chosen===id?[i]:[]);
 const markers=seats.map(i=>`<i style="--player-color:${color(i)}">P${i+1}${model.phases[i]==='ready'?' ✓':''}</i>`).join('');
 if(id==='random')return `<button class="ac-roster-fighter ac-random-fighter ${seats.length?'is-active':''}" data-mp-fighter="random" aria-label="${text('Random fighter','Lutador aleatório')}"><span aria-hidden="true">?</span><b>${text('RANDOM','ALEATÓRIO')}</b><span class="mp-cursors">${markers}</span></button>`;
 const p=fighterPresentation(id);
 return `<button class="ac-roster-fighter ${seats.length?'is-active':''}" data-mp-fighter="${id}" aria-label="${esc(characters[id].displayName)}${seats.map(i=>' P'+(i+1)).join('')}" style="--thumbnail-scale:${p.rosterScale??p.thumbnailScale??1};--thumbnail-position-x:${p.thumbnailPositionX??50}%;--thumbnail-offset-x:${p.rosterOffsetX??0}%;--thumbnail-offset-y:${p.rosterOffsetY??0}%"><img src="${esc(p.portrait)}" alt=""><b>${esc(characters[id].displayName)}</b><span class="mp-cursors">${seats.map(i=>`<i style="--player-color:${color(i)}">P${i+1}${model.phases[i]==='ready'?' ✓':''}</i>`).join('')}</span></button>`;
 }).join('')}</div></div></section>
 <footer class="mp-footer"><div class="mp-arena"></div><span class="mp-hints">${text('D-pad / stick: move · A: fighter → skin → ready · B: back / unlock','Direcional / analógico: mover · A: lutador → visual → pronto · B: voltar')}<br>${text('Mouse: choose a player above, then a fighter and skin. P1 Start / Enter: controllers, or start when all ready. P1 LB / RB when ready: arena.','Mouse: escolha um jogador acima, depois lutador e visual. P1 Start / Enter: controles ou iniciar com todos prontos. P1 LB / RB pronto: arena.')}</span><button class="primary" data-action="${elimination?'elimination-start':'local-match-start'}" ${model.ready?'':'disabled'}>${model.ready?text('START MATCH →','INICIAR PARTIDA →'):text('WAITING FOR PLAYERS','AGUARDANDO JOGADORES')} <small>${model.phases.filter(p=>p==='ready').length}/${count}</small></button></footer><p class="mp-error" id="${elimination?'elimination-setup-error':'local-match-error'}" role="status"></p></main>`;
}
