/** Authoring-only: real visual factories and every trap atlas; never included in the production entry points. */
import * as THREE from 'three';
import {loadFighterSprites,createFighterVisual} from './rendering/VisualRegistry.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
import {createFighter} from '../../../packages/game-core/simulation/Fighter.js';
import {hairGripCatalog,hairGripPath} from './rendering/HairGripVisual.js';
import {framesFrom} from './rendering/DodoRenderer.js';
import {loadTexture} from './rendering/TextureCache.js';
import {worldX} from './rendering/StageCoordinates.js';
const canvas=document.querySelector('canvas')!,status=document.querySelector('#status')!,slider=document.querySelector<HTMLInputElement>('#frame')!,skin=document.querySelector<HTMLSelectElement>('#skin')!,forms=document.querySelector<HTMLInputElement>('#forms')!;
const ids=Object.keys(hairGripCatalog),report:string[]=[];
for(const [id,spec] of Object.entries(hairGripCatalog))for(const [key,rows] of [[id,spec.rows] as const,...Object.entries(spec.extras??{}).map(([form,rows])=>[`${id}-${form}`,rows] as const)]){
 const texture=await loadTexture(hairGripPath(key)),frames=framesFrom(texture,6,rows,true,true);
 for(let row=0;row<rows;row++){
  const poses=frames.slice(row*6,row*6+6),reference=poses[0];
  for(const [col,pose] of poses.entries())if(pose.height/reference.height<.55||pose.height/reference.height>1.4||pose.width/reference.width>2.1)report.push(`${key} row ${row+1}, col ${col+1}: check bounds ${pose.width}×${pose.height} vs ${reference.width}×${reference.height}`);
 }
 frames.forEach(frame=>frame.texture.dispose());
}
await loadFighterSprites(ids);
const scene=new THREE.Scene();scene.background=new THREE.Color('#253341');
const camera=new THREE.OrthographicCamera(-7,7,10.7,-.3,.1,100);camera.position.z=10;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
let visuals=ids.map(id=>createFighterVisual(characters[id]));
const fighters=ids.map(id=>createFighter(id,900,1));
const groups=visuals.map((v,i)=>{const group=new THREE.Group();group.position.set((i%4-1.5)*5-worldX(900),Math.floor(i/4)*2.6,0);group.add(v.root);scene.add(group);return group;});
skin.onchange=()=>{visuals.forEach(v=>v.dispose());visuals=ids.map((id,i)=>{const v=createFighterVisual(characters[id],characters[id].skins![Number(skin.value)].id);groups[i].clear();groups[i].add(v.root);return v;});};
let playing=true,tick=40,last=0,facing=1;
document.querySelector<HTMLButtonElement>('#play')!.onclick=()=>{playing=!playing;document.querySelector('#play')!.textContent=playing?'Pause':'Play';};
slider.oninput=()=>{playing=false;tick=Number(slider.value);document.querySelector('#play')!.textContent='Play';};
document.querySelector<HTMLButtonElement>('#flip')!.onclick=()=>{facing*=-1;};
status.textContent=report.length?report.join('\n'):'All 22 sheets decoded; 270 poses checked. Bound → struggle → release. Gameplay state stays unchanged.';
function draw(now:number){
 if(playing&&now-last>=1000/60){tick=(tick+1)%201;last=now;slider.value=String(tick);}
 fighters.forEach((f,i)=>{
  const id=ids[i],active=forms.checked;
  Object.assign(f,{state:tick<180?'HairTrapped':'Idle',trappedUntil:180,stateFrame:tick,facing,
   weaponUntil:active&&['fausto','gut','drupa','eide','dodo','jomp'].includes(id)?999:0,
   armorUntil:active&&['bozo','roms'].includes(id)?999:0,bloodMasterUntil:active&&id==='caio'?999:0,angelUntil:active&&id==='biel'?999:0});
  const before=JSON.stringify(f);visuals[i].update(f,tick/60,tick);if(JSON.stringify(f)!==before)throw Error('Visual mutated fighter');
  groups[i].scale.setScalar(active&&id==='drupa'?.45:active&&id==='eide'?.7:1);
 });
 renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.left=-5.5*canvas.clientWidth/canvas.clientHeight;camera.right=-camera.left;camera.updateProjectionMatrix();renderer.render(scene,camera);requestAnimationFrame(draw);
}requestAnimationFrame(draw);
