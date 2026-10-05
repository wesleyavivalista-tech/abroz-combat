import {AudioManager} from './audio/AudioManager.js';
import {fighterAudio,assetBriefs} from './audio/FighterAudio.js';
import type {MusicState} from './audio/MusicRegistry.js';
import {sounds} from './audio/SoundRegistry.js';
if(!(import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV)throw Error('Development only');
const audio=new AudioManager();
document.body.style.cssText='background:#111923;color:#f5efdf;font:16px system-ui;padding:32px;max-width:1000px;margin:auto';
document.body.innerHTML='<h1>Audio review</h1><p>Original synthesized effects for all 16 fighters · original arena and menu soundtrack connected.</p><button id="stress">Run eight-fighter stress test</button> <button id="stop">Stop</button> <button id="mute">Toggle mute</button><h2>Music audition</h2><select id=music-state aria-label="Music state"></select> <select id=music-arena aria-label="Music arena"></select> <button id=music-play>Play music</button> <label>Music volume <input id=music-volume type=range min=0 max=1 step=.01 value=.3></label><h2>Fighter sound audit</h2><label>Fighter <select id="fighter"><option value="">Shared cues</option></select></label><p>Enabled buttons have audio previews. Disabled buttons need recordings; hover for the sound brief.</p><div id="cues" style="max-height:340px;overflow:auto"></div><h2>Live diagnostics</h2><pre id="stats"></pre><p id="result" role="status"></p>';
const musicState=document.getElementById('music-state') as HTMLSelectElement;
const musicArena=document.getElementById('music-arena') as HTMLSelectElement;
for(const state of ['menu','selection','match','final','sudden-death','championship','championship-final','party','victory','defeat'])musicState.add(new Option(state,state));
for(const arena of ['the-foundry','basketball-court','shopping-mall','aeroporto-church'])musicArena.add(new Option(arena,arena));
document.getElementById('music-play')!.onclick=()=>{audio.setMusic(musicState.value as MusicState,musicArena.value);audio.unlock();};
(document.getElementById('music-volume') as HTMLInputElement).oninput=e=>{audio.music=Number((e.target as HTMLInputElement).value);audio.update(false);};
const cues=document.getElementById('cues')!;
const picker=document.getElementById('fighter') as HTMLSelectElement;
for(const id of Object.keys(fighterAudio)){const o=document.createElement('option');o.value=id;o.textContent=id.toUpperCase();picker.append(o);}
function renderCues(){cues.replaceChildren();
for(const [id,def] of Object.entries(sounds)){
 if(picker.value?!id.startsWith(`${picker.value}.`):id.includes('.'))continue;

 const b=document.createElement('button');b.textContent=id;b.disabled=!def.fallback&&!def.assets?.length;b.title=assetBriefs[id]??id;b.style.margin='4px';b.onclick=async()=>{audio.unlock();await audio.preload([id]);audio.play(id);};cues.append(b);
}}
picker.onchange=renderCues;renderCues();
let end=0,serial=0,peak=0,frames=0,maxTick=0;
document.getElementById('stress')!.onclick=async()=>{audio.unlock();audio.resetMatch();document.getElementById('result')!.textContent='Loading fighter effects…';await audio.preload(Object.keys(sounds));end=performance.now()+4000;serial=0;peak=0;frames=0;maxTick=0;document.getElementById('result')!.textContent='Running…';};
document.getElementById('stop')!.onclick=()=>{end=0;audio.stopEffects();};
document.getElementById('mute')!.onclick=()=>{audio.mute=!audio.mute;audio.update(false);};
const timer=setInterval(()=>{
 if(end){
  if(performance.now()<end){
   const start=performance.now();
   for(let i=0;i<8;i++){const fighter=Object.keys(fighterAudio)[(i+frames)%16],profiles=Object.values(fighterAudio[fighter]),profile=profiles[frames%profiles.length];for(const key of [profile.start,profile.impact])audio.play(key,{eventId:`stress:${serial++}`,x:i*300,width:2400});}
   audio.syncAbilityLoops([{id:'water',key:'roms.water.active',x:600},{id:'bees',key:'nikalz.bees.active',x:1600}],2400);
   if(frames%30===0){audio.play('attack_ultimate');audio.duck('ultimate');}
   if(frames%60===0){audio.play('ko');audio.duck('ko');}
   frames++;maxTick=Math.max(maxTick,performance.now()-start);peak=Math.max(peak,audio.diagnostics().active);
  }else{end=0;audio.syncAbilityLoops([],2400);document.getElementById('result')!.textContent=`Complete: ${serial} events attempted; peak ${peak}/24 active; ${maxTick.toFixed(2)} ms worst audio dispatch batch. Wait for active sounds to return to zero.`;}
 }
 document.getElementById('stats')!.textContent=JSON.stringify(audio.diagnostics(),null,2);
},16);
window.addEventListener('pagehide',()=>{clearInterval(timer);audio.dispose();},{once:true});
