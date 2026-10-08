import {errorMessage} from './i18n/errors.js';
import {arenaName, skinName} from './i18n/content.js';
import {getLocale, formatNumber, setLocale, languageOptions, t, th, inputLabelKeys} from './i18n/index.js';
import {finalDeathActive,matchTimeScale} from '../../../packages/game-core/simulation/UndeadSystem.js';
import {matchCountdown} from './ui/MatchCountdown.js';
import {toggleFullscreen} from './platform/runtime.js';
import {arenaSelection} from './ui/ArenaSelection.js';
import './ui/arena-selection.css';
import {ControllerHints} from './input/ControllerHints.js';
import {controllerTextEntry} from './input/ControllerTextEntry.js';
import {MenuNavigation} from "./input/MenuNavigation.js";
import {STANDARD} from "./input/GamepadManager.js";
import {controllerSettings,refreshControllerLabels,controllerDiagnostics} from "./ui/Controllers.js";
import "./ui/controllers.css";
import {localMatchSetup,localMatchTeams,type LocalMatchMode} from './ui/LocalMatchSetup.js';
import {eliminationSetup,eliminationPanel,eliminationStatus} from './ui/Elimination.js';
import type {EliminationMode} from '../../../packages/game-core/simulation/EliminationSystem.js';
import {energyMeter} from './ui/EnergyMeter.js';
import {RenderInterpolation} from './rendering/RenderInterpolation.js';
import { championshipSetup, championshipBracket } from './ui/Championship.js';
import './ui/championship.css';
import { createChampionship, currentMatches, findMatch, finishBracketMatch, matchToken, startBracketMatch, type Championship, type Entrant } from '../../../packages/game-core/tournament/Championship.js';
import {jompStatus} from './ui/JompStatus.js';
import {tournamentPanel} from './ui/TournamentPanel.js';
import {disposeFighterSprites} from './rendering/VisualRegistry.js';
import {damageMultiplier} from '../../../packages/game-core/combat/DamageSystem.js';
import { updateHomeCast, homeCastTick } from './ui/HomeCast.js';
import { resultScreen } from './ui/ResultScreen.js';
import { fighterSkins, resolveSkin } from "../../../packages/game-core/characters/skins.js";
import type { OnlineMode } from "../../../packages/shared/protocol.js";
import { fighterPresentation, escapeMarkup } from "./ui/FighterPresentation.js";
import "./style.css";
import "./ui/combat-menu.css";
import "./ui/selection-finish.css";
import { fighterGuideScreen, controlLabel } from './ui/FighterGuide.js';
import './ui/fighter-guide.css';
import { homeScreen, localGameScreen, selectionScreen } from "./ui/MenuScreens.js";
import "./ui/match-overlays.css";
import { trainingRoom, stages } from "../../../packages/game-core/stages/registry.js";
import { GameSimulation } from "../../../packages/game-core/simulation/GameSimulation.js";
import { characters } from "../../../packages/game-core/characters/registry.js";
import { RollbackManager } from "../../../packages/networking/RollbackManager.js";
import { InputManager } from "./input/InputManager.js";
import { AudioManager } from "./audio/AudioManager.js";
import {sounds,characterSounds} from "./audio/SoundRegistry.js";
import {GameAudio,screenMusic,actionSound} from "./audio/GameAudio.js";
import { AssetManager } from "./assets/AssetManager.js";
import { SceneRenderer } from "./rendering/SceneRenderer.js";
import { LobbyClient } from "./network.js";
import { UI, updateMarkup } from "./ui/UI.js";
document.documentElement.lang=getLocale();
const ui = new UI(),
  input = new InputManager(),
  audio = new AudioManager(),
  assets = new AssetManager(),
  network = new LobbyClient();
const renderer = new SceneRenderer(
  document.querySelector<HTMLCanvasElement>("#scene")!,
);
const renderInterpolation = new RenderInterpolation();
const gameAudio = new GameAudio(audio);
let simulation = new GameSimulation(),
  rollback: RollbackManager | null = null;
let screen = "home",
  mode: "local" | "training" | "online" = "local",
  selectSeat = 0,
  seat = 0,
  debug = false,
  paused = false,
  accumulator = 0,
  last = performance.now(),
  fps = 60,
  lastHash = -1;
