import {mixLevels,MusicDucking,sampleCalibration,createMixProtection,type DuckKind} from './AudioMix.js';
import {AnnouncerSpeech} from './AnnouncerSpeech.js';
import {storage} from '../platform/storage.js';
import {AudioPolicy} from './AudioPolicy.js';
import {sounds,legacySounds,type AudioBus} from './SoundRegistry.js';
import {chooseMusic,tracks,arenaAudio,ambience,type MusicState,type MusicTrack} from './MusicRegistry.js';
interface Voice {source: AudioScheduledSourceNode; nodes: AudioNode[]; bus:AudioBus;}
interface Loop {element:HTMLAudioElement; source:MediaElementAudioSourceNode; gain:GainNode; id:string; bus:'music'|'ambience';}
const storageKey='abroz-audio-v1';
export class AudioManager {
  private announcer=new AnnouncerSpeech();
  context:AudioContext|null=null;
  master=.35; music=.3; sound=.65; ui=.65; voice=.8; mute=false; muteOnBlur=true;
  private masterNode?:GainNode; private sfxNode?:GainNode;
  private buses=new Map<AudioBus,GainNode>();
  private compressor?:DynamicsCompressorNode;
  private safety?:WaveShaperNode;
  private calibration=new Map<string,ReturnType<typeof sampleCalibration>>();
  private ducking=new MusicDucking();private duckTimer?:ReturnType<typeof setTimeout>;private duckLevel=1;
  private criticalCombat?:GainNode;
  private voices=new Map<number,Voice>();
  private retiring=new Map<number,Voice>();
  private abilityLoops=new Map<string,number>();
  readonly policy=new AudioPolicy(24);
  private buffers=new Map<string,AudioBuffer>();
  private pending=new Map<string,Promise<void>>();
  private abort=new AbortController();
  private loops:Loop[]=[];
  private timers=new Set<ReturnType<typeof setTimeout>>();
  private generation=0;
  private disposed=false;
  private blurred=false;
  private paused=false;
  private combatDuckUntil=0;
  private musicKey=''; private musicState:MusicState='menu'; private arena='the-foundry';
  private currentTrack?:string;
  private previousTrack?:string;
  private trackArena='';
  private baseTrack?:string;
  private failedAssets=new Set<string>();
  private failedTracks=new Set<string>();
  private failureCount=0;
  private resumePending=false;
  private musicNeedsGesture=false;
  constructor(){
    try{
      const value=JSON.parse(storage.getItem(storageKey)??'{}');
      for(const k of ['master','music','sound','ui','voice'] as const)if(typeof value[k]==='number'&&Number.isFinite(value[k]))this[k]=Math.max(0,Math.min(1,value[k]));
      for(const k of ['mute','muteOnBlur'] as const)if(typeof value[k]==='boolean')this[k]=value[k];
    }catch{/* Storage disabled or invalid: defaults remain usable. */}
  }
  unlock():void {
    if(this.disposed)return;
    if(this.musicNeedsGesture){this.musicNeedsGesture=false;this.musicKey='';}
    try {
      if(!this.context){
        const c=this.context=new AudioContext();
        this.masterNode=c.createGain();this.sfxNode=c.createGain();
        const protection=createMixProtection(c);this.compressor=protection.compressor;this.safety=protection.safety;
        this.masterNode.connect(this.compressor);this.sfxNode.connect(this.masterNode);
        this.criticalCombat=c.createGain();this.criticalCombat.connect(this.sfxNode);this.criticalCombat.gain.value=mixLevels.critical;
        for(const bus of ['music','combat','ui','ambience','voice'] as AudioBus[]){const gain=c.createGain();gain.connect(['combat','ui','ambience'].includes(bus)?this.sfxNode:this.masterNode);this.buses.set(bus,gain);}
        this.update(false);void this.preload(Object.keys(sounds).filter(id=>(sounds[id].bus==='ui'||sounds[id].bus==='voice')&&!id.includes('.')||['attack_light','attack_heavy','hit_light','hit_heavy','block','ko'].includes(id)));
        this.musicKey='';
      }
      if(this.context.state!=='running'&&this.context.state!=='closed'&&!this.resumePending){
        this.resumePending=true;
        void this.context.resume().then(()=>{if(!this.disposed)this.refreshMusic();}).catch(()=>{this.failureCount++;}).finally(()=>{this.resumePending=false;});
      }else if(!this.musicKey)this.refreshMusic();
    }catch{this.failureCount++;}
  }
  private ramp(node:GainNode|undefined,value:number,time=.04):void{
    if(!node||!this.context)return;
    node.gain.setTargetAtTime(value,this.context.currentTime,time);
  }
  announce(text:string):void{
    if(this.disposed||this.paused||this.blurred||this.mute||this.context?.state!=='running'||this.voice<=0||this.master<=0)return;
    this.announcer.speak(text,Math.min(1,this.master*this.voice*mixLevels.voice));
    this.duck('voice');
  }
  update(save=true):void{
    this.announcer.cancel();
    for(const key of ['master','music','sound','ui','voice'] as const)this[key]=Math.max(0,Math.min(1,Number.isFinite(this[key])?this[key]:0));
    this.ramp(this.masterNode,this.mute||this.blurred&&this.muteOnBlur?0:this.master);
    this.ramp(this.sfxNode,this.sound);
    this.mix();
    if(save)try{storage.setItem(storageKey,JSON.stringify({master:this.master,music:this.music,sound:this.sound,ui:this.ui,voice:this.voice,mute:this.mute,muteOnBlur:this.muteOnBlur}));}catch{/* Optional persistence. */}
  }
  private mix():void{
    const now=performance.now();
    const duck=this.ducking.gain(now);
    this.ramp(this.buses.get('music'),this.music*mixLevels.music*duck*(this.paused?.65:1),duck<this.duckLevel?.035:.22);this.duckLevel=duck;
    this.ramp(this.buses.get('combat'),mixLevels.combat*(this.paused?.12:now<this.combatDuckUntil?.65:1),.08);
    this.ramp(this.buses.get('ui'),this.ui*mixLevels.ui);
    this.ramp(this.buses.get('ambience'),mixLevels.ambience*(this.paused?.25:1));
    this.ramp(this.buses.get('voice'),this.voice*mixLevels.voice);
  }
  private later(fn:()=>void,ms:number):void {const timer=setTimeout(()=>{this.timers.delete(timer);if(!this.disposed)fn();},ms);this.timers.add(timer);}
  duck(kind:DuckKind):void{
    const now=performance.now();this.ducking.request(kind,now);
    if(kind==='ko')this.combatDuckUntil=Math.max(this.combatDuckUntil,now+400);
    this.mix();this.scheduleDuckRelease();
  }
  private scheduleDuckRelease():void{
    if(this.duckTimer!==undefined)clearTimeout(this.duckTimer);
    const now=performance.now(),next=this.ducking.next(now);
    const wait=this.combatDuckUntil>now?Math.min(next??Infinity,this.combatDuckUntil-now):next;this.duckTimer=undefined;
    if(wait!==undefined)this.duckTimer=setTimeout(()=>{this.duckTimer=undefined;if(!this.disposed){this.mix();this.scheduleDuckRelease();}},wait+5);
  }
  setPaused(value:boolean):void {this.paused=value;this.mix();if(value)this.stopEffects();}
  setFocus(focused:boolean):void{
    this.blurred=!focused;
    if(!focused)this.stopEffects();
    this.update(false);
    // Do not replay missed effects or seek/restart loops when returning.
  }
  private stopVoice(id:number,fade=false):void{
    const voice=this.voices.get(id)??this.retiring.get(id);if(!voice)return;
    // Retiring voices no longer consume admission slots, but remain owned until disconnected.
    if(fade&&this.retiring.has(id))return;
    voice.source.onended=null;this.voices.delete(id);this.policy.voices.delete(id);
    const finish=()=>{try{voice.source.stop();}catch{/* Already ended. */}for(const node of voice.nodes)node.disconnect();this.retiring.delete(id);};
    if(fade){this.retiring.set(id,voice);this.ramp(voice.nodes[1] as GainNode,0,.004);this.later(()=>{if(this.retiring.has(id))finish();},24);}else finish();
  }
  stopEffects(buses?:AudioBus[]):void{
    if(!buses||buses.includes('voice')||buses.includes('ui'))this.announcer.cancel();
    for(const [id,voice] of [...this.voices,...this.retiring])if(!buses||buses.includes(voice.bus))this.stopVoice(id);
    for(const [id,voice] of this.abilityLoops)if(!this.voices.has(voice))this.abilityLoops.delete(id);
  }
  fadeCombat():void{
    this.announcer.cancel();
    for(const [id,voice] of this.voices)if(voice.bus==='combat'||voice.bus==='voice'){this.ramp(voice.nodes[1] as GainNode,0,.008);this.later(()=>this.stopVoice(id),50);}
  }
  resetMatch():void{this.ducking.clear();this.combatDuckUntil=0;if(this.duckTimer!==undefined)clearTimeout(this.duckTimer);this.duckTimer=undefined;this.stopEffects();this.policy.reset();this.paused=false;this.musicKey='';this.currentTrack=undefined;this.baseTrack=undefined;this.mix();}
  async preload(ids:string[]):Promise<void>{
    const c=this.context;if(!c||this.disposed)return;
    await Promise.all(ids.flatMap(id=>sounds[id]?.assets??[]).map(url=>{
      if(this.buffers.has(url)||this.failedAssets.has(url))return Promise.resolve();
      if(this.pending.has(url))return this.pending.get(url)!;
      const task=fetch(url,{signal:this.abort.signal}).then(r=>{if(!r.ok)throw Error('Audio asset unavailable');return r.arrayBuffer();}).then(bytes=>c.decodeAudioData(bytes)).then(buffer=>{
        if(this.disposed)return;
        if(buffer.duration>10)throw Error('Use streamed audio for long clips');
        this.buffers.set(url,buffer);this.calibration.set(url,sampleCalibration(buffer));
        // Short sample cache bounded independently from streamed music.
        while(this.buffers.size>512||[...this.buffers.values()].reduce((sum,b)=>sum+b.length*b.numberOfChannels*4,0)>64*1024*1024){const key=this.buffers.keys().next().value!;this.buffers.delete(key);this.calibration.delete(key);}
      }).catch(()=>{this.failureCount++;this.failedAssets.add(url);}).finally(()=>{this.pending.delete(url);});
      this.pending.set(url,task);return task;
    }));
  }
  play(key:string,options:{eventId?:string;x?:number;width?:number;gain?:number;layer?:boolean}={}):number|undefined{
    const c=this.context;key=legacySounds[key]??key;const def=sounds[key];
    if(!c||c.state!=='running'||!def||this.disposed||this.mute||this.blurred&&this.muteOnBlur||this.paused&&(def.bus==='combat'||def.bus==='voice'))return;
    if(this.master<=0||def.bus==='voice'&&this.voice<=0||['combat','ui','ambience'].includes(def.bus)&&this.sound<=0||def.bus==='ui'&&this.ui<=0)return;
    if(!options.layer)for(const layer of def.layers??[])this.play(layer,{...options,layer:true,eventId:options.eventId?`${options.eventId}:${layer}`:undefined});
    const available=(def.assets??[]).filter(url=>this.buffers.has(url));
    if(!available.length&&!def.fallback)return;
    const ticket=this.policy.admit(key,def,performance.now(),options.eventId);if(!ticket)return;
    if(ticket.evict!==undefined)this.stopVoice(ticket.evict,true);
    try{
      const gain=c.createGain(),panner=c.createStereoPanner();
      const variation=1+(Math.random()*2-1)*def.variation;
      const pan=def.spatial&&options.x!==undefined&&options.width?Math.max(-.55,Math.min(.55,(options.x/options.width*2-1)*.55)):0;
      panner.pan.value=pan;gain.connect(panner);panner.connect(def.bus==='combat'&&def.priority>=90?this.criticalCombat!:this.buses.get(def.bus)!);
      let source:AudioScheduledSourceNode,duration:number,normalization=1;
      if(available.length){const sample=c.createBufferSource();const url=available[Math.floor(Math.random()*available.length)];sample.buffer=this.buffers.get(url)!;normalization=def.bus==='voice'?1:(this.calibration.get(url)?.gain??1);sample.playbackRate.value=variation;sample.loop=def.loop??false;source=sample;duration=sample.buffer.duration/variation;}
      else{const f=def.fallback!,osc=c.createOscillator();osc.type=f.wave;osc.frequency.setValueAtTime(f.from*variation,c.currentTime);osc.frequency.exponentialRampToValueAtTime(f.to*variation,c.currentTime+f.duration);source=osc;duration=f.duration;}
      const level=def.gain*normalization*(1+(Math.random()*2-1)*def.variation*.5)*Math.max(.5,Math.min(1.2,options.gain??1));
      gain.gain.setValueAtTime(0,c.currentTime);gain.gain.linearRampToValueAtTime(level,c.currentTime+.004);
      if(!def.loop&&!available.length){gain.gain.setTargetAtTime(.0001,c.currentTime+duration*.35,Math.max(.008,duration*.18));}
      source.connect(gain);this.voices.set(ticket.id,{source,nodes:[source,gain,panner],bus:def.bus});
      source.onended=()=>this.stopVoice(ticket.id);source.start();
      if(def.bus==='voice')this.duck('voice');else if(def.duck&&!def.loop&&!options.layer)this.duck(def.duck);if(!def.loop)source.stop(c.currentTime+duration+.03);
      return ticket.id;
    }catch{this.stopVoice(ticket.id);this.policy.voices.delete(ticket.id);this.failureCount++;}
  }
  syncAbilityLoops(desired:readonly {id:string;key:string;x:number}[],width:number):void{
    const wanted=new Set(desired.map(v=>v.id));
    for(const [id,voice] of this.abilityLoops)if(!wanted.has(id)||!this.voices.has(voice)){this.stopVoice(voice,true);this.abilityLoops.delete(id);}
    for(const item of desired){
      const existing=this.abilityLoops.get(item.id);
      if(existing!==undefined){const p=this.voices.get(existing)?.nodes[2] as StereoPannerNode|undefined;if(p)p.pan.value=Math.max(-.55,Math.min(.55,(item.x/width*2-1)*.55));continue;}
      if(this.abilityLoops.size>=6)break;
      const voice=this.play(item.key,{x:item.x,width});if(voice!==undefined)this.abilityLoops.set(item.id,voice);
    }
  }
  setMusic(state:MusicState,arena=this.arena):void{
    const key=`${arena}:${state}`;if(this.musicKey===key)return;
    this.musicState=state;this.arena=arena;this.musicKey=key;
    this.refreshMusic();
  }
  private refreshMusic():void{
    if(!this.context||this.context.state!=='running'||this.musicNeedsGesture)return;
    this.musicKey=`${this.arena}:${this.musicState}`;
    // Preserve the same arena song across intensity changes; use authored variants if present.
    let chosen:MusicTrack|undefined;
    const current=this.baseTrack&&tracks[this.baseTrack];
    if(current&&!this.failedTracks.has(current.id)&&this.trackArena===this.arena&&['match','intro','final','sudden-death'].includes(this.musicState)&&current.profile===arenaAudio[this.arena]?.profile){
      const variant=this.musicState==='final'?current.finalVersion:this.musicState==='sudden-death'?current.suddenDeathVersion:undefined;
      chosen=variant&&tracks[variant]?.url&&!this.failedTracks.has(variant)?tracks[variant]:current;
    }else {
      const combat=['match','intro','final','sudden-death'].includes(this.musicState);
      const base=chooseMusic(combat?'match':this.musicState,this.arena,this.previousTrack,Math.random,this.failedTracks);
      this.baseTrack=base?.id;
      const variant=this.musicState==='final'?base?.finalVersion:this.musicState==='sudden-death'?base?.suddenDeathVersion:this.musicState==='intro'?base?.introVersion:undefined;
      chosen=variant&&tracks[variant]?.url&&!this.failedTracks.has(variant)?tracks[variant]:base;
    }
    this.trackArena=this.arena;
    const a=arenaAudio[this.arena],ambient=a?.ambience&&ambience[a.ambience];
    const ambientActive=!!(ambient&&ambient.url&&['intro','match','final','sudden-death'].includes(this.musicState));
    if(chosen?.id===this.currentTrack&&this.loops.some(l=>l.id===chosen!.id)&&this.loops.some(l=>l.bus==='ambience')===ambientActive)return;
    const generation=++this.generation;
    this.currentTrack=chosen?.id;if(chosen)this.previousTrack=chosen.id;
    // Keep the arena audible until the invasion file can actually play.
    const invasion=chosen?.id==='invasion_01';
    const outgoing=invasion?[...this.loops]:[];
    if(!invasion)for(const loop of [...this.loops])this.fadeLoop(loop);
    if(chosen?.url)this.startLoop(chosen.id,chosen.url,chosen.gain,'music',generation,chosen.loop,invasion?outgoing:undefined);
    if(ambient&&ambient.url&&ambientActive)this.startLoop(a!.ambience!,ambient.url,ambient.gain,'ambience',generation,true);
  }
  private startLoop(id:string,url:string,volume:number,bus:'music'|'ambience',generation:number,repeat:boolean,invasionOutgoing?:Loop[]):void{
    const c=this.context;if(!c)return;
    try{
      // At most old+new music and ambience during crossfade, even under rapid navigation.
      while(this.loops.length>=4)this.removeLoop(this.loops[0]);
      const element=new Audio();element.crossOrigin='anonymous';element.preload='auto';element.loop=repeat;element.src=url;
      const source=c.createMediaElementSource(element),gain=c.createGain();gain.gain.value=invasionOutgoing?volume:0;source.connect(gain);gain.connect(this.buses.get(bus)!);
      const loop={id,element,source,gain,bus};this.loops.push(loop);
      const fail=()=>{
        if(!this.loops.includes(loop))return;
        this.failureCount++;this.removeLoop(loop);
        if(bus==='music'&&generation===this.generation&&!this.disposed){this.failedTracks.add(id);this.currentTrack=undefined;this.baseTrack=undefined;this.refreshMusic();}
      };
      element.onerror=fail;
      void element.play().then(()=>{
        if(this.disposed||generation!==this.generation){this.removeLoop(loop);return;}
        if(invasionOutgoing){
          // The invasion starts at full track gain; only the arena fades (~3 seconds).
          for(const old of invasionOutgoing)if(this.loops.includes(old))this.fadeLoop(old,.6,3300);
        }else this.ramp(gain,volume,.25);
      }).catch(error=>{
        // A browser gesture restriction is not a corrupt/missing asset. Retry on unlock.
        if(error?.name==='NotAllowedError'){
          this.removeLoop(loop);
          if(generation===this.generation&&!this.disposed){this.currentTrack=undefined;this.musicKey='';this.musicNeedsGesture=true;}
        }else fail();
      });
    }catch{this.failureCount++;}
  }
  private fadeLoop(loop:Loop,time=.15,removeAfter=850):void{this.ramp(loop.gain,0,time);this.later(()=>this.removeLoop(loop),removeAfter);}
  private removeLoop(loop:Loop):void{
    if(!this.loops.includes(loop))return;
    loop.element.onerror=null;loop.element.pause();loop.element.removeAttribute('src');loop.element.load();loop.source.disconnect();loop.gain.disconnect();this.loops.splice(this.loops.indexOf(loop),1);
  }
  diagnostics(){return {state:this.context?.state??'locked',active:this.voices.size,retiring:this.retiring.size,cap:this.policy.cap,voices:[...this.policy.voices.values()].map(v=>({sound:v.key,bus:sounds[v.key]?.bus,priority:v.priority})),suppressed:this.policy.suppressed,musicState:this.musicState,profile:arenaAudio[this.arena]?.profile??'default',track:this.currentTrack??'missing asset',musicVolume:this.music,mix:mixLevels,duckGain:this.ducking.gain(performance.now()),voiceVolume:this.voice,intensity:(this.currentTrack&&tracks[this.currentTrack]?.intensity)??(this.musicState==='final'||this.musicState==='sudden-death'?'high':'normal'),playback:this.loops.map(l=>({id:l.id,seconds:l.element.currentTime??0,ready:l.element.readyState??0,paused:l.element.paused??false})),loops:this.loops.length,buffers:this.buffers.size,failures:this.failureCount};}
  dispose():void{
    this.disposed=true;if(this.duckTimer!==undefined)clearTimeout(this.duckTimer);this.ducking.clear();this.generation++;this.abort.abort();for(const timer of this.timers)clearTimeout(timer);this.timers.clear();
    this.stopEffects();for(const loop of [...this.loops])this.removeLoop(loop);this.buffers.clear();this.calibration.clear();this.pending.clear();
    for(const bus of this.buses.values())bus.disconnect();this.buses.clear();this.sfxNode?.disconnect();this.masterNode?.disconnect();this.compressor?.disconnect();this.safety?.disconnect();this.criticalCombat?.disconnect();
    if(this.context)void this.context.close().catch(()=>{});this.context=null;
  }
}
