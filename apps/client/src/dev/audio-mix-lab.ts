/// <reference types="vite/client" />
import {tracks} from '../audio/MusicRegistry.js';
import {sounds} from '../audio/SoundRegistry.js';
import {mixLevels,sampleCalibration,createMixProtection,MusicDucking} from '../audio/AudioMix.js';
const status=document.querySelector('#status')!,results=document.querySelector('#results')!,button=document.querySelector<HTMLButtonElement>('#run')!;
if(!import.meta.env.DEV)throw Error('Development tool only');
button.onclick=async()=>{
 button.disabled=true;const reports:unknown[]=[];const cache=new Map<string,AudioBuffer>();
 try{
 const decode=new OfflineAudioContext(2,1,44100);
 const sample=async(url:string)=>{if(!cache.has(url)){const r=await fetch(url);if(!r.ok)throw Error(url);cache.set(url,await decode.decodeAudioData(await r.arrayBuffer()));}return cache.get(url)!;};
 const scenarios=[['menu', ['menu_hover','menu_confirm','menu_back'],false],['1v1',['nikalz.jab.start','nikalz.jab.impact','nikalz.meteor.impact'],false],['8 fighters',Array.from({length:24},(_,i)=>['nikalz.jab.impact','nikalz.meteor.impact','block'][i%3]),false],['major events',['round_start','ko','nikalz.meteor.impact'],false],['quiet',[],false],['maximum sliders / 24 simultaneous',Array(24).fill('nikalz.meteor.impact'),true],['countdown',['countdown_3','countdown_2','countdown_1','round_start'],false]] as const;
 for(const [name,ids,max] of scenarios){
 status.textContent=`Rendering ${name}`;
 const context=new OfflineAudioContext(2,44100*6,44100),master=context.createGain();master.gain.value=max?1:.35;const protection=createMixProtection(context);master.connect(protection.compressor);
 const music=context.createBufferSource();music.buffer=await sample(tracks.menu_01.url!);const musicGain=context.createGain();musicGain.gain.value=(max?1:.3)*mixLevels.music*.65;music.connect(musicGain);musicGain.connect(master);music.start(0,20,6);
 const ducks=new MusicDucking();const events=ids.map((id,i)=>({id,time:name==='countdown'?i*1.2:name.includes('simultaneous')||name==='8 fighters'?.5:.5+i*.6}));
 for(const {id,time} of events){
  const d=sounds[id];if(!d)throw Error(`Unknown sound ${id}`);const gain=context.createGain();
  const bus=d.bus==='voice'?(max?1:.8)*mixLevels.voice:d.bus==='ui'?(max?1:.65)*(max?1:.65)*mixLevels.ui:(max?1:.65)*mixLevels.combat;
  let source:AudioScheduledSourceNode,duration:number,normal=1;
  if(d.assets?.length){const buffer=await sample(d.assets[0]),node=context.createBufferSource();node.buffer=buffer;normal=d.bus==='voice'?1:sampleCalibration(buffer).gain;duration=buffer.duration;source=node;}
  else if(d.fallback){const node=context.createOscillator(),f=d.fallback;node.type=f.wave;node.frequency.setValueAtTime(f.from,time);node.frequency.exponentialRampToValueAtTime(f.to,time+f.duration);source=node;duration=f.duration;}
  else continue;
  const level=d.gain*bus*normal;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+.004);
  if(!d.assets?.length)gain.gain.setTargetAtTime(.0001,time+duration*.35,Math.max(.008,duration*.18));
  source.connect(gain);gain.connect(master);source.start(time);source.stop(Math.min(6,time+duration+.03));
 }
 let previous=1;
 for(let t=0;t<6;t+=.02){for(const e of events)if(e.time>=t&&e.time<t+.02){const d=sounds[e.id];if(d.bus==='voice')ducks.request('voice',t*1000);else if(d.duck)ducks.request(d.duck,t*1000);}const duck=ducks.gain(t*1000);if(duck!==previous)musicGain.gain.setTargetAtTime((max?1:.3)*mixLevels.music*.65*duck,t,duck<previous?.035:.22);previous=duck;}
 const out=await context.startRendering();let peak=0,sum=0,clipped=0;
 for(let ch=0;ch<2;ch++)for(const v of out.getChannelData(ch)){peak=Math.max(peak,Math.abs(v));sum+=v*v;if(Math.abs(v)>=1)clipped++;}
 reports.push({name,peakDbFS:20*Math.log10(peak),rmsDbFS:20*Math.log10(Math.sqrt(sum/(out.length*2))),clippedSamples:clipped});results.textContent=JSON.stringify(reports,null,2);
 }
 status.textContent='Complete';
 }catch(e){status.textContent=String(e);}finally{button.disabled=false;}
};
