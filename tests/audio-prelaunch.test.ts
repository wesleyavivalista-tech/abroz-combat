import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioManager} from '../apps/client/src/audio/AudioManager.js';
import {sounds} from '../apps/client/src/audio/SoundRegistry.js';

class Param {value=1;setTargetAtTime(v:number){this.value=v;}setValueAtTime(v:number){this.value=v;}linearRampToValueAtTime(v:number){this.value=v;}exponentialRampToValueAtTime(v:number){this.value=v;}}
class Node {
 gain=new Param();pan=new Param();frequency=new Param();playbackRate=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();
 onended:(()=>void)|null=null;connections:Node[]=[];started=false;stopped=false;
 connect(n:Node){this.connections.push(n);}disconnect(){this.connections=[];}start(){this.started=true;}stop(){this.stopped=true;}
}
class Context {
 static latest:Context;state='running';currentTime=0;destination=new Node();nodes:Node[]=[];resumes=0;
 constructor(){Context.latest=this;}
 node(){const n=new Node();this.nodes.push(n);return n;}
 createGain(){return this.node();}createDynamicsCompressor(){return this.node();}createWaveShaper(){return this.node();}createStereoPanner(){return this.node();}createOscillator(){return this.node();}createBufferSource(){return this.node();}createMediaElementSource(){return this.node();}
 resume(){this.resumes++;this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
}
class Media {
 static blocked=false;static all:Media[]=[];src='';crossOrigin='';preload='';loop=false;onerror:(()=>void)|null=null;paused=true;readyState=4;currentTime=0;
 constructor(){Media.all.push(this);}
 play(){if(Media.blocked)return Promise.reject(Object.assign(Error('Gesture required'),{name:'NotAllowedError'}));this.paused=false;return Promise.resolve();}
 pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}
}
async function fixture(run:(a:AudioManager,c:Context)=>Promise<void>|void){
 const old={AudioContext:globalThis.AudioContext,Audio:globalThis.Audio,fetch:globalThis.fetch};
 Object.assign(globalThis,{AudioContext:Context,Audio:Media,fetch:async()=>{throw Error('Test uses oscillator fallbacks');}});Media.all=[];
 const a=new AudioManager();
 try{a.unlock();await run(a,Context.latest);}finally{a.dispose();Media.blocked=false;Object.assign(globalThis,old);}
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('dispose disconnects a loop already retiring through a fade',async()=>fixture(async(a,c)=>{
 const key='audit_loop';sounds[key]={...sounds.hit_light,loop:true,cooldown:0};
 try{
  a.syncAbilityLoops([{id:'one',key,x:100}],2400);
  const source=c.nodes.find(n=>n.started)!;assert.ok(source);
  a.syncAbilityLoops([],2400);a.dispose();
  assert.equal(source.stopped,true);assert.ok(c.nodes.every(n=>n.connections.length===0),'all audio nodes disconnected, including retiring source and panner');
 }finally{delete sounds[key];}
}));

test('autoplay denial keeps the selected track eligible for the next gesture',async()=>{
 Media.blocked=true;
 await fixture(async(a)=>{
  await settle();assert.equal(a.diagnostics().loops,0);
  const attempts=Media.all.length;for(let i=0;i<60;i++){a.setMusic(i%2?'menu':'selection');await settle();}assert.equal(Media.all.length,attempts,'no retry loop without a gesture');
  Media.blocked=false;a.unlock();await settle();
  assert.equal(a.diagnostics().track,'menu_01');assert.equal(a.diagnostics().loops,1);
  assert.ok(Media.all.at(-1)!.src.endsWith('abroz-main-menu-theme-v8.mp3'));
 });
});

test('an interrupted audio context resumes on the next unlock',async()=>fixture(async(a,c)=>{
 await settle();c.state='interrupted';a.unlock();await settle();assert.equal(c.resumes,1);assert.equal(c.state,'running');
}));

test('rapid transitions preserve menu continuity and clean music/effects after rematches',async()=>fixture(async(a,c)=>{
 await settle();const first=Media.all.at(-1);a.setMusic('selection');await settle();assert.equal(Media.all.at(-1),first);
 for(let i=0;i<100;i++){
  a.resetMatch();a.setMusic('intro',['the-foundry','shopping-mall','aeroporto-church','basketball-court'][i%4]);await settle();
  a.play('hit_heavy',{eventId:`hit:${i}`});a.setPaused(true);assert.equal(a.diagnostics().active,0);a.setPaused(false);
  a.setMusic('victory');await settle();a.fadeCombat();a.setMusic('menu');await settle();assert.ok(a.diagnostics().loops<=4);
 }
 await new Promise(r=>setTimeout(r,900));assert.equal(a.diagnostics().loops,1);assert.equal(a.diagnostics().track,'menu_01');
 a.dispose();assert.ok(Media.all.every(m=>m.paused&&m.src===''));assert.ok(c.nodes.every(n=>n.connections.length===0));
}));
