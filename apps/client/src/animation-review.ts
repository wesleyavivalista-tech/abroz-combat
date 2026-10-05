/** Developer-only visual regression page; no changes to live matches or combat data. */
import * as THREE from 'three';
import {SceneRenderer} from './rendering/SceneRenderer.js';
import {createFighterVisual,loadFighterSprites} from './rendering/VisualRegistry.js';
import {RenderInterpolation} from './rendering/RenderInterpolation.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
import {createFighter} from '../../../packages/game-core/simulation/Fighter.js';
import type {Fighter} from '../../../packages/game-core/types.js';
const select=(id:string)=>document.querySelector<HTMLSelectElement>('#'+id)!;
const status=document.querySelector('#status')!,report=document.querySelector('#report')!;
const ids=Object.keys(characters),states=['Idle','WalkForward','WalkBackward','JumpStartup','Jump','Fall','Land','DashForward','DashBackward','Crouch','BlockStanding','BlockCrouching','HitStunStanding','HitStunCrouching','AirHitStun','Knockdown','GetUp','KO','MatchWin','MatchLose'];
const modes:Record<string,Partial<Fighter>[]>={nikalz:[{beeBoxes:3},{meteorStart:0}],eide:[{weaponUntil:9999},{loveMode:true}],astolfo:[{personality:'sad'},{personality:'angry'}],fausto:[{weaponUntil:9999},{angerUntil:9999,angerStacks:8},{weaponUntil:9999,angerUntil:9999,angerStacks:8}],biel:[{angelUntil:9999},{loanUntil:9999}],tocha:[{onFireUntil:9999}],jomp:[{weaponUntil:9999}],dodo:[{weaponUntil:9999}],drupa:[{weaponUntil:9999}],gut:[{weaponUntil:9999}],caio:[{bloodMasterUntil:9999}],roms:[{armorUntil:9999},{weaponUntil:9999}]};
const summons:Record<string,string[]>={napa:['cookie-monster'],eide:['blonde-0','blonde-1'],astolfo:['sad','angry','sad-casual','angry-casual'],dodo:['pain-killer-0','pain-killer-1','pain-killer-2'],jopa:['tree','tentacle','knight'],bozo:['hair-clone']};
let total=0;const failures:string[]=[];
const frame=()=>new Promise<void>(r=>requestAnimationFrame(()=>r()));
await loadFighterSprites(ids);
for(const id of ids){
 status.textContent='Checking '+id+'…';await frame();
 for(const skin of [...(characters[id].skins??[{id:'original',name:'Original'}]),...(summons[id]??[]).map(id=>({id,name:id}))]){
  const visual=createFighterVisual(characters[id],skin.id);
  const inspect=(f:Fighter,label:string)=>{
   try{
    visual.update(f,f.stateFrame/60,f.stateFrame);
    visual.root.traverse(o=>{if(![...o.position.toArray(),...o.scale.toArray(),o.rotation.x,o.rotation.y,o.rotation.z].every(Number.isFinite))throw new Error('Non-finite transform');if(o instanceof THREE.Mesh){for(const material of Array.isArray(o.material)?o.material:[o.material]){const map=(material as THREE.MeshBasicMaterial).map;if(map&&(!map.image||![...map.offset.toArray(),...map.repeat.toArray()].every(Number.isFinite)))throw new Error('Missing texture or invalid UV');}}});total++;
   }catch(error){const message=`${id}/${skin.id}/${label}: ${error}`;if(!failures.includes(message))failures.push(message);}
  };
  for(const mode of [...(skin.id.startsWith('blonde')?[{loveNpc:true}]:[{}]),...(modes[id]??[])]){
   for(const state of states)for(let tick=0;tick<90;tick++){
    const f=createFighter(id,900,1);Object.assign(f,mode,{state,stateFrame:tick});inspect(f,state);
   }
   for(const move of Object.values(characters[id].moves)){
    const length=move.startupFrames+move.activeFrames+move.recoveryFrames;
    for(let tick=0;tick<Math.min(length+2,240);tick++){
     const f=createFighter(id,900,1);Object.assign(f,mode,{move:move.id,state:move.state,moveFrame:tick,stateFrame:tick});inspect(f,move.id);
    }
   }
  }
  visual.dispose();
 }
 report.textContent=`${total.toLocaleString()} pose updates checked\n${failures.length?failures.join('\n'):'No missing textures, invalid frame access or invalid transforms.'}`;
}
status.textContent=`Audit complete: ${ids.length} fighters, ${total.toLocaleString()} pose updates, ${failures.length} failures.`;
const renderer=new SceneRenderer(document.querySelector('canvas')!);await renderer.prepareFighters(ids);
const view=new RenderInterpolation();
let game:GameSimulation,paused=false,tick=0;
select('fighter').innerHTML=ids.map(id=>`<option>${id}</option>`).join('');
function setup(rebuild=false){
 const id=select('fighter').value;
 if(rebuild){select('skin').innerHTML=(characters[id].skins??[{id:'original',name:'Original'}]).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');select('action').innerHTML=[...states,...Object.keys(characters[id].moves)].map(s=>`<option>${s}</option>`).join('');}
 game=new GameSimulation([id,'nikalz'],true,undefined,undefined,[select('skin').value,'original']);game.state.phase='fight';game.state.fighters.forEach((f,i)=>{f.x=900+i*350;f.state='Idle';});view.reset();tick=0;
}
select('fighter').onchange=()=>setup(true);select('skin').onchange=()=>setup();select('action').onchange=()=>setup();
document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{paused=!paused;document.querySelector('#pause')!.textContent=paused?'Play':'Pause';view.reset();};setup(true);
let last=performance.now(),accumulator=0;
function draw(now:number){
 const elapsed=Math.min(.1,(now-last)/1000);last=now;
 if(!paused){accumulator+=elapsed;while(accumulator>=1/60){
  view.capture(game.state);game.state.frame++;tick++;const f=game.state.fighters[0],action=select('action').value,m=characters[f.characterId].moves[action];
  f.move=m?m.id:null;f.state=m?m.state:action;f.moveFrame=m?tick%(m.startupFrames+m.activeFrames+m.recoveryFrames):0;f.stateFrame=m?f.moveFrame:tick;
  f.x=900+(action.startsWith('Walk')?Math.sin(tick/120)*200:action.startsWith('Dash')?(tick%12)*9:0);f.y=['Jump','Fall'].includes(action)?Math.max(0,Math.sin(tick/30))*150:0;
  if(action==='meteor')f.meteorStart=game.state.frame-f.moveFrame;
  accumulator-=1/60;
 }}else accumulator=0;
 renderer.draw(!paused&&document.querySelector<HTMLInputElement>('#smooth')!.checked?view.view(game.state,accumulator*60):game.state,elapsed,now/1000,false,game.stage);
 requestAnimationFrame(draw);
}requestAnimationFrame(draw);
