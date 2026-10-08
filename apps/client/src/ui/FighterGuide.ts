import {t, th, getLocale, formatNumber} from '../i18n/index.js';
import {skinName} from '../i18n/content.js';
import {guidesPtBR} from '../i18n/guides-pt-BR.js';
import {guidesEn, type FighterGuide} from '../i18n/guides-en.js';
import { characters } from '../../../../packages/game-core/characters/registry.js';
import { fighterSkins } from '../../../../packages/game-core/characters/skins.js';
import type { CharacterDefinition, MoveDefinition } from '../../../../packages/game-core/types.js';
import { fighterPresentation, escapeMarkup as esc } from './FighterPresentation.js';

type BasicAttackSet = NonNullable<CharacterDefinition['basicAttacks']>;
export const fighterGuides:Record<string,FighterGuide>=guidesEn;
export const controlLabel=(code:string)=>code.replace(/^Key|^Digit/,'').replace('ArrowLeft','←').replace('ArrowRight','→').replace('ArrowUp','↑').replace('ArrowDown','↓');
const seconds=(frames:number)=>`${formatNumber(Number((frames/60).toFixed(2)),getLocale())}s`;
function moveFacts(m:MoveDefinition):string[]{
 const facts:string[]=[];
 if(m.damage)facts.push(t(m.beam?.continuous?'guide.damageTick':'guide.baseDamage',{damage:m.damage}));
 if(m.channelHeal)facts.push(t('guide.heal',{seconds:seconds(m.channelHeal.interval)}));
 if(m.weaponFrames||m.auraFrames||m.armorFrames)facts.push(t('guide.duration',{seconds:seconds(m.weaponFrames??m.auraFrames??m.armorFrames!)}));
 if(m.beam?.continuous)facts.push(t('guide.every',{seconds:seconds(m.beam.interval)}));
 if(m.trapFrames||m.grappleFrames)facts.push(t('guide.holdDuration',{seconds:seconds(m.trapFrames??m.grappleFrames!)}));
 if(m.knockdown)facts.push(t('guide.knockdown'));
 if(m.level==='low')facts.push(t('guide.low'));
 if(m.meterCost)facts.push(m.meterCost===100?t('guide.fullEnergy'):t('guide.energy',{energy:m.meterCost}));
 return facts;
}
export function fighterGuideScreen(id:string,skin:string|undefined,bindings:readonly string[],player=0):string{
 const c=characters[id],p=fighterPresentation(id,skin);
 const g:FighterGuide=getLocale()==='pt-BR'?(guidesPtBR[id as keyof typeof guidesPtBR]??fighterGuides[id]):fighterGuides[id];
 const key=(n:number)=>`<kbd data-control-index="${n}" data-control-player="${player}">${esc(controlLabel(bindings[n]))}</kbd>`;
 const card=(moveId:string,input:string,label?:string)=>{const m=c.moves[moveId];return `<article class="fg-move"><div class="fg-move-heading"><div><span>${esc(label??'')}</span><h4>${esc(m.displayName??moveId)}</h4></div><div class="fg-input">${input}</div></div><p>${esc(g.moves[moveId])}</p><div class="fg-facts">${moveFacts(m).map(f=>`<span>${esc(f)}</span>`).join('')}</div></article>`;};
 const basics=(b:BasicAttackSet)=>`${b.chain.map((move,i)=>card(move,Array.from({length:i+1},()=>key(4)).join('<i>→</i>'),t('guide.combo',{index:i+1,count:b.chain.length}))).join('')}${card(b.heavy,`${(c.moves[b.heavy].beam?.holdButton||c.moves[b.heavy].holdInvisible||c.moves[b.heavy].chargeFrames)?t('guide.hold'):''}${key(5)}`,t('guide.basic2'))}${card(b.kick,key(6),t('guide.basic3'))}${card(b.crouch,`${key(3)}<i>+</i>${key(4)}`,t('guide.crouchAttack'))}${card(b.air,`${key(2)}<i>${th("guide.then")}</i>${key(4)}`,t('guide.airAttack'))}${b.doubleJumpHeavy?card(b.doubleJumpHeavy,`${key(2)}${key(2)}<i>${th("guide.then")}</i>${key(5)}`,t('guide.doubleJumpAttack')):''}`;
 const section=(anchor:string,num:string,title:string,body:string,note='')=>`<section id="fg-${anchor}" class="fg-section"><div class="fg-section-title"><span>${num}</span><h3>${title}</h3></div>${note?`<p class="fg-section-note">${note}</p>`:''}${body}</section>`;
 return `<main class="fighter-guide" style="--fighter-accent:${c.color}"><div class="fg-top"><div><span>${th("guide.eyebrow")}</span><h2>${th("guide.title")}</h2></div><nav class="fg-roster" aria-label="${th("guide.nav")}">${Object.values(characters).map(f=>`<button data-action="pick" data-id="${f.id}" aria-label="${th("selection.chooseName",{name:f.displayName})}" aria-pressed="${f.id===id}"><span class="fg-roster-art" style="--guide-thumbnail-scale:${fighterPresentation(f.id).guideThumbnailScale??1}"><img src="${esc(fighterPresentation(f.id).portrait)}" alt=""></span><b>${f.displayName}</b></button>`).join('')}</nav></div><div class="fg-layout"><aside class="fg-profile"><div class="fg-portrait" style="--guide-art-scale:${p.guideScale??1}"><img src="${esc(p.portrait)}" alt="${c.displayName}"></div><div class="fg-profile-copy"><span>${g.role}</span><h1>${c.displayName}</h1><div class="fg-stats"><span>${esc(getLocale()==='pt-BR'?c.description.split('·').at(-1)!.trim().replace('.',','):c.description.split('·').at(-1)!.trim())}</span><span>${th('guide.health',{health:c.stats.maxHealth})}</span><span>${th('guide.skins',{count:fighterSkins(c).length})}</span></div><label class="fg-skin">${th("guide.look")} <select id="fighter-skin" aria-label="${th("guide.skinLabel")}">${fighterSkins(c).map((s,i)=>`<option value="${s.id}" ${s.id===skin||!skin&&i===0?'selected':''}>${esc(skinName(c.id,s))}</option>`).join('')}</select></label><button class="fg-practice" data-action="practice-fighter">${th('guide.practice',{name:c.displayName})}<b>↗</b></button></div></aside><div class="fg-manual"><div class="fg-toolbar"><nav aria-label="${th("guide.sections")}"><a href="#fg-playstyle">${th("guide.overview")}</a><a href="#fg-movement">${th("guide.movement")}</a><a href="#fg-basics">${th("guide.basics")}</a><a href="#fg-specials">${th("guide.specials")}</a><a href="#fg-supers">${th("guide.ultimates")}</a>${c.weaponAttacks?'<a href="#fg-form">'+(id==='fausto'?'Samurai':id==='dodo'?'Guitar Star':id==='gut'?'Spear':id==='eide'?'Mutant':'White Buda')+'</a>':''}</nav><label>${th("guide.controls")} <select id="guide-controls" aria-label="${th("guide.controlsLabel")}"><option value="0" ${player===0?'selected':''}>${th("common.player",{player:1})}</option><option value="1" ${player===1?'selected':''}>${th("common.player",{player:2})}</option></select></label></div><div class="fg-scroll" tabindex="0" aria-label="${th('guide.label',{name:c.displayName})}">
 ${section('playstyle','01',t('guide.plan'),`<p class="fg-tip">${g.tip}</p><div class="fg-traits">${g.traits.map((t,i)=>`<article><b>0${i+1}</b><p>${t}</p></article>`).join('')}</div>`)}
 ${section('movement','02',t('guide.movementTitle'),`<div class="fg-movement-grid">${[
 [t('guide.walk'),`${key(0)} / ${key(1)}`,t('guide.walkHelp')],
 [id==='caio'?t('guide.tripleJump'):t('guide.jump'),`${key(2)}<i>${th("guide.then")}</i>${key(2)}${id==='caio'?`<i>${th("guide.then")}</i>`+key(2):''}`,id==='caio'?t('guide.tripleJumpHelp'):t('guide.jumpHelp')],
 [t('guide.dash'),`${key(0)}${key(0)} / ${key(1)}${key(1)}`,t('guide.dashHelp')],
 [t('guide.drop'),`${key(3)}${key(3)}`,t('guide.dropHelp')],
 [t('guide.crouch'),key(3),t('guide.crouchHelp')],
 [t('guide.guard'),t('guide.guardInput'),t('guide.guardHelp')]
 ].map(([name,input,description])=>`<article><h4>${name}</h4><div class="fg-input">${input}</div><p>${description}</p></article>`).join('')}</div>`,t('guide.movementNote'))}
 ${section('basics','03',t('guide.basicTitle'),`<div class="fg-moves">${basics(c.basicAttacks!)}</div>`,t('guide.basicNote'))}
 ${section('specials','04',t('guide.specialTitle'),`<div class="fg-moves">${c.specialButtons.map((m,i)=>card(m,`${(c.moves[m].channelHeal||c.moves[m].talking||m==='coolMuscles')?t('guide.hold'):''}${key(7+i)}`,t('guide.special',{index:i+1}))).join('')}</div>`,c.specialButtons.some(id=>c.moves[id].talking)?t('guide.astolfoCost'):id==='napa'?t('guide.napaCost'):id==='jomp'?t('guide.jompCost'):t('guide.specialCost'))}
 ${section('supers','05',t('guide.ultimateTitle'),`<div class="fg-moves">${c.superButtons.map((m,i)=>card(m,key(9+i),t('guide.ultimate',{index:i+1}))).join('')}${id==='napa'?['bossBarrage','bossCookie','bossSlam','bossChomp'].map(m=>card(m,t('guide.automatic'),'COOKIE MONSTER')).join(''):''}${id==='dodo'?['pkJab','pkCross','pkFinish','ball'].map(m=>card(m,t('guide.automatic'),'PAIN KILLERS')).join(''):''}${id==='luizinho'?card('build',key(10),t('guide.reactivate'))+card('cannon',t('guide.automatic'),t('guide.turretShot')):''}</div>`,t('guide.ultimateNote'))}
 ${c.weaponAttacks?section('form','06',id==='fausto'?t('guide.samuraiTitle'):id==='dodo'?t('guide.guitarTitle'):id==='roms'?t('guide.jugglingTitle'):id==='gut'?t('guide.spearTitle'):id==='eide'?t('guide.mutantTitle'):t('guide.budaTitle'),`<div class="fg-moves">${id==='dodo'?card('starWave',t('guide.holdBasic')):id==='eide'?['giantPunch','charge','flyingKick'].map((m,i)=>card(m,key(4+i),t('guide.basic',{index:i+1}))).join(''):basics(c.weaponAttacks)}${c.weaponExpiryMove?card(c.weaponExpiryMove,t('guide.automatic'),id==='roms'?t('guide.jugglingEnd'):t('guide.spearEnd')):''}</div>`,id==='fausto'?t('guide.samuraiNote'):id==='dodo'?t('guide.guitarNote'):id==='roms'?t('guide.jugglingNote'):id==='gut'?t('guide.spearNote'):id==='eide'?t('guide.mutantNote'):t('guide.budaNote')):''}
 ${c.financeMoves?section('form','06',t('guide.bielTitle'),`<div class="fg-moves">${card(c.financeMoves.stamp,t('guide.anyBasic'),t('guide.loanMode'))}${card(c.financeMoves.feathers,key(4),t('guide.bielBasic',{index:1}))}${card(c.financeMoves.dive,key(5),t('guide.bielBasic',{index:2}))}${card(c.financeMoves.beam,t('guide.hold')+key(6),t('guide.bielBasic',{index:3}))}</div>`,t('guide.bielNote')):''}
 ${c.moves.placeBox?section('boxes','06',t('guide.beeTitle'),`<div class="fg-moves">${card('placeBox',t('guide.anyBasic'),t('guide.beeActive'))}</div>`):''}
 <p class="fg-footnote">${th("guide.footnote")}</p></div></div></div></main>`;
}
