import {COUNTDOWN_BEAT_FRAMES,MATCH_INTRO_FRAMES,FIGHT_BANNER_FRAMES} from '../packages/game-core/simulation/MatchIntro.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {GameAudio} from '../apps/client/src/audio/GameAudio.js';
import type {AudioManager} from '../apps/client/src/audio/AudioManager.js';
import {AnnouncerSpeech} from '../apps/client/src/audio/AnnouncerSpeech.js';
import {matchCountdown} from '../apps/client/src/ui/MatchCountdown.js';

test('countdown follows protected intro and fight begins at the shared unlock tick',()=>{
 const sim=new GameSimulation(['nikalz','jopa'],false);
 const spoken:string[]=[],cues:string[]=[];
 const audio=new GameAudio({play:(id:string)=>cues.push(id),announce:(text:string)=>spoken.push(text),syncAbilityLoops:()=>{},setMusic:()=>{},duck:()=>{},resetMatch:()=>{}} as unknown as AudioManager);
 const consume=()=>audio.consume(sim.state,[],[],'the-foundry',2400,[0]);
 const positions=sim.state.fighters.map(f=>[f.x,f.y,f.health]);
 for(let frame=0;frame<MATCH_INTRO_FRAMES;frame++){
   assert.equal(sim.state.phase,'intro');
   assert.equal(matchCountdown(sim.state),String(3-Math.floor(frame/COUNTDOWN_BEAT_FRAMES)));
   consume();consume();
   assert.deepEqual(sim.state.fighters.map(f=>[f.x,f.y,f.health]),positions);
   sim.step([255,255]);
 }
 assert.equal(sim.state.phase,'fight');assert.equal(matchCountdown(sim.state),'FIGHT!');
 consume();consume();
 assert.deepEqual(spoken,[]); // Recorded cues replace device speech.
 assert.deepEqual(cues.filter(c=>c.startsWith('countdown_')),['countdown_3','countdown_2','countdown_1']);
 assert.equal(cues.filter(c=>c==='round_start').length,1);
 sim.state.phaseFrame=FIGHT_BANNER_FRAMES;assert.equal(matchCountdown(sim.state),'');
 // Subsequent rounds and rematches use the same sequence.
 sim.state.phase='intro';sim.state.phaseFrame=0;sim.state.frame++;consume();
 assert.equal(cues.at(-1),'countdown_3');
 audio.reset();consume();assert.equal(cues.at(-1),'countdown_3');
 assert.equal(matchCountdown(new GameSimulation(['nikalz','jopa'],true).state),'');
});

test('optional announcer uses local voices, replaces rather than queues, and cleans up',()=>{
 const oldSynth=globalThis.speechSynthesis,oldUtterance=globalThis.SpeechSynthesisUtterance;
 const spoken:{text:string;volume:number;rate:number;pitch:number}[]=[];let cancels=0;
 class Utterance {volume=1;constructor(public text:string){}}
 const local={lang:'en-US',localService:true};
 Object.assign(globalThis,{SpeechSynthesisUtterance:Utterance,speechSynthesis:{getVoices:()=>[local],speak:(u:{text:string;volume:number;rate:number;pitch:number})=>spoken.push(u),cancel:()=>cancels++}});
 try{
  const announcer=new AnnouncerSpeech();announcer.speak('Three',.2);announcer.speak('Two',.2);
  assert.equal(cancels,1);assert.deepEqual(spoken.map(u=>u.text),['Three','Two']);assert.equal(spoken[0].volume,.2);assert.equal(spoken[0].rate,.78);assert.equal(spoken[0].pitch,.72);
  announcer.cancel();announcer.cancel();assert.equal(cancels,2);
  announcer.speak('One',0);assert.equal(spoken.length,2);
  Object.assign(globalThis,{speechSynthesis:{getVoices:()=>[{lang:'en-US',localService:false}]}});
  announcer.speak('Fight!',1);assert.equal(spoken.length,2);
  Object.assign(globalThis,{speechSynthesis:undefined});assert.doesNotThrow(()=>announcer.speak('Fight!',1));
 }finally{Object.assign(globalThis,{speechSynthesis:oldSynth,SpeechSynthesisUtterance:oldUtterance});}
});
