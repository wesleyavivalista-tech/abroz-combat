import { homeCastPair } from "./HomeCast.js";
import { fighterSkins } from "../../../../packages/game-core/characters/skins.js";
import { fighterPresentation, escapeMarkup } from "./FighterPresentation.js";
import { characters } from "../../../../packages/game-core/characters/registry.js";

export type MenuMode = "local" | "online" | "training";
const modes: Record<MenuMode, { name: string; title: string; detail: string; count: string; cta: string }> = {
  local: { name: "LOCAL", title: "Settle it on the rooftop.", detail: "Two players. One screen. Pick your fighters and go head to head.", count: "2–16 PLAYERS / SAME DEVICE", cta: "CHOOSE FIGHTERS" },
  online: { name: "ONLINE", title: "Bring the whole crew.", detail: "Create a versus room for up to eight fighters or a 1v1 championship for up to sixteen.", count: "2–16 PLAYERS / PRIVATE ROOM", cta: "CHOOSE YOUR FIGHTER" },
  training: { name: "TRAINING", title: "Make every move yours.", detail: "Practice your combos, specials and movement against a training dummy.", count: "SOLO / FREE PRACTICE", cta: "ENTER TRAINING" },
};
const art = (id: string, skin?: string) => escapeMarkup(fighterPresentation(id, skin).portrait);

export function homeScreen(): string {
  return `<main class="ac-home">
    <div class="ac-home-atmosphere" aria-hidden="true"></div>
    <div class="ac-home-cast" aria-hidden="true">${homeCastPair(0).map((id, index) => { const p = fighterPresentation(id); return `<img class="cast-${index === 0 ? "left" : "right"}" data-fighter="${id}" style="scale:${p.homeScale ?? p.previewScale ?? 1};transform-origin:50% 0;transform:scaleX(${(index === 0) === (p.facing === "right") ? 1 : -1})" src="${art(id)}" alt="">`; }).join("")}</div>
    <section class="ac-title"><h1 class="ac-custom-wordmark"><img src="/art/abroz-combat-wordmark-v2.svg" alt="Abroz Combat"></h1><p>Three lives. One survivor.</p></section>
    <nav class="ac-direct-menu" aria-label="Main menu">
      ${(Object.keys(modes) as MenuMode[]).map((id)=>`<button class="ac-menu-ticket ticket-${id}" data-action="${id}" aria-label="${modes[id].name}"><span class="ticket-content"><small>${modes[id].count}</small><strong>${modes[id].name}</strong><span>${id === "local" ? "Choose your game type" : id === "online" ? "Bring your crew" : "Perfect your moves"}</span></span><b aria-hidden="true">↗</b></button>`).join("")}
      <button class="ac-menu-ticket ticket-roster" data-action="characters" aria-label="FIGHTERS"><span class="ticket-content"><small>ROSTER / MOVE LISTS</small><strong>FIGHTERS</strong><span>Find your fighting style</span></span><b aria-hidden="true">↗</b></button>
    </nav>
  </main>`;
}

