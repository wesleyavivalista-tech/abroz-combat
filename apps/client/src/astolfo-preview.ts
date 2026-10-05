import {worldX} from './rendering/StageCoordinates.js';
import * as THREE from 'three';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../../../packages/game-core/types.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
import {loadFighterSprites,createFighterVisual} from './rendering/VisualRegistry.js';
import {AstolfoEffects} from './rendering/AstolfoEffects.js';
import type {FighterVisual} from './rendering/FighterRenderer.js';
const mode=document.querySelector<HTMLSelectElement>('#mode')!,skin=document.querySelector<HTMLSelectElement>('#skin')!,timeline=document.querySelector<HTMLInputElement>('#timeline')!,status=document.querySelector('#status')!;
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,alpha:true,antialias:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-4,8,3.3,-.2,.1,50);camera.position.z=10;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,.03),new THREE.MeshBasicMaterial({color:0x668699}));floor.position.set(2,-.02,0);scene.add(floor);
const effects=new AstolfoEffects();scene.add(effects.root);const clones=new Map<number,FighterVisual>();
let visual:FighterVisual,opponent:FighterVisual,g:GameSimulation,paused=false,tick=0,last=0,raf=0;
function clearClones(){for(const v of clones.values()){scene.remove(v.root);v.dispose();}clones.clear();}
function reset(){clearClones();timeline.max=mode.value==='idea'?'1400':mode.value==='bipolar'?'900':'360';g=new GameSimulation(['astolfo','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});g.state.fighters[0].x=1000;g.state.fighters[1].x=['talking','idea','combo','heavyKick','heavyPunch'].includes(mode.value)?1160:1500;tick=0;}
function step(){
 const button=({talking:Button.Special,spider:Button.Special2,bipolar:Button.Super1,idea:Button.Super2,heavyKick:Button.Medium,heavyPunch:Button.Heavy} as Record<string,number>)[mode.value]??0;
 const input=mode.value==='jump'&&tick%70===0?Button.Up:mode.value==='talking'&&tick<220?Button.Special:mode.value==='combo'&&[0,22,52].includes(tick)?Button.Light:tick===0?button:0;
 g.step([input,0]);tick++;
}
function draw(){
 const s=g.state,f=s.fighters[0];visual.update(['walk','dash'].includes(mode.value)?{...f,move:null,state:mode.value==='dash'?'DashForward':'WalkForward',stateFrame:tick}:f,tick/60);opponent.update(s.fighters[1],tick/60);
 for(const [id,v] of clones)if(!s.clones.some(c=>c.id===id)){scene.remove(v.root);v.dispose();clones.delete(id);}
 for(const c of s.clones){let v=clones.get(c.id);if(!v){v=createFighterVisual(characters.astolfo,c.kind+(skin.value==='casual'?'-casual':''));clones.set(c.id,v);scene.add(v.root);}v.update(c.fighter,tick/60);}
 effects.update(s,false);timeline.value=String(tick);status.textContent=`Frame ${tick} · ${f.move??f.state} · Energy ${f.meter} · Opponent ${s.fighters[1].health} HP · ${s.clones.map(c=>`${c.kind}: ${c.fighter.health} HP`).join(' / ')} · Idea ${Math.max(0,Math.ceil(((f.talkUntil??0)-s.frame)/60))}s`;
 const close=document.querySelector<HTMLInputElement>('#face-view')!.checked;camera.left=close?-1.5:-4;camera.right=close?1.5:8;camera.top=close?1.95:3.3;camera.bottom=close?.75:-.2;camera.position.x=close?worldX(f.x):0;camera.position.y=close?f.y/100:0;camera.updateProjectionMatrix();renderer.render(scene,camera);
}
const resize=()=>renderer.setSize(innerWidth,innerHeight*.65,false);
try{
 await loadFighterSprites(['astolfo','gut']);
 const switchSkin=()=>{if(visual){scene.remove(visual.root);visual.dispose();}visual=createFighterVisual(characters.astolfo,skin.value);scene.add(visual.root);};switchSkin();opponent=createFighterVisual(characters.gut);scene.add(opponent.root);reset();
 skin.onchange=()=>{switchSkin();clearClones();};mode.onchange=()=>{reset();paused=false;document.querySelector('#pause')!.textContent='Pause';};
 for(const kind of ['sad','angry'])document.querySelector<HTMLButtonElement>('#'+kind+'-death')!.onclick=()=>{const c=g.state.clones.find(c=>c.kind===kind);if(c){c.fighter.x=g.state.fighters[1].x-100;c.fighter.health=0;g.step([0,0]);draw();}};
 document.querySelector<HTMLButtonElement>('#replay')!.onclick=()=>{reset();paused=false;document.querySelector('#pause')!.textContent='Pause';};document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{paused=!paused;document.querySelector('#pause')!.textContent=paused?'Play':'Pause';};
 timeline.oninput=()=>{const target=Number(timeline.value);paused=true;document.querySelector('#pause')!.textContent='Play';reset();for(let i=0;i<target;i++)step();draw();};
 addEventListener('resize',resize);resize();function loop(now:number){if(now-last>=1000/60){last=now;if(!paused){if(tick>=Number(timeline.max))reset();step();}draw();}raf=requestAnimationFrame(loop);}raf=requestAnimationFrame(loop);
 addEventListener('pagehide',()=>{cancelAnimationFrame(raf);removeEventListener('resize',resize);clearClones();visual.dispose();opponent.dispose();effects.dispose();floor.geometry.dispose();(floor.material as THREE.Material).dispose();renderer.dispose();},{once:true});
}catch(error){status.textContent=String(error);console.error(error);}
