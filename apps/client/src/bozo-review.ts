/** Authoring-only review. Not a production entry point; uses the real visual factories. */
import * as THREE from 'three';
import {loadFighterSprites,createFighterVisual} from './rendering/VisualRegistry.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
import {createFighter} from '../../../packages/game-core/simulation/Fighter.js';
import {loadMountedArt} from './rendering/MountedVisual.js';
import {worldX} from './rendering/StageCoordinates.js';
const canvas=document.querySelector('canvas')!,status=document.querySelector('#status')!,pose=document.querySelector<HTMLSelectElement>('#pose')!,slider=document.querySelector<HTMLInputElement>('#frame')!;
const states=['Idle','WalkForward','WalkBackward','JumpStartup','Jump','Fall','Land','DashForward','DashBackward','Crouch','BlockStanding','BlockCrouching','HitStunStanding','HitStunCrouching','AirHitStun','Knockdown','GetUp','KO','Respawning','MatchWin','MatchLose'];
pose.innerHTML=[...states,...Object.keys(characters.bozo.moves)].map(s=>`<option>${s}</option>`).join('');
await loadFighterSprites(['bozo']);await loadMountedArt('bozo');
const scene=new THREE.Scene();scene.background=new THREE.Color('#151c25');const camera=new THREE.OrthographicCamera(-5,5,2.8,-.3,.1,100);camera.position.z=10;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const skins=['original','basketball','hair-clone'];const visuals=skins.map(s=>createFighterVisual(characters.bozo,s));const fighters=skins.map(()=>createFighter('bozo',900,1));
const groups=visuals.map((v,i)=>{const group=new THREE.Group();group.position.x=(i-1)*3.2-worldX(900);group.add(v.root);scene.add(group);return group;});
const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5,0,0),new THREE.Vector3(5,0,0)]),new THREE.LineBasicMaterial({color:0x667788}));scene.add(line);
let checks=0;
for(const visual of visuals)for(const armorUntil of [0,9999]){
 const f=createFighter('bozo',900,1);f.armorUntil=armorUntil;
 for(const action of [...states,...Object.keys(characters.bozo.moves)]){
  const move=characters.bozo.moves[action],length=move?move.startupFrames+move.activeFrames+move.recoveryFrames:90;
  for(let tick=0;tick<=length;tick++){
   Object.assign(f,{state:move?.state??action,move:move?.id??null,moveFrame:tick,stateFrame:tick});const before=JSON.stringify(f);visual.update(f,tick/60,tick);
   if(JSON.stringify(f)!==before)throw Error('Visual changed combat state');
   visual.root.traverse(o=>{if(![...o.position.toArray(),...o.scale.toArray()].every(Number.isFinite))throw Error('Invalid transform');});checks++;
  }
 }
}
status.textContent=`${checks.toLocaleString()} pose updates passed · both skins, armor and hair clones · game animation timing unchanged`;
let playing=true,tick=0,last=0;
pose.onchange=()=>{tick=0;slider.value='0';};slider.oninput=()=>{playing=false;tick=Number(slider.value);document.querySelector('#play')!.textContent='Play';};
document.querySelector<HTMLButtonElement>('#play')!.onclick=()=>{playing=!playing;document.querySelector('#play')!.textContent=playing?'Pause':'Play';};
let light=false;document.querySelector<HTMLButtonElement>('#background')!.onclick=()=>{light=!light;scene.background=new THREE.Color(light?'#bbc3cb':'#151c25');};
function draw(now:number){
 const move=characters.bozo.moves[pose.value],length=move?move.startupFrames+move.activeFrames+move.recoveryFrames:90;slider.max=String(length);
 if(playing&&now-last>=1000/60){tick=(tick+1)%length;last=now;slider.value=String(tick);}
 fighters.forEach((f,i)=>{Object.assign(f,{state:move?.state??pose.value,move:move?.id??null,moveFrame:tick,stateFrame:tick,armorUntil:document.querySelector<HTMLInputElement>('#armor')!.checked?9999:0,jopaRide:document.querySelector<HTMLInputElement>('#mounted')!.checked?0:undefined});visuals[i].update(f,tick/60,tick);});
 const width=canvas.clientWidth,height=canvas.clientHeight;renderer.setSize(width,height,false);const view=document.querySelector<HTMLSelectElement>('#view')!.value;
 if(view==='all'){camera.left=-1.55*width/height;camera.right=1.55*width/height;camera.top=2.8;camera.bottom=-.3;}else{camera.left=-2;camera.right=14;camera.top=.85+8*height/width;camera.bottom=.85-8*height/width;}
 groups.forEach((g,i)=>{g.visible=view==='all'||Number(view)===i;g.position.x=(view==='all'?(i-1)*3.2:0)-worldX(900);});camera.updateProjectionMatrix();renderer.render(scene,camera);requestAnimationFrame(draw);
}requestAnimationFrame(draw);