export function localGameScreen(): string {
  const cards = [
    {action:'local-versus',theme:'versus',count:'2 PLAYERS · ONE MATCH',title:'1v1 VERSUS',detail:'Three lives. Last fighter wins.',cta:'CHOOSE FIGHTERS'},
    {action:'local-ffa',theme:'ffa',count:'2–8 PLAYERS · EVERYONE FOR THEMSELVES',title:'FREE-FOR-ALL',detail:'Everyone fights. One survivor.',cta:'SET UP MATCH'},
    {action:'local-2v2',theme:'teams',count:'4 PLAYERS · TWO TEAMS',title:'2 VS 2',detail:'Team up. No friendly fire.',cta:'SET UP TEAMS'},
    {action:'local-3v3',theme:'squads',count:'6 PLAYERS · TWO TEAMS',title:'3 VS 3',detail:'Three per side. Last team wins.',cta:'SET UP TEAMS'},
    {action:'championship',theme:'champion',count:'2–16 PLAYERS · SINGLE ELIMINATION',title:'CHAMPIONSHIP',detail:'Win the bracket. Take the title.',cta:'SET UP TOURNAMENT'},
    {action:'elimination',theme:'elimination',count:'2–8 PLAYERS · WIN TO BE SAFE',title:'ELIMINATION',detail:'Win to stay. Last player is out.',cta:'SET UP ELIMINATION'},
    {action:'elimination-party',theme:'party',count:'6 PLAYERS · CHANGING FORMATS',title:'ELIMINATION PARTY',detail:'New teams. New rules. Every round.',cta:'START THE PARTY'},
  ];
  return `<main class="local-game-page local-arcade"><nav class="local-game-types" aria-label="Local game types">${cards.map(c=>`<button data-action="${c.action}" class="local-game-card mode-${c.theme}"><span class="mode-art" aria-hidden="true"><img class="mode-scene" src="/art/modes/${c.theme}-${['versus','ffa','squads','party'].includes(c.theme) ? 'v2' : 'v1'}.png" alt=""></span><span class="mode-card-copy"><small>${c.count}</small><strong>${c.title}</strong><span class="mode-description">${c.detail}</span><b class="mode-cta">${c.cta}<i aria-hidden="true">→</i></b></span></button>`).join('')}</nav><footer class="local-arcade-footer"><button class="text-button" data-action="home">← MAIN MENU</button><span>ABROZ COMBAT <b>/</b> PLAY TOGETHER</span></footer></main>`;
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
    const label = roster ? (index === 0 ? "IN FOCUS" : "THE COMPETITION") : mode === "online" ? (index === 0 ? "YOUR FIGHTER" : "YOUR RIVALS") : mode === "training" ? (index === 0 ? "YOUR FIGHTER" : "TRAINING OPPONENT") : `PLAYER 0${index + 1}`;
    const status = roster ? (index === 0 ? "ROSTER PREVIEW" : "ROSTER PREVIEW") : isUnknown ? "DECIDED IN THE ROOM" : index === activeSeat ? "SELECTING" : (mode === "local" || mode === "training") && selectSeat === 1 && index === 0 ? "LOCKED IN" : "UP NEXT";
    const skinPicker = isUnknown || (roster && index !== 0) ? '' : `<label class="ac-skin-picker">SKIN<select id="fighter-skin-${index}" data-skin-seat="${index}" aria-label="${label} skin" ${fighterSkins(c).length === 1 ? 'disabled' : ''}>${fighterSkins(c).map((look,n)=>`<option value="${look.id}" ${look.id===skin||!skin&&n===0?'selected':''}>${escapeMarkup(look.name)}</option>`).join('')}</select></label>`;
    const mirror = fighterPresentation(id, skin).facing !== (index === 0 ? "right" : "left");
    return `<section class="ac-faceoff-side side-${index} ${index === activeSeat ? "is-selecting" : ""} ${isUnknown ? "is-unknown" : ""}" aria-label="${label}">
      <div class="ac-player-flag"><span>${label}</span><b>${status}</b>${!roster && !isUnknown && !(mode=== "training" && index===1)?`<small data-device-slot="${index}"></small>`:""}</div>
      <img class="ac-faceoff-art ${mirror ? "is-mirrored" : ""}" style="--portrait-inset:${(fighterPresentation(id, skin).previewInset ?? 0) * (index === 0 ? 1 : -1)}%;--portrait-scale:${fighterPresentation(id, skin).previewScale ?? 1};--portrait-offset-y:${fighterPresentation(id, skin).previewOffsetY ?? 0}%" src="${art(id, skin)}" alt="${isUnknown ? "Opponent silhouette" : c.displayName}">
      <div class="ac-fighter-identity"><h3>${isUnknown ? "WHO’S NEXT?" : c.displayName}</h3>${skinPicker}${(mode === "local" || mode === "training") && selectSeat === 1 && index === 0 && !roster ? '<button class="ac-edit-player" data-action="edit-player">CHANGE FIGHTER</button>' : ""}</div>
    </section>`;
  };
  return `<main class="ac-selection ac-selection-cinematic" aria-label="Fighter selection">
    <div class="ac-faceoff">${seats.map(side).join("")}<div class="ac-versus" aria-hidden="true"><span>VS</span><i></i></div></div>
    <section class="ac-selection-console">
      <div class="ac-roster" style="--roster-count:${Object.keys(characters).length + (roster ? 0 : 1)}"><span>${roster ? "EXPLORE THE ROSTER" : mode === "local" ? `PLAYER ${selectSeat+1} · CHOOSE A FIGHTER` : mode === "training" && selectSeat === 1 ? "CHOOSE YOUR TRAINING OPPONENT" : "CHOOSE YOUR FIGHTER"}</span><div>${Object.values(characters).map(c=>`<button data-action="pick" data-id="${c.id}" aria-label="Choose ${c.displayName}" aria-pressed="${active.id===c.id}" class="ac-roster-fighter ${active.id===c.id ? "is-active" : ""} ${!roster && mode !== "online" && selectSeat === 1 && selected[0] === c.id ? "is-locked" : ""}"><img style="--thumbnail-scale:${fighterPresentation(c.id).rosterScale ?? fighterPresentation(c.id).thumbnailScale ?? 1};--thumbnail-position-x:${fighterPresentation(c.id).thumbnailPositionX ?? 50}%;--thumbnail-offset-x:${fighterPresentation(c.id).rosterOffsetX ?? 0}%;--thumbnail-offset-y:${fighterPresentation(c.id).rosterOffsetY ?? 0}%" src="${art(c.id)}" alt=""><b>${c.displayName}</b></button>`).join("")}${roster ? "" : '<button data-action="pick-random" aria-label="Choose a random fighter" title="Pick a random fighter" class="ac-roster-fighter ac-random-fighter"><span aria-hidden="true">?</span><b>RANDOM</b></button>'}</div></div>
      <div class="ac-selection-motto" aria-hidden="true">DIFFERENT PLAYERS<br>SAME PASSION<span></span></div><div class="ac-lock-panel"><button class="ac-cta" data-action="${roster ? "home" : "confirm-fighter"}"><span>${roster ? "BACK TO MENU" : mode === "local" && selectSeat === 0 ? "LOCK IN PLAYER 1" : mode === "local" ? "LOCK IN PLAYER 2" : mode === "training" && selectSeat === 1 ? "LOCK IN OPPONENT" : "LOCK IN FIGHTER"}</span></button></div>
    </section>
  </main>`;
}
