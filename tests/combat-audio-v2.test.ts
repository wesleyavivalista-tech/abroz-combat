import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {GameAudio} from '../apps/client/src/audio/GameAudio.js';
import {AudioPolicy} from '../apps/client/src/audio/AudioPolicy.js';
import {sounds} from '../apps/client/src/audio/SoundRegistry.js';
import {fighterAudio,moveAudio} from '../apps/client/src/audio/FighterAudio.js';
import {audioPresence} from '../apps/client/src/audio/AbilityAudio.js';
import type {AudioManager} from '../apps/client/src/audio/AudioManager.js';

function harness(character='nikalz'){
 const sim=new GameSimulation([character,'jopa']);sim.state.phase='fight';
 const heard:{key:string;x?:number;eventId?:string}[]=[];
 const bridge=new GameAudio({syncAbilityLoops:()=>{},play:(key:string,o:{x?:number;eventId?:string}={})=>{heard.push({key,...o});},setMusic:()=>{},duck:()=>{}} as unknown as AudioManager);
 const consume=()=>bridge.consume(sim.state,sim.events,sim.gameplayEvents,'the-foundry',2400,[0]);
 return {sim,heard,bridge,consume};
}
test('real missed jab swings at active animation frame, not input/startup',()=>{
 const {sim,heard,consume}=harness();sim.state.fighters[0].x=500;sim.state.fighters[1].x=1800;
 const profile=moveAudio('nikalz','jab')!;
 sim.step([Button.Light,0]);consume();assert.ok(!heard.some(e=>e.key===profile.start));
 let swingFrame=-1;
 for(let i=0;i<45;i++){
  const previous=heard.length;sim.step([0,0]);consume();
  if(heard.slice(previous).some(e=>e.key===profile.start))swingFrame=sim.state.fighters[0].moveFrame;
 }
 assert.equal(swingFrame,characters.nikalz.moves.jab.startupFrames);
 assert.equal(heard.filter(e=>e.key===profile.start).length,1);assert.ok(!heard.some(e=>e.key===profile.impact));
});
test('real connected jab has one contact cue; victim position is used',()=>{
 const {sim,heard,consume}=harness();sim.state.fighters[0].x=900;sim.state.fighters[1].x=950;sim.state.fighters[0].facing=1;
 for(let i=0;i<35;i++){sim.step([i===0?Button.Light:0,0]);consume();}
 const hits=heard.filter(e=>e.key===moveAudio('nikalz','jab')!.impact);
 assert.equal(hits.length,1);assert.ok(hits[0].x!>=950);
});
test('charge has a held cue, no premature swing, and cancellation into recovery is silent',()=>{
 for(const [id,move] of [['fausto','flash'],['dodo','starWave']]){
  const {sim,bridge,heard}=harness(id),f=sim.state.fighters[0],m=characters[id].moves[move],p=moveAudio(id,move)!;
  f.move=move;f.moveFrame=15;assert.ok(audioPresence(sim.state).some(p=>p.id.includes(':charge:')));
  const event={id:'charge-start',frame:1,type:'AttackStarted' as const,actor:0,detail:move};
  bridge.consume(sim.state,[],[event],'the-foundry',2400,[]);assert.ok(!heard.some(e=>e.key===p.start));
  f.moveFrame=m.startupFrames+m.activeFrames;
  bridge.consume(sim.state,[],[{...event,id:'cancel',type:'MoveActive'}],'the-foundry',2400,[]);
  assert.ok(!heard.some(e=>e.key===p.start));assert.ok(!audioPresence(sim.state).some(p=>p.id.includes(':charge:')));
  f.moveFrame=m.startupFrames;
  bridge.consume(sim.state,[],[{...event,id:'release',type:'MoveActive'}],'the-foundry',2400,[]);
  assert.equal(heard.filter(e=>e.key===p.start).length,1);
 }
});
test('contact cue follows a summoned victim rather than its owner',()=>{
 const {sim,bridge,heard}=harness();
 const clone={id:12,owner:1,kind:'blonde' as const,fighter:{...sim.state.fighters[1],x:1700}};
 sim.state.clones.push(clone as typeof sim.state.clones[number]);
 bridge.consume(sim.state,[],[{id:'hit',frame:1,type:'DamageApplied',actor:1,detail:'summon 12',amount:20,source:0,move:'jab'}],'the-foundry',2400,[]);
 assert.equal(heard.find(e=>e.key===moveAudio('nikalz','jab')!.impact)?.x,1700);
});
test('repeat/network duplicate ids are suppressed while simultaneous unique impacts survive',()=>{
 const policy=new AudioPolicy(24),key=moveAudio('nikalz','jab')!.impact,def=sounds[key];
 for(let i=0;i<5;i++)assert.ok(policy.admit(key,def,100,`hit:${i}`));
 assert.equal(policy.admit(key,def,100,'hit:0'),undefined);
 for(let i=0;i<80;i++)policy.admit(key,def,101+i,`next:${i}`);
 assert.ok(policy.voices.size<=24);
});
test('replacement foley is short, unclipped PCM with varied takes and distinct weights',()=>{
 const urls=new Set<string>();
 for(const moves of Object.values(fighterAudio))for(const p of Object.values(moves))if(p.swingOnActive){
  for(const key of [p.start,p.impact]){
   const def=sounds[key];assert.equal(def.assets?.length,3);assert.ok(def.variation>0&&def.variation<.05);
   def.assets!.forEach(u=>urls.add(u));
  }
 }
 assert.notDeepEqual(sounds['roms.chop.start'].assets,sounds['roms.heavy.start'].assets);
 for(const url of urls){
  const bytes=readFileSync(`apps/client/public${url}`);assert.equal(bytes.toString('ascii',0,4),'RIFF');
  const duration=(bytes.length-44)/2/bytes.readUInt32LE(24);assert.ok(duration<.5);
  let peak=0;for(let i=44;i<bytes.length;i+=2)peak=Math.max(peak,Math.abs(bytes.readInt16LE(i)));
  assert.ok(peak>1000&&peak<30000,url);assert.equal(bytes.readInt16LE(44),0);
 }
});
test('real held-charge simulation emits only at completion and early release never swings',()=>{
 for(const [id,move] of [['fausto','flash'],['dodo','starWave']])for(const cancel of [false,true]){
  const {sim,heard,consume}=harness(id),f=sim.state.fighters[0],m=characters[id].moves[move],p=moveAudio(id,move)!;
  f.x=400;sim.state.fighters[1].x=1900;f.move=move;f.moveFrame=0;f.chargeStartedAt=sim.state.frame;f.chargeButton=Button.Heavy;f.attackSerial++;
  for(let tick=0;tick<90;tick++){sim.step([tick<(cancel?12:m.startupFrames+1)?Button.Heavy:0,0]);consume();}
  assert.equal(heard.filter(e=>e.key===p.start).length,cancel?0:1,`${id} cancelled=${cancel}`);
  assert.ok(!audioPresence(sim.state).some(p=>p.id.includes(':charge:')));
 }
});