const playerColors = [
  "#c9ec7a",
  "#ffb18e",
  "#7adfff",
  "#dbadff",
  "#ffdf70",
  "#ff83ba",
  "#6ef0bd",
  "#b4c4ff",
];
const rosterIds = Object.keys(characters);
const selected: [string, string] = [rosterIds[0], rosterIds[1] ?? rosterIds[0]];
const selectedSkins = selected.map(id => resolveSkin(characters[id]));
let guidePlayer = 0;
let archiveSkin: string | undefined;
const recentGameplayEvents:string[]=[];
const pendingHashes = new Map<string, { frame: number; hash: string }>();
let archiveId = rosterIds[0];
let viewRevision = 0;
let cancelBinding: (() => void) | undefined;
let championship: Championship | null = null;
let championshipMatch: string | undefined;
let championshipSeat = 0;
let championshipReady: number[] = [];
let championshipEntrants: Entrant[] = [];
let localElimination:EliminationMode='elimination';
let eliminationIds:string[]=[],eliminationSkins:string[]=[];
let hudEliminationFight=0;
let idleTestMatch=false;
const developmentBuild=!!(import.meta as ImportMeta & {env?:{DEV?:boolean}}).env?.DEV;
let localMatchMode:LocalMatchMode='ffa',localIds:string[]=[],localSkins:string[]=[],localTeams:number[]=[];
const menuNavigation = new MenuNavigation();
let pauseOwner:number|null=null;
let controllerPanel=false;
let onlineControllerMenu=false;
let controllerPanelRevision=-1;
let controllerLastPaint=0;
let controllerMessage='';
let controllerMessageUntil=0;
const controllerHints=new ControllerHints();
function displayBindings(player:number){return controllerHints.active?[...['Left','Right',controllerHints.button(0),'Down'],...input.gamepadButtons.map(b=>controllerHints.button(b))]:input.bindings[player];}
const controllerNotice=document.createElement('div');
controllerNotice.className='controller-notice';controllerNotice.setAttribute('role','status');document.body.append(controllerNotice);
function controllerToast(message:string){controllerMessage=message;controllerMessageUntil=performance.now()+4500;}
function openControllers(){
 if(controllerPanel)return;
 cancelBinding?.();
 if(screen==='fight'&&!paused&&mode!=='online')pause();
 controllerPanel=true;input.clear();menuNavigation.reset();
 const dialog=document.createElement('dialog');dialog.id='controllers-dialog';dialog.className='controller-dialog';
 dialog.innerHTML=controllerSettings(input.controllers);ui.root.append(dialog);dialog.showModal();
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeControllers();});
 dialog.querySelector<HTMLSelectElement>('#controller-deadzone')!.onchange=e=>{input.controllers.deadzone=Number((e.target as HTMLSelectElement).value);input.clear();input.save();};
 refreshControllerLabels(dialog,input.controllers);controllerPanelRevision=-1;
 dialog.querySelector<HTMLElement>('[data-action="controller-assign"]')?.focus();
}
function closeControllers(){controllerPanel=false;input.controllers.capture=null;input.controllers.testing=null;document.getElementById('controllers-dialog')?.remove();input.clear();menuNavigation.reset();}
function onlineMenuContent():string {
 return `<h2>${th('pause.onlineTitle')}</h2><p>${th('pause.onlineHelp')}</p><button data-action="online-controller-resume">${th('pause.return')}</button><button data-action="pause-settings">${th('pause.settings')}</button><button data-action="home">${th('pause.leave')}</button>`;
}
function toggleOnlineControllerMenu(){
 if(document.getElementById('disconnect'))return;
 onlineControllerMenu=!onlineControllerMenu;input.clear();input.enabled=!onlineControllerMenu;menuNavigation.reset();
 if(!onlineControllerMenu){document.getElementById('online-controller-menu')?.remove();return;}
 const dialog=document.createElement('dialog');dialog.id='online-controller-menu';dialog.className='controller-dialog';
 dialog.innerHTML=onlineMenuContent();
 ui.root.append(dialog);dialog.showModal();dialog.addEventListener('cancel',e=>{e.preventDefault();toggleOnlineControllerMenu();});
}
function controllerBack(){
 if(document.getElementById('disconnect')){home();return;}
 const editor=document.getElementById('controller-text-entry');if(editor){editor.dispatchEvent(new Event('cancel',{cancelable:true}));return;}
 if(controllerPanel){if(input.controllers.capture||input.controllers.testing!==null){input.controllers.capture=null;input.controllers.testing=null;input.clear();ui.text('controller-message',t('controller.cancelled'));}else closeControllers();return;}
 const settingsDialog=document.getElementById('settings-dialog');if(settingsDialog){closeSettings();return;}
 if(cancelBinding){cancelBinding();return;}

 audio.play("menu_back");
 if(onlineControllerMenu){toggleOnlineControllerMenu();return;}
 if(screen==='fight'){if(document.getElementById('match-result'))home();else if(paused)pause();return;}
 if(screen==='select'){if(selectSeat===1){selectSeat=0;selection();}else home();return;}
 if(screen==='stage'){selection();return;}
 const back=ui.root.querySelector<HTMLElement>('main [data-action="local"],main [data-action="back-fighters"]')??ui.root.querySelector<HTMLElement>('[data-action="home"]');back?.click();
}
function activeInputSlots(){return mode==='online'||mode==='training'?1:screen==='local-match-setup'?localIds.length:screen==='elimination-setup'?eliminationIds.length:screen==='fight'?simulation.state.fighters.length:2;}
function updateControllers(now:number){
 const pads=input.controllers;
 const joinAllowed=screen!=='loading'&&(controllerPanel||screen!=='fight')&&!pads.capture&&pads.testing===null;
 input.refresh(joinAllowed,controllerPanel?pads.cap:screen==='home'||screen==='local'?pads.cap:activeInputSlots());
 for(const action of input.systemActions.splice(0)){
  if(action==='debug'&&(developmentBuild||mode==='training'))debug=!debug;
  if(action==='reset'&&mode==='training'&&screen==='fight'){simulation.resetPositions();recentGameplayEvents.length=0;}
  if(action==='pause'){if(controllerPanel||document.getElementById('settings-dialog')||document.getElementById('controller-text-entry'))controllerBack();else{pauseOwner=null;pause();}}
 }
 for(const event of pads.drain()){
  if(event.kind==='menu'||event.kind==='join'||event.kind==='activity'){audio.unlock();controllerHints.use(pads.devices.get(event.device)?.brand??'generic');}
  if(event.kind==='join'||event.kind==='assigned')audio.play("joined");
  if(event.kind==='disconnect')audio.play("disconnected");
  if(event.kind==='assigned'||event.kind==='join'){
   const message=t('controller.assigned',{player:event.player!+1,name:pads.devices.get(event.device)!.name});
   controllerToast(message);ui.text('controller-message',message);
  }
  if(event.kind==='activity'&&controllerPanel){
   const d=pads.devices.get(event.device)!;
   if(d.player!==null)ui.text('controller-message',t('controller.identified',{player:d.player+1,name:d.name}));
  }
  if(event.kind==='disconnect'&&event.player!==null&&screen==='fight'&&event.player<activeInputSlots()){
   if(mode!=='online'&&!paused){pauseOwner=null;pause();}
   controllerToast(t('controller.lost',{player:event.player+1}));
  }
  if(event.kind!=='menu'||event.player===null||!event.action)continue;
  const player=event.player,action=event.action;
  if(action==='pause'&&(document.getElementById('controller-text-entry')||document.getElementById('settings-dialog'))){controllerBack();break;}
  if(action==='pause'&&!controllerPanel&&screen==='fight'&&!document.getElementById('match-result')){
   if(mode==='online'){if(player===0)toggleOnlineControllerMenu();break;}
   if(player>=activeInputSlots()||paused&&pauseOwner!==null&&pauseOwner!==player)continue;
   if(!paused)pauseOwner=player;pause();break;
  }
  if(screen==='fight'&&!paused&&!controllerPanel&&!onlineControllerMenu&&!document.querySelector('dialog[open]'))continue;
  if(onlineControllerMenu&&player!==0)continue;
  if(paused&&!controllerPanel&&pauseOwner!==null&&pauseOwner!==player)continue;
  let root:HTMLElement=document.querySelector<HTMLElement>('dialog[open]:last-of-type')??ui.root;
  let scoped=false;
  let allowed:(el:HTMLElement)=>boolean=()=>true;
  if(!controllerPanel&&!document.querySelector('dialog[open]')&&screen==='select'){
   if(mode==='local'&&player!==selectSeat||mode!=='local'&&player!==0)continue;
   root=ui.root.querySelector<HTMLElement>('.ac-selection')!;
   allowed=el=>(!el.matches('[data-skin-seat]')||Number(el.dataset.skinSeat)===selectSeat)&&!(player!==0&&el.dataset.action==='edit-player');
   if(action==='previous'||action==='next'){
    const picker=root.querySelector<HTMLSelectElement>(`[data-skin-seat="${selectSeat}"]`);
    if(picker&&!picker.disabled){picker.selectedIndex=(picker.selectedIndex+(action==='next'?1:-1)+picker.options.length)%picker.options.length;picker.dispatchEvent(new Event('change',{bubbles:true}));}continue;
   }
  }
  if(!controllerPanel&&!document.querySelector('dialog[open]')&&(screen==='local-match-setup'||screen==='elimination-setup')){
   const own=ui.root.querySelector<HTMLElement>(`[data-player-slot="${player}"]`);
   if(!own)continue;
   // Other players edit their card only. P1 owns global setup and start.
   allowed=el=>!el.closest('[data-player-slot]')||el.closest('[data-player-slot]')===own;
   if(player!==0){root=own;scoped=true;if(action==='back')continue;}
  }
  const before=`${viewRevision}:${paused}:${controllerPanel}:${onlineControllerMenu}`;
  menuNavigation.handle(action,player,root,now,controllerBack,scoped,allowed);
  if(before!==`${viewRevision}:${paused}:${controllerPanel}:${onlineControllerMenu}`)break;
 }
 const modal=document.querySelector<HTMLElement>('dialog[open]:last-of-type');
 if(controllerHints.active&&(modal||screen!=='fight')&&(!(modal??ui.root).contains(document.activeElement)||!(document.activeElement as HTMLElement)?.matches('button,select,input,textarea,a[href],summary,[tabindex="0"]')))menuNavigation.sync(modal??ui.root,screen==='select'&&mode==='local'?selectSeat:0,el=>!!modal||screen!=='select'||!el.matches('[data-skin-seat]')||Number(el.dataset.skinSeat)===selectSeat);
 controllerHints.update(screen==='fight'&&!modal,screen==='select');
 document.querySelectorAll<HTMLElement>('[data-control-index]').forEach(el=>{const value=controlLabel(displayBindings(Number(el.dataset.controlPlayer))[Number(el.dataset.controlIndex)]??'');if(value&&el.textContent!==value)el.textContent=value;});
 const disconnected=pads.slots.map((_,i)=>i).filter(i=>i<activeInputSlots()&&pads.device(i)&&!pads.device(i)!.connected);
 if(disconnected.length&&screen==='fight'){
  const p=disconnected[0];
  if(!controllerPanel){
   // Only an unassigned pad may reclaim a missing seat during play.
   const replacement=Array.from(pads.devices.values()).find(d=>d.connected&&d.player===null&&d.mapping==='standard'&&now-d.lastActivity<80);
   if(replacement)pads.assign(replacement.key,p);
  }
  ui.root.querySelectorAll<HTMLElement>('[data-controller-disconnect]').forEach(el=>el.textContent=t('controller.lostHelp',{player:p+1}));
 }else ui.root.querySelectorAll<HTMLElement>('[data-controller-disconnect]').forEach(el=>el.textContent='');
 if(controllerPanel&&pads.capture&&Array.from(pads.devices.values()).some(d=>d.connected&&d.buttons[STANDARD.pause]>.5&&d.buttons[STANDARD.view]>.5)){pads.capture=null;input.clear();ui.text('controller-message',t('controller.cancelled'));}
 if(controllerPanel&&pads.testing!==null){const d=pads.devices.get(pads.testing);if(d&&d.buttons[STANDARD.pause]>.5&&d.buttons[STANDARD.view]>.5){pads.testing=null;input.clear();ui.text('controller-message',t('controller.finished'));}}
 if(controllerPanelRevision!==pads.revision||now-controllerLastPaint>150){
  refreshControllerLabels(ui.root,pads);
  if(controllerPanel)controllerDiagnostics(ui.root,pads,now);
  controllerPanelRevision=pads.revision;controllerLastPaint=now;
 }
 const notice=disconnected.length&&screen==='fight'?t('controller.lostNotice',{player:disconnected[0]+1,online:mode==='online'?t('controller.onlineContinues'):''}):now<controllerMessageUntil?controllerMessage:joinAllowed?t('controller.joinHint'):'';
 if(controllerNotice.textContent!==notice)controllerNotice.textContent=notice;
 controllerNotice.hidden=!notice;
}
function showLocalMatchSetup(kind:LocalMatchMode=localMatchMode,count=kind==='3v3'?6:4){
 mode='local';championship=null;championshipMatch=undefined;
 if(kind!==localMatchMode||count!==localIds.length)localTeams=localMatchTeams(kind,count);
 localMatchMode=kind;
 localIds=Array.from({length:count},(_,i)=>localIds[i]??rosterIds[i%rosterIds.length]);
 localSkins=localIds.map((id,i)=>resolveSkin(characters[id],localSkins[i]));
 navigate('local-match-setup');ui.shell(localMatchSetup(kind,localIds,localSkins,localTeams,developmentBuild));addSetupArenaPicker();
 document.getElementById('local-match-count')!.onchange=e=>showLocalMatchSetup(kind,Number((e.target as HTMLSelectElement).value));
 ui.root.querySelectorAll<HTMLSelectElement>('[data-local-fighter]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.localFighter);localIds[i]=el.value;localSkins[i]=resolveSkin(characters[el.value]);showLocalMatchSetup(kind,count);});
 ui.root.querySelectorAll<HTMLSelectElement>('[data-local-skin]').forEach(el=>el.onchange=()=>localSkins[Number(el.dataset.localSkin)]=el.value);
 ui.root.querySelectorAll<HTMLSelectElement>('[data-local-team]').forEach(el=>el.onchange=()=>{localTeams[Number(el.dataset.localTeam)]=Number(el.value);showLocalMatchSetup(kind,count);});
}
function showEliminationSetup(kind:EliminationMode=localElimination,count=kind==='elimination-party'?6:4){
 mode='local';localElimination=kind;championship=null;championshipMatch=undefined;
 eliminationIds=Array.from({length:count},(_,i)=>eliminationIds[i]??rosterIds[i%rosterIds.length]);
 eliminationSkins=eliminationIds.map((id,i)=>resolveSkin(characters[id],eliminationSkins[i]));
 navigate('elimination-setup');ui.shell(eliminationSetup(kind,eliminationIds,eliminationSkins));addSetupArenaPicker();
 document.getElementById('elimination-count')!.onchange=e=>showEliminationSetup(kind,Number((e.target as HTMLSelectElement).value));
 ui.root.querySelectorAll<HTMLSelectElement>('[data-elimination-fighter]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.eliminationFighter);eliminationIds[i]=el.value;eliminationSkins[i]=resolveSkin(characters[el.value]);showEliminationSetup(kind,count);});
 ui.root.querySelectorAll<HTMLSelectElement>('[data-elimination-skin]').forEach(el=>el.onchange=()=>eliminationSkins[Number(el.dataset.eliminationSkin)]=el.value);
}
function showChampionshipSetup() {
  mode = 'local';
  navigate('championship-setup');
  if (!championshipEntrants.length) resizeChampionship(4);
  ui.shell(championshipSetup(championshipEntrants));addSetupArenaPicker();
  document.getElementById('championship-count')!.onchange = e => { resizeChampionship(Number((e.target as HTMLSelectElement).value)); showChampionshipSetup(); };
  ui.root.querySelectorAll<HTMLInputElement>('[data-entrant-name]').forEach(el => el.oninput = () => { championshipEntrants[Number(el.dataset.entrantName)].name = el.value; });
  ui.root.querySelectorAll<HTMLSelectElement>('[data-entrant-character]').forEach(el => el.onchange = () => {
    const e = championshipEntrants[Number(el.dataset.entrantCharacter)]; e.character = el.value; e.skin = resolveSkin(characters[e.character]); showChampionshipSetup();
  });
  ui.root.querySelectorAll<HTMLSelectElement>('[data-entrant-skin]').forEach(el => el.onchange = () => { championshipEntrants[Number(el.dataset.entrantSkin)].skin = el.value; showChampionshipSetup(); });
}
function resizeChampionship(count: number) {
  championshipEntrants = Array.from({length: count}, (_, id) => championshipEntrants[id] ?? { id, name: `Player ${id+1}`, character: rosterIds[id % rosterIds.length], skin: resolveSkin(characters[rosterIds[id % rosterIds.length]]) });
}
function showChampionship(note = '') {
  if (!championship) return;
  championshipMatch = undefined; rollback = null; pendingHashes.clear(); paused = false;
  navigate('championship-bracket', true);
  ui.shell(championshipBracket(championship, mode === 'online', championshipSeat, championshipReady, note), `1v1 CHAMPIONSHIP / ${stages[selectedArena].name.toUpperCase()}`);
}
function playChampionship(id: string) {
  if (!championship || screen !== 'championship-bracket' || mode !== 'local') return;
  const m = startBracketMatch(championship, id);
  championshipMatch = matchToken(m);
  const entrants = m.slots.map(id => championship!.entrants.find(e => e.id === id)!);
  void start(entrants.map(e => e.character), undefined, entrants.map(e => e.skin));
}
function navigate(next: string, keepConnection = false) {
  viewRevision++;
  if(controllerPanel)closeControllers();
  onlineControllerMenu=false;
  cancelBinding?.();
  if (!keepConnection && mode === "online" && ["lobby", "loading"].includes(screen)) { network.disconnect(); rollback = null; }
  ui.root.dataset.navScreen=next;
  screen = next; audio.setPaused(false); audio.fadeCombat(); audio.setMusic(screenMusic(next)); input.enabled = false; input.clear();
  menuNavigation.reset(); pauseOwner=null;
}
function home() {
  network.disconnect();
  championship = null; championshipMatch = undefined; championshipReady = [];
  rollback = null;
  navigate("home");
  paused = false;
  input.enabled = false;
  simulation = new GameSimulation();
  simulation.state.fighters[0].x = trainingRoom.width / 2 + 80;
  simulation.state.fighters[1].x = trainingRoom.width / 2 + 380;
  simulation.state.fighters.forEach((f) => (f.state = "Idle"));
  renderHome();
}
let homeStartedAt=0,homeCastStep=0;
function renderHome() {
  homeStartedAt=performance.now();homeCastStep=0;
  ui.shell(homeScreen(), t("home.footer"), false);
  updateHomeCast(ui.root,0);
}

function selection(roster = false) {
  navigate(roster ? "roster" : "select");
  input.enabled = false;
  ui.shell(roster ? fighterGuideScreen(archiveId, archiveSkin, displayBindings(guidePlayer), guidePlayer) : selectionScreen(mode, selected, selectSeat, roster, archiveId, selectedSkins, archiveSkin),
    t("selection.footer"));
  document.getElementById("guide-controls")?.addEventListener("change", event => {
    const scroll = document.querySelector('.fg-scroll')?.scrollTop ?? 0;
    guidePlayer = Number((event.target as HTMLSelectElement).value);
    selection(true);
    document.querySelector('.fg-scroll')?.scrollTo(0, scroll);
    document.getElementById('guide-controls')?.focus();
  });
  document.querySelectorAll<HTMLSelectElement>("#fighter-skin, [data-skin-seat]").forEach(picker => picker.addEventListener("change", event => {
    const value = (event.target as HTMLSelectElement).value;
    const guideScroll = roster ? document.querySelector('.fg-scroll')?.scrollTop ?? 0 : 0;
    if (roster) archiveSkin = resolveSkin(characters[archiveId], value);
    else { const skinSeat = Number(picker.dataset.skinSeat ?? selectSeat); selectedSkins[skinSeat] = resolveSkin(characters[selected[skinSeat]], value); }
    selection(roster);
    if (roster) document.querySelector('.fg-scroll')?.scrollTo(0, guideScroll);
    document.getElementById(picker.id)?.focus();
  }));
}

let selectedArena = trainingRoom.id;
function randomizeArena(): void {
  const ids=Object.keys(stages).filter(id=>id!==selectedArena);
  if(ids.length)selectedArena=ids[Math.floor(Math.random()*ids.length)];
}
function arenaPicker(): string {
  return `<label class="arena-picker">${th("arena.label")} <select id="arena-choice">${Object.values(stages).map(a=>`<option value="${a.id}" ${a.id===selectedArena?'selected':''}>${escapeMarkup(arenaName(a))} · ${th("arena.platforms",{count:a.platforms?.length??0})}</option>`).join('')}<option value="random">${th("arena.randomOption")}</option></select></label>`;
}
function bindArenaPicker(refresh?:()=>void): void {
  const el=document.getElementById('arena-choice') as HTMLSelectElement|null;
  if(el)el.onchange=()=>{if(el.value==='random'){randomizeArena();el.value=selectedArena;refresh?.();}else if(Object.hasOwn(stages,el.value)){selectedArena=el.value;refresh?.();}};
}
function addSetupArenaPicker(): void {
  const main=ui.root.querySelector('main');
  if(main){main.insertAdjacentHTML('afterbegin',arenaPicker());bindArenaPicker();}
}
function stage() {
  navigate("stage");
  ui.shell(arenaSelection(selectedArena,mode,selected,selectedSkins));
  const randomButton=ui.root.querySelector<HTMLButtonElement>('[data-random-arena]');
  if(randomButton)randomButton.onclick=()=>{
    randomizeArena();audio.play('menu_confirm');stage();
    ui.root.querySelector<HTMLButtonElement>('[data-random-arena]')?.focus({preventScroll:true});
  };
  ui.root.querySelectorAll<HTMLButtonElement>('[data-arena]').forEach(button=>{
    button.onclick=()=>{const id=button.dataset.arena!;if(!Object.hasOwn(stages,id))return;selectedArena=id;audio.play('menu_confirm');stage();ui.root.querySelector<HTMLButtonElement>(`[data-arena="${id}"]`)?.focus({preventScroll:true});};
  });
}
async function start(ids: string[] = selected, teams?: number[], skins: string[] = selectedSkins, tournament: boolean | EliminationMode = false, seed = Math.floor(Math.random()*0x100000000), arenaId = selectedArena, idleTest = false) {
  if(!developmentBuild && mode!=="training")debug=false;
  idleTestMatch = developmentBuild && mode === "local" && idleTest;
  selectedArena = Object.hasOwn(stages,arenaId) ? arenaId : trainingRoom.id;
  navigate("loading", true);
  const revision = viewRevision;
  recentGameplayEvents.length=0;
  input.enabled = false;
  ui.shell(
    `<main class="page"><div class="eyebrow">${th('match.loading')}</div><h2>${th('match.entering',{arena:arenaName(stages[selectedArena]).toUpperCase()})}</h2><div class="loading-bar"><i id="load-progress" style="width:0%"></i></div></main>`,
  );
  simulation = new GameSimulation(ids, mode === "training", stages[selectedArena], teams, skins, tournament, seed);
  gameAudio.reset();
  audio.setMusic("intro",simulation.stage.id);
  void audio.preload([...Object.keys(sounds).filter(id=>!id.includes('.')||id.startsWith('layer.')||ids.some(f=>id.startsWith(`${f}.`))),...ids.flatMap(id=>Object.values(characterSounds[id]??{}).filter((key):key is string=>!!key))]);
  if (mode === "online") {
    rollback = new RollbackManager(simulation, seat, 2, 8);
    lastHash = -1;
    pendingHashes.clear();
  } else rollback = null;
  try {
  renderer.draw(simulation.state,0,0,false,simulation.stage);
  await Promise.all([renderer.stage.ready, renderer.prepareFighters(ids)]);
  if(revision!==viewRevision||screen!=="loading")return;
  await assets.load(
    Object.assign({}, ...ids.map((id) => characters[id].assets)),
    (p) => {
      if(revision!==viewRevision||screen!=="loading")return;
      const el = document.getElementById("load-progress");
      if (el) el.style.width = `${p * 100}%`;
    },
  );
  } catch (error) {
    if (revision !== viewRevision) return;
    disconnectMessage(error instanceof Error ? error.message : t('match.assetError'));
    return;
  }
  if (revision !== viewRevision || screen !== "loading") return;
  screen = "fight";
  paused = false;
  accumulator = 0;
  input.clear();
  input.enabled = true;
  hud();
}
function hud() {
  hudEliminationFight=simulation.state.elimination?.fight??0;
  ui.render(
    `<div style="--fighter-count:${simulation.state.fighters.length}" class="hud ${simulation.state.teamMatch ? "team-hud" : ""} ${simulation.state.fighters.length > 2 ? `multi-hud ${simulation.state.fighters.length > 6 ? "large-ffa-hud" : ""}` : ""}">${simulation.state.fighters.length > 2 ? simulation.state.fighters.map((_, i) => fighterHud(i)).join("") : `${fighterHud(0)}<div class="timer"><span id="match-symbol">VS</span><small id="match-mode">${th("hud.survival")}</small></div>${fighterHud(1)}`}</div><div id="player-tags"></div><div class="announcement" id="announcement"></div><div class="combo" id="combo0"></div><div class="combo right" id="combo1"></div><pre class="debug" id="debug" hidden></pre>${mode === "training" ? `<div class="training"><span class="pill">${th("home.training.name")}</span><label>${th("hud.dummy")} <select id="dummy"><option value="stand" ${simulation.trainingOptions.dummy === "stand" ? "selected" : ""}>${th("hud.stand")}</option><option value="crouch" ${simulation.trainingOptions.dummy === "crouch" ? "selected" : ""}>${th("hud.crouch")}</option><option value="jump" ${simulation.trainingOptions.dummy === "jump" ? "selected" : ""}>${th("hud.jump")}</option><option value="block" ${simulation.trainingOptions.dummy === "block" ? "selected" : ""}>${th("hud.block")}</option><option value="afterHit" ${simulation.trainingOptions.dummy === "afterHit" ? "selected" : ""}>${th("hud.afterHit")}</option></select></label><label><input id="infinite" type="checkbox" ${simulation.trainingOptions.infiniteMeter ? "checked" : ""}> ${th("hud.infiniteMeter")}</label><button data-action="reset">${th("hud.reset")}</button><button data-action="debug">${th("hud.boxes")}</button><span id="damage">${th('hud.damage',{damage:0,combo:0})}</span></div>` : ""}<div class="combat-actions"><button class="text-button" data-action="pause">${th(mode==='online'?'hud.options':'hud.pause')} [<span data-prompt-pause>ESC</span>]</button></div>`,
  );
  document
    .getElementById("dummy")
    ?.addEventListener(
      "change",
      (e) =>
        (simulation.trainingOptions.dummy = (e.target as HTMLSelectElement)
          .value as typeof simulation.trainingOptions.dummy),
    );
  document
    .getElementById("infinite")
    ?.addEventListener(
      "change",
      (e) =>
        (simulation.trainingOptions.infiniteMeter = (
          e.target as HTMLInputElement
        ).checked),
    );
}
const teamName=(team:number)=>t(team===0?'team.blueShort':'team.redShort');
const teamColors = ["#7adfff", "#ff8575"];
function fighterColor(i: number) { return simulation.state.teamMatch ? (teamColors[simulation.state.teams[i]]??playerColors[i]) : playerColors[i]; }
function teamLabel(i: number) { return simulation.state.teamMatch && simulation.state.teams[i]<2 ? ` · ${teamName(simulation.state.teams[i])}` : ""; }
function fighterHud(i: number) {
  const match = championship?.rounds.flat().find(m => matchToken(m) === championshipMatch);
  const entrant = match && championship!.entrants.find(e => e.id === match.slots[i]);
  return `<div class="p${i + 1} ${mode === "online" && i === seat ? "you" : ""}" style="--player-color:${fighterColor(i)};order:${simulation.state.teamMatch ? simulation.state.teams[i] * 10 + i : i}"><div class="fighter-name"><img class="hud-portrait" src="${fighterPresentation(simulation.state.fighters[i].characterId, simulation.state.skins[i]).portrait}" alt=""><b>${entrant ? escapeMarkup(entrant.name) : characters[simulation.state.fighters[i].characterId].displayName}</b><span>P${i + 1}${teamLabel(i)}${mode === "online" && i === seat ? t('championship.you') : ""}</span></div><div class="health"><i id="health${i}"></i></div>${energyMeter(characters[simulation.state.fighters[i].characterId],i)}<div class="super-slots" id="supers${i}"></div><div class="lives" id="lives${i}"></div><div class="life-status" id="life-status${i}"></div></div>`;
}
function updateHUD(presentationOnly=false) {
  const s = simulation.state;
  if((s.elimination?.fight??0)!==hudEliminationFight)hud();
  ui.text("match-symbol", s.training ? "∞" : "VS");
  ui.text("match-mode", t(s.training?'home.training.name':s.elimination?'local.elimination.title':championship?'local.champion.title':'hud.survival'));
  s.fighters.forEach((f, i) => {
    document.getElementById("health" + i)!.style.width =
      `${(f.health / characters[f.characterId].stats.maxHealth) * 100}%`;
    document.getElementById("meter" + i)!.style.width = `${f.meter}%`;
    const energy=document.getElementById("energy"+i)!;
    energy.setAttribute("aria-valuenow",String(f.meter));
    const loanLocked=(f.loanUntil??0)>s.frame;
    const formLocked=loanLocked||f.stampAttempts!==undefined||(f.angelUntil??0)>s.frame;
    energy.classList.toggle("is-locked",loanLocked);
    energy.classList.toggle("is-full",f.meter>=100&&!formLocked);
    energy.querySelectorAll<HTMLElement>(".energy-threshold").forEach(marker=>{
      const cost=Number(marker.dataset.cost),ready=f.meter>=cost&&!formLocked;
      marker.classList.toggle("is-ready",ready);
      marker.title=t('energy.state',{name:marker.dataset.label??'',cost,status:loanLocked?t('energy.loan'):formLocked?t('energy.form'):ready?t('energy.ready'):t('energy.need',{count:Math.ceil(cost-f.meter)})});
      marker.setAttribute("aria-label",marker.title);
    });
    updateMarkup(document.getElementById("supers" + i)!, characters[
      f.characterId
    ].superButtons
      .map((id, n) => {
        const marked=s.structures?.some(b=>b.owner===i&&b.move===id&&b.phase==="marked");
        const spent = f.usedSupers.includes(id)&&!marked,
          ready = !formLocked && (!!marked || (!spent && f.meter >= 100));
        const key = mode === "online" && i !== seat ? "" : (displayBindings(mode === "online" ? 0 : i)?.[9 + n]??"")
          .replace("Key", "")
          .replace("Digit", "");
        return `<span class="super-slot ${spent ? "spent" : ready ? "ready" : ""}" title="${characters[f.characterId].moves[id].displayName ?? id} · ${marked ? th('ultimate.buildHelp') : th('ultimate.help')}">${key ? `<b>${escapeMarkup(key)}</b>` : ""} ${s.fighters.length > 2 ? `U${n + 1}` : (characters[f.characterId].moves[id].displayName ?? id)} <em>${loanLocked ? "LOAN" : spent ? th('ultimate.used') : formLocked ? th('ultimate.locked') : marked ? th('ultimate.build') : ready ? th('ultimate.ready') : th('ultimate.charge')}</em></span>`;
      })
      .join(""));
    const lives = document.getElementById("lives" + i)!;
    updateMarkup(lives,
      Array.from({length:Math.max(3,f.lives)},(_,n)=>n)
        .map((n) => `<i class="${n < f.lives ? "remaining" : ""}"></i>`)
        .join("") +
      `<span>${s.training ? th('lives.infinite') : th('lives.count',{count:f.lives})}</span>`);
    lives.setAttribute(
      "aria-label",
      s.training ? t('lives.unlimited') : t('lives.remaining',{count:f.lives}),
    );
    ui.text(
      "life-status" + i,
      s.elimination && (s.elimination.saved.includes(i)||s.elimination.eliminated.includes(i)) ? eliminationStatus(s,i) : f.respawnAt > 0
        ? t('status.respawning',{seconds:formatNumber((f.respawnAt-s.frame)/60,getLocale(),1)})
        : f.invulnerableUntil > s.frame
          ? t('status.protected',{seconds:formatNumber((f.invulnerableUntil-s.frame)/60,getLocale(),1)})
          : f.lives === 0
            ? rollback?.departures.has(i)
              ? t('status.disconnected')
              : t('status.eliminated')
            : [(f.talkUntil??0)>s.frame ? `A GREAT IDEA · ${Math.ceil((f.talkUntil!-s.frame)/60)}s` : "",(f.angerUntil??0)>s.frame ? t('status.bravinho',{seconds:Math.ceil((f.angerUntil!-s.frame)/60),hits:f.angerStacks??0,bonus:20+5*(f.angerStacks??0)}) : "",jompStatus(s,f),f.weaponUntil>s.frame ? `${characters[f.characterId].weaponModifiers?.label??"SPEAR"} · ${Math.ceil((f.weaponUntil-s.frame)/60)}s` : "", f.grappleUntil>s.frame ? t('status.grabbed',{seconds:Math.ceil((f.grappleUntil-s.frame)/60)}) : "", f.onFireUntil > s.frame ? t('status.onFire',{seconds:Math.ceil((f.onFireUntil-s.frame)/60)}) : "", f.burnUntil >= s.frame && f.burnUntil > 0 ? `${f.burnKind === "purple" ? t('status.purpleFire') : t('status.burn')} · ${Math.ceil((f.burnUntil - s.frame) / 60)}s` : ""].filter(Boolean).join(" / "),
    );
    const combo = document.getElementById("combo" + (1 - i));
    if (s.fighters.length === 2 && combo)
      combo.innerHTML =
        f.combo > 1
          ? `${th('combo.hits',{count:f.combo})}<small>${th('combo.damage',{damage:f.comboDamage})}</small>`
          : "";
  });
  const announcement = document.getElementById("announcement")!;
  const countdown = matchCountdown(s);
  const finalDeath=finalDeathActive(s);
  announcement.classList.toggle("final-death",finalDeath);
  announcement.classList.toggle("match-countdown",!!countdown);
  announcement.classList.toggle("match-fight",!!countdown && s.phase === "fight");
  if (countdown) {
    if(announcement.textContent!==countdown){
      const word=document.createElement("span");
      word.className="countdown-word";word.textContent=countdown;
      announcement.replaceChildren(word);
    }
  }
  else
    announcement.textContent = finalDeath ? t('match.dead') : rollback?.stalled
      ? t('match.waitInput')
      : s.phase === "result" && rollback && rollback.confirmed < s.endedAt-1
        ? t('match.confirm')
        : mode === "online" && s.fighters[seat].lives === 0
          ? s.elimination?.saved.includes(seat) ? t('match.safeWatching') : t('match.outWatching')
          : "";
  ui.text(
    "damage",
    t('hud.damage',{damage:s.fighters[1].lastDamage,combo:s.fighters[1].comboDamage}),
  );
  const panel = document.getElementById("debug")!;
  panel.hidden = !debug;
  renderer.debug = debug;
  if (debug) {
    const f = s.fighters[0],
      m = f.move ? characters[f.characterId].moves[f.move] : undefined;
    panel.textContent = `COMBAT LAB / F1\nFPS ${Math.round(fps)} | TICK 60 Hz | FRAME ${s.frame}\n${s.fighters
      .map(
        (f, i) =>
          `P${i + 1} ${f.state} [${f.stateFrame}]\nPOS ${f.x},${f.y} VEL ${f.vx},${f.vy}\nDAMAGE TAKEN ×${damageMultiplier(f,s.frame)} ACTION ${Math.max(0,(f.actionUntil??0)-s.frame)}f MODE ${Math.max(0,f.weaponUntil-s.frame)}f\nHP ${f.health} METER ${f.meter} FACE ${f.facing}\nLIVES ${f.lives} RESPAWN ${Math.max(0, f.respawnAt - s.frame)}f SHIELD ${Math.max(0, f.invulnerableUntil - s.frame)}f\nANIM ${f.move ?? f.state} / ${f.moveFrame}\nINPUT ${f.buffer
            .slice(-12)
            .map((b) => b.direction)
            .join(" ")}`,
      )
      .join(
        "\n",
      )}\n${m ? `START ${m.startupFrames} ACTIVE ${m.activeFrames} REC ${m.recoveryFrames}` : "NO ACTIVE MOVE"}\nBOXES: HIT pink / HURT blue / PUSH lime / BEAM cyan / PROJECTILE yellow / AREA purple / GRAB orange\nNETWORK ${rollback ? "ONLINE" : "LOCAL"}\nPING ${network.ping}ms | DELAY ${rollback?.inputDelay ?? 0}f\nROLLBACK ${rollback?.rollbackCount ?? 0} / ${rollback?.rollbackFrames ?? 0}f\nREMOTE ${rollback?.remoteFrame ?? "—"}\nDESYNC ${rollback?.desync ?? "OK"}\nSIMULATED LATENCY ${network.latency}ms\nEVENTS\n${recentGameplayEvents.join("\n")}`;
  }
  let tournamentHost=document.getElementById("tournament-panel-host");
  if((s.tournament||s.elimination)&&!tournamentHost){tournamentHost=document.createElement("div");tournamentHost.id="tournament-panel-host";ui.root.append(tournamentHost);}
  if(tournamentHost)tournamentHost.innerHTML=s.elimination?eliminationPanel(s,!rollback||rollback.confirmed>=s.endedAt-1):tournamentPanel(s,!rollback||rollback.confirmed>=s.endedAt-1);
  if(presentationOnly)return;
  if (
    s.phase === "result" && !finalDeathActive(s) &&
    (!s.tournament || s.tournament.complete) &&
    (!s.elimination || s.elimination.complete) &&
    screen === "fight" &&
    (!rollback || rollback.confirmed >= s.endedAt - 1)
  ) {
    if (championship && championshipMatch) {
      if (mode === 'local') {
        const match = championship.rounds.flat().find(m => matchToken(m) === championshipMatch)!;
        const winner = s.winner < 0 ? null : match.slots[s.winner];
        finishBracketMatch(championship, match.id, winner);
        showChampionship(winner === null ? t('championship.replay') : t('championship.advances',{name:championship.entrants.find(e=>e.id===winner)!.name}));
      }
      // Online results are decided by the server's confirmed simulation.
      return;
    }
    screen = "result";
    const lost = mode === "online" && s.winner >= 0 && (s.teamMatch ? s.teams[s.winner] !== s.teams[seat] : s.winner !== seat);
    audio.fadeCombat();audio.setMusic(lost?"defeat":"victory",simulation.stage.id);audio.play(lost?"defeat":"victory");
    if(!lost&&simulation.state.winner>=0)audio.play(`${simulation.state.fighters[simulation.state.winner].characterId}.victory`);
    if(rollback)network.send({type:"finished",frame:s.endedAt});
    input.enabled = false;
    const winner = s.winner < 0 ? null : s.fighters[s.winner];
    const winnerName = winner ? (s.teamMatch ? t(s.teams[s.winner]===0?'team.blueWinner':'team.redWinner') : characters[winner.characterId].displayName) : t('result.draw');
    ui.root.insertAdjacentHTML(
      "beforeend",
      resultScreen(s, mode, winnerName, teamLabel, arenaName(simulation.stage)),
    );
    const resultDialog = document.getElementById("match-result") as HTMLDialogElement;
    resultDialog.showModal();
    resultDialog.addEventListener("cancel", (event) => event.preventDefault());
  }
}
function closeSettings(){
  cancelBinding?.();
  document.getElementById('settings-dialog')?.remove();
  input.clear();menuNavigation.reset();
}
function refreshBindings(){
  ui.root.querySelectorAll<HTMLElement>('[data-action="bind"]').forEach(button=>{
    button.textContent=input.bindings[Number(button.dataset.player)][Number(button.dataset.index)];
  });
}
/** Refresh presentation in place: never navigate, reset the match, or re-open a modal. */
function refreshMatchLanguage(){
  if(screen!=='fight')return;
  const hudElement=ui.root.querySelector('.hud');
  if(hudElement)hudElement.innerHTML=simulation.state.fighters.length>2
    ?simulation.state.fighters.map((_,i)=>fighterHud(i)).join('')
    :`${fighterHud(0)}<div class="timer"><span id="match-symbol">VS</span><small id="match-mode">${th('hud.survival')}</small></div>${fighterHud(1)}`;
  const training=ui.root.querySelector('.training');
  const pauseDialog=document.getElementById('pause');
  if(pauseDialog){if(training)ui.root.append(training);pauseDialog.innerHTML=pauseContent();if(training)pauseDialog.querySelector('.pause-drawer')!.append(training);}
  const onlineMenu=document.getElementById('online-controller-menu');
  if(onlineMenu)onlineMenu.innerHTML=onlineMenuContent();
  const pauseButton=ui.root.querySelector('.combat-actions [data-action="pause"]');
  if(pauseButton)pauseButton.innerHTML=`${th(mode==='online'?'hud.options':'hud.pause')} [<span data-prompt-pause>ESC</span>]`;
  if(training){
    training.querySelector('.pill')!.textContent=t('home.training.name');
    const dummy=training.querySelector<HTMLSelectElement>('#dummy')!;
    dummy.parentElement!.firstChild!.textContent=t('hud.dummy')+' ';
    const labels={stand:'hud.stand',crouch:'hud.crouch',jump:'hud.jump',block:'hud.block',afterHit:'hud.afterHit'} as const;
    Array.from(dummy.options).forEach(option=>{option.textContent=t(labels[option.value as keyof typeof labels]);});
    training.querySelector('#infinite')!.nextSibling!.textContent=' '+t('hud.infiniteMeter');
    training.querySelector('[data-action="reset"]')!.textContent=t('hud.reset');
    training.querySelector('[data-action="debug"]')!.textContent=t('hud.boxes');
  }
  updateHUD(true);
}
function settings(overlay=false, refresh=false) {
  if(!overlay&&!refresh)navigate("settings");
  if(!refresh)input.enabled = false;
  const html=`<main class="page"><div class="eyebrow">${th('settings.eyebrow')}</div><h2>${th('nav.settings')}</h2><button class="primary" data-action="controllers">${th('settings.controllers')}</button><div class="settings-grid"><section><label class="setting">${th('language.label')}<select id="language-choice">${languageOptions.map(option=>`<option value="${option.value}" ${getLocale()===option.value?'selected':''}>${option.label}</option>`).join('')}</select></label><span class="tag">${th('settings.visual')}</span><label class="setting">${th('settings.graphics')}<select id="visual-quality">${(['low','medium','high'] as const).map(q=>`<option value="${q}" ${renderer.environment.quality===q?'selected':''}>${th(`settings.quality.${q}`)}</option>`).join('')}</select></label><p>${th('settings.quality.help')}</p><span class="tag">${th('settings.audioNetwork')}</span>${(import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV?`<details><summary>${th('settings.audioDiagnostics')}</summary><pre id="audio-debug"></pre></details>`:''}${(["master", "music", "sound", "ui", "voice"] as const).map((k) => `<label class="setting">${th(`settings.volume.${k}`)}<input type="range" min="0" max="1" step=".01" value="${audio[k]}" data-volume="${k}"></label>`).join("")}<label class="setting">${th('settings.mute')}<input id="audio-mute" type="checkbox" ${audio.mute?"checked":""}></label><label class="setting">${th('settings.muteBlur')}<input id="audio-focus" type="checkbox" ${audio.muteOnBlur?"checked":""}></label>${developmentBuild?`<label class="setting">${th('settings.diagnostics')}<input id="diagnostics" type="checkbox" ${debug ? "checked" : ""}></label><label class="setting">${th('settings.delay')}<select id="latency">${[0, 50, 100, 150, 200].map((n) => `<option ${network.latency === n ? "selected" : ""} value="${n}">${n} ms</option>`).join("")}</select></label><label class="setting">${th('settings.jitter')}<input id="jitter" type="checkbox" ${network.jitter ? "checked" : ""}></label><p>${th('settings.latencyHelp')}</p>`:""}<span class="tag">${th('settings.padAttacks')}</span>${inputLabelKeys.slice(4).map((a, i) => `<label class="setting">${th(a)}<select data-pad="${i}">${Array.from({ length: 16 }, (_, n) => `<option value="${n}" ${input.gamepadButtons[i] === n ? "selected" : ""}>${th('settings.button',{button:n})}</option>`).join("")}</select></label>`).join("")}</section><section><span class="tag">${th('settings.keyboard')}</span>${inputLabelKeys.map((a, i) => `<div class="setting"><span>${th(a)}</span><button class="bind" data-action="bind" data-player="0" data-index="${i}">${input.bindings[0][i]}</button><button class="bind" data-action="bind" data-player="1" data-index="${i}">${input.bindings[1][i]}</button></div>`).join("")}<p>${th('settings.keyboardHelp')}<br>${th('settings.padHelp')}</p></section></div></main>`
;
  if(overlay){
    if(refresh)document.getElementById('settings-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='settings-dialog';dialog.className='controller-dialog';
    dialog.innerHTML=`<button data-action="settings-close">${th('nav.back')}</button>`+html;ui.root.append(dialog);dialog.showModal();
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeSettings();});
  }else ui.shell(html);
  ui.root.querySelectorAll<HTMLInputElement>("[data-volume]").forEach(
    (el) =>
      (el.oninput = () => {
        audio[el.dataset.volume as "master" | "music" | "sound" | "ui" | "voice"] = Number(
          el.value,
        );
        audio.update();
      }),
  );
  document.getElementById('language-choice')!.onchange=e=>{
    const scrollRoot=document.getElementById('settings-dialog')??ui.root;
    const scrollTop=scrollRoot.scrollTop;
    if(!setLocale((e.target as HTMLSelectElement).value))return;
    document.documentElement.lang=getLocale();
    refreshMatchLanguage();
    settings(overlay,true);
    (document.getElementById('settings-dialog')??ui.root).scrollTop=scrollTop;
    document.getElementById('language-choice')?.focus({preventScroll:true});
  };
  document.getElementById('visual-quality')!.onchange=e=>renderer.setVisualQuality((e.target as HTMLSelectElement).value as 'low'|'medium'|'high');
  document.getElementById("audio-mute")!.onchange=e=>{audio.mute=(e.target as HTMLInputElement).checked;audio.update();};
  document.getElementById("audio-focus")!.onchange=e=>{audio.muteOnBlur=(e.target as HTMLInputElement).checked;audio.update();};
  if(developmentBuild){
  document.getElementById("diagnostics")!.onchange = (e) =>
    (debug = (e.target as HTMLInputElement).checked);
  document.getElementById("latency")!.onchange = (e) =>
    (network.latency = Number((e.target as HTMLSelectElement).value));
  document.getElementById("jitter")!.onchange = (e) =>
    (network.jitter = (e.target as HTMLInputElement).checked);
  }
  ui.root.querySelectorAll<HTMLSelectElement>("[data-pad]").forEach(
    (el) =>
      (el.onchange = () => {
        input.gamepadButtons[Number(el.dataset.pad)] = Number(el.value);
        input.save();
      }),
  );
}
function lobby() {
  navigate("lobby");
  ui.shell(
    `<main class="page online-lobby"><div class="eyebrow">${th("online.eyebrow")}</div><h2>${th("online.title")}</h2><p>${th("online.modes")}<br>${th("online.rules")}<br>${th('online.fighter',{name:characters[selected[0]].displayName})}</p><div class="network-panel"><div class="room-setup-grid"><section><label class="setting">${th("online.mode")}<select id="online-mode" aria-label="${th("online.modeLabel")}"><option value="championship">${th("online.mode.championship")}</option><option value="ffa" selected>${th("online.mode.ffa")}</option><option value="ffa-tournament">${th("online.mode.ffa-tournament")}</option><option value="elimination">${th("online.mode.elimination")}</option><option value="elimination-party">${th("online.mode.elimination-party")}</option><option value="2v2">${th("online.mode.2v2")}</option><option value="3v3">${th("online.mode.3v3")}</option></select></label><label class="setting" id="room-size-setting">${th("online.roomSize")}<select id="room-size" aria-label="${th("online.roomSizeLabel")}">${[2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}">${th('online.fighters',{count:n})}</option>`).join("")}</select></label><p id="team-rules" class="tag">${th("online.ffaRule")}</p><label class="setting">${th("online.yourTeam")} <select id="preferred-team" aria-label="${th("online.teamLabel")}"><option value="auto">${th("online.auto")}</option><option value="0">${th("team.blue")}</option><option value="1">${th("team.red")}</option></select></label><small>${th("online.teamHelp")}</small></section><section class="room-connect"><button class="primary" data-action="create">${th("online.create")}</button><p>${th("online.codeHelp")}</p><div class="row"><input id="code" type="text" placeholder="ABX42" maxlength="5" aria-label="${th("online.codeLabel")}" style="width:150px;text-transform:uppercase;letter-spacing:4px"><button class="secondary" data-action="join">${th("online.join")}</button></div><p id="network-status"></p></section></div></div><p class="tag">${th("online.footer1")}<br>${th("online.footer2")}</p></main>`,
  );
  const updateMode = () => {
    const matchMode = (document.getElementById("online-mode") as HTMLSelectElement).value;
    document.getElementById("room-size-setting")!.hidden = (matchMode === "2v2" || matchMode === "3v3" || matchMode === "elimination-party");
    (document.getElementById("preferred-team") as HTMLSelectElement).disabled=matchMode!=="2v2"&&matchMode!=="3v3";
    (document.getElementById('room-size') as HTMLSelectElement).innerHTML = Array.from({length: matchMode === 'championship' ? 15 : 7}, (_,i) => `<option value="${i+2}">${th('common.players',{count:i+2})}</option>`).join('');
    ui.text("team-rules", matchMode === "elimination" ? t('online.eliminationRule') : matchMode === "elimination-party" ? t('online.partyRule') : matchMode === "championship" ? t('online.championshipRule') : matchMode === "ffa-tournament" ? t('online.tournamentRule') : matchMode === "ffa" ? t('online.ffaRule') : t('online.teamsRule',{count:matchMode==='2v2'?4:6}));
  };
  document.getElementById('online-mode')!.addEventListener('change', updateMode);
  updateMode();
}
let connectionAttempt = 0;
async function connect(create: boolean) {
  const attempt = ++connectionAttempt;
  const code = (document.getElementById("code") as HTMLInputElement)?.value
    .trim()
    .toUpperCase();
  if (!create && !/^[A-Z0-9]{5}$/.test(code)) {
    ui.text("network-status", t('online.enterCode'));
    return;
  }
  const revision = viewRevision;
  const capacity = Number((document.getElementById("room-size") as HTMLSelectElement)?.value ?? 2);
  const character = selected[0];
  const skin = selectedSkins[0];
  const matchMode = (document.getElementById("online-mode") as HTMLSelectElement).value as OnlineMode;
  const preference = (document.getElementById("preferred-team") as HTMLSelectElement).value;
  const team = preference === "auto" ? undefined : Number(preference);
  ui.text("network-status", t('online.connecting'));
  try {
    await network.connect();
    if (attempt !== connectionAttempt || revision !== viewRevision || screen !== "lobby") return;
    network.send(
      create
        ? {
            type: "create",
            stage: selectedArena,
            character,
            skin,
            capacity,
            mode: matchMode,
            team,
          }
        : { type: "join", code, character, team, skin },
    );
  } catch (e) {
    if (attempt !== connectionAttempt || revision !== viewRevision || screen !== "lobby") return;
    ui.text(
      "network-status",
      e instanceof Error ? errorMessage(e.message) : t('online.failed'),
    );
  }
}
network.onMessage = (message) => {
  switch (message.type) {
    case 'championship': {
      if (mode !== 'online' || !['lobby','championship-bracket','loading','fight'].includes(screen)) return;
      championship = message.bracket; championshipReady = message.ready;
      const active = championship.rounds.flat().find(m => matchToken(m) === championshipMatch);
      if (!active || active.status !== 'playing') showChampionship();
      break;
    }
    case 'championship-start':
      if (screen !== 'championship-bracket' || !championship) return;
      championshipMatch = message.matchId; seat = message.seat;
      void start(message.characters, undefined, message.skins, false, undefined, message.stage ?? trainingRoom.id);
      break;
    case "input-wait": {
      const id=`input-wait-${message.seat}`;
      document.getElementById(id)?.remove();
      if(message.seconds>0){const notice=document.createElement('p');notice.id=id;notice.className='network-wait';notice.textContent=t('online.waitInput',{player:message.seat+1,seconds:message.seconds});ui.root.append(notice);}
      break;
    }
    case "room":
      if (screen !== "lobby") return;
      seat = message.seat; championshipSeat = message.seat;
      ui.text("network-status", t('online.created'));
      document.querySelector(".network-panel")!.innerHTML =
        `<span class="tag">${th('online.roomCode',{player:seat+1})}</span><div class="room-code">${message.code}</div><p>${th('online.share')}<br>${th('online.waitFighters')}</p><div id="room-roster"></div><p id="network-status"></p>`;
      network.send({ type: "ready" });
      break;
    case "roster":
      if (screen !== "lobby") return;
      if(message.stage && Object.hasOwn(stages,message.stage))selectedArena=message.stage;
      ui.text(
        "network-status",
        t('online.joined',{mode:message.mode==='ffa-tournament'?t('online.ffaTournamentShort'):message.mode==='ffa'?t('local.ffa.title'):message.mode==='championship'?t('local.champion.title'):message.mode==='elimination'?t('local.elimination.title'):message.mode==='elimination-party'?t('local.party.title'):message.mode.toUpperCase(),count:message.players.length,capacity:message.capacity}),
      );
      {
        const roster = document.getElementById("room-roster");
        if (roster)
          roster.innerHTML = Array.from(
            { length: message.capacity },
            (_, i) =>
              `<p style="color:${(message.mode === "2v2" || message.mode === "3v3") && message.players[i] ? teamColors[message.players[i].team] : playerColors[i % playerColors.length]}">P${i + 1}${(message.mode === "2v2" || message.mode === "3v3") && message.players[i] ? ` · ${teamName(message.players[i].team)}` : ""} · ${message.players[i] ? characters[message.players[i].character].displayName + " / " + escapeMarkup(skinName(message.players[i].character,fighterSkins(characters[message.players[i].character]).find(skin => skin.id === message.players[i].skin)??{id:"original",name:t("skin.original")})) + (i === seat ? t('championship.you') : "") : t('online.waitPlayer')}</p>`,
          ).join("");
      }
      break;
    case "start":
      if (screen !== "lobby") return;
      audio.play("ready");
      void start(message.characters, message.teams, message.skins, message.mode === "elimination" || message.mode === "elimination-party" ? message.mode : message.mode === "ffa-tournament",message.seed, message.stage ?? trainingRoom.id);
      break;
    case "input":
      if (message.matchId !== championshipMatch) break;
      rollback?.receive(message.frame, message.mask, message.seat);
      checkNetworkHealth();
      break;
    case "hash":
      if (message.seat !== -1 || message.matchId !== championshipMatch) break;
      if(!rollback?.isHashFrameRetained(message.frame))break;
      pendingHashes.set(`${message.seat}:${message.frame}`, {
        frame: message.frame,
        hash: message.hash,
      });
      checkNetworkHealth();
      break;
    case "error":
      audio.play("invalid");
      if (screen === "lobby") ui.text("network-status", errorMessage(message.message));
      else disconnectMessage(message.message);
      break;
    case "left":
      audio.play("disconnected");
      document.getElementById(`input-wait-${message.seat}`)?.remove();
      rollback?.disconnect(message.seat, message.frame);
      for (const key of pendingHashes.keys())
        if (key.startsWith(`${message.seat}:`)) pendingHashes.delete(key);
      checkNetworkHealth();
      break;
  }
};
function checkNetworkHealth(): boolean {
  if (!rollback) return true;
  for (const [key, { frame, hash }] of pendingHashes) {
    if(!rollback.isHashFrameRetained(frame)){pendingHashes.delete(key);continue;}
    const checked = rollback.verifyRemoteHash(frame, hash);
    if (checked !== undefined) pendingHashes.delete(key);
    if (checked === false) break;
  }
  if (rollback.desync === "OK") return true;
  // No authoritative state is available to repair this match safely.
  document.getElementById("match-result")?.remove();
  disconnectMessage(t('online.desync'));
  return false;
}
network.onClose = () => {
  if (mode === "online" && (screen === "fight" || screen === "lobby" || screen === "loading" || screen === "championship-bracket"))
    disconnectMessage(t('online.lost'));
};
function disconnectMessage(message: string) {
  viewRevision++;
  network.disconnect();
  if (document.getElementById("disconnect")) return;
  cancelBinding?.();
  if(controllerPanel)closeControllers();
  onlineControllerMenu=false;
  input.clear();menuNavigation.reset();
  paused = true;
  input.enabled = false;
  // Remove native modal dialogs too: they otherwise keep recovery controls inert.
  ui.render('');
  const overlay = document.createElement("div");
  overlay.className = "modal";
  overlay.id = "disconnect";
  const box = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = t('online.interrupted');
  const p = document.createElement("p");
  p.textContent = errorMessage(message);
  const button = document.createElement("button");
  button.className = "primary";
  button.dataset.action = "home";
  button.textContent = t("nav.menu");
  box.append(title, p, button);
  overlay.append(box);
  ui.root.append(overlay);
  button.focus();
}
function pauseContent():string {
  return `<div class="pause-match"><span class="overlay-kicker">${arenaName(simulation.stage).toUpperCase()} / ${mode === "training" ? th('home.training.name') : championship ? th('pause.localChampionship') : th('pause.localVersus')}</span><div class="pause-matchup">${simulation.state.fighters.map((f, i) => `<div><span>${th('controller.player',{player:i+1})}</span><strong>${characters[f.characterId].displayName}</strong><small>${mode === "training" ? (i === 1 ? th('pause.trainingPartner') : th('pause.freePractice')) : th('pause.lives',{count:f.lives})}</small></div>`).join('<i aria-hidden="true">/</i>')}</div></div><section class="pause-drawer"><span class="overlay-kicker">${th("pause.kicker")}</span><h2 id="pause-title">${th("pause.title1")}<br>${th("pause.title2")}</h2><p>${th("pause.description1")}<br>${th("pause.description2")}</p><div class="overlay-actions"><button class="overlay-action main-action" data-action="pause"><span>${th("pause.resume")}<small>${th("pause.resumeHelp")}</small></span><b aria-hidden="true">↗</b></button><button class="overlay-action" data-action="home"><span>${th("nav.menu")}<small>${th("pause.leaveHelp")}</small></span><b aria-hidden="true">→</b></button></div><button class="overlay-action" data-action="pause-settings">${th("nav.settings")}</button><button class="overlay-action" data-action="controllers">${th("controller.title")}</button><p data-controller-disconnect role="status"></p><span class="pause-key"><kbd data-prompt-pause>ESC</kbd> ${th("pause.resume")}</span></section>`;
}
function pause() {
  if (screen !== "fight" || document.getElementById("disconnect")) return;
  if (mode === "online") {
    toggleOnlineControllerMenu();
    return;
  }
  if(paused&&!idleTestMatch&&simulation.state.fighters.some((_,i)=>i>=2&&!input.controllers.ready(i))){controllerToast(t('pause.reconnect'));return;}
  input.clear();
  paused = !paused;
  audio.setPaused(paused);
  input.enabled = !paused;
  if (paused) {
    ui.root.insertAdjacentHTML(
      "beforeend",
      `<dialog class="match-overlay pause-overlay" id="pause" aria-labelledby="pause-title">${pauseContent()}</dialog>`,
    );
    const pauseDialog = document.getElementById("pause") as HTMLDialogElement;
    const training=ui.root.querySelector('.training');if(training)pauseDialog.querySelector('.pause-drawer')!.append(training);
    pauseDialog.showModal();
    pauseDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (paused) pause();
    });
  } else {
    const training=document.querySelector('#pause .training');if(training)ui.root.append(training);
    document.getElementById("pause")?.remove();
    input.clear();
  }
}
ui.onAction((action, element) => {
  audio.unlock();
  audio.play(actionSound(action));
  switch (action) {
    case 'online-controller-resume': toggleOnlineControllerMenu();break;
    case 'controllers': openControllers(); break;
    case 'controller-close': closeControllers(); break;
    case 'controller-cancel': input.controllers.capture=null;input.controllers.testing=null;input.clear();ui.text('controller-message',t('controller.ready'));break;
    case 'controller-assign': input.controllers.capture={player:Number(element.dataset.slot)};input.controllers.testing=null;input.clear();ui.text('controller-message',t('controller.assignPrompt',{player:Number(element.dataset.slot)+1}));break;
    case 'controller-keyboard': input.controllers.release(Number(element.dataset.slot));input.controllers.keyboardClaimed.add(Number(element.dataset.slot));input.clear();break;
    case 'controller-release': input.controllers.release(Number(element.dataset.slot));input.clear();break;
    case 'controller-identify': {const d=input.controllers.device(Number(element.dataset.slot));if(d?.connected){input.controllers.capture={identify:d.key};input.clear();ui.text('controller-message',t('controller.identifyPrompt',{player:d.player!+1}));}else ui.text('controller-message',t('controller.emptySlot'));break;}
    case 'controller-test': case 'controller-device-test': {const d=action==='controller-test'?input.controllers.device(Number(element.dataset.slot)):input.controllers.devices.get(Number(element.dataset.device));if(d?.connected){input.controllers.testing=d.key;input.controllers.capture=null;input.clear();ui.text('controller-message',t('controller.testing'));document.getElementById('controller-test')?.scrollIntoView({block:'nearest'});}else ui.text('controller-message',t('controller.assignFirst'));break;}

    case 'local-ffa': case 'local-2v2': case 'local-3v3': showLocalMatchSetup(action.slice(6) as LocalMatchMode); break;
    case 'local-match-idle-test':
    case 'local-match-start': {
      const idleTest=action==='local-match-idle-test';
      if(screen!=='local-match-setup'||mode!=='local'||(idleTest&&!developmentBuild))break;
      if(localMatchMode!=='ffa'&&localTeams.filter(t=>t===0).length!==localIds.length/2){audio.play('invalid');ui.text('local-match-error',t('setup.balanceError',{count:localIds.length/2}));break;}
      if(!idleTest&&localIds.some((_,i)=>!input.controllers.ready(i))){audio.play('invalid');ui.text('local-match-error',t('controller.deviceRequired'));break;}
      void start(localIds,localTeams,localSkins,false,undefined,undefined,idleTest);break;
    }

    case 'elimination': case 'elimination-party': showEliminationSetup(action); break;
    case 'elimination-start': {
      if(eliminationIds.some((_,i)=>!input.controllers.ready(i))){audio.play('invalid');ui.text('elimination-setup-error',t('controller.deviceRequired'));break;}
      void start(eliminationIds,undefined,eliminationSkins,localElimination);break;
    }
    case 'championship': showChampionshipSetup(); break;
    case 'championship-generate':
      championship = createChampionship(championshipEntrants.map((e,i) => ({...e, name: e.name.trim() || `Player ${i+1}`})));
      showChampionship(); break;
    case 'championship-play': playChampionship(element.dataset.match!); break;
    case 'championship-ready':
      if (championship && screen === 'championship-bracket' && !championshipReady.includes(championshipSeat)) {
        const match = findMatch(championship, element.dataset.match!);
        if (match && currentMatches(championship).includes(match)) network.send({type: 'championship-ready', matchId: element.dataset.token!});
      }
      break;
    case "home":
      home();
      break;
    case "back-fighters":
      selection();
      break;
    case "edit-player":
      selectSeat = 0;
      selection();
      break;
    case "local":
      mode = "local"; navigate("local-types"); ui.shell(localGameScreen()); break;
    case "local-versus":
      mode = "local"; selectSeat = 0; selection(); break;
    case "training":
    case "online":
      mode = action;
      selectSeat = 0;
      selection();
      break;
    case "practice-fighter":
      mode = "training"; selectSeat = 0;
      selected[0] = archiveId;
      selectedSkins[0] = resolveSkin(characters[archiveId], archiveSkin);
      selectSeat = 1;
      selection();
      break;
    case "characters":
      selection(true);
      break;
    case "pause-settings": settings(true);break;
    case "settings-close": closeSettings();break;
    case "settings":
      settings();
      break;
    case "pick-random":
    case "pick": {
      const randomPick = element.dataset.action === "pick-random";
      const ids = Object.keys(characters);
      const id = randomPick ? ids[Math.floor(Math.random() * ids.length)] : element.dataset.id!;
      if (screen === "roster") { if (archiveId !== id) archiveSkin = undefined; archiveId = id; }
      else { if (selected[selectSeat] !== id) selectedSkins[selectSeat] = resolveSkin(characters[id]); selected[selectSeat] = id; }
      selection(screen === "roster");
      ui.root.querySelector<HTMLButtonElement>(randomPick ? '[data-action="pick-random"]' : `[data-action="pick"][data-id="${id}"]`)?.focus();
      break;
    }
    case "confirm-fighter":
      if ((mode === "local" || mode === "training") && selectSeat === 0) {
        selectSeat = 1;
        selection();
      } else stage();
      break;
    case "launch":
      if (mode === "online") lobby();
      else void start();
      break;
    case "create":
      void connect(true);
      break;
    case "join":
      void connect(false);
      break;
    case "pause":
      pause();
      break;
    case "reset":
      simulation.resetPositions(); recentGameplayEvents.length=0;
      break;
    case "debug":
      if(developmentBuild||mode === "training")debug = !debug;
      break;
    case "rematch":
      if(simulation.state.elimination)void start(simulation.state.fighters.map(f=>f.characterId),undefined,simulation.state.skins,simulation.state.elimination.mode);
      else void start(simulation.state.fighters.map(f=>f.characterId),simulation.state.teams,simulation.state.skins);
      break;
    case "fullscreen":
      void toggleFullscreen().catch(()=>controllerToast("Fullscreen is unavailable. Try maximizing the window."));
      break;
    case "bind": {
      cancelBinding?.();
      const player = Number(element.dataset.player), index = Number(element.dataset.index);
      const original = input.bindings[player][index];
      if(controllerHints.active){controllerTextEntry(element,code=>{input.bindings.forEach(row=>row.forEach((key,i)=>{if(key===code)row[i]=original;}));input.bindings[player][index]=code;input.save();refreshBindings();},true);break;}
      element.textContent = "PRESS KEY";
      const handler = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (e.code === "Escape") { cancelBinding?.(); return; }
        if (["F1", "KeyR"].includes(e.code)) { element.textContent = t("binding.reserved"); return; }
        input.bindings.forEach(row => row.forEach((key, i) => { if (key === e.code) row[i] = original; }));
        input.bindings[player][index] = e.code;
        input.save();
        cancelBinding?.();
        input.clear();
        refreshBindings();
      };
      cancelBinding = () => {
        window.removeEventListener("keydown", handler, true);
        element.textContent = original;
        cancelBinding = undefined;
      };
      window.addEventListener("keydown", handler, true);
      break;
    }
  }
});
const onBlur=() => {
  audio.setFocus(false);
  if (screen === "fight" && mode !== "online" && !paused) pause();
};
window.addEventListener("blur",onBlur);
const audioListeners=new AbortController();
const audioOptions={signal:audioListeners.signal};
window.addEventListener('pointerdown',()=>audio.unlock(),audioOptions);
window.addEventListener('keydown',()=>audio.unlock(),audioOptions);
window.addEventListener('focus',()=>audio.setFocus(!document.hidden),audioOptions);
document.addEventListener('visibilitychange',()=>audio.setFocus(!document.hidden&&document.hasFocus()),audioOptions);
let lastAudioFocus:Element|null=null;
const focusAudio=(event:Event)=>{
 const element=(event.target as Element)?.closest('button,select,input');
 if(element&&element!==lastAudioFocus){lastAudioFocus=element;audio.play('menu_hover');}
};
ui.root.addEventListener('pointerover',focusAudio,audioOptions);
ui.root.addEventListener('focusin',focusAudio,audioOptions);
ui.root.addEventListener('change',event=>{
 const el=event.target as HTMLElement;
 if(el.matches('[data-skin-seat],#fighter-skin,[data-player-slot] select'))audio.play('fighter_selected');
},audioOptions);
// Development-only read-only diagnostics, no production debug UI.
if((import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV)Object.assign(window,{abrozAudioDebug:()=>audio.diagnostics()});
const pingTimer=setInterval(() => {
  if (rollback) network.measurePing();
}, 2000);
let presentationTime=0;
function loop(now: number) {
  updateControllers(now);
  if(screen==='settings'&&Math.floor(now/250)!==Math.floor(last/250)){const panel=document.getElementById('audio-debug');if(panel)panel.textContent=JSON.stringify(audio.diagnostics(),null,2);}
  if(screen==='home'){
    const step=homeCastTick(now,homeStartedAt);
    if(step!==homeCastStep){homeCastStep=step;updateHomeCast(ui.root,step);}
  }
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps = fps * 0.95 + (1 / Math.max(0.001, elapsed)) * 0.05;
  if (screen === "fight" && !paused) {
    accumulator += elapsed;
    let ticks = 0;
    while (accumulator >= 1 / (60*matchTimeScale(simulation.state)) && ticks++ < 6) {
      const stepDuration=1/(60*matchTimeScale(simulation.state));
      input.refresh(false);
      renderInterpolation.capture(simulation.state);
      if (rollback) {
        rollback.schedule(input.poll(0), (frame, mask) =>
          network.send({ type: "input", frame, mask, matchId: championshipMatch }),
        );
        if (!rollback.tick()) {
          accumulator = 0;
          break;
        }
        const hashFrame =
          Math.floor(
            Math.min(rollback.confirmed, simulation.state.frame - 1) / 60,
          ) * 60;
        if (hashFrame >= 0 && hashFrame > lastHash) {
          const hash = rollback.confirmedHash(hashFrame);
          if (hash) {
            network.send({ type: "hash", frame: hashFrame, hash, matchId: championshipMatch });
            lastHash = hashFrame;
          }
        }
        if (!checkNetworkHealth()) break;
      } else simulation.step(simulation.state.fighters.map((_,i)=>input.poll(i)));
      renderInterpolation.complete(simulation.state);
      for(const e of simulation.gameplayEvents)recentGameplayEvents.push(`${e.frame} P${e.actor+1} ${e.type} ${e.detail}${e.amount===undefined?'':` ${e.amount}`}`);
      recentGameplayEvents.splice(0,Math.max(0,recentGameplayEvents.length-12));
      renderer.consume(
        simulation.events.map((e) => ({
          ...e,
          type:
            characters[simulation.state.fighters[e.player].characterId].effects[
              e.type
            ] ?? e.type,
        })),
      );
      gameAudio.consume(simulation.state,simulation.events,rollback?[...simulation.gameplayEvents.filter(e=>e.type!=='DamageApplied'),...rollback.drainConfirmedImpacts()]:simulation.gameplayEvents,simulation.stage.id,simulation.stage.width,
        mode==='online'?[seat]:mode==='training'?[0]:simulation.state.fighters.map((_,i)=>i),!rollback||rollback.confirmed>=simulation.state.endedAt-1,championship?(championship.round===championship.rounds.length-1?'championship-final':'championship'):simulation.state.elimination?.mode==='elimination-party'?'party':'match',rollback?rollback.confirmed+1:Infinity);
      accumulator -= stepDuration;
    }
    if (!paused) updateHUD();
  } else {accumulator = 0;renderInterpolation.reset();}
  renderer.debug = debug && screen === "fight";
  renderer.mountLabels=simulation.state.fighters.map((_,i)=>{
    if(screen!=='fight'||paused||(mode==='online'?i!==seat:mode==='training'?i!==0:false))return undefined;
    const player=mode==='online'?0:i,key=(displayBindings(player)?.[5]??'').replace(/^Key|^Digit/,'').replace('Arrow','');
    const pad=input.controllers.device(player)?.connected;
    return escapeMarkup(key+(pad?` / Pad ${input.gamepadButtons[1]}`:''));
  });
  const visualElapsed=elapsed*(screen==='fight'?matchTimeScale(simulation.state):1);
  presentationTime+=visualElapsed;
  renderer.draw(
    screen === "fight" && !paused && !debug ? renderInterpolation.view(simulation.state,accumulator * 60 * matchTimeScale(simulation.state)) : simulation.state,
    visualElapsed,
    presentationTime,
    !["fight", "result"].includes(screen),
    simulation.stage,
    renderInterpolation.seconds(screen === "fight" && !paused ? accumulator * 60 * matchTimeScale(simulation.state) : 1),
  );
  animationFrame=requestAnimationFrame(loop);
}
let animationFrame=0;
home();
animationFrame=requestAnimationFrame(loop);
(import.meta as ImportMeta & {hot?:{dispose(callback:()=>void):void}}).hot?.dispose(()=>{
 audioListeners.abort();
 controllerHints.dispose();viewRevision++;cancelBinding?.();cancelAnimationFrame(animationFrame);clearInterval(pingTimer);
 window.removeEventListener('blur',onBlur);controllerNotice.remove();
 network.disconnect();input.dispose();ui.dispose();assets.dispose();audio.dispose();renderer.dispose();void disposeFighterSprites();
});
