import {skinName} from '../i18n/content.js';
import {th, t} from '../i18n/index.js';
import { homeCastPair } from "./HomeCast.js";
import { fighterSkins } from "../../../../packages/game-core/characters/skins.js";
import { fighterPresentation, escapeMarkup } from "./FighterPresentation.js";
import { characters } from "../../../../packages/game-core/characters/registry.js";

export type MenuMode = "local" | "online" | "training";
function menuModes() { return {
  local: { name: t("home.local.name"), title: t("home.local.title"), detail: t("home.local.detail"), count: t("home.local.count"), cta: t("home.local.cta") },
  online: { name: t("home.online.name"), title: t("home.online.title"), detail: t("home.online.detail"), count: t("home.online.count"), cta: t("home.online.cta") },
  training: { name: t("home.training.name"), title: t("home.training.title"), detail: t("home.training.detail"), count: t("home.training.count"), cta: t("home.training.cta") },
}; }
const art = (id: string, skin?: string) => escapeMarkup(fighterPresentation(id, skin).portrait);

export function homeScreen(): string {
  const modes=menuModes();
  return `<main class="ac-home">
    <div class="ac-home-atmosphere" aria-hidden="true"></div>
    <div class="ac-home-cast" aria-hidden="true">${homeCastPair(0).map((id, index) => { const p = fighterPresentation(id); return `<img class="cast-${index === 0 ? "left" : "right"}" data-fighter="${id}" style="scale:${p.homeScale ?? p.previewScale ?? 1};transform-origin:50% 0;transform:scaleX(${(index === 0) === (p.facing === "right") ? 1 : -1})" src="${art(id)}" alt="">`; }).join("")}</div>
    <section class="ac-title"><h1 class="ac-custom-wordmark"><img src="/art/abroz-combat-wordmark-v2.svg" alt="Abroz Combat"></h1><p>${th("home.tagline")}</p></section>
    <nav class="ac-direct-menu" aria-label="${th("home.nav")}">
      ${(Object.keys(modes) as MenuMode[]).map((id)=>`<button class="ac-menu-ticket ticket-${id}" data-action="${id}" aria-label="${modes[id].name}"><span class="ticket-content"><small>${modes[id].count}</small><strong>${modes[id].name}</strong><span>${th(`home.${id}.teaser`)}</span></span><b aria-hidden="true">↗</b></button>`).join("")}
      <button class="ac-menu-ticket ticket-roster" data-action="characters" aria-label="${th("nav.fighters")}"><span class="ticket-content"><small>${th("home.roster.count")}</small><strong>${th("nav.fighters")}</strong><span>${th("home.roster.teaser")}</span></span><b aria-hidden="true">↗</b></button>
    </nav>
  </main>`;
}

export function localGameScreen(): string {
  const cards = [
    {action:'local-versus',theme:'versus',count:t("local.versus.count"),title:t("local.versus.title"),detail:t("local.versus.detail"),cta:t("local.versus.cta")},
    {action:'local-ffa',theme:'ffa',count:t("local.ffa.count"),title:t("local.ffa.title"),detail:t("local.ffa.detail"),cta:t("local.ffa.cta")},
    {action:'local-2v2',theme:'teams',count:t("local.teams.count"),title:t("local.teams.title"),detail:t("local.teams.detail"),cta:t("local.teams.cta")},
    {action:'local-3v3',theme:'squads',count:t("local.squads.count"),title:t("local.squads.title"),detail:t("local.squads.detail"),cta:t("local.squads.cta")},
    {action:'championship',theme:'champion',count:t("local.champion.count"),title:t("local.champion.title"),detail:t("local.champion.detail"),cta:t("local.champion.cta")},
    {action:'elimination',theme:'elimination',count:t("local.elimination.count"),title:t("local.elimination.title"),detail:t("local.elimination.detail"),cta:t("local.elimination.cta")},
    {action:'elimination-party',theme:'party',count:t("local.party.count"),title:t("local.party.title"),detail:t("local.party.detail"),cta:t("local.party.cta")},
  ];
  return `<main class="local-game-page local-arcade"><nav class="local-game-types" aria-label="${th("local.nav")}">${cards.map(c=>`<button data-action="${c.action}" class="local-game-card mode-${c.theme}"><span class="mode-art" aria-hidden="true"><img class="mode-scene" src="/art/modes/${c.theme}-${['versus','ffa','squads','party'].includes(c.theme) ? 'v2' : 'v1'}.png" alt=""></span><span class="mode-card-copy"><small>${c.count}</small><strong>${c.title}</strong><span class="mode-description">${c.detail}</span><b class="mode-cta">${c.cta}<i aria-hidden="true">→</i></b></span></button>`).join('')}</nav><footer class="local-arcade-footer"><button class="text-button" data-action="home">← ${th("nav.menu")}</button><span>ABROZ COMBAT <b>/</b> ${th("local.footer")}</span></footer></main>`;
}

