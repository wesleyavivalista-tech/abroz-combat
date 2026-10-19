import {OnlineDiagnostics} from './onlineDiagnostics.js';
import {matchPerformance} from './matchPerformance.js';
import {randomArena} from '../../../packages/game-core/stages/random.js';
import './ui/persistent-championship.css';
import {PersistentController} from './persistentController.js';
import {MultiplayerSelection,multiplayerSelection,type SelectionAction} from './ui/MultiplayerSelection.js';
import {SpectatorPlayback} from './networkSpectator.js';
import {onlineMenu,createRoom,joinCode,browseRooms,sharedLobby,lobbyFighters,lobbyArenas,onlineText} from './ui/OnlineLobby.js';
import type {RoomView,RoomSummary,RoomSettings} from '../../../packages/shared/protocol.js';
import './ui/online-lobby.css';
import {championshipVictory,preloadChampionshipArtwork,bindChampionshipArtwork} from './ui/ChampionshipVictory.js';
import './ui/championship-victory.css';
import {matchStatisticsScreen,animateStatistics,statisticsTabs,type StatisticsTab} from './ui/MatchStatistics.js';
import type {MatchStatistics} from '../../../packages/game-core/simulation/MatchStatistics.js';
import './ui/match-statistics.css';
import {LocalPlayers} from './input/LocalPlayers.js';
import {refreshPlayerManagement} from './ui/PlayerManagement.js';
import './ui/player-management.css';
import {presentCombatEvents} from './rendering/CombatEventPresentation.js';
import {decodeSnapshot,type RecoveryState} from '../../../packages/shared/recovery.js';
import {bindDiagnosticButton} from './diagnostics.js';
import {errorMessage} from './i18n/errors.js';
import {arenaName} from './i18n/content.js';
import {getLocale, formatNumber, setLocale, languageOptions, t, th, inputLabelKeys} from './i18n/index.js';
import {finalDeathActive,matchTimeScale} from '../../../packages/game-core/simulation/UndeadSystem.js';
import {matchTimer} from './ui/MatchTimer.js';
import {matchCountdown} from './ui/MatchCountdown.js';
import {toggleFullscreen,desktopBridge} from './platform/runtime.js';
import {arenaSelection} from './ui/ArenaSelection.js';
import './ui/arena-selection.css';
import {ControllerHints} from './input/ControllerHints.js';
import {controllerTextEntry} from './input/ControllerTextEntry.js';
import {MenuNavigation} from "./input/MenuNavigation.js";
import {STANDARD} from "./input/GamepadManager.js";
import {controllerSettings,refreshControllerLabels,controllerDiagnostics} from "./ui/Controllers.js";
import "./ui/controllers.css";
import {localMatchTitle,localMatchTeams,type LocalMatchMode} from './ui/LocalMatchSetup.js';
import {eliminationTitle,eliminationPanel,eliminationStatus} from './ui/Elimination.js';
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
import { resolveSkin } from "../../../packages/game-core/characters/skins.js";
import type { OnlineMode } from "../../../packages/shared/protocol.js";
import { fighterPresentation, escapeMarkup } from "./ui/FighterPresentation.js";
import "./style.css";
import "./ui/combat-menu.css";
import "./ui/selection-finish.css";
import './ui/multiplayer-selection.css';
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
let spectatorPlayback:SpectatorPlayback|null=null,spectatorTarget=-1;
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
let verifiedHashFrame = -1;
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
network.diagnosticsEnabled=developmentBuild&&new URLSearchParams(location.search).get('netdebug')==='1';
const onlineDiagnostics=new OnlineDiagnostics(network.diagnosticsEnabled);
let localMatchMode:LocalMatchMode='ffa',localIds:string[]=[],localSkins:string[]=[],localTeams:number[]=[];
const menuNavigation = new MenuNavigation();
let pauseOwner:number|null=null;
let controllerPanel=false;
let controllerBoardActive=true;
let localPlayersManaged=false;
const playerLobby=new LocalPlayers(input.controllers);
let playersNext:((count:number)=>void)|null=null;
function localInputReady(slot:number){return mode==='local'&&localPlayersManaged?playerLobby.connected(slot):input.controllers.ready(slot);}
function showPlayers(limit:number,minimum:number,required:number|undefined,next:(count:number)=>void){
 mode='local';localPlayersManaged=true;playerLobby.configure(limit,minimum,required);
 navigate('local-players');playersNext=next;
 ui.shell(`<main class="player-board-page"><div id="player-management"></div></main>`);
 refreshPlayerManagement(ui.root,playerLobby,true);
}
function continuePlayers(){if(!playerLobby.canContinue||!playersNext)return;const next=playersNext;playersNext=null;input.clear();next(playerLobby.count);}
function playerTools(){
 if(!controllerPanel)openControllers(true);
 controllerBoardActive=false;
 const panel=document.getElementById('controllers-dialog')!,tools=panel.querySelector<HTMLElement>('#controller-tools'),board=panel.querySelector<HTMLElement>('#player-management');if(tools)tools.hidden=false;if(board)board.hidden=true;
 document.querySelector<HTMLElement>('[data-action="controller-assign"]')?.focus();input.clear();
}
function playerBoard(){controllerBoardActive=true;document.querySelector('#controllers-dialog #controller-tools')?.setAttribute('hidden','');document.querySelector('#controllers-dialog #player-management')?.removeAttribute('hidden');input.clear();refreshPlayerManagement(ui.root,playerLobby,screen==='local-players'&&!controllerPanel);}

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
function openControllers(tools=false){
 if(controllerPanel)return;
 cancelBinding?.();
 if(screen==='fight'&&!paused&&mode!=='online')pause();
 if(screen!=='local-players')playerLobby.configure(['fight','local-match-setup','elimination-setup','select','stage'].includes(screen)?activeInputSlots():input.controllers.cap,1);
 controllerBoardActive=!tools;
 if(mode==='local'){if(!localPlayersManaged&&screen==='fight')for(let i=0;i<Math.min(2,activeInputSlots());i++)if(!input.controllers.device(i))playerLobby.keyboards.add(i);localPlayersManaged=true;}
 controllerPanel=true;input.clear();menuNavigation.reset();
 const dialog=document.createElement('dialog');dialog.id='controllers-dialog';dialog.className='controller-dialog';
 dialog.innerHTML=controllerSettings(input.controllers);ui.root.append(dialog);dialog.showModal();
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeControllers();});
 dialog.querySelector<HTMLSelectElement>('#controller-deadzone')!.onchange=e=>{input.controllers.deadzone=Number((e.target as HTMLSelectElement).value);input.clear();input.save();};
 refreshControllerLabels(dialog,input.controllers);controllerPanelRevision=-1;
 if(tools)playerTools();else{refreshPlayerManagement(dialog,playerLobby,false);dialog.querySelector<HTMLElement>('[data-action="players-tools"]')?.focus();}
}
function closeControllers(){input.controllers.cancelMapping();controllerPanel=false;input.controllers.capture=null;input.controllers.testing=null;document.getElementById('controllers-dialog')?.remove();input.clear();menuNavigation.reset();}
function onlineMenuContent():string {
 return `<h2>${th('pause.onlineTitle')}</h2><p>${th('pause.onlineHelp')}</p><button data-action="online-controller-resume">${th('pause.return')}</button><button data-action="pause-settings">${th('pause.settings')}</button>${restartButton()}<button data-action="home">${th('pause.leave')}</button>`;
}
function toggleOnlineControllerMenu(){
 if(document.getElementById("restart-confirm")){cancelRestart();return;}
 if(document.getElementById('disconnect'))return;
 onlineControllerMenu=!onlineControllerMenu;input.clear();input.enabled=!onlineControllerMenu;menuNavigation.reset();
 if(!onlineControllerMenu){document.getElementById('online-controller-menu')?.remove();return;}
 const dialog=document.createElement('dialog');dialog.id='online-controller-menu';dialog.className='controller-dialog';
 dialog.innerHTML=onlineMenuContent();
 ui.root.append(dialog);dialog.showModal();dialog.addEventListener('cancel',e=>{e.preventDefault();toggleOnlineControllerMenu();});
}
function controllerBack(){
 const persistentDialog=document.getElementById('persistent-dialog');if(persistentDialog){persistentDialog.dispatchEvent(new Event('cancel',{cancelable:true}));return;}
 if(screen==='lobby'&&!document.querySelector('dialog[open]')){onlineBack();return;}
 if(screen==='championship-victory'){home();return;}
 if(screen==='championship-bracket'&&championship?.complete&&championship.champion!==null){showChampionVictory();return;}
 if(screen==='statistics'){restoreVictory();return;}
 if(document.getElementById("restart-confirm")){cancelRestart();return;}
 if(document.getElementById('disconnect')){home();return;}
 const editor=document.getElementById('controller-text-entry');if(editor){editor.dispatchEvent(new Event('cancel',{cancelable:true}));return;}
 if(controllerPanel){if(input.controllers.mappings.wizard||input.controllers.capture||input.controllers.testing!==null){input.controllers.cancelMapping();input.controllers.capture=null;input.controllers.testing=null;input.clear();ui.text('controller-message',t('controller.cancelled'));}else closeControllers();return;}
 const settingsDialog=document.getElementById('settings-dialog');if(settingsDialog){closeSettings();return;}
 if(cancelBinding){cancelBinding();return;}

 audio.play("menu_back");
 if(onlineControllerMenu){toggleOnlineControllerMenu();return;}
 if(screen==='fight'){if(document.getElementById('match-result'))home();else if(paused)pause();return;}
 if(screen==='local-players'){playersNext=null;mode='local';navigate('local-types');ui.shell(localGameScreen());return;}
 if(screen==='select'){if(selectSeat===1){selectSeat=0;selection();}else home();return;}
 if(multiSelectionActive()){multiSelectionAction(0,'back');return;}
 if(screen==='stage'){selection();return;}
 const back=ui.root.querySelector<HTMLElement>('main [data-action="local"],main [data-action="back-fighters"]')??ui.root.querySelector<HTMLElement>('[data-action="home"]');back?.click();
}
function activeInputSlots(){if(screen==='local-players')return playerLobby.limit;return mode==='online'||mode==='training'?1:screen==='local-match-setup'?localIds.length:screen==='elimination-setup'?eliminationIds.length:['fight','result','statistics'].includes(screen)?simulation.state.fighters.length:2;}
function updateControllers(now:number){
 const pads=input.controllers;
 const boardActive=(screen==='local-players'&&!controllerPanel||controllerPanel&&controllerBoardActive)&&!pads.capture&&pads.testing===null&&!pads.mappings.wizard;
 pads.managementEvents=boardActive;
 input.localKeyboardSeats=mode==='local'&&localPlayersManaged?playerLobby.keyboards:null;
 const joinAllowed=!boardActive&&!(mode==='local'&&localPlayersManaged&&(controllerPanel||['select','stage','local-match-setup','elimination-setup','loading','fight'].includes(screen)))&&screen!=='loading'&&(controllerPanel||screen!=='fight')&&!pads.capture&&pads.testing===null;
 input.refresh(joinAllowed,controllerPanel?pads.cap:screen==='home'||screen==='local'?pads.cap:activeInputSlots());
 for(const action of input.systemActions.splice(0)){
  if(action==='debug'&&(developmentBuild||mode==='training'))debug=!debug;
  if(action==='reset'&&mode==='training'&&screen==='fight'){simulation.resetPositions();recentGameplayEvents.length=0;}
  if(action==='pause'){if(controllerPanel||document.getElementById('settings-dialog')||document.getElementById('controller-text-entry')||screen==='lobby'||screen==='local-players'||screen==='statistics'||screen==='championship-victory'||screen==='championship-bracket'&&championship?.complete)controllerBack();else{pauseOwner=null;pause();}}
 }
 for(const event of pads.drain()){
  if(event.kind==='menu'||event.kind==='join'||event.kind==='activity'){audio.unlock();const d=pads.devices.get(event.device);controllerHints.use(d?.brand??'generic',d&&d.mapping!=='standard'?pads.mappings.profiles.get(d.profileKey):undefined);}
  if(event.kind==='join'||event.kind==='assigned')audio.play("joined");
  if(event.kind==='disconnect'&&event.player!==null&&multiSelectionActive()){if(multiSelection!.phases[event.player]==='ready')multiSelection!.phases[event.player]='skin';drawMultiSelection();}
  if(event.kind==='disconnect'){audio.play("disconnected");if(mode==='online'&&event.player===0&&screen==='lobby')controllerToast(t('controller.lost',{player:1}));}
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
  if(boardActive&&event.kind==='menu'){
   if(event.action==='up'||event.action==='down'){(controllerPanel?document.querySelector('.controller-page'):document.querySelector('.player-board-page'))?.scrollBy({top:event.action==='down'?180:-180,behavior:'smooth'});continue;}
   if(event.action==='previous'||event.action==='next'){playerTools();break;}
   const result=playerLobby.handle(event);
   if(result==='continue'){if(controllerPanel)closeControllers();else continuePlayers();break;}
   continue;
  }
  if(event.kind!=='menu'||event.player===null||!event.action)continue;
  const player=event.player,action=event.action;
  if(multiSelectionActive()&&!controllerPanel&&!document.querySelector('dialog[open]')){multiSelectionAction(player,action);continue;}
  if(mode==='online'&&player!==0&&!controllerPanel)continue;
  if(screen==='statistics'&&(action==='previous'||action==='next')){if(!menuNavigation.claim(player,now))continue;statisticsTab=statisticsTabs[(statisticsTabs.indexOf(statisticsTab)+(action==='next'?1:3))%4];renderStatistics();continue;}
  if(action==='pause'&&(document.getElementById('controller-text-entry')||document.getElementById('settings-dialog'))){controllerBack();break;}
  if(action==='pause'&&!controllerPanel&&screen==='fight'&&!document.getElementById('match-result')){
   if(mode==='online'){if(player===0)toggleOnlineControllerMenu();break;}
   if(player>=activeInputSlots()||paused&&pauseOwner!==null&&pauseOwner!==player)continue;
   if(!paused)pauseOwner=player;pause();break;
  }
  if(screen==='fight'&&isSpectating()&&!document.querySelector('dialog[open]')&&(action==='previous'||action==='next'||action==='left'||action==='right')){cycleSpectator(action==='previous'||action==='left'?-1:1);continue;}
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
 if(!multiSelectionActive()&&!boardActive&&controllerHints.active&&(modal||screen!=='fight')&&(!(modal??ui.root).contains(document.activeElement)||!(document.activeElement as HTMLElement)?.matches('button,select,input,textarea,a[href],summary,[tabindex="0"]')))menuNavigation.sync(modal??ui.root,screen==='select'&&mode==='local'?selectSeat:0,el=>!!modal||screen!=='select'||!el.matches('[data-skin-seat]')||Number(el.dataset.skinSeat)===selectSeat);
 controllerHints.update(screen==='fight'&&!modal,screen==='select',boardActive?t('players.controls'):screen==='statistics'?t('statistics.controller'):screen==='fight'&&isSpectating()?`${controllerHints.button(4)} / ${controllerHints.button(5)} · ${onlineText('Switch fighter','Trocar lutador')}   ${controllerHints.button(9)} · ${onlineText('Options','Opções')}`:undefined);
 document.querySelectorAll<HTMLElement>('[data-control-index]').forEach(el=>{const value=controlLabel(displayBindings(Number(el.dataset.controlPlayer))[Number(el.dataset.controlIndex)]??'');if(value&&el.textContent!==value)el.textContent=value;});
 const disconnected=pads.slots.map((_,i)=>i).filter(i=>i<activeInputSlots()&&pads.device(i)&&!pads.device(i)!.connected);
 if(disconnected.length&&screen==='fight'){
  const p=disconnected[0];
  if(!controllerPanel){
   // Only an unassigned pad may reclaim a missing seat during play.
   const replacement=Array.from(pads.devices.values()).find(d=>d.connected&&d.player===null&&pads.supported(d)&&now-d.lastActivity<80&&(!(mode==='local'&&localPlayersManaged)||d.buttons[STANDARD.confirm]>.5&&!(d.previousButtons[STANDARD.confirm]>.5)));
   if(replacement)pads.assign(replacement.key,p);
  }
  ui.root.querySelectorAll<HTMLElement>('[data-controller-disconnect]').forEach(el=>el.textContent=t('controller.lostHelp',{player:p+1}));
 }else ui.root.querySelectorAll<HTMLElement>('[data-controller-disconnect]').forEach(el=>el.textContent='');
 if(controllerPanel&&pads.capture&&Array.from(pads.devices.values()).some(d=>d.connected&&d.buttons[STANDARD.pause]>.5&&d.buttons[STANDARD.view]>.5)){pads.capture=null;input.clear();ui.text('controller-message',t('controller.cancelled'));}
 if(controllerPanel&&pads.testing!==null){const d=pads.devices.get(pads.testing);if(d&&d.buttons[STANDARD.pause]>.5&&d.buttons[STANDARD.view]>.5){pads.testing=null;input.clear();ui.text('controller-message',t('controller.finished'));}}
 if(controllerPanelRevision!==pads.revision||now-controllerLastPaint>150){
  refreshControllerLabels(ui.root,pads);
  if(controllerPanel)controllerDiagnostics(ui.root,pads,now);
  if(boardActive)refreshPlayerManagement(ui.root,playerLobby,screen==='local-players'&&!controllerPanel);
  controllerPanelRevision=pads.revision;controllerLastPaint=now;
 }
 const notice=disconnected.length&&screen==='fight'?t('controller.lostNotice',{player:disconnected[0]+1,online:mode==='online'?t('controller.onlineContinues'):''}):now<controllerMessageUntil?controllerMessage:joinAllowed?t('controller.joinHint'):'';
 if(controllerNotice.textContent!==notice)controllerNotice.textContent=notice;
 controllerNotice.hidden=!notice;
}
let multiSelection:MultiplayerSelection|null=null;
function multiSelectionActive(){return mode==='local'&&(screen==='local-match-setup'||screen==='elimination-setup')&&!!multiSelection;}
function drawMultiSelection(fresh=false){
 if(!multiSelectionActive())return;
 const m=multiSelection!,elimination=screen==='elimination-setup';
 const focus=document.activeElement as HTMLElement|null;
 const focusKey=focus?.dataset.mpFighter;
 const markup=multiplayerSelection(m,elimination?eliminationTitle(localElimination):localMatchTitle(localMatchMode),!elimination&&localMatchMode!=='ffa'?localTeams:undefined,elimination);
 if(fresh||!ui.root.querySelector('.mp-selection'))ui.shell(markup);
 else{
  const template=document.createElement('template');template.innerHTML=markup;
  for(const selector of ['.mp-preview','.mp-console .ac-roster>div','.mp-footer>.primary']){
   const current=ui.root.querySelectorAll(selector),next=template.content.querySelectorAll(selector);
   current.forEach((el,i)=>{if(next[i]&&(el.matches('.mp-preview')?el.getAttribute('data-selection-key')!==next[i].getAttribute('data-selection-key'):el.outerHTML!==next[i].outerHTML))el.replaceWith(next[i]);});
  }
 }
 const arena=ui.root.querySelector('.mp-arena')!;if(!arena.firstElementChild){arena.innerHTML=arenaPicker();bindArenaPicker();}
 (arena.querySelector('select') as HTMLSelectElement).value=selectedArena;
 refreshControllerLabels(ui.root,input.controllers);
 ui.root.querySelectorAll<HTMLElement>('[data-mp-keyboard]').forEach(el=>{const seat=Number(el.dataset.mpKeyboard);el.textContent=playerLobby.keyboards.has(seat)&&!input.controllers.device(seat)?`${input.bindings[seat]?.slice(0,4).map(controlLabel).join(' / ')} · ${controlLabel(input.bindings[seat]?.[4]??'')}: ${onlineText('Confirm','Confirmar')} · ${controlLabel(input.bindings[seat]?.[5]??'')}: ${onlineText('Back','Voltar')}`:'';});
 ui.root.querySelectorAll<HTMLElement>('[data-mp-seat]').forEach(el=>el.onclick=()=>{m.mouseSeat=Number(el.dataset.mpSeat);drawMultiSelection();});
 ui.root.querySelectorAll<HTMLElement>('[data-mp-fighter]').forEach(el=>el.onclick=()=>{if(m.phases[m.mouseSeat]!=='fighter')return;m.pick(m.mouseSeat,el.dataset.mpFighter!);multiSelectionAction(m.mouseSeat,'confirm');});
 ui.root.querySelectorAll<HTMLElement>('[data-mp-skin]').forEach(el=>el.onclick=()=>{const seat=Number(el.dataset.mpPlayer);if(m.phases[seat]!=='skin')return;m.skins[seat]=el.dataset.mpSkin!;multiSelectionAction(seat,'confirm');});
 ui.root.querySelectorAll<HTMLElement>('[data-mp-back]').forEach(el=>el.onclick=()=>multiSelectionAction(Number(el.dataset.mpBack),'back'));
 ui.root.querySelectorAll<HTMLElement>('[data-mp-team]').forEach(el=>el.onclick=()=>{const seat=Number(el.dataset.mpTeam);localTeams[seat]=1-localTeams[seat];m.phases[seat]='fighter';drawMultiSelection();});
 if(focusKey)ui.root.querySelector<HTMLElement>(`[data-mp-fighter="${focusKey}"]`)?.focus({preventScroll:true});
}
function multiSelectionAction(player:number,action:string){
 const m=multiSelection;if(!m||player>=m.ids.length)return;
 if(action==='pause'){if(player===0){if(m.ready)ui.root.querySelector<HTMLButtonElement>('.mp-footer [data-action]')?.click();else openControllers();}return;}
 // The owner cycles arenas with shoulder buttons after locking in.
 if(screen==='local-match-setup'&&player===0&&m.phases[0]==='ready'&&(action==='previous'||action==='next')){
  const ids=Object.keys(stages);selectedArena=ids[(ids.indexOf(selectedArena)+(action==='next'?1:-1)+ids.length)%ids.length];drawMultiSelection();return;
 }
 if(screen==='local-match-setup'&&localMatchMode!=='ffa'&&m.phases[player]==='fighter'&&(action==='previous'||action==='next')){localTeams[player]=1-localTeams[player];audio.play('menu_confirm');drawMultiSelection();return;}
 if(!['left','right','up','down','previous','next','confirm','back'].includes(action))return;
 const tiles=Array.from(ui.root.querySelectorAll<HTMLElement>('[data-mp-fighter]'));
 const columns=tiles.filter(el=>el.offsetTop===tiles[0]?.offsetTop).length||8;
 if(m.handle(player,action as SelectionAction,columns)){audio.play(action==='confirm'?'ready':action==='back'?'menu_back':'fighter_selected');drawMultiSelection();if(m.phases[player]==='fighter')ui.root.querySelector<HTMLElement>(`[data-mp-fighter="${m.cursors[player]}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});}
 else if(action==='back'&&player===0){mode='local';navigate('local-types');ui.shell(localGameScreen());}
}
function showLocalMatchSetup(kind:LocalMatchMode=localMatchMode,count=kind==='3v3'?6:4){
 mode='local';championship=null;championshipMatch=undefined;
 if(kind!==localMatchMode||count!==localIds.length)localTeams=localMatchTeams(kind,count);
 localMatchMode=kind;
 localIds=Array.from({length:count},(_,i)=>localIds[i]??rosterIds[i%rosterIds.length]);
 localSkins=localIds.map((id,i)=>resolveSkin(characters[id],localSkins[i]));
 navigate('local-match-setup');multiSelection=new MultiplayerSelection(localIds,localSkins);drawMultiSelection(true);
}
function showEliminationSetup(kind:EliminationMode=localElimination,count=kind==='elimination-party'?6:4){
 mode='local';localElimination=kind;championship=null;championshipMatch=undefined;
 eliminationIds=Array.from({length:count},(_,i)=>eliminationIds[i]??rosterIds[i%rosterIds.length]);
 eliminationSkins=eliminationIds.map((id,i)=>resolveSkin(characters[id],eliminationSkins[i]));
 navigate('elimination-setup');multiSelection=new MultiplayerSelection(eliminationIds,eliminationSkins);drawMultiSelection(true);
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
function showChampionship(note = '', review = false) {
  if (!championship) return;
  preloadChampionshipArtwork(championship);
  if(championship.complete&&championship.champion!==null&&!review){showChampionVictory();return;}
  spectatorPlayback=null;championshipMatch = undefined; rollback = null; pendingHashes.clear(); paused = false;
  navigate('championship-bracket', true);
  ui.shell(championshipBracket(championship, mode === 'online', championshipSeat, championshipReady, note)+(mode==='online'&&!championship.complete?`<div class="on-watch-duels">${championship.rounds.flat().filter(m=>m.status==='playing'&&!m.slots.includes(championshipSeat)).map(m=>`<button data-action="spectator-duel" data-match="${matchToken(m)}">${onlineText('Watch match','Assistir partida')} ${m.id}</button>`).join('')}</div>`:''), `1v1 CHAMPIONSHIP / ${onlineText("RANDOM ARENAS","ARENAS ALEATÓRIAS")}`);
}
function showChampionVictory(){
 if(!championship?.complete||championship.champion===null)return;
 spectatorPlayback=null;championshipMatch=undefined;rollback=null;pendingHashes.clear();paused=false;
 navigate('championship-victory',true);audio.setMusic('victory',selectedArena);
 ui.render(championshipVictory(championship,mode==='online'));bindChampionshipArtwork(ui.root);
 ui.root.querySelector<HTMLButtonElement>('[data-champion-default]')?.focus({preventScroll:true});
}
function playChampionship(id: string) {
  if (!championship || screen !== 'championship-bracket' || mode !== 'local') return;
  launchChampionshipMatch(id);
}
function launchChampionshipMatch(id:string){
  if(!championship||mode!=='local')return;
  const m = startBracketMatch(championship, id);
  championshipMatch = matchToken(m);
  const entrants = m.slots.map(id => championship!.entrants.find(e => e.id === id)!);
  void start(entrants.map(e => e.character), undefined, entrants.map(e => e.skin));
}
function navigate(next: string, keepConnection = false) {
  viewRevision++;restartTarget=null;restartPending=false;stopStatisticsAnimation?.();stopStatisticsAnimation=undefined;
  if(screen==='local-players'&&next!=='local-players')playersNext=null;
  if(controllerPanel)closeControllers();
  onlineControllerMenu=false;
  cancelBinding?.();
  if (!keepConnection && mode === "online" && ["lobby", "loading"].includes(screen)) { network.disconnect(); rollback = null; }
  ui.root.dataset.navScreen=next;
  screen = next; audio.setPaused(false); audio.fadeCombat(); audio.setMusic(screenMusic(next)); input.enabled = false; input.clear();
  menuNavigation.reset(); pauseOwner=null;
}
function home() {
  persistentFight=false;
  network.disconnect();
  championship = null; championshipMatch = undefined; championshipReady = [];
  rollback = null;spectatorPlayback=null;renderer.spectatorTarget=undefined;
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
  if(mode==='local'&&(screen==='elimination-setup'||screen==='championship-setup'))return `<label class="arena-picker">${th("arena.label")} <select id="arena-choice" disabled><option value="${selectedArena}">${onlineText("Random every match","Aleatória a cada partida")}</option></select></label>`;
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
let authoritativeStatistics:MatchStatistics|null=null;
let statisticsTab:StatisticsTab='overview',statisticsSeat=0,statisticsReturnStatus='';
let stopStatisticsAnimation:(()=>void)|undefined;
function renderStatistics(){
 const stats=mode==='online'?authoritativeStatistics:simulation.state.statistics;
 if(!stats?.finalized||championship)return;
 const focused=document.activeElement as HTMLElement|null,action=focused?.dataset.action,tab=focused?.dataset.tab,selectedSeat=focused?.dataset.seat;
 stopStatisticsAnimation?.();if(screen!=='statistics')menuNavigation.reset();viewRevision++;screen='statistics';ui.root.dataset.navScreen=screen;input.enabled=false;input.clear();
 ui.shell(matchStatisticsScreen(simulation.state,stats,mode==='online',statisticsTab,statisticsSeat,statisticsReturnStatus,persistentFight));
 const restore=[...ui.root.querySelectorAll<HTMLElement>('button')].find(el=>el.dataset.action===action&&el.dataset.tab===tab&&el.dataset.seat===selectedSeat);
 (restore??ui.root.querySelector<HTMLElement>('[data-action="statistics-tab"]'))?.focus({preventScroll:true});
 stopStatisticsAnimation=animateStatistics(ui.root);
}
function restoreVictory(){
 stopStatisticsAnimation?.();stopStatisticsAnimation=undefined;screen='result';ui.root.dataset.navScreen='result';menuNavigation.reset();hud();
 const s=simulation.state,winner=s.winner<0?null:s.fighters[s.winner];
 const name=winner?(s.teamMatch?t(s.teams[s.winner]===0?'team.blueWinner':'team.redWinner'):characters[winner.characterId].displayName):t('result.draw');
 ui.root.insertAdjacentHTML('beforeend',resultScreen(s,mode,name,teamLabel,arenaName(simulation.stage),persistentFight));
 const dialog=document.getElementById('match-result') as HTMLDialogElement;dialog.showModal();dialog.addEventListener('cancel',e=>e.preventDefault());
}
let initialFight:{ids:string[];teams?:number[];skins:string[];tournament:boolean|EliminationMode;seed:number;arenaId:string;idleTest:boolean}|null=null;
let restartTarget:GameSimulation|null=null;
let restartPending=false;
function canRestartFight(){if(persistentFight)return false;return mode!=='online'||!spectatorPlayback&&(championship?seat===0:seat===(onlineRoom?.owner??0));}
function restartButton():string {
 return canRestartFight()?`<button class="overlay-action" data-action="restart-fight">${th('pause.restart')}</button>`:'';
}
function cancelRestart(){document.getElementById('restart-confirm')?.remove();restartTarget=null;menuNavigation.reset();ui.root.querySelector<HTMLElement>('[data-action="restart-fight"]')?.focus();}
function confirmRestart(){
 if(screen!=='fight'||simulation.state.phase==='result'||restartPending||document.getElementById('restart-confirm'))return;
 if(!canRestartFight())return;
 restartTarget=simulation;input.clear();menuNavigation.reset();
 const dialog=document.createElement('dialog');dialog.id='restart-confirm';dialog.className='controller-dialog';dialog.setAttribute('aria-labelledby','restart-title');
 dialog.innerHTML=`<h2 id="restart-title">${th('pause.restart')}</h2><p>${th('pause.restartHelp')}</p>${mode==='online'?`<p>${th('pause.restartOnline')}</p>`:''}<div class="row"><button data-action="restart-cancel">${th('entry.cancel')}</button><button class="primary" data-action="restart-confirm">${th('pause.restart')}</button></div>`;
 ui.root.append(dialog);dialog.showModal();dialog.addEventListener('cancel',e=>{e.preventDefault();cancelRestart();});dialog.querySelector<HTMLElement>('[data-action="restart-cancel"]')?.focus();
}
function restartFight(){
 if(screen!=='fight'||restartTarget!==simulation||simulation.state.phase==='result'||restartPending){cancelRestart();return;}
 cancelRestart();
 if(mode==='online'){
  if(!canRestartFight())return;
  restartPending=true;network.send({type:'restart-fight',matchId:championshipMatch});return;
 }
 if(!initialFight)return;
 const config=initialFight,trainingOptions={...simulation.trainingOptions};
 // start() replaces the entire simulation and runs normal input/audio/UI cleanup.
 const loading=start(config.ids,config.teams,config.skins,config.tournament,config.seed,config.arenaId,config.idleTest),fresh=simulation;
 void loading.then(()=>{if(simulation===fresh&&mode==='training'&&screen==='fight'){simulation.trainingOptions=trainingOptions;hud();}});
}
async function start(ids: string[] = selected, teams?: number[], skins: string[] = selectedSkins, tournament: boolean | EliminationMode = false, seed = Math.floor(Math.random()*0x100000000), arenaId = mode==='local'&&(!!tournament||!!championshipMatch)?randomArena(selectedArena):selectedArena, idleTest = false, recovery?:RecoveryState, spectating=false) {
  if(mode==='local'&&localPlayersManaged&&!idleTest&&ids.some((_,i)=>!localInputReady(i))){showPlayers(ids.length,ids.length,ids.length,()=>{void start(ids,teams,skins,tournament,seed,arenaId,idleTest,recovery);});return;}
  if(!developmentBuild && mode!=="training")debug=false;
  idleTestMatch = developmentBuild && mode === "local" && idleTest;
  selectedArena = Object.hasOwn(stages,arenaId) ? arenaId : trainingRoom.id;
  navigate("loading", true);
  const revision = viewRevision;
  recentGameplayEvents.length=0;authoritativeStatistics=null;statisticsTab='overview';statisticsSeat=0;statisticsReturnStatus='';
  input.enabled = false;
  ui.shell(
    `<main class="page"><div class="eyebrow">${th('match.loading')}</div><h2>${th('match.entering',{arena:arenaName(stages[selectedArena]).toUpperCase()})}</h2><div class="loading-bar"><i id="load-progress" style="width:0%"></i></div></main>`,
  );
  if(mode!=='online')initialFight={ids:[...ids],teams:teams?[...teams]:undefined,skins:[...skins],tournament,seed,arenaId:selectedArena,idleTest};
  simulation = new GameSimulation(ids, mode === "training", stages[selectedArena], teams, skins, tournament, seed);
  gameAudio.reset();
  audio.setMusic("intro",simulation.stage.id);
  void audio.preload([...Object.keys(sounds).filter(id=>!id.includes('.')||id.startsWith('layer.')||ids.some(f=>id.startsWith(`${f}.`))),...ids.flatMap(id=>Object.values(characterSounds[id]??{}).filter((key):key is string=>!!key))]);
  spectatorPlayback=null;spectatorTarget=-1;renderer.spectatorTarget=undefined;
  if(spectating&&recovery){spectatorPlayback=new SpectatorPlayback(simulation,recovery);rollback=null;}
  else if (mode === "online") {
    rollback = new RollbackManager(simulation, seat);
    matchPerformance.begin();
    if(recovery){rollback.restoreRecovery(recovery);if(simulation.state.statistics?.finalized)authoritativeStatistics=structuredClone(simulation.state.statistics);}
    lastHash = -1;
    verifiedHashFrame = -1;
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
  if(mode==='local'&&localPlayersManaged&&!idleTest&&ids.some((_,i)=>!localInputReady(i))){showPlayers(ids.length,ids.length,ids.length,()=>{void start(ids,teams,skins,tournament,seed,arenaId,idleTest,recovery);});return;}
  screen = "fight";
  paused = false;
  accumulator = 0;
  input.clear();
  input.enabled = true;
  hud();
}
function isSpectating(){return mode==='online'&&screen==='fight'&&(!!spectatorPlayback||simulation.state.fighters[seat]?.lives===0);}
function cycleSpectator(direction:number){
 if(!isSpectating())return;
 const survivors=simulation.state.fighters.flatMap((f,i)=>f.lives>0?[i]:[]);if(!survivors.length)return;
 spectatorTarget=survivors[(survivors.indexOf(spectatorTarget)+direction+survivors.length)%survivors.length];updateSpectator();
}
function updateSpectator(){
 if(!isSpectating()){document.getElementById('online-spectator')?.remove();renderer.spectatorTarget=undefined;return;}
 const survivors=simulation.state.fighters.flatMap((f,i)=>f.lives>0?[i]:[]);
 if(!survivors.includes(spectatorTarget))spectatorTarget=survivors[0]??-1;
 renderer.spectatorTarget=spectatorTarget>=0?spectatorTarget:undefined;
 let panel=document.getElementById('online-spectator');if(!panel){panel=document.createElement('div');panel.id='online-spectator';panel.className='online-spectator';ui.root.append(panel);}
 const fighter=simulation.state.fighters[spectatorTarget];
 updateMarkup(panel,`<button data-action="spectator-previous" aria-label="Previous fighter">‹</button><b>${onlineText('SPECTATING','ASSISTINDO')} · ${fighter?`P${spectatorTarget+1} / ${characters[fighter.characterId].displayName}`:'—'}</b><button data-action="spectator-next" aria-label="Next fighter">›</button><small>${onlineText('LB / RB or ← / → · Switch fighter','LB / RB ou ← / → · Trocar lutador')}</small>`);
 if(spectatorPlayback?.needsRefresh){spectatorPlayback.needsRefresh=false;network.send({type:'spectate',matchId:championshipMatch});}
}
function hud() {
  hudEliminationFight=simulation.state.elimination?.fight??0;
  ui.render(
    `<div style="--fighter-count:${simulation.state.fighters.length}" class="hud ${simulation.state.teamMatch ? "team-hud" : ""} ${simulation.state.fighters.length > 2 ? `multi-hud ${simulation.state.fighters.length > 6 ? "large-ffa-hud" : ""}` : ""}">${simulation.state.fighters.length > 2 ? simulation.state.fighters.map((_, i) => fighterHud(i)).join("")+multiMatchTimer() : `${fighterHud(0)}<div class="timer"><span id="match-symbol" role="timer">0:00</span><small id="match-mode">${th("hud.survival")}</small></div>${fighterHud(1)}`}</div><div id="player-tags"></div><div class="announcement" id="announcement"></div><div class="combo" id="combo0"></div><div class="combo right" id="combo1"></div><pre class="debug" id="debug" hidden></pre>${mode === "training" ? `<div class="training"><span class="pill">${th("home.training.name")}</span><label>${th("hud.dummy")} <select id="dummy"><option value="stand" ${simulation.trainingOptions.dummy === "stand" ? "selected" : ""}>${th("hud.stand")}</option><option value="crouch" ${simulation.trainingOptions.dummy === "crouch" ? "selected" : ""}>${th("hud.crouch")}</option><option value="jump" ${simulation.trainingOptions.dummy === "jump" ? "selected" : ""}>${th("hud.jump")}</option><option value="block" ${simulation.trainingOptions.dummy === "block" ? "selected" : ""}>${th("hud.block")}</option><option value="afterHit" ${simulation.trainingOptions.dummy === "afterHit" ? "selected" : ""}>${th("hud.afterHit")}</option></select></label><label><input id="infinite" type="checkbox" ${simulation.trainingOptions.infiniteMeter ? "checked" : ""}> ${th("hud.infiniteMeter")}</label><button data-action="reset">${th("hud.reset")}</button><button data-action="debug">${th("hud.boxes")}</button><span id="damage">${th('hud.damage',{damage:0,combo:0})}</span></div>` : ""}<div class="combat-actions"><button class="text-button" data-action="pause">${th(mode==='online'?'hud.options':'hud.pause')} [<span data-prompt-pause>ESC</span>]</button></div>`,
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
function multiMatchTimer(){return '<div class="timer multi-match-timer"><span id="match-symbol" role="timer">0:00</span></div>';}
let lastHudPaint=-Infinity;
function updateHUD(presentationOnly=false) {
  const s = simulation.state;
  if((s.elimination?.fight??0)!==hudEliminationFight)hud();
  const paintNow=performance.now();
  if(mode!=="online"||presentationOnly||paintNow-lastHudPaint>=1000/30||s.phase!=="fight"){
  lastHudPaint=paintNow;
  const clock=matchTimer(s),clockElement=document.getElementById('match-symbol');
  if(clockElement){
    if(clockElement.textContent!==clock.text)clockElement.textContent=clock.text;
    clockElement.classList.toggle('invasion-danger',clock.danger);
    clockElement.parentElement!.classList.toggle('invasion-danger',clock.danger);
    clockElement.setAttribute('aria-label',t(clock.danger?'hud.invasionTimer':'hud.elapsedTimer',{time:clock.text}));
    clockElement.parentElement!.hidden=clock.hidden;
  }
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
  const waitingForPeers = rollback?.waitingForPeers ?? false;
  const countdown = waitingForPeers ? '' : matchCountdown(s);
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
    announcement.textContent = waitingForPeers ? t('match.waitPlayers') : finalDeath ? t('match.dead') : rollback?.stalled
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
  if(tournamentHost)updateMarkup(tournamentHost,s.elimination?eliminationPanel(s,!rollback||rollback.confirmed>=s.endedAt-1):tournamentPanel(s,!rollback||rollback.confirmed>=s.endedAt-1));
  }
  if(presentationOnly)return;
  if (
    s.phase === "result" && !finalDeathActive(s) &&
    (!s.tournament || s.tournament.complete) &&
    (!s.elimination || s.elimination.complete) &&
    screen === "fight" &&
    (!rollback || rollback.confirmed >= s.endedAt - 1)
  ) {
    if(persistentFight)return;
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
    if(rollback)network.send({type:"finished",frame:s.endedAt,matchId:championshipMatch});
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
  if(screen==='statistics'){renderStatistics();return;}
  if(screen!=='fight')return;
  const hudElement=ui.root.querySelector('.hud');
  if(hudElement)hudElement.innerHTML=simulation.state.fighters.length>2
    ?simulation.state.fighters.map((_,i)=>fighterHud(i)).join('')+multiMatchTimer()
    :`${fighterHud(0)}<div class="timer"><span id="match-symbol" role="timer">0:00</span><small id="match-mode">${th('hud.survival')}</small></div>${fighterHud(1)}`;
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
  const html=`<main class="page"><div class="eyebrow">${th('settings.eyebrow')}</div><h2>${th('nav.settings')}</h2><button class="primary" data-action="controllers">${th('settings.controllers')}</button><div class="settings-grid"><section><label class="setting">${th('language.label')}<select id="language-choice">${languageOptions.map(option=>`<option value="${option.value}" ${getLocale()===option.value?'selected':''}>${option.label}</option>`).join('')}</select></label><span class="tag">${th('settings.visual')}</span><label class="setting">${th('settings.graphics')}<select id="visual-quality">${(['low','medium','high'] as const).map(q=>`<option value="${q}" ${renderer.environment.quality===q?'selected':''}>${th(`settings.quality.${q}`)}</option>`).join('')}</select></label><p>${th('settings.quality.help')}</p><button id="copy-diagnostics" class="secondary">${th('diagnostics.copy')}</button><p>${th('diagnostics.help')}</p><p id="diagnostics-status" role="status"></p><textarea id="diagnostics-report" aria-label="${th('diagnostics.report')}" readonly hidden style="width:100%;min-height:160px"></textarea><span class="tag">${th('settings.audioNetwork')}</span>${(import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV?`<details><summary>${th('settings.audioDiagnostics')}</summary><pre id="audio-debug"></pre></details>`:''}${(["master", "music", "sound", "ui", "voice"] as const).map((k) => `<label class="setting">${th(`settings.volume.${k}`)}<input type="range" min="0" max="1" step=".01" value="${audio[k]}" data-volume="${k}"></label>`).join("")}<label class="setting">${th('settings.mute')}<input id="audio-mute" type="checkbox" ${audio.mute?"checked":""}></label><label class="setting">${th('settings.muteBlur')}<input id="audio-focus" type="checkbox" ${audio.muteOnBlur?"checked":""}></label>${developmentBuild?`<label class="setting">${th('settings.diagnostics')}<input id="diagnostics" type="checkbox" ${debug ? "checked" : ""}></label><label class="setting">${th('settings.delay')}<select id="latency">${[0, 50, 100, 150, 200].map((n) => `<option ${network.latency === n ? "selected" : ""} value="${n}">${n} ms</option>`).join("")}</select></label><label class="setting">${th('settings.jitter')}<input id="jitter" type="checkbox" ${network.jitter ? "checked" : ""}></label><p>${th('settings.latencyHelp')}</p>`:""}<span class="tag">${th('settings.padAttacks')}</span>${inputLabelKeys.slice(4).map((a, i) => `<label class="setting">${th(a)}<select data-pad="${i}">${Array.from({ length: 16 }, (_, n) => `<option value="${n}" ${input.gamepadButtons[i] === n ? "selected" : ""}>${th('settings.button',{button:n})}</option>`).join("")}</select></label>`).join("")}</section><section><span class="tag">${th('settings.keyboard')}</span>${inputLabelKeys.map((a, i) => `<div class="setting"><span>${th(a)}</span><button class="bind" data-action="bind" data-player="0" data-index="${i}">${input.bindings[0][i]}</button><button class="bind" data-action="bind" data-player="1" data-index="${i}">${input.bindings[1][i]}</button></div>`).join("")}<p>${th('settings.keyboardHelp')}<br>${th('settings.padHelp')}</p></section></div></main>`
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
  bindDiagnosticButton(document.getElementById('copy-diagnostics') as HTMLButtonElement,document.getElementById('diagnostics-report') as HTMLTextAreaElement,document.getElementById('diagnostics-status')!);
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
type OnlinePage='persistent'|'menu'|'create'|'browse'|'code'|'room'|'fighter'|'arena'|'settings';
let drawnOnlinePage:OnlinePage|undefined;
let onlinePage:OnlinePage='menu',onlineRoom:RoomView|null=null,publicRooms:RoomSummary[]=[],roomFilter='',onlineBusy=false,onlinePending=false;
let persistentFight=false;
const persistentUI=new PersistentController(async message=>{await onlineSend(message);},()=>{if(screen==='lobby'&&onlinePage==='persistent'&&!document.querySelector('dialog[open]')&&document.activeElement?.id!=='pc-pin')drawOnline();});
function lobby(){onlineRoom=null;onlinePending=false;onlinePage='menu';navigate('lobby');drawOnline();}
function drawOnline(){
 if(screen!=='lobby')return;
 const active=document.activeElement as HTMLElement|null;
 const pcKey=active?.dataset.pc,pcSlot=active?.dataset.slot;
 const key=active?.dataset.online,id=active?.dataset.id,code=active?.dataset.code,inputId=active?.id;
 const scroll=ui.root.querySelector('.on-screen')?.scrollTop??0;
 const markup=onlinePage==='persistent'?persistentUI.markup():onlinePage==='room'&&onlineRoom?sharedLobby(onlineRoom):onlinePage==='fighter'&&onlineRoom?lobbyFighters(onlineRoom):onlinePage==='arena'&&onlineRoom?lobbyArenas(onlineRoom):onlinePage==='settings'&&onlineRoom?createRoom(onlineRoom):onlinePage==='create'?createRoom():onlinePage==='browse'?browseRooms(publicRooms,roomFilter):onlinePage==='code'?joinCode():onlineMenu();
 ui.render(markup);
 if(drawnOnlinePage===onlinePage)(ui.root.querySelector('.on-screen') as HTMLElement).style.animation='none';
 drawnOnlinePage=onlinePage;
 ui.root.querySelector('.on-screen')!.scrollTop=scroll;
 const controls=[...ui.root.querySelectorAll<HTMLElement>('button,input,select')];
 const restored=controls.find(el=>inputId?el.id===inputId:pcKey?el.dataset.pc===pcKey&&el.dataset.id===id&&el.dataset.slot===pcSlot:key&&el.dataset.online===key&&el.dataset.id===id&&el.dataset.code===code);
 (restored&&!restored.hasAttribute('disabled')?restored:pcKey==='claim'&&controls.find(el=>el.dataset.pc==='ready')||controls.find(el=>!el.hasAttribute('disabled')&&el.dataset.online!=='back'&&el.dataset.pc!=='back'))?.focus({preventScroll:true});
 bindRoomSettings();
}
function bindRoomSettings(){
 const choice=document.getElementById('on-mode') as HTMLSelectElement|null,size=document.getElementById('on-capacity') as HTMLSelectElement|null;
 if(!choice||!size)return;
 const update=()=>{const m=choice.value,fixed=m==='2v2'?4:m==='3v3'||m==='elimination-party'?6:0,max=m==='championship'?16:8;
  for(const option of size.options){option.hidden=Number(option.value)>max;option.disabled=option.hidden;}
  size.value=String(fixed||Math.min(max,Number(size.value)));size.disabled=!!fixed;
 };choice.onchange=update;update();
}
function onlineBack(){
 if(onlinePage==='persistent'){if(persistentUI.page!=='browse'){void onlineSend({type:'persistent',action:'leave'}).then(()=>persistentUI.browse());return;}onlinePage='menu';drawOnline();return;}
 if(onlineBusy&&!onlineRoom){network.disconnect();onlinePending=false;}
 if(onlinePage==='room'){home();return;}
 if(onlineRoom){onlinePage='room';drawOnline();return;}
 if(onlinePage==='menu'){home();return;}
 onlinePage='menu';drawOnline();
}
async function onlineSend(message:import('../../../packages/shared/protocol.js').ClientMessage){
 const joining=message.type==='create'||message.type==='join';
 if(onlineBusy||joining&&onlinePending){if(message.type==='persistent')persistentUI.failed();return;}onlineBusy=true;if(joining){onlinePending=true;ui.text('network-status',t('online.connecting'));}
 const revision=viewRevision,page=onlinePage;
 try{if(network.socket?.readyState!==WebSocket.OPEN)await network.connect();if(screen==='lobby'&&revision===viewRevision&&page===onlinePage)network.send(message);}
 catch(error){onlinePending=false;if(message.type==='persistent')persistentUI.failed();if(screen==='lobby')ui.text('network-status',error instanceof Error?error.message:onlineText('Connection failed','Falha na conexão'));}
 finally{onlineBusy=false;}
}
function readRoomSettings():RoomSettings{return {name:(document.getElementById('on-name') as HTMLInputElement).value,visibility:(document.getElementById('on-visibility') as HTMLSelectElement).value as 'public'|'private',capacity:Number((document.getElementById('on-capacity') as HTMLSelectElement).value),mode:(document.getElementById('on-mode') as HTMLSelectElement).value as OnlineMode};}
const onlineEvents=new AbortController();
window.addEventListener('keydown',e=>{if(isSpectating()&&!document.querySelector('dialog[open]')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();cycleSpectator(e.key==='ArrowLeft'?-1:1);}},{signal:onlineEvents.signal});
ui.root.addEventListener('click',event=>{
 const el=(event.target as HTMLElement).closest<HTMLElement>('[data-online]');if(!el||screen!=='lobby')return;
 audio.unlock();audio.play('menu_confirm');
 const action=el.dataset.online;
 if(action==='persistent'){onlinePage='persistent';drawOnline();void persistentUI.browse();return;}
 if(action==='back'){onlineBack();return;}
 if(action==='leave'){home();return;}
 if(action==='back-room'){onlinePage='room';drawOnline();return;}
 if(action==='create'||action==='code'||action==='browse'||action==='fighter'||action==='arena'||action==='settings'){
  onlinePage=action;drawOnline();if(action==='browse')void onlineSend({type:'list-rooms'});return;
 }
 if(action==='refresh'){void onlineSend({type:'list-rooms'});return;}
 if(action==='create-submit'){void onlineSend({type:'create',...readRoomSettings(),stage:selectedArena,character:selected[0],skin:selectedSkins[0]});return;}
 if(action==='join-submit'||action==='join-room'){
  const code=el.dataset.code??(document.getElementById('on-code') as HTMLInputElement).value.trim().toUpperCase();
  if(!/^[A-Z0-9]{5}$/.test(code)){ui.text('network-status',t('online.enterCode'));return;}
  void onlineSend({type:'join',code,character:selected[0],skin:selectedSkins[0]});return;
 }
 if(!onlineRoom)return;
 if(action==='ready')network.send({type:'ready',ready:!onlineRoom.players[onlineRoom.seat].ready});
 if(action==='start')network.send({type:'start-match'});
 if(action==='pick-fighter')network.send({type:'choose-fighter',character:el.dataset.id!});
 if(action==='pick-arena'){network.send({type:'room-settings',settings:{stage:el.dataset.id!}});onlinePage='room';drawOnline();}
 if(action==='save'){network.send({type:'room-settings',settings:readRoomSettings()});onlinePage='room';drawOnline();}
},{signal:onlineEvents.signal});
ui.root.addEventListener('click',event=>{const el=(event.target as HTMLElement).closest<HTMLElement>('[data-pc]');if(!el||screen!=='lobby'||onlinePage!=='persistent')return;if(el.dataset.pc==='back'){onlineBack();return;}void persistentUI.action(el).catch(e=>ui.text('network-status',e instanceof Error?e.message:'Could not complete action'));},{signal:onlineEvents.signal});
ui.root.addEventListener('input',event=>{if(screen==='lobby'&&onlinePage==='persistent'&&event.target instanceof HTMLInputElement)persistentUI.change(event.target);},{signal:onlineEvents.signal});
ui.root.addEventListener('change',event=>{
 const el=event.target as HTMLSelectElement;
 if(screen==='lobby'&&onlinePage==='persistent')persistentUI.change(el);
 if(el.id==='on-filter'){roomFilter=el.value;drawOnline();}
 if(el.id==='on-skin'&&onlineRoom)network.send({type:'choose-fighter',character:onlineRoom.players[onlineRoom.seat].character,skin:el.value});
},{signal:onlineEvents.signal});
const roomBrowserTimer=setInterval(()=>{if(screen==='lobby'&&onlinePage==='persistent'&&!document.querySelector('dialog[open]'))persistentUI.refresh();if(screen==='lobby'&&onlinePage==='browse'&&!document.getElementById('controller-text-entry'))void onlineSend({type:'list-rooms'});},5000);
network.onMessage = (message) => {
  if(message.type==='persistent-start'){
    if(screen!=='lobby'||onlinePage!=='persistent')return;
    persistentFight=true;seat=message.seat;championship=null;championshipMatch=message.matchId;
    void start(message.characters,message.teams,message.skins,false,message.seed,message.stage);return;
  }
  if(message.type==='persistent-ended'){
    if(message.matchId!==championshipMatch)return;
    rollback=null;pendingHashes.clear();championshipMatch=undefined;paused=false;gameAudio.reset();
    persistentUI.receive(message);
    if(message.snapshot){
      simulation.restore(decodeSnapshot(message.snapshot));
      authoritativeStatistics=simulation.state.statistics?.finalized?structuredClone(simulation.state.statistics):null;
      persistentFight=true;input.enabled=false;input.clear();
      const s=simulation.state,lost=s.winner>=0&&s.teams[s.winner]!==s.teams[seat];
      audio.fadeCombat();audio.setMusic(lost?'defeat':'victory',simulation.stage.id);audio.play(lost?'defeat':'victory');
      restoreVictory();return;
    }
    persistentFight=false;navigate('lobby',true);onlinePage='persistent';drawOnline();return;
  }
  if(message.type==='persistent-detail'||message.type==='persistent-created'||message.type==='persistent-list'||message.type==='persistent-deleted'){persistentUI.receive(message);return;}
  switch (message.type) {
    case 'spectate-start': {
      if(mode!=='online'||!championship||!['championship-bracket','fight','loading'].includes(screen))break;
      const state=decodeSnapshot(message.state.snapshot);championshipMatch=message.matchId;
      void start(state.fighters.map(f=>f.characterId),state.teams,state.skins,false,undefined,message.stage,false,message.state,true);break;
    }
    case 'match-statistics':
      if(mode==='online'&&message.matchId===championshipMatch){authoritativeStatistics=message.statistics;ui.root.querySelector<HTMLButtonElement>('[data-action="statistics"]')?.removeAttribute('disabled');}
      break;
    case 'room-return-status':
      if(message.matchId===championshipMatch){statisticsReturnStatus=t('statistics.returnWaiting',{ready:message.ready,total:message.total});ui.text('statistics-return-status',statisticsReturnStatus);}
      break;
    case 'rooms':
      if(JSON.stringify(publicRooms)===JSON.stringify(message.rooms))break;
      publicRooms=message.rooms;
      if(screen==='lobby'&&onlinePage==='browse'&&!document.getElementById('controller-text-entry'))drawOnline();break;
    case 'room-state':
      onlineRoom=message.room;
      if(screen==='lobby'){
       seat=message.room.seat;championshipSeat=seat;selectedArena=message.room.stage;
       if(!['room','fighter','arena','settings'].includes(onlinePage))onlinePage='room';
       if(onlinePage!=='settings'&&!document.getElementById('controller-text-entry'))drawOnline();
      }break;
    case 'room-returned':
      seat=message.seat;championshipSeat=seat;championshipMatch=undefined;rollback=null;pendingHashes.clear();championship=null;paused=false;
      onlinePage='room';navigate('lobby',true);drawOnline();
      break;
    case 'restart-denied':
      restartPending=false;controllerToast(t('pause.restartDenied'));break;
    case 'fight-restarted': {
      if(mode!=='online'||message.previousId!==championshipMatch||!['fight','loading'].includes(screen))break;
      let state;try{state=decodeSnapshot(message.state.snapshot);}catch{disconnectMessage(t('online.lost'));break;}
      championshipMatch=message.matchId;seat=message.seat;
      if(message.bracket)championship=message.bracket;
      void start(state.fighters.map(f=>f.characterId),state.teams,state.skins,message.mode==='elimination'||message.mode==='elimination-party'?message.mode:message.mode==='ffa-tournament',undefined,message.stage,false,message.state);
      break;
    }
    case 'resume': {
      seat=message.seat;championshipMatch=message.matchId;
      championship=message.bracket??null;championshipReady=message.ready??[];
      if(message.state){
        let state;
        try{state=decodeSnapshot(message.state.snapshot);}catch{disconnectMessage(t('online.lost'));break;}
        void start(state.fighters.map(f=>f.characterId),state.teams,state.skins,message.mode==='elimination'||message.mode==='elimination-party'?message.mode:message.mode==='ffa-tournament',undefined,message.stage,false,message.state);
      }else if(message.bracket){championshipSeat=message.seat;showChampionship();}
      break;
    }
    case 'championship': {
      if (mode !== 'online' || !['lobby','championship-bracket','championship-victory','loading','fight'].includes(screen)) return;
      const reviewing=screen==='championship-bracket'&&championship?.complete;
      championship = message.bracket; championshipReady = message.ready;
      const active = championship.rounds.flat().find(m => matchToken(m) === championshipMatch);
      if (!active || active.status !== 'playing') showChampionship('',!!reviewing);
      break;
    }
    case 'championship-start':
      if (!['championship-bracket','fight','loading'].includes(screen) || !championship) return;
      championshipMatch = message.matchId; seat = message.seat;
      void start(message.characters, undefined, message.skins, false, undefined, message.stage ?? trainingRoom.id);
      break;
    case "input-wait": {
      if(message.matchId!==championshipMatch)break;
      const id=`input-wait-${message.seat}`;
      document.getElementById(id)?.remove();
      if(message.seconds>0){const notice=document.createElement('p');notice.id=id;notice.className='network-wait';notice.textContent=t('online.waitInput',{player:message.seat+1,seconds:message.seconds});ui.root.append(notice);}
      break;
    }
    case "room":
      onlinePending=false;
      if(screen==='lobby'){seat=message.seat;championshipSeat=seat;onlinePage='room';}break;
    case "roster":break;
    case "start":
      if (screen !== "lobby") return;
      championshipMatch=message.matchId;
      audio.play("ready");
      void start(message.characters, message.teams, message.skins, message.mode === "elimination" || message.mode === "elimination-party" ? message.mode : message.mode === "ffa-tournament",message.seed, message.stage ?? trainingRoom.id);
      break;
    case "input":
      if (message.matchId !== championshipMatch) break;
      if(spectatorPlayback){spectatorPlayback.receive(message.seat,message.frame,message.mask);break;}
      rollback?.receive(message.frame, message.mask, message.seat,true);
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
      persistentUI.failed();onlinePending=false;
      audio.play("invalid");
      if (desktopBridge() && (message.code==='VERSION_MISMATCH'||message.message==='Game versions differ. Refresh the game before joining a room.')) disconnectMessage(message.message);
      else if (screen === "lobby") ui.text("network-status", errorMessage(message.message));
      else disconnectMessage(message.message);
      break;
    case "left":
      if(message.matchId!==championshipMatch)break;
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
    if (checked === true) verifiedHashFrame = Math.max(verifiedHashFrame, frame);
    if (checked === false) break;
  }
  if (rollback.desync === "OK") return true;
  // No authoritative state is available to repair this match safely.
  document.getElementById("match-result")?.remove();
  disconnectMessage(t('online.desync'));
  return false;
}
network.onRecovering=()=>{
  if(mode!=='online')return;
  viewRevision++;paused=true;input.enabled=false;input.clear();menuNavigation.reset();
  ui.shell(`<main class="page"><h2>${th('online.reconnecting')}</h2><p>${th('online.reconnectHelp')}</p><button class="primary" data-action="home">${th('nav.menu')}</button></main>`);
};
network.onClose = () => {
  if (mode === "online" && (["fight","lobby","loading","result","statistics","championship-bracket","championship-victory"].includes(screen)))
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
  if(desktopBridge()&&message==='Game versions differ. Refresh the game before joining a room.'){
    const update=document.createElement('a');update.href='https://abrozcombat.com/download';update.target='_blank';update.rel='noopener noreferrer';update.className='primary';update.textContent=t('error.downloadUpdate');box.append(update);
  }
  overlay.append(box);
  ui.root.append(overlay);
  button.focus();
}
function pauseContent():string {
  return `<div class="pause-match"><span class="overlay-kicker">${arenaName(simulation.stage).toUpperCase()} / ${mode === "training" ? th('home.training.name') : championship ? th('pause.localChampionship') : th('pause.localVersus')}</span><div class="pause-matchup">${simulation.state.fighters.map((f, i) => `<div><span>${th('controller.player',{player:i+1})}</span><strong>${characters[f.characterId].displayName}</strong><small>${mode === "training" ? (i === 1 ? th('pause.trainingPartner') : th('pause.freePractice')) : th('pause.lives',{count:f.lives})}</small></div>`).join('<i aria-hidden="true">/</i>')}</div></div><section class="pause-drawer"><span class="overlay-kicker">${th("pause.kicker")}</span><h2 id="pause-title">${th("pause.title1")}<br>${th("pause.title2")}</h2><p>${th("pause.description1")}<br>${th("pause.description2")}</p><div class="overlay-actions"><button class="overlay-action main-action" data-action="pause"><span>${th("pause.resume")}<small>${th("pause.resumeHelp")}</small></span><b aria-hidden="true">↗</b></button>${restartButton()}<button class="overlay-action" data-action="home"><span>${th("nav.menu")}<small>${th("pause.leaveHelp")}</small></span><b aria-hidden="true">→</b></button></div><button class="overlay-action" data-action="pause-settings">${th("nav.settings")}</button><button class="overlay-action" data-action="controllers">${th("controller.title")}</button><p data-controller-disconnect role="status"></p><span class="pause-key"><kbd data-prompt-pause>ESC</kbd> ${th("pause.resume")}</span></section>`;
}
function pause() {
  if(document.getElementById("restart-confirm")){cancelRestart();return;}
  if (screen !== "fight" || document.getElementById("disconnect")) return;
  if (mode === "online") {
    toggleOnlineControllerMenu();
    return;
  }
  if(paused&&!idleTestMatch&&simulation.state.fighters.some((_,i)=>(localPlayersManaged||i>=2)&&!localInputReady(i))){controllerToast(t('pause.reconnect'));return;}
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
const playerManagementLifetime=new AbortController();
window.addEventListener('keydown',event=>{
 if(!multiSelectionActive()||controllerPanel||document.querySelector('dialog[open]')||(event.target as HTMLElement).matches('input,select,textarea'))return;
 for(let seat=0;seat<input.bindings.length;seat++){
  if(!playerLobby.keyboards.has(seat)||input.controllers.device(seat))continue;
  const index=input.bindings[seat].slice(0,8).indexOf(event.code);
  const action=index>=0?(['left','right','up','down','confirm','back','previous','next'] as const)[index]:seat===0&&event.code==='Enter'?'pause':null;
  if(!action)continue;
  event.preventDefault();event.stopImmediatePropagation();
  if(!event.repeat||index<4)multiSelectionAction(seat,action);
  return;
 }
},{capture:true,signal:playerManagementLifetime.signal});
window.addEventListener('keydown',event=>{
 if(!(screen==='local-players'&&!controllerPanel||controllerPanel&&controllerBoardActive)||event.repeat||(event.target as HTMLElement).matches('input,select,textarea'))return;
 for(let slot=0;slot<2;slot++){
  if(event.code===input.bindings[slot][4]){event.preventDefault();if(!input.controllers.device(slot)){if(playerLobby.keyboards.has(slot))playerLobby.toggleReady(slot);else playerLobby.keyboard(slot);}return;}
  if(event.code===input.bindings[slot][5]&&playerLobby.keyboards.has(slot)){event.preventDefault();if(playerLobby.isReady(slot))playerLobby.toggleReady(slot);else playerLobby.keyboard(slot);return;}
 }
},{signal:playerManagementLifetime.signal});
ui.onAction((action, element) => {
  audio.unlock();
  audio.play(actionSound(action));
  switch (action) {
    case 'online-controller-resume': toggleOnlineControllerMenu();break;
    case 'controllers': openControllers(); break;
    case 'players-tools': playerTools();break;
    case 'players-board': playerBoard();break;
    case 'players-back': controllerBack();break;
    case 'players-continue': continuePlayers();break;
    case 'players-join': playerLobby.join(Number(element.dataset.device));break;
    case 'players-ready': playerLobby.toggleReady(Number(element.dataset.slot));break;
    case 'players-leave': {const slot=Number(element.dataset.slot),d=input.controllers.device(slot);if(d)playerLobby.leave(d.key);else playerLobby.keyboard(slot);break;}
    case 'players-move': playerLobby.shift(Number(element.dataset.device),Number(element.dataset.direction));break;
    case 'players-keyboard': playerLobby.keyboard(Number(element.dataset.slot));break;
    case 'players-test': {playerTools();const key=Number(element.dataset.device);input.controllers.testing=key;input.controllers.capture=null;input.clear();break;}
    case 'controller-close': closeControllers(); break;
    case 'controller-cancel': input.controllers.cancelMapping();input.controllers.capture=null;input.controllers.testing=null;input.clear();ui.text('controller-message',t('controller.ready'));break;
    case 'controller-map': input.controllers.beginMapping(Number(element.dataset.device));break;
    case 'controller-map-start': {const pads=input.controllers,d=pads.devices.get(pads.mappings.wizard?.device??-1);if(d?.connected)pads.mappings.start(d.rawButtons,d.rawAxes);break;}
    case 'controller-map-skip': input.controllers.mappings.skipDpad();break;
    case 'controller-map-save': input.controllers.saveMapping();ui.text('controller-message',t('controller.mapSaved'));break;
    case 'controller-assign': input.controllers.cancelMapping(); input.controllers.capture={player:Number(element.dataset.slot)};input.controllers.testing=null;input.clear();ui.text('controller-message',t('controller.assignPrompt',{player:Number(element.dataset.slot)+1}));break;
    case 'controller-keyboard': input.controllers.cancelMapping();input.controllers.release(Number(element.dataset.slot));playerLobby.keyboards.add(Number(element.dataset.slot));input.controllers.keyboardClaimed.add(Number(element.dataset.slot));input.clear();break;
    case 'controller-release': input.controllers.cancelMapping();input.controllers.release(Number(element.dataset.slot));input.clear();break;
    case 'controller-identify': {input.controllers.cancelMapping();const d=input.controllers.device(Number(element.dataset.slot));if(d?.connected){input.controllers.capture={identify:d.key};input.clear();ui.text('controller-message',t('controller.identifyPrompt',{player:d.player!+1}));}else ui.text('controller-message',t('controller.emptySlot'));break;}
    case 'controller-test': case 'controller-device-test': {input.controllers.cancelMapping();const d=action==='controller-test'?input.controllers.device(Number(element.dataset.slot)):input.controllers.devices.get(Number(element.dataset.device));if(d?.connected){input.controllers.testing=d.key;input.controllers.capture=null;input.clear();ui.text('controller-message',t('controller.testing'));document.getElementById('controller-test')?.scrollIntoView({block:'nearest'});}else ui.text('controller-message',t('controller.assignFirst'));break;}

    case 'local-ffa': case 'local-2v2': case 'local-3v3': {const kind=action.slice(6) as LocalMatchMode,n=kind==='2v2'?4:kind==='3v3'?6:8;showPlayers(n,kind==='ffa'?2:n,kind==='ffa'?undefined:n,count=>showLocalMatchSetup(kind,count));break;}
    case 'local-match-idle-test':
    case 'local-match-start': {
      const idleTest=action==='local-match-idle-test';
      if(screen!=='local-match-setup'||mode!=='local'||(idleTest&&!developmentBuild)||!multiSelection?.ready)break;
      if(localMatchMode!=='ffa'&&localTeams.filter(t=>t===0).length!==localIds.length/2){audio.play('invalid');ui.text('local-match-error',t('setup.balanceError',{count:localIds.length/2}));break;}
      if(!idleTest&&localIds.some((_,i)=>!localInputReady(i))){audio.play('invalid');ui.text('local-match-error',t('controller.deviceRequired'));break;}
      void start(localIds,localTeams,localSkins,false,undefined,undefined,idleTest);break;
    }

    case 'elimination': case 'elimination-party': {const kind=action,n=kind==='elimination-party'?6:8;showPlayers(n,kind==='elimination-party'?6:2,kind==='elimination-party'?6:undefined,count=>showEliminationSetup(kind,count));break;}
    case 'elimination-start': {
      if(screen!=='elimination-setup'||!multiSelection?.ready)break;
      if(eliminationIds.some((_,i)=>!localInputReady(i))){audio.play('invalid');ui.text('elimination-setup-error',t('controller.deviceRequired'));break;}
      void start(eliminationIds,undefined,eliminationSkins,localElimination);break;
    }
    case 'championship': showPlayers(2,2,2,()=>showChampionshipSetup()); break;
    case 'championship-generate':
      championship = createChampionship(championshipEntrants.map((e,i) => ({...e, name: e.name.trim() || `Player ${i+1}`})));
      showChampionship(); break;
    case 'champion-bracket':if(championship?.complete)showChampionship('',true);break;
    case 'champion-victory':showChampionVictory();break;
    case 'champion-again':
      if(championship?.complete){
       network.disconnect();championship=null;championshipReady=[];championshipMatch=undefined;
       if(mode==='online'){lobby();onlinePage='create';drawOnline();}
       else showChampionshipSetup();
      }break;
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
      showPlayers(2,2,2,()=>{selectSeat=0;selection();}); break;
    case "online":mode="online";lobby();break;
    case "training":
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

    case "pause":
      pause();
      break;
    case 'spectator-previous':cycleSpectator(-1);break;
    case 'spectator-next':cycleSpectator(1);break;
    case 'spectator-duel':network.send({type:'spectate',matchId:element.dataset.match});break;
    case "statistics":
      if(screen==='result'&&!championship){if(mode==='online'&&!authoritativeStatistics){controllerToast(t('statistics.waiting'));break;}statisticsSeat=simulation.state.winner>=0?simulation.state.winner:0;renderStatistics();}break;
    case "statistics-tab":
      if(screen==='statistics'&&statisticsTabs.includes(element.dataset.tab as StatisticsTab)){statisticsTab=element.dataset.tab as StatisticsTab;renderStatistics();}break;
    case "statistics-player":
      if(screen==='statistics'&&Number.isInteger(Number(element.dataset.seat))&&simulation.state.fighters[Number(element.dataset.seat)]){statisticsSeat=Number(element.dataset.seat);renderStatistics();}break;
    case "statistics-back":if(screen==='statistics')restoreVictory();break;
    case 'online-continue':
    case 'statistics-return':if(mode==='online'){if(persistentFight){persistentFight=false;navigate('lobby',true);onlinePage='persistent';drawOnline();persistentUI.refresh();}else network.send({type:'return-room',matchId:championshipMatch});}break;
    case "room-ready":if(screen==='lobby'&&mode==='online'){network.send({type:'ready'});element.setAttribute('disabled','');}break;
    case "restart-fight": confirmRestart();break;
    case "restart-cancel": cancelRestart();break;
    case "restart-confirm": restartFight();break;
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
const recordFocus=()=>{if(screen==="fight"&&rollback)matchPerformance.visibility(performance.now(),document.hidden,!document.hasFocus());};
window.addEventListener("focus",recordFocus);
document.addEventListener("visibilitychange",recordFocus);
const onBlur=() => {
  recordFocus();
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
/** Settled online state at `frame` (hash and fighter x) plus the last server checksum this client verified. */
function onlineTestDiagnostics(frame?:number){
 if(!rollback)return undefined;
 const settled=Math.min(rollback.confirmed,simulation.state.frame-1);
 const state=frame!==undefined&&frame<=settled?rollback.history.get(frame):undefined;
 return {seat,frame:simulation.state.frame,settled,desync:rollback.desync,verifiedHashFrame,hash:state&&rollback.confirmedHash(frame!),x:state?.fighters.map(f=>f.x)};
}
// Development-only read-only diagnostics, no production debug UI.
if((import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV)Object.assign(window,{abrozAudioDebug:()=>audio.diagnostics(),abrozOnlineDebug:onlineTestDiagnostics});
const pingTimer=setInterval(() => {
  if (rollback) network.measurePing();
}, 2000);
let presentationTime=0;
function loop(now: number) {
  if(screen==="fight"&&rollback){rollback.flushPending();checkNetworkHealth();}
  updateControllers(now);
  if(screen==='settings'&&Math.floor(now/250)!==Math.floor(last/250)){const panel=document.getElementById('audio-debug');if(panel)panel.textContent=JSON.stringify(audio.diagnostics(),null,2);}
  if(screen==='home'){
    const step=homeCastTick(now,homeStartedAt);
    if(step!==homeCastStep){homeCastStep=step;updateHomeCast(ui.root,step);}
  }
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps = fps * 0.95 + (1 / Math.max(0.001, elapsed)) * 0.05;
  if(screen==="fight"&&rollback)matchPerformance.observe(now,rollback.stalled,document.hidden,!document.hasFocus(),rollback.rollbackCount,rollback.rollbackFrames,Math.max(0,simulation.state.frame-rollback.confirmed-1));
  if (screen === "fight" && !paused) {
    accumulator += elapsed;
    let ticks = 0;
    while (accumulator >= 1 / (60*matchTimeScale(simulation.state)) && ticks++ < 6) {
      const stepDuration=1/(60*matchTimeScale(simulation.state));
      input.refresh(false);
      renderInterpolation.capture(simulation.state);
      if(spectatorPlayback){if(!spectatorPlayback.tick()){accumulator=0;break;}}
      else if (rollback) {
        rollback.schedule(isSpectating()?0:input.poll(0), (frame, mask) =>
          network.send({ type: "input", frame, mask, matchId: championshipMatch }),
        );
        if (rollback.waitingForPeers || !rollback.tick()) {
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
      renderer.consume(presentCombatEvents(simulation.state,simulation.events));
      gameAudio.consume(simulation.state,simulation.events,rollback?[...simulation.gameplayEvents.filter(e=>e.type!=='DamageApplied'),...rollback.drainConfirmedImpacts()]:simulation.gameplayEvents,simulation.stage.id,simulation.stage.width,
        mode==='online'?[seat]:mode==='training'?[0]:simulation.state.fighters.map((_,i)=>i),!rollback||rollback.confirmed>=simulation.state.endedAt-1,championship?(championship.round===championship.rounds.length-1?'championship-final':'championship'):simulation.state.elimination?.mode==='elimination-party'?'party':'match',rollback?rollback.confirmed+1:Infinity);
      accumulator -= stepDuration;
    }
    if (!paused){updateHUD();updateSpectator();}
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
    screen === "fight" && !paused && !debug ? renderInterpolation.view(simulation.state,accumulator * 60 * matchTimeScale(simulation.state),rollback&&!isSpectating()?seat:undefined) : simulation.state,
    visualElapsed,
    presentationTime,
    !["fight", "result"].includes(screen),
    simulation.stage,
    renderInterpolation.seconds(screen === "fight" && !paused ? accumulator * 60 * matchTimeScale(simulation.state) : 1),
    mode === "online" && screen === "fight",
  );
  if(network.diagnosticsEnabled)onlineDiagnostics.update(now,screen==='fight'?(rollback??undefined):undefined,network,fps,matchPerformance.snapshot());
  animationFrame=requestAnimationFrame(loop);
}
let animationFrame=0;
home();
const persistentLink=new URLSearchParams(location.search).get('championship');
if(persistentLink&&/^[a-f0-9-]{36}$/.test(persistentLink)){mode='online';lobby();onlinePage='persistent';drawOnline();void persistentUI.open(persistentLink);}
animationFrame=requestAnimationFrame(loop);
(import.meta as ImportMeta & {hot?:{dispose(callback:()=>void):void}}).hot?.dispose(()=>{
 onlineDiagnostics.dispose();audioListeners.abort();playerManagementLifetime.abort();onlineEvents.abort();clearInterval(roomBrowserTimer);
 controllerHints.dispose();viewRevision++;cancelBinding?.();cancelAnimationFrame(animationFrame);clearInterval(pingTimer);
 window.removeEventListener('blur',onBlur);controllerNotice.remove();
 network.disconnect();input.dispose();ui.dispose();assets.dispose();audio.dispose();renderer.dispose();void disposeFighterSprites();
});
