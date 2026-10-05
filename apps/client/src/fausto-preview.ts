import * as THREE from 'three';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../../../packages/game-core/types.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
import {loadFighterSprites,createFighterVisual} from './rendering/VisualRegistry.js';
import {FaustoEffects} from './rendering/FaustoEffects.js';
import type {FighterVisual} from './rendering/FighterRenderer.js';
const select=(id:string)=>document.querySelector<HTMLSelectElement>(id)!;
const mode=select('#mode'),skin=select('#skin'),timeline=document.querySelector<HTMLInputElement>('#timeline')!,status=document.querySelector('#status')!;
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,alpha:true,antialias:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.5,8.5,3.3,-.2,.1,50);camera.position.z=10;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,.03),new THREE.MeshBasicMaterial({color:0x668699}));floor.position.set(2.5,-.02,0);scene.add(floor);
const effects=new FaustoEffects();scene.add(effects.root);
let visual:FighterVisual,opponent:FighterVisual,g:GameSimulation,paused=false,tick=0,last=0,raf=0;
function reset(){timeline.max=mode.value==='bravinho'?'1900':'240';g=new GameSimulation(['fausto','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});g.state.fighters[0].x=1000;g.state.fighters[1].x=mode.value==='combo'?1090:mode.value==='flash'?1380:1700;if(['flash','samuraiWalk'].includes(mode.value))g.state.fighters[0].weaponUntil=1200;tick=0;}
function step(){const button=mode.value==='heavyPunch'?Button.Heavy:mode.value==='origami'?Button.Special:mode.value==='cloud'?Button.Special2:mode.value==='ancestry'?Button.Super1:mode.value==='bravinho'?Button.Super2:0;const input=mode.value==='flash'?Button.Medium:mode.value==='combo'&&[0,22,52].includes(tick)?Button.Light:tick===0?button:0;g.step([input,0]);tick++;}
function draw(){const f=g.state.fighters[0],walking=mode.value.toLowerCase().includes('walk');visual.update(walking?{...f,move:null,state:'WalkForward',stateFrame:tick}:f,tick/60);opponent.update(g.state.fighters[1],tick/60);effects.update(g.state,false);timeline.value=String(tick);status.textContent=`Frame ${tick} · ${f.move??f.state} · ${g.state.hazards.filter(h=>h.kind==='origami').length} traps · Samurai ${Math.max(0,Math.ceil((f.weaponUntil-g.state.frame)/60))}s · Opponent ${g.state.fighters[1].health} HP${(f.angerUntil??0)>g.state.frame?` · BRAVINHO ${Math.ceil((f.angerUntil!-g.state.frame)/60)}s · ${f.angerStacks??0} stacks · +${20+5*(f.angerStacks??0)}%`:''}`;renderer.render(scene,camera);}
const resize=()=>renderer.setSize(innerWidth,innerHeight*.65,false);
try{
 await loadFighterSprites(['fausto','gut']);
 const switchSkin=()=>{if(visual){scene.remove(visual.root);visual.dispose();}visual=createFighterVisual(characters.fausto,skin.value);scene.add(visual.root);};switchSkin();opponent=createFighterVisual(characters.gut);scene.add(opponent.root);reset();
 document.querySelector<HTMLButtonElement>('#anger-hit')!.onclick=()=>{g.hit(1,characters.gut.moves.palm,0,false,0,-1,g.state.fighters[1],g.state.fighters[0]);draw();};
 skin.onchange=switchSkin;mode.onchange=reset;document.querySelector<HTMLButtonElement>('#replay')!.onclick=()=>{reset();paused=false;document.querySelector('#pause')!.textContent='Pause';};document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{paused=!paused;document.querySelector('#pause')!.textContent=paused?'Play':'Pause';};timeline.oninput=()=>{const target=Number(timeline.value);paused=true;document.querySelector('#pause')!.textContent='Play';reset();for(let i=0;i<target;i++)step();draw();};
 addEventListener('resize',resize);resize();function loop(now:number){if(now-last>=1000/60){last=now;if(!paused){if(tick>=Number(timeline.max))reset();step();}draw();}raf=requestAnimationFrame(loop);}raf=requestAnimationFrame(loop);
 addEventListener('pagehide',()=>{cancelAnimationFrame(raf);removeEventListener('resize',resize);visual.dispose();opponent.dispose();effects.dispose();floor.geometry.dispose();floor.material.dispose();renderer.dispose();},{once:true});
}catch(error){status.textContent=String(error);console.error(error);}
