import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioPolicy} from '../apps/client/src/audio/AudioPolicy.js';
import {sounds} from '../apps/client/src/audio/SoundRegistry.js';
import {chooseMusic,tracks,arenaAudio,musicProfiles} from '../apps/client/src/audio/MusicRegistry.js';
import {AudioManager} from '../apps/client/src/audio/AudioManager.js';
import {GameAudio} from '../apps/client/src/audio/GameAudio.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';

test('eight-player flood stays within cap and important cues replace low priority voices',()=>{
 const p=new AudioPolicy(24),def={...sounds.jump,cooldown:0,maxInstances:30};
 for(let frame=0;frame<600;frame++)for(let fighter=0;fighter<8;fighter++){
  p.admit('jump',def,frame*16,`${frame}:${fighter}`);assert.ok(p.voices.size<=24);
 }
 const ko=p.admit('ko',sounds.ko,10000,'ko');assert.ok(ko);assert.notEqual(ko.evict,undefined);
 assert.equal(p.voices.size,24);assert.ok([...p.voices.values()].some(v=>v.key==='ko'));assert.ok(p.suppressed>0);assert.ok(p.seen.size<=2048);
});
test('duplicate ids, shared cooldown and per-sound cap are enforced',()=>{
 const p=new AudioPolicy();const d={...sounds.hit_light,maxInstances:1};
 assert.ok(p.admit('hit',d,0,'event'));
 assert.equal(p.admit('hit',d,100,'event'),undefined);
 assert.equal(p.admit('hit',d,10,'other'),undefined);
 assert.ok(p.admit('hit',d,200,'third')?.evict);assert.equal(p.voices.size,1);
 p.reset();assert.ok(p.admit('hit',d,201,'event'));
});
test('music uses arena pool, avoids immediate repeat, uses optional variants and fallback',()=>{
 const original=structuredClone(tracks),originalPool=arenaAudio['the-foundry'].tracks;
 arenaAudio['the-foundry'].tracks=['rooftop_01','rooftop_02'];
 delete tracks.rooftop_01.finalVersion;
 tracks.rooftop_01.url='/one.ogg';tracks.rooftop_02.url='/two.ogg';tracks.battle_01.url='/fallback.ogg';
 try{
  assert.equal(chooseMusic('match','the-foundry','rooftop_01',()=>0)?.id,'rooftop_02');
  assert.equal(chooseMusic('final','the-foundry','rooftop_02',()=>0)?.id,'rooftop_01');
  tracks.rooftop_01.finalVersion='test_final';tracks.test_final={id:'test_final',url:'/final.ogg',gain:.5,loop:true,profile:'urban'};
  assert.equal(chooseMusic('final','the-foundry','rooftop_02',()=>0)?.id,'test_final');
  assert.equal(chooseMusic('match','unknown',undefined,()=>0)?.id,'battle_01');
  tracks.championship_01.url='/champ.ogg';assert.equal(chooseMusic('championship','the-foundry')?.id,'championship_01');
  arenaAudio.test={profile:'tropical'};tracks.beach_01.url='/beach.ogg';assert.equal(chooseMusic('match','test')?.id,'beach_01');
 }finally{for(const key of Object.keys(tracks))delete tracks[key];Object.assign(tracks,original);arenaAudio['the-foundry'].tracks=originalPool;delete arenaAudio.test;}
 assert.ok(chooseMusic('match','the-foundry')?.url);
 assert.ok(musicProfiles.industrial.tracks.includes('factory_01'));
});
class Param {value=1;targets:{value:number;time:number}[]=[];setTargetAtTime(v:number,_at=0,time=.04){this.targets.push({value:v,time});this.value=v;}setValueAtTime(v:number){this.value=v;}linearRampToValueAtTime(v:number){this.value=v;}exponentialRampToValueAtTime(v:number){this.value=v;}}
class Node {gain=new Param();pan=new Param();frequency=new Param();playbackRate=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();onended:(()=>void)|null=null;connections:Node[]=[];type='sine';connect(n:Node){this.connections.push(n);}disconnect(){this.connections=[];}start(){}stop(){}}
class Context {static instances=0;state='running';currentTime=0;destination=new Node();nodes:Node[]=[];constructor(){Context.instances++;}node(){const n=new Node();this.nodes.push(n);return n;}createGain(){return this.node();}createDynamicsCompressor(){return this.node();}createWaveShaper(){return this.node();}createStereoPanner(){return this.node();}createOscillator(){return this.node();}createBufferSource(){return this.node();}resume(){this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}

test('one context, live settings persistence, bus routing, suppression, focus and disposal',()=>{
 const oldContext=globalThis.AudioContext,oldStorage=globalThis.localStorage;const values=new Map<string,string>();
 Object.assign(globalThis,{AudioContext:Context,localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
 try{
  const a=new AudioManager();for(let i=0;i<10;i++)a.unlock();assert.equal(Context.instances,1);
  a.play('hit_light',{eventId:'x'});a.play('hit_light',{eventId:'x'});assert.equal(a.diagnostics().active,1);assert.equal(a.diagnostics().suppressed,1);
  a.master=.2;a.ui=.1;a.voice=.23;a.muteOnBlur=true;a.update();const restored=new AudioManager();assert.equal(restored.master,.2);assert.equal(restored.ui,.1);assert.equal(restored.voice,.23);
  a.setFocus(false);assert.equal(a.diagnostics().active,0);a.play('ko');assert.equal(a.diagnostics().active,0);
  a.setFocus(true);a.play('ko');assert.equal(a.diagnostics().active,1);
  a.setPaused(true);assert.equal(a.diagnostics().active,0);a.play('hit_heavy');assert.equal(a.diagnostics().active,0);
  a.dispose();a.unlock();assert.equal(Context.instances,1);assert.equal(a.context,null);
 }finally{Object.assign(globalThis,{AudioContext:oldContext,localStorage:oldStorage});}
});
test('audio observation does not mutate game state; readiness is a threshold event',()=>{
 const sim=new GameSimulation(['nikalz','jopa'],false);sim.state.phase='fight';sim.state.fighters[0].meter=0;
 const played:string[]=[];const fake={syncAbilityLoops:()=>{},play:(id:string)=>played.push(id),setMusic:()=>{},duck:()=>{},resetMatch:()=>{}} as unknown as AudioManager;
 const bridge=new GameAudio(fake),consume=()=>bridge.consume(sim.state,[],[],'the-foundry',2400,[0]);
 consume();const before=hashState(sim.state);consume();assert.equal(hashState(sim.state),before);
 sim.state.frame++;sim.state.fighters[0].meter=100;consume();const count=played.length;consume();assert.equal(played.length,count);assert.ok(played.includes('ultimate_ready'));
});
test('misses have movement only, damage adds impact, blocks replace damage cue',()=>{
 const sim=new GameSimulation(['nikalz','jopa'],false);sim.state.phase='fight';const ids:string[]=[];
 const bridge=new GameAudio({syncAbilityLoops:()=>{},play:(id:string)=>ids.push(id),setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
 sim.state.fighters[0].move='jab';sim.state.fighters[0].moveFrame=characters.nikalz.moves.jab.startupFrames;
 const journal=[{id:'1',frame:1,type:'MoveActive' as const,actor:0,detail:'jab'}];
 bridge.consume(sim.state,[],journal,'the-foundry',2400,[0]);assert.deepEqual(ids,['nikalz.jab.start']);ids.length=0;
 bridge.consume(sim.state,[{id:'2',type:'block',player:1,x:0,y:0,power:1}],[{id:'3',frame:1,type:'DamageApplied',actor:1,detail:'Idle',amount:20}],'the-foundry',2400,[0]);assert.deepEqual(ids,['block']);
});

test('music crossfades stay bounded, stale loads clean up, failures select fallback',async()=>{
 const oldContext=globalThis.AudioContext,oldAudio=globalThis.Audio;
 class MusicContext extends Context {createMediaElementSource(){return this.node();}}
 class Media {src='';crossOrigin='';preload='';loop=false;onerror:(()=>void)|null=null;play(){return this.src.includes('broken')?Promise.reject(Error('missing')):Promise.resolve();}pause(){}removeAttribute(){this.src='';}load(){}}
 Object.assign(globalThis,{AudioContext:MusicContext,Audio:Media});
 const original=structuredClone(tracks);
 tracks.menu_01.url='/menu.ogg';tracks.rooftop_01.url='/broken.ogg';tracks.rooftop_02.url='/battle.ogg';
 const a=new AudioManager();
 try{
  a.unlock();await Promise.resolve();
  for(let i=0;i<30;i++){a.setMusic(i%2?'match':'menu');assert.ok(a.diagnostics().loops<=4);}
  await new Promise(resolve=>setTimeout(resolve,20));assert.ok(a.diagnostics().loops<=4);
  await new Promise(resolve=>setTimeout(resolve,900));assert.equal(a.diagnostics().loops,1);
  a.setMusic('final');await Promise.resolve();assert.equal(a.diagnostics().track,'championship_final_01');
  a.setMusic('match');await Promise.resolve();assert.equal(a.diagnostics().track,'rooftop_02');
  a.setMusic('invasion');await Promise.resolve();assert.equal(a.diagnostics().track,'invasion_01');
  for(let i=0;i<60;i++)a.setMusic('invasion');
  await new Promise(resolve=>setTimeout(resolve,3400));assert.equal(a.diagnostics().loops,1);
  a.setMusic('menu');await Promise.resolve();
  await new Promise(resolve=>setTimeout(resolve,900));assert.equal(a.diagnostics().track,'menu_01');assert.equal(a.diagnostics().loops,1);
  a.dispose();assert.equal(a.diagnostics().loops,0);assert.equal(a.diagnostics().active,0);
 }finally{a.dispose();for(const key of Object.keys(tracks))delete tracks[key];Object.assign(tracks,original);Object.assign(globalThis,{AudioContext:oldContext,Audio:oldAudio});}
});

test('failed sample preload is nonfatal and retried at most once per session',async()=>{
 const oldContext=globalThis.AudioContext,oldFetch=globalThis.fetch;let attempts=0;
 Object.assign(globalThis,{AudioContext:Context,fetch:async(url:string)=>{if(url==='/missing.wav')attempts++;throw Error('offline');}});
 sounds.test_asset={...sounds.hit_light,assets:['/missing.wav']};
 const a=new AudioManager();
 try{a.unlock();await a.preload(['test_asset']);await a.preload(['test_asset']);assert.equal(attempts,1);assert.equal(a.diagnostics().buffers,0);a.play('hit_light');assert.equal(a.diagnostics().active,1);}
 finally{a.dispose();delete sounds.test_asset;Object.assign(globalThis,{AudioContext:oldContext,fetch:oldFetch});}
});

test('eight fighters with projectiles, specials and supers remain deterministic with audio',()=>{
 const ids=['nikalz','jopa','eide','napa','dodo','drupa','tocha','roms'];
 const a=new GameSimulation(ids,false,undefined,undefined,undefined,false,1234);
 const b=new GameSimulation(ids,false,undefined,undefined,undefined,false,1234);
 const bridge=new GameAudio({syncAbilityLoops:()=>{},play:()=>{},setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
 for(let frame=0;frame<720;frame++){
  const input=ids.map((_,i)=>frame%90===i?128:frame%120===i?512:frame%30<5?16:frame%80<40?2:1);
  a.step(input);b.step(input);
  bridge.consume(a.state,a.events,a.gameplayEvents,'the-foundry',2400,[0,1]);
  if(frame%60===0)assert.equal(hashState(a.state),hashState(b.state));
 }
 assert.equal(hashState(a.state),hashState(b.state));
});

import {fighterAudio,assetBriefs,materials,moveAudio} from '../apps/client/src/audio/FighterAudio.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {audioPresence} from '../apps/client/src/audio/AbilityAudio.js';
import {applyDamage} from '../packages/game-core/combat/DamageSystem.js';
import {clearGameplayEvents,gameplayEvents} from '../packages/game-core/combat/GameplayEvents.js';
test('all roster moves have material-specific phases and documented valid references',()=>{
 assert.equal(Object.keys(fighterAudio).length,16);
 for(const c of Object.values(characters))for(const move of Object.keys(c.moves)){
  const profile=moveAudio(c.id,move);assert.ok(profile);assert.ok(materials[profile.family]);
  for(const phase of ['start','active','impact','end'] as const){assert.ok(sounds[profile[phase]]);assert.ok(assetBriefs[profile[phase]]);}
 }
 assert.equal(moveAudio('gut','axe')?.family,'kick');assert.equal(moveAudio('bozo','spear')?.family,'hair');
 assert.equal(moveAudio('roms','water')?.family,'water');assert.equal(moveAudio('jopa','football')?.family,'football');
 assert.notEqual(moveAudio('dodo','chord')?.impact,moveAudio('nikalz','bees')?.impact);
 assert.equal(sounds['roms.water.impact'].fallback,undefined);
});
test('source metadata selects impact material even with a simultaneous block on the same victim',()=>{
 const sim=new GameSimulation(['roms','jopa'],false);sim.state.phase='fight';clearGameplayEvents(sim.state);
 applyDamage(sim.state,sim.state.fighters[1],20,{source:0,move:'water'});
 const ids:string[]=[];const bridge=new GameAudio({syncAbilityLoops:()=>{},play:(id:string)=>ids.push(id),setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
 bridge.consume(sim.state,[{id:'block',type:'block',player:1,power:1,x:0,y:0}],gameplayEvents(sim.state),'the-foundry',2400,[]);
 assert.ok(ids.includes('roms.water.impact'));assert.ok(ids.includes('block'));assert.ok(!ids.includes('hit_special'));
});
test('channel loops start only in active frames and stop on cancellation, KO and results',()=>{
 const sim=new GameSimulation(['roms','jopa'],false);const s=sim.state,f=s.fighters[0];s.phase='fight';f.move='water';f.moveFrame=0;
 assert.equal(audioPresence(s).length,0);f.moveFrame=31;assert.ok(audioPresence(s).some(p=>p.move==='water'));
 f.move=null;assert.equal(audioPresence(s).length,0);f.move='water';f.health=0;assert.equal(audioPresence(s).length,0);
 f.health=100;s.phase='result';assert.equal(audioPresence(s).length,0);
});
test('scoped looping sources are bounded, follow desired objects and clean up after pause',()=>{
 const old=globalThis.AudioContext;Object.assign(globalThis,{AudioContext:Context});
 const def=sounds['roms.water.active'];const backup=def.fallback;def.fallback={from:100,to:100,duration:1,wave:'sine'};
 const a=new AudioManager();try{a.unlock();a.syncAbilityLoops([{id:'hose',key:'roms.water.active',x:20}],2400);assert.equal(a.diagnostics().active,1);
 a.syncAbilityLoops([{id:'hose',key:'roms.water.active',x:100}],2400);assert.equal(a.diagnostics().active,1);
 a.syncAbilityLoops([],2400);assert.equal(a.diagnostics().active,0);a.setPaused(true);a.syncAbilityLoops([{id:'new',key:'roms.water.active',x:20}],2400);assert.equal(a.diagnostics().active,0);
 }finally{a.dispose();def.fallback=backup;Object.assign(globalThis,{AudioContext:old});}
});

import {Button} from '../packages/game-core/types.js';
import {spawnBees} from '../packages/game-core/simulation/NikalzSystem.js';
import {readFileSync} from 'node:fs';
test('Nikalz ground attacks emit an impact on a miss, at ground contact rather than activation',()=>{
 for(const [move,button] of [['testada',Button.Special],['meteor',Button.Super1],['foreheadDive',Button.Medium]] as const){
  const sim=new GameSimulation(['nikalz','gut']);sim.state.phase='fight';
  const f=sim.state.fighters[0];f.state='Idle';f.meter=100;f.x=200;f.y=sim.stage.floorHeight;sim.state.fighters[1].x=2200;
  if(move==='foreheadDive'){f.y=300;f.state='Jump';f.airJumpUsed=true;f.airJumpsUsed=1;}
  const heard:string[]=[];const bridge=new GameAudio({syncAbilityLoops:()=>{},play:(id:string)=>heard.push(id),setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
  let contacts=0;
  for(let frame=0;frame<150;frame++){sim.step([frame===0?button:0,0]);contacts+=sim.gameplayEvents.filter(e=>e.type==='GroundImpact'&&e.detail===move).length;bridge.consume(sim.state,sim.events,sim.gameplayEvents,'the-foundry',2400,[]);}
  assert.equal(contacts,1,move);assert.ok(heard.includes(`nikalz.${move}.impact`),move);
 }
});
test('bees request a real loop while alive and stop it after contact',()=>{
 const sim=new GameSimulation(['nikalz','gut']);sim.state.phase='fight';sim.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=200+i*1800;});
 spawnBees(sim.state,0,700,85);const loops:string[][]=[];
 const bridge=new GameAudio({syncAbilityLoops:(items:{key:string}[])=>loops.push(items.map(i=>i.key)),play:()=>{},setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
 bridge.consume(sim.state,[],[],'the-foundry',2400,[]);assert.ok(loops.at(-1)?.includes('nikalz.bees.active'));
 sim.state.fighters[1].x=700;sim.state.fighters[1].y=0;sim.step([0,0]);
 bridge.consume(sim.state,sim.events,sim.gameplayEvents,'the-foundry',2400,[]);assert.ok(!loops.at(-1)?.includes('nikalz.bees.active'));
 for(const id of ['nikalz.testada.impact','nikalz.meteor.impact','nikalz.foreheadDive.impact','nikalz.bees.start','nikalz.bees.active','nikalz.bees.impact','nikalz.bees.end']){
  assert.ok(sounds[id].assets?.length,id);
  for(const url of sounds[id].assets!){const wav=readFileSync(`apps/client/public${url}`);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.ok(wav.length>1000);}
 }
});

test('every fighter move phase resolves to non-silent shipped PCM, within the complete roster cache budget',()=>{
 const unique=new Set<string>();
 for(const moves of Object.values(fighterAudio))for(const profile of Object.values(moves))for(const phase of ['start','active','impact','end'] as const){
  const def=sounds[profile[phase]];assert.ok(def.assets?.length,profile[phase]);def.assets!.forEach(u=>unique.add(u));
 }
 let bytes=0;
 for(const url of unique){const wav=readFileSync(`apps/client/public${url}`);assert.equal(wav.toString('ascii',0,4),'RIFF',url);let energy=0;for(let i=44;i<wav.length;i+=2)energy+=Math.abs(wav.readInt16LE(i));assert.ok(energy/(wav.length/2)>100,url);bytes+=(wav.length-44)/2/wav.readUInt32LE(24)*48000*4;}
 assert.ok(unique.size<512);assert.ok(bytes<64*1024*1024);
});
test('all 225 attack activations and sourced impacts request playable material effects',()=>{
 for(const c of Object.values(characters)){
  const sim=new GameSimulation([c.id,'nikalz']);sim.state.phase='fight';const heard:string[]=[];
  const bridge=new GameAudio({syncAbilityLoops:()=>{},play:(id:string)=>heard.push(id),setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
  for(const move of Object.keys(c.moves)){
   sim.state.fighters[0].move=move;sim.state.fighters[0].moveFrame=c.moves[move].startupFrames;
   heard.length=0;bridge.consume(sim.state,[],[{id:move+'active',frame:1,type:'MoveActive',actor:0,detail:move},{id:move,frame:1,type:'AttackStarted',actor:0,detail:move},{id:move+'hit',frame:1,type:'DamageApplied',actor:1,detail:'Idle',amount:10,source:0,move}],'the-foundry',2400,[]);
   assert.ok(heard.includes(moveAudio(c.id,move)!.start));assert.ok(heard.includes(moveAudio(c.id,move)!.impact));
  }
 }
});
test('idle fighters are not slowed and an opponent entering a slow field receives feedback',()=>{
 const sim=new GameSimulation(['caio','nikalz']);sim.state.phase='fight';const ids:string[]=[];
 const bridge=new GameAudio({syncAbilityLoops:()=>{},play:(id:string)=>ids.push(id),setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
 bridge.consume(sim.state,[],[],'the-foundry',2400,[0]);sim.state.fighters[1].areaSlow=.5;
 bridge.consume(sim.state,[],[],'the-foundry',2400,[0]);assert.ok(ids.includes('nikalz.slow'));
});
test('multiple projectiles from a single companion attack retain distinct audio lifetimes',()=>{
 const sim=new GameSimulation(['napa','nikalz']);sim.state.phase='fight';
 for(let i=0;i<2;i++)Object.assign(sim.state.projectiles[i],{active:true,owner:0,serial:42,move:'bossCookie',x:400+i*50});
 const p=audioPresence(sim.state).filter(p=>p.move==='bossCookie');assert.equal(p.length,2);assert.notEqual(p[0].id,p[1].id);
});

test('every fighter special and ultimate produces activation audio through real simulation input',()=>{
 for(const c of Object.values(characters))for(const [move,button] of [...(c.specialButtons??[]).map((m,i)=>[m,[Button.Special,Button.Special2][i]] as const),...(c.superButtons??[]).map((m,i)=>[m,[Button.Super1,Button.Super2][i]] as const)]){
  const sim=new GameSimulation([c.id,'nikalz']);sim.state.phase='fight';
  sim.state.fighters.forEach((f,i)=>{f.state='Idle';f.meter=100;f.x=400+i*300;f.y=sim.stage.floorHeight;});
  const played:string[]=[];const bridge=new GameAudio({syncAbilityLoops:()=>{},play:(id:string)=>played.push(id),setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
  for(let i=0;i<6;i++){sim.step([button,0]);bridge.consume(sim.state,sim.events,sim.gameplayEvents,'the-foundry',2400,[]);}
  assert.ok(played.includes(moveAudio(c.id,move)!.start),`${c.id}.${move}`);
 }
});

test('announcer obeys volume, mute, pause, focus, match reset and disposal',()=>{
 const oldContext=globalThis.AudioContext,oldSynth=globalThis.speechSynthesis,oldUtterance=globalThis.SpeechSynthesisUtterance;
 let spoken=0,cancels=0,volume=0;
 class Utterance {volume=1;constructor(public text:string){}}
 Object.assign(globalThis,{AudioContext:Context,SpeechSynthesisUtterance:Utterance,speechSynthesis:{getVoices:()=>[{lang:'en-US',localService:true}],speak:(u:Utterance)=>{spoken++;volume=u.volume;},cancel:()=>cancels++}});
 const a=new AudioManager();
 try{
  a.announce('Three');assert.equal(spoken,0);
  a.unlock();a.master=.5;a.sound=.4;a.ui=.5;a.announce('Three');assert.ok(Math.abs(volume-.36)<1e-9);
  a.mute=true;a.update(false);assert.equal(cancels,1);a.announce('Two');assert.equal(spoken,1);
  a.mute=false;a.setPaused(true);a.announce('Two');assert.equal(spoken,1);
  a.setPaused(false);a.setFocus(false);a.announce('Two');assert.equal(spoken,1);
  a.setFocus(true);a.announce('One');assert.equal(spoken,2);a.resetMatch();assert.equal(cancels,2);
  a.announce('Fight!');a.dispose();assert.equal(cancels,3);a.announce('Three');assert.equal(spoken,3);
 }finally{a.dispose();Object.assign(globalThis,{AudioContext:oldContext,speechSynthesis:oldSynth,SpeechSynthesisUtterance:oldUtterance});}
});

test('voice remains independent of SFX mute while master mute suppresses both',()=>{
 const old=globalThis.AudioContext;Object.assign(globalThis,{AudioContext:Context});
 const a=new AudioManager();
 try{
  a.unlock();a.sound=0;a.update(false);
  assert.equal(a.play('hit_light'),undefined);assert.ok(a.play('countdown_3')!==undefined);
  a.stopEffects();a.voice=0;a.sound=.65;a.update(false);
  assert.equal(a.play('countdown_2'),undefined);assert.ok(a.play('hit_heavy')!==undefined);
  a.stopEffects();a.voice=.8;a.mute=true;a.update(false);
  assert.equal(a.play('countdown_1'),undefined);assert.equal(a.play('ko'),undefined);
  a.mute=false;a.master=0;a.update(false);assert.equal(a.play('menu_confirm'),undefined);
  a.resetMatch();assert.equal(a.diagnostics().duckGain,1);
 }finally{a.dispose();Object.assign(globalThis,{AudioContext:old});}
});


test('invasion warning sounds once at confirmed 3:00, survives rollback, and resets for each round/match',()=>{
 const sim=new GameSimulation(['nikalz','jopa']),heard:string[]=[];
 const bridge=new GameAudio({syncAbilityLoops:()=>{},play:(id:string)=>heard.push(id),setMusic:()=>{},duck:()=>{},resetMatch:()=>{}} as unknown as AudioManager);
 const consume=(age:number,confirmed=Infinity,start=180)=>{
  sim.state.phaseFrame=age;sim.state.frame=start+age;
  bridge.consume(sim.state,[],[],'the-foundry',2400,[0],true,'match',confirmed);
 };
 const count=()=>heard.filter(id=>id==='invasion_danger').length;
 sim.state.phase='fight';consume(10799);assert.equal(count(),0);
 consume(10800,10979);assert.equal(count(),0,'wait for authoritative confirmation');
 consume(10801,10980);assert.equal(count(),1,'crossing is not lost if confirmation arrives late');
 consume(10799);consume(10800);consume(11400);assert.equal(count(),1,'no repeat on rollback or later waves');
 consume(10800,Infinity,20000);assert.equal(count(),2,'new round');
 bridge.reset();consume(10800);assert.equal(count(),3,'new match');
 bridge.reset();sim.state.training=true;consume(10800);assert.equal(count(),3);
 sim.state.training=false;sim.state.phase='result';consume(10800);assert.equal(count(),3);
 assert.equal(sounds.invasion_danger.maxInstances,1);assert.equal(sounds.invasion_danger.loop,undefined);
});


test('invasion music replaces every combat score after confirmed threshold and resets with rounds',()=>{
 const sim=new GameSimulation(['nikalz','jopa']),music:string[]=[];
 const bridge=new GameAudio({syncAbilityLoops:()=>{},play:()=>{},setMusic:(state:string)=>music.push(state),duck:()=>{},resetMatch:()=>{}} as unknown as AudioManager);
 const consume=(age:number,confirmed=Infinity)=>{
  sim.state.phaseFrame=age;sim.state.frame=180+age;
  bridge.consume(sim.state,[],[],'the-foundry',2400,[0],true,'championship-final',confirmed);
  return music.at(-1);
 };
 sim.state.phase='fight';
 assert.equal(consume(10799),'championship-final');
 assert.equal(consume(10800,10979),'championship-final');
 assert.equal(consume(10801,10980),'invasion');
 assert.equal(consume(10799),'invasion','rollback does not restart the music');
 assert.equal(consume(12000),'invasion');
 sim.state.phase='intro';assert.equal(consume(0),'intro');
 bridge.reset();sim.state.phase='fight';assert.equal(consume(0),'championship-final');
 sim.state.training=true;assert.equal(consume(10800),'championship-final');
 for(const arena of ['the-foundry','basketball-court','shopping-mall','aeroporto-church'])assert.equal(chooseMusic('invasion',arena)?.id,'invasion_01');
 assert.equal(tracks.invasion_01.loop,true);assert.ok(tracks.invasion_01.gain>tracks.rooftop_01.gain);
});


test('invasion starts at full track gain and fades arena only after playback is ready; stale starts are ignored',async()=>{
 const oldContext=globalThis.AudioContext,oldAudio=globalThis.Audio;
 let resolveInvasion:()=>void=()=>{};
 const sources:{element:Media;source:Node}[]=[];
 class Media {src='';crossOrigin='';preload='';loop=false;onerror:(()=>void)|null=null;play(){return this.src.includes('invasion-dark-horror')?new Promise<void>(resolve=>{resolveInvasion=resolve;}):Promise.resolve();}pause(){}removeAttribute(){this.src='';}load(){}}
 class MusicContext extends Context {createMediaElementSource(element:Media){const source=this.node();sources.push({element,source});return source;}}
 Object.assign(globalThis,{AudioContext:MusicContext,Audio:Media});
 const a=new AudioManager();
 try{
  a.unlock();await Promise.resolve();a.setMusic('match');await Promise.resolve();
  const arena=sources.at(-1)!.source.connections[0].gain,previousTargets=arena.targets.length;
  a.setMusic('invasion');
  const invasion=sources.at(-1)!.source.connections[0].gain;
  assert.equal(invasion.value,tracks.invasion_01.gain,'no invasion fade-in');assert.equal(invasion.targets.length,0);
  assert.equal(arena.targets.length,previousTargets,'arena keeps playing while new track loads');
  resolveInvasion();await Promise.resolve();
  assert.deepEqual(arena.targets.at(-1),{value:0,time:.6});assert.equal(invasion.targets.length,0);
  a.setMusic('menu');await Promise.resolve();
  a.setMusic('invasion');a.setMusic('menu');await Promise.resolve();
  const menu=sources.at(-1)!.source.connections[0].gain,n=menu.targets.length;
  resolveInvasion();await Promise.resolve();assert.equal(menu.targets.length,n,'stale completion cannot fade new menu music');
  assert.equal(a.diagnostics().track,'menu_01');
 }finally{a.dispose();Object.assign(globalThis,{AudioContext:oldContext,Audio:oldAudio});}
});
