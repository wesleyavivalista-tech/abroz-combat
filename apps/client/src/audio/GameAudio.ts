import {INVASION} from '../../../../packages/game-core/simulation/InvasionSystem.js';
import {FINAL_DEATH_FRAMES} from '../../../../packages/game-core/simulation/UndeadSystem.js';
import {COUNTDOWN_BEAT_FRAMES} from '../../../../packages/game-core/simulation/MatchIntro.js';
import type {CombatEvent,SimulationSnapshot} from '../../../../packages/game-core/types.js';
import type {GameplayEvent} from '../../../../packages/game-core/combat/GameplayEvents.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {audioPresence,type AudioPresence} from './AbilityAudio.js';
import {moveAudio} from './FighterAudio.js';
import {characterSounds} from './SoundRegistry.js';
import type {AudioManager} from './AudioManager.js';
import type {MusicState} from './MusicRegistry.js';
interface Observed {meter:number;health:number;lives:number;poison:boolean;slow:boolean;armor:boolean;mode:boolean;stun:boolean;}
/** Read-only presentation adapter. Never called by rollback replay or simulation rules. */
export class GameAudio {
  private previous:Observed[]=[];
  private presence=new Map<string,AudioPresence>();
  private deathCues=new Set<string>();private lastDeathVoice=-Infinity;private undeadPhases=new Map<number,string>();
  private invasionRound:number|null=null;
  private phase='';private countdown=-1;private resultPlayed=false;
  constructor(private audio:AudioManager){}
  reset():void{this.invasionRound=null;this.deathCues.clear();this.lastDeathVoice=-Infinity;this.undeadPhases.clear();this.previous=[];this.presence.clear();this.phase='';this.countdown=-1;this.resultPlayed=false;this.audio.resetMatch();}
  consume(s:SimulationSnapshot,events:readonly CombatEvent[],journal:readonly GameplayEvent[],arena:string,width:number,localSeats:number[],confirmed=true,musicMode:'match'|'championship'|'championship-final'|'party'='match',confirmedFrame=Infinity):void{
    const roundStart=s.frame-s.phaseFrame;
    if(!s.training&&s.phase==='fight'&&s.phaseFrame>=INVASION.startFrames&&confirmedFrame>=roundStart+INVASION.startFrames&&this.invasionRound!==roundStart){
      this.invasionRound=roundStart;
      this.audio.play('invasion_danger',{eventId:`invasion:${roundStart}`});
    }
    const deaths=(s.finalDeaths??[]).filter(d=>d.frame<=confirmedFrame&&!this.deathCues.has(`${d.frame}:${d.seat}`));
    if(deaths.length){for(const d of deaths)this.deathCues.add(`${d.frame}:${d.seat}`);if(deaths[0].frame-this.lastDeathVoice>=FINAL_DEATH_FRAMES){this.lastDeathVoice=deaths[0].frame;this.audio.play('final_death',{eventId:`dead:${deaths[0].frame}`});this.audio.announce?.('DEAD.');this.audio.duck('ko');}}
    if(this.deathCues.size>64)this.deathCues=new Set([...this.deathCues].slice(-32));
    const phases=new Map<number,string>();
    for(const c of s.clones)if(c.undead){phases.set(c.id,c.fighter.undead!);if(c.fighter.undead==='rising'&&this.undeadPhases.get(c.id)==='grave')this.audio.play('grave_break',{eventId:`grave:${c.id}:${c.undead.phaseAt}`,x:c.fighter.x,width});}
    this.undeadPhases=phases;
    const play=(key:string,actor:number,id:string,x?:number)=>{
      const fighter=s.fighters[actor];
      this.audio.play(characterSounds[fighter?.characterId]?.[key]??key,{eventId:id,x:x??fighter?.x,width});
    };
    const specialHits=new Set(events.filter(e=>['super-hit','fire-hit','projectile-impact'].includes(e.type)).map(e=>e.player));
    const blocks=new Set(events.filter(e=>e.type==='block').map(e=>e.player));
    for(const e of journal){
      const f=s.fighters[e.actor];if(!f)continue;
      if(e.type==='StateChanged'&&e.detail.endsWith('→ Jump'))play(`${f.characterId}.jump`,e.actor,`jump:${e.id}`);
      if(e.type==='GroundImpact'||e.type==='ObjectImpact'||e.type==='MoveActive'&&e.detail==='bossSlam'){const profile=moveAudio(f.characterId,e.detail);if(profile)this.audio.play(profile.impact,{eventId:`ground:${e.id}`,x:e.x??f.x,width});}
      if(e.type==='AttackStarted'){
        const c=characters[f.characterId],move=c.moves[e.detail];
        const ultimate=c.superButtons?.includes(e.detail),special=c.specialButtons?.includes(e.detail);
        const key=moveAudio(f.characterId,e.detail)?.start??(ultimate?'attack_ultimate':special?'attack_special':(move?.damage??0)>=130?'attack_heavy':'attack_light');
        if(!moveAudio(f.characterId,e.detail)?.swingOnActive)play(key,e.actor,`attack:${e.id}`,e.x);if(ultimate)this.audio.duck('ultimate');
      }
      if(e.type==='MoveActive'){
        const profile=moveAudio(f.characterId,e.detail),m=characters[f.characterId].moves[e.detail];
        // The observer also crosses startup when a charge is cancelled into recovery.
        const actor=f.move===e.detail&&(e.x===undefined||f.x===e.x)?f:s.clones.find(c=>c.owner===e.actor&&c.fighter.move===e.detail&&c.fighter.x===e.x)?.fighter;
        if(profile?.swingOnActive&&m&&actor&&actor.moveFrame>=m.startupFrames&&actor.moveFrame<m.startupFrames+m.activeFrames)
          play(profile.start,e.actor,`swing:${e.id}`,e.x);
      }
      if(e.type==='DamageApplied'&&(e.amount??0)>0&&!e.blocked&&(e.source!==undefined||!blocks.has(e.actor))){
        const profile=e.source===undefined?undefined:moveAudio(s.fighters[e.source]?.characterId,e.move??'');
        const status=(e.move==='@zombie-claw'||e.move?.startsWith('@invasion-'))?'undead_hit':e.move?.startsWith('@')?`${s.fighters[e.source!]?.characterId}.${e.move.slice(1)}`:undefined;
        const amount=e.amount??0;play(status??profile?.impact??(amount>=400?'ground_slam':specialHits.has(e.actor)?'hit_special':amount>=130?'hit_heavy':'hit_light'),e.actor,`damage:${e.id}`,e.x??(e.detail.startsWith('summon ')?s.clones.find(c=>`summon ${c.id}`===e.detail)?.fighter.x:undefined));
      }
    }
    for(const e of events){
      let key: string|undefined;
      if(e.type==='block')key='block';
      else if(e.type==='ko'){key='ko';this.audio.duck('ko');}
      // Visual particle names are not material/sound identities.
      else if(e.type==='dash-dust')key='dash';
      else if(e.type==='landing-dust')key=e.power>=3?'ground_slam':'land';
      if(key&&['dash','land','ground_slam'].includes(key)){const f=s.fighters[e.player];if(f)key=`${f.characterId}.${key==='ground_slam'?'heavy_land':key}`;}
      if(key)play(key,e.player,`effect:${e.id}`);
    }
    const current=new Map(audioPresence(s).map(p=>[p.id,p]));
    for(const [id,p] of current){
      const old=this.presence.get(id),profile=moveAudio(p.character,p.move)!;
      if(!old&&!(id.startsWith('projectile:')&&profile.swingOnActive)&&!id.startsWith('bee:')&&!id.includes(':channel:')&&!id.includes(':mode:')&&!id.includes(':charge:'))this.audio.play(profile.start,{eventId:`presence:${s.frame}:${id}`,x:p.x,width});
      if(old&&((p.health!==undefined&&old.health!==undefined&&p.health<old.health)||(p.bounces!==undefined&&old.bounces!==undefined&&p.bounces!==old.bounces)))this.audio.play(profile.impact,{eventId:`object-impact:${s.frame}:${id}`,x:p.x,width});
      if(old?.phase==='marked'&&p.phase==='built')this.audio.play(profile.start,{eventId:`built:${s.frame}:${id}`,x:p.x,width});
      if(p.phase==='collapsed'&&old?.phase!=='collapsed')this.audio.play(profile.end,{eventId:`collapse:${s.frame}:${id}`,x:p.x,width});
    }
    for(const [id,p] of this.presence)if(!current.has(id)&&p.phase!=='collapsed'&&!id.includes(':charge:'))this.audio.play(moveAudio(p.character,p.move)!.end,{eventId:`expire:${s.frame}:${id}`,x:p.x,width});
    this.audio.syncAbilityLoops([...current.values()].filter(p=>p.phase!=='collapsed'&&p.phase!=='marked').map(p=>({id:p.id,key:(p.id.includes(':charge:')?moveAudio(p.character,p.move)!.charge:undefined)??moveAudio(p.character,p.move)!.active,x:p.x})),width);
    this.presence=current;
    s.fighters.forEach((f,i)=>{
      const before=this.previous[i],next:Observed={meter:f.meter,health:f.health,lives:f.lives,poison:f.poisonUntil>s.frame,slow:f.bloodSlowUntil>s.frame||f.areaSlow<1,armor:f.armorUntil>s.frame,mode:f.weaponUntil>s.frame,stun:f.stun>0};
      if(before&&localSeats.includes(i)&&f.lives>0&&f.health>0&&f.lives===before.lives){
        const c=characters[f.characterId];
        const costs=(ids:readonly string[])=>ids.map(id=>c.moves[id]?.meterCost??0).filter(n=>n>0);
        const special=Math.min(...costs(c.specialButtons??[])),ultimate=Math.min(...costs(c.superButtons??[]));
        if(before.meter<ultimate&&f.meter>=ultimate)play('ultimate_ready',i,`ready-u:${s.frame}:${i}`);
        else if(before.meter<special&&f.meter>=special)play('special_ready',i,`ready-s:${s.frame}:${i}`);
        const low=c.stats.maxHealth*.2;
        if(before.health>low&&f.health<=low)play('low_health',i,`low:${s.frame}:${i}`);
      }
      if(before&&f.lives>0&&f.health>0&&f.lives===before.lives){
        for(const key of ['poison','slow','armor','stun'] as const)if(!before[key]&&next[key])play(`${f.characterId}.${key}`,i,`status:${s.frame}:${i}:${key}`);
        if(before.armor&&!next.armor)play(`${f.characterId}.armor_break`,i,`armor-end:${s.frame}:${i}`);
        if(before.mode&&!next.mode)play(`${f.characterId}.mode_end`,i,`mode-end:${s.frame}:${i}`);
      }
      this.previous[i]=next;
    });
    if(s.phase==='intro'){
      if(this.phase!=='intro'){this.countdown=-1;this.resultPlayed=false;}
      const beat=Math.floor(s.phaseFrame/COUNTDOWN_BEAT_FRAMES);
      if(beat!==this.countdown&&beat<3){this.audio.play(`countdown_${3-beat}`,{eventId:`count:${s.frame-s.phaseFrame}:${beat}`});this.audio.duck('voice');this.countdown=beat;}
      this.audio.setMusic('intro',arena);
    }else if(s.phase==='fight'){
      if(this.phase==='intro'){this.audio.play('round_start',{eventId:`start:${s.frame}`});this.audio.duck('voice');}
      const remaining=s.fighters.filter(f=>f.lives>0);
      const final=!s.training&&remaining.length<=2&&remaining.every(f=>f.lives===1);
      const deciding=s.tournament?.wins.some(w=>w>=2);
      this.audio.setMusic(!s.training&&this.invasionRound===roundStart?'invasion':deciding||musicMode==='championship-final'?'championship-final':final?'final':musicMode,arena);
      this.resultPlayed=false;
    }else if(confirmed&&!this.resultPlayed){
      this.resultPlayed=true;this.audio.play('round_end',{eventId:`end:${s.endedAt}`});
    }
    this.phase=s.phase;
  }
}
export function screenMusic(screen:string):MusicState{
  // Bracket and party setup screens share menu music; combat selects its own score.
  if(screen.includes('championship')||screen.includes('elimination'))return 'menu';
  if(['select','stage','roster','loading','lobby','local-match-setup'].includes(screen))return 'selection';
  return 'menu';
}
export function actionSound(action:string):string{
  if(['home','back-fighters','edit-player','controller-close','controller-cancel'].includes(action))return 'menu_back';
  if(['pick','pick-random'].includes(action))return 'fighter_selected';
  if(['confirm-fighter','championship-ready','launch','local-match-start','elimination-start'].includes(action))return 'ready';
  return 'menu_confirm';
}
