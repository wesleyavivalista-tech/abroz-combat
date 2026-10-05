import {backwardDashPose,loadBackwardDashArt} from './BackwardDash.js';
import {astolfoMouth,registerAstolfoMouths} from './AstolfoFace.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
import {Button} from '../../../../packages/game-core/types.js';

export function astolfoPose(f:Fighter):number{
 if(f.move){
  if(f.move==='talking')return 10;
  if(f.move==='spider')return 11;
  if(f.move==='bipolar')return 13;
  if(f.move==='idea')return 12;
  const m=characters.astolfo.moves[f.move];
  if(f.moveFrame<m.startupFrames*.65||f.moveFrame>=m.startupFrames+m.activeFrames+m.recoveryFrames*.6)return 0;
  return ({punch:1,comboKick:2,finishPunch:3,heavyKick:4,heavyPunch:3,low:5,air:6} as Record<string,number>)[f.move]??0;
 }
 if(f.state==='MatchWin')return 14;
 if(['KO','Respawning','Knockdown'].includes(f.state))return 9;
 if(f.state.includes('HitStun')||f.state==='GetUp')return 8;
 if(f.state==='Crouch'||f.state==='BlockCrouching')return 16;
 if(f.state.startsWith('Block'))return 7;
 return 0;
}
export class AstolfoRenderer implements FighterVisual{
 private mouth=new THREE.Group();private lip=new THREE.Mesh(new THREE.CircleGeometry(1,10),new THREE.MeshBasicMaterial({color:0x261718,side:THREE.DoubleSide,toneMapped:false}));
 private tongue=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xcc706f,side:THREE.DoubleSide,toneMapped:false}));
 private ghosts:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
 root=new THREE.Group();shadow:THREE.Mesh;private personalityTint={value:0};private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 constructor(private combat:Frame[],private walking:Frame[],private movement:Frame[],private tintFar=true,private backward:Frame[]=[]){
  this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));this.root.add(this.sprite);
  this.mouth.add(this.lip,this.tongue);this.tongue.position.z=.002;this.root.add(this.mouth);
  const tint=this.personalityTint;
  this.sprite.material.onBeforeCompile=shader=>{shader.uniforms.personalityTint=tint;shader.fragmentShader='uniform float personalityTint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat skin=step(.12,diffuseColor.r)*step(diffuseColor.g*1.5,diffuseColor.r)*step(diffuseColor.b*1.3,diffuseColor.r);vec3 hue=personalityTint<0.?vec3(.32,.55,1.):vec3(1.,.19,.12);diffuseColor.rgb=mix(diffuseColor.rgb,hue*max(.3,diffuseColor.r),skin*abs(personalityTint));');};
  for(const color of [0x7aaaff,0xff6650]){const ghost=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,toneMapped:false}));ghost.visible=false;this.ghosts.push(ghost);this.root.add(ghost);}
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.4,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter,time=0):void{
  const talkingWalk=f.move==='talking'&&f.y===surfaceBelow(renderStage,f.x,f.y)&&!!(f.previousInput&(Button.Left|Button.Right));
  const walk=talkingWalk||!f.move&&f.state.startsWith('Walk');
  const speed=f.personality==='angry'?1.5:f.personality==='sad'?.8:1,phase=Math.floor(f.stateFrame*speed/7)%4;
  const dash=!f.move&&f.state.startsWith('Dash'),jump=!f.move&&['Jump','Fall','JumpStartup'].includes(f.state);
  const backPose=backwardDashPose(f),back=backPose===null?undefined:this.backward[backPose];
  const frame=back??(dash?this.movement[Math.floor(f.stateFrame/4)%2]:jump?this.movement[f.state==='Fall'?3:2]:walk?this.walking[phase]:this.combat[astolfoPose(f)]);
  const scale=1.6/(frame.referenceHeight??this.combat[0].height);
  const resting=!f.move&&f.state==='Idle',breath=resting?1+Math.sin(time*2.4)*.003:1;
  this.personalityTint.value=(astolfoPose(f)===16||dash||jump||this.tintFar&&walk&&phase>=2)?(f.personality==='sad'?-.7:f.personality==='angry'?.7:0):0;
  this.sprite.material.map=frame.texture;this.sprite.scale.set(frame.width*scale,frame.height*scale*breath,1);this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale*breath/2,0);
  const talking=((f.talkUntil??0)>0||f.move==='talking')&&!['KO','Respawning','Knockdown','MatchWin','MatchLose'].includes(f.state);
  const at=astolfoMouth(frame);this.mouth.visible=talking&&!!at;
  if(talking&&at){const opening=.18+.82*Math.abs(Math.sin(time*14));this.mouth.position.set((at.x-frame.pivot)*scale,(frame.height-at.y)*scale*breath,.015);this.lip.scale.set(.037,.008+.025*opening,1);this.tongue.scale.set(.04,.008*opening,1);this.tongue.position.y=-.011*opening;}
  this.ghosts.forEach((ghost,i)=>{const splitting=f.move==='bipolar'&&f.moveFrame<characters.astolfo.moves.bipolar.startupFrames;ghost.visible=splitting;if(splitting){const progress=Math.max(0,f.moveFrame/characters.astolfo.moves.bipolar.startupFrames);ghost.material.map=frame.texture;ghost.material.opacity=progress*.6;ghost.scale.copy(this.sprite.scale);ghost.position.copy(this.sprite.position);ghost.position.x+=(i?1:-1)*progress*.85;ghost.position.z=-.02;}});
  this.root.position.set(worldX(f.x),f.y/100,.12);this.root.scale.set(f.facing,1,1);this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose(){this.lip.geometry.dispose();this.lip.material.dispose();this.tongue.geometry.dispose();this.tongue.material.dispose();for(const ghost of this.ghosts){ghost.geometry.dispose();ghost.material.dispose();}this.sprite.geometry.dispose();this.sprite.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();}
}
const assets=new RetryableAssets<{neutral:Frame[];movement:Frame[];spider:Frame[];combat:Frame[][];walk:Frame[][];sad:Frame[];angry:Frame[];far:Frame[];farCasual:Frame[];sadCasual:Frame[];angryCasual:Frame[]}>();
export async function loadAstolfo(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 const a=await assets.get(async own=>{
  const read=async(name:string,c:number,r:number)=>{const t=await loadTexture('/art/astolfo/'+name+'.png');t.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(t,c,r,true,true);for(const f of frames)own(f.texture);registerAstolfoMouths(name,frames);return frames;};
  return {neutral:await read('neutral-poses-v1',3,2),movement:await read('movement-v2',4,2),spider:await read('spider-crawl-v2',4,1),farCasual:await read('walk-far-casual',3,4),sadCasual:await read('combat-sad-casual',4,4),angryCasual:await read('combat-angry-casual',4,4),far:await read('walk-far-v2',3,4),combat:await Promise.all([1,2].map(i=>read('combat-'+i,4,4))),walk:await Promise.all([1,2].map(i=>read('walk-'+i,4,3))),sad:await read('combat-sad',4,4),angry:await read('combat-angry',4,4)};
 });
 const backward=await loadBackwardDashArt();
 for(let i=0;i<2;i++){const frame=a.neutral[i*3+1];frame.referenceHeight=a.neutral[i*3].height;a.combat[i].push(frame);}
 a.sad.push(a.neutral[1]);a.angry.push(a.neutral[1]);a.sadCasual.push(a.neutral[4]);a.angryCasual.push(a.neutral[4]);
 astolfoSpiderFrames=a.spider;
 const cycle=(near:Frame[],far:Frame[])=>{for(const f of near)f.referenceHeight=near[0].height;for(const f of far)f.referenceHeight=far[0].height;return [near[0],near[1],far[0],far[1]];};
 for(let i=0;i<2;i++)for(const frame of a.movement.slice(i*4,i*4+4))frame.referenceHeight=a.movement[i*4].height/.88;
 for(let i=0;i<2;i++)register('astolfo',()=>new AstolfoRenderer(a.combat[i],cycle(a.walk[i].slice(0,2),a.far.slice(i*3,i*3+2)),a.movement.slice(i*4,i*4+4),true,backward.slice(i*3,i*3+3)),i?'casual':'original');
 register('astolfo',()=>new AstolfoRenderer(a.sad,cycle(a.walk[0].slice(4,6),a.far.slice(6,8)),a.movement.slice(0,4),true,backward.slice(0,3)),'sad');
 register('astolfo',()=>new AstolfoRenderer(a.angry,cycle(a.walk[0].slice(8,10),a.far.slice(9,11)),a.movement.slice(0,4),true,backward.slice(0,3)),'angry');
 register('astolfo',()=>new AstolfoRenderer(a.sadCasual,cycle(a.walk[1].slice(4,6),a.farCasual.slice(6,8)),a.movement.slice(4,8),false,backward.slice(3,6)),'sad-casual');
 register('astolfo',()=>new AstolfoRenderer(a.angryCasual,cycle(a.walk[1].slice(8,10),a.farCasual.slice(9,11)),a.movement.slice(4,8),false,backward.slice(3,6)),'angry-casual');
}
export let astolfoSpiderFrames:Frame[]=[];
export function disposeAstolfo(){astolfoSpiderFrames=[];assets.dispose();}