export function selectionScreen(mode: MenuMode, selected: readonly string[], selectSeat: number, roster: boolean, archiveId: string, skins: readonly string[] = [], archiveSkin?: string): string {
  const activeId = roster ? archiveId : selected[selectSeat];
  const active = characters[activeId];
  const opponentPreview = Object.keys(characters).find(id => id !== activeId) ?? activeId;
  const seats = roster ? [activeId, opponentPreview] : mode === "online" ? [selected[0], opponentPreview] : selected;
  const activeSeat = roster ? 0 : selectSeat;
  const side = (id: string, index: number) => {
    const c = characters[id];
    const skin = roster ? (index === 0 ? archiveSkin : undefined) : skins[index];
    const isUnknown = mode === "online" && index === 1 && !roster;
    const label = roster ? (index === 0 ? t("selection.focus") : t("selection.competition")) : mode === "online" ? (index === 0 ? t("selection.yours") : t("selection.rivals")) : mode === "training" ? (index === 0 ? t("selection.yours") : t("selection.dummy")) : t("selection.player",{player:index+1});
    const status = roster ? (index === 0 ? t("selection.preview") : t("selection.preview")) : isUnknown ? t("selection.room") : index === activeSeat ? t("selection.selecting") : (mode === "local" || mode === "training") && selectSeat === 1 && index === 0 ? t("selection.locked") : t("selection.next");
    const skinPicker = isUnknown || (roster && index !== 0) ? '' : `<label class="ac-skin-picker">${th("selection.skin")}<select id="fighter-skin-${index}" data-skin-seat="${index}" aria-label="${th("selection.skinLabel",{player:label})}" ${fighterSkins(c).length === 1 ? 'disabled' : ''}>${fighterSkins(c).map((look,n)=>`<option value="${look.id}" ${look.id===skin||!skin&&n===0?'selected':''}>${escapeMarkup(skinName(c.id,look))}</option>`).join('')}</select></label>`;
    const mirror = fighterPresentation(id, skin).facing !== (index === 0 ? "right" : "left");
    return `<section class="ac-faceoff-side side-${index} ${index === activeSeat ? "is-selecting" : ""} ${isUnknown ? "is-unknown" : ""}" aria-label="${label}">
      <div class="ac-player-flag"><span>${label}</span><b>${status}</b>${!roster && !isUnknown && !(mode=== "training" && index===1)?`<small data-device-slot="${index}"></small>`:""}</div>
      <img class="ac-faceoff-art ${mirror ? "is-mirrored" : ""}" style="--portrait-inset:${(fighterPresentation(id, skin).previewInset ?? 0) * (index === 0 ? 1 : -1)}%;--portrait-scale:${fighterPresentation(id, skin).previewScale ?? 1};--portrait-offset-y:${fighterPresentation(id, skin).previewOffsetY ?? 0}%" src="${art(id, skin)}" alt="${isUnknown ? t("selection.silhouette") : c.displayName}">
      <div class="ac-fighter-identity"><h3>${isUnknown ? t("selection.whosNext") : c.displayName}</h3>${skinPicker}${(mode === "local" || mode === "training") && selectSeat === 1 && index === 0 && !roster ? `<button class="ac-edit-player" data-action="edit-player">${th("selection.change")}</button>` : ""}</div>
    </section>`;
  };
  return `<main class="ac-selection ac-selection-cinematic" aria-label="${th("selection.nav")}">
    <div class="ac-faceoff">${seats.map(side).join("")}<div class="ac-versus" aria-hidden="true"><span>VS</span><i></i></div></div>
    <section class="ac-selection-console">
      <div class="ac-roster" style="--roster-count:${Object.keys(characters).length + (roster ? 0 : 1)}"><span>${roster ? t("selection.explore") : mode === "local" ? t("selection.chooseSeat",{player:selectSeat+1}) : mode === "training" && selectSeat === 1 ? t("selection.chooseDummy") : t("selection.choose")}</span><div>${Object.values(characters).map(c=>`<button data-action="pick" data-id="${c.id}" aria-label="${th("selection.chooseName",{name:c.displayName})}" aria-pressed="${active.id===c.id}" class="ac-roster-fighter ${active.id===c.id ? "is-active" : ""} ${!roster && mode !== "online" && selectSeat === 1 && selected[0] === c.id ? "is-locked" : ""}"><img style="--thumbnail-scale:${fighterPresentation(c.id).rosterScale ?? fighterPresentation(c.id).thumbnailScale ?? 1};--thumbnail-position-x:${fighterPresentation(c.id).thumbnailPositionX ?? 50}%;--thumbnail-offset-x:${fighterPresentation(c.id).rosterOffsetX ?? 0}%;--thumbnail-offset-y:${fighterPresentation(c.id).rosterOffsetY ?? 0}%" src="${art(c.id)}" alt=""><b>${c.displayName}</b></button>`).join("")}${roster ? "" : `<button data-action="pick-random" aria-label="${th("selection.randomLabel")}" title="${th("selection.randomTitle")}" class="ac-roster-fighter ac-random-fighter"><span aria-hidden="true">?</span><b>${th("selection.random")}</b></button>`}</div></div>
      <div class="ac-selection-motto" aria-hidden="true">${th("selection.motto1")}<br>${th("selection.motto2")}<span></span></div><div class="ac-lock-panel"><button class="ac-cta" data-action="${roster ? "home" : "confirm-fighter"}"><span>${roster ? t("selection.back") : mode === "local" && selectSeat === 0 ? t("selection.lockSeat",{player:1}) : mode === "local" ? t("selection.lockSeat",{player:2}) : mode === "training" && selectSeat === 1 ? t("selection.lockDummy") : t("selection.lock")}</span></button></div>
    </section>
  </main>`;
}
