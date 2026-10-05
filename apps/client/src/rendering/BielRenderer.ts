import {validateAnimationManifest,validateAtlasFrames,type AnimationManifest} from './AnimationContract.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
export const bielAnimationManifest:AnimationManifest={frameCount:65,actions:{idle:[0],walk:[24,25,26,27,28,29],dashForward:[16],dashBackward:[17],jump:[12,13,14,15],crouch:[22],guard:[8,22],hit:[9],knockdown:[10,23],victory:[11],jab:[0,1,0],cross:[0,2,0],kick:[0,3,0],heavyKick:[0,4,0],heavyPunch:[0,5,0],low:[6],air:[7],wine:[18,19],coins:[20,21],loan:[30],stamp:[31,32,33],angel:[34,35,36,37,49],hover:[38,39,40,41],feathers:[42,43],dive:[44,45],divine:[46,47],angelHit:[48],loanWalk:[51,52,53,54,55,56],loanJump:[57,58,59],loanDash:[60],loanCrouch:[61],coinThrow:[62,63,64]}};
export type BielPose={sheet:'combat'|'walk'|'ultimate'|'angel'|'loanMovement'|'coinThrow';index:number};
export function bielPose(f:Fighter):BielPose{
 if(f.angelUntil){
  let index=[0,1,2,3][Math.floor(f.stateFrame/9)%4];
  if(f.stun)index=10;
  else if(f.move==='feathers')index=f.moveFrame<10?4:5;
  else if(f.move==='dive')index=f.moveFrame<10?6:7;
  else if(f.move==='divine')index=f.moveFrame<24?8:9;
  return {sheet:'angel',index};
 }
 if(f.move==='angel')return {sheet:'ultimate',index:f.moveFrame<40?4:f.moveFrame<70?5:f.moveFrame<130?6:7};
 if(f.move==='loan'||f.move==='stamp'||f.stampAttempts!==undefined){
  if(!f.stun){
   if(f.move==='stamp')return {sheet:'ultimate',index:f.moveFrame<14?1:f.moveFrame<20?2:3};
   if(f.state.startsWith('Walk')){const step=Math.floor(f.stateFrame/6)%6;return {sheet:'loanMovement',index:1+(f.state==='WalkBackward'?(6-step)%6:step)};}
   return {sheet:'loanMovement',index:f.state==='Jump'?7:f.state==='Fall'?8:f.state==='JumpStartup'||f.state==='Land'?9:f.state.startsWith('Dash')?10:f.state==='Crouch'||f.state==='BlockCrouching'?11:0};
  }
 }
 if(f.move){
  const m=characters.biel.moves[f.move],late=f.moveFrame>=m.startupFrames+m.activeFrames+Math.ceil(m.recoveryFrames*.6);
  if(f.move==='wine')return {sheet:'combat',index:f.moveFrame<m.startupFrames?18:late?0:19};
  if(f.move==='coins')return late?{sheet:'combat',index:0}:{sheet:'coinThrow',index:f.moveFrame<12?0:f.moveFrame<m.startupFrames?1:2};
  return {sheet:'combat',index:f.moveFrame<m.startupFrames*.5||late?0:({jab:1,cross:2,kick:3,heavyKick:4,heavyPunch:5,low:6,air:7} as Record<string,number>)[f.move]??0};
 }
 if(f.state.startsWith('Walk')){const step=Math.floor(f.stateFrame/6)%6;return {sheet:'walk',index:f.state==='WalkBackward'?(6-step)%6:step};}
 const index=f.state==='DashBackward'?17:f.state.startsWith('Dash')?16:f.state==='JumpStartup'?12:f.state==='Jump'?13:f.state==='Fall'?14:f.state==='Land'?15:f.state==='GetUp'?23:f.state==='BlockCrouching'||f.state==='Crouch'?22:f.state.startsWith('Block')?8:f.state.includes('HitStun')?9:['KO','Knockdown','Respawning','MatchLose'].includes(f.state)?10:f.state==='MatchWin'?11:0;
 return {sheet:'combat',index};
}
export class BielRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 root=new THREE.Group();shadow:THREE.Mesh;
 private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 constructor(private sheets:Record<BielPose['sheet'],Frame[]>){this.root.add(this.sprite);this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.44,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;}
 update(f:Fighter):void{
  const pose=bielPose(f),frames=this.sheets[pose.sheet],frame=frames[pose.index];
  const reference=pose.sheet==='angel'?frames[1]:pose.sheet==='walk'?frame:frames[0];
  const scale=(pose.sheet==='angel'?2.25:1.76)/(frame.referenceHeight??reference.height);
  this.sprite.material.map=frame.texture;this.sprite.scale.set(frame.width*scale,frame.height*scale,1);this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,0);
  this.sprite.visible=f.jopaTree===undefined;this.root.position.set(worldX(f.x),f.y/100,.14);this.root.scale.set(f.facing,1,1);
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);this.shadow.visible=f.jopaTree===undefined&&f.jopaRide===undefined;
 }
 dispose(){for(const mesh of [this.sprite,this.shadow]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
const cache=new RetryableAssets<Record<BielPose['sheet'],Frame[]>[]>();
export async function loadBiel(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 validateAnimationManifest(bielAnimationManifest,[...Object.keys(characters.biel.moves),'idle','walk','dashForward','dashBackward','jump','crouch','guard','hit','knockdown','victory','hover','angelHit']);
 const skins=await cache.get(async own=>{
  const sheet=async(name:string,c:number,r:number)=>{const t=await loadTexture('/art/biel/'+name+'.png');t.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(t,c,r,true,true);validateAtlasFrames(frames.map(f=>[f.sourceLeft!,f.sourceTop!,f.sourceLeft!+f.width-4,f.sourceTop!+f.height-4]),t.image.width,t.image.height);frames.forEach(f=>own(f.texture));return frames;};
  const angel=await sheet('angel',4,3),opposite=await sheet('walk-opposite-v2',2,2),loanOpposite=await sheet('loan-opposite',2,2),coinThrow=await sheet('coin-throw',3,2);
  // Opposite-leg contact/recovery are authored separately to prevent a repeated one-leg shuffle.
  return Promise.all([1,2].map(async i=>{const walk=await sheet('walk-'+i+'-v2',4,2),loanMovement=await sheet('loan-movement-'+i,4,3),throwFrames=coinThrow.slice((i-1)*3,i*3);
   loanMovement[3]=loanOpposite[(i-1)*2];loanMovement[4]=loanOpposite[(i-1)*2+1];
   for(let j=1;j<=6;j++)loanMovement[j].referenceHeight=loanMovement[j].height;
   // Bag and raised hands extend above the head: use the standing body height, not the full silhouette.
   for(const frame of throwFrames)frame.referenceHeight=throwFrames[0].height;
   return {loanMovement,coinThrow:throwFrames,combat:await sheet('combat-'+i,6,4),walk:[walk[0],walk[1],opposite[(i-1)*2],opposite[(i-1)*2+1],walk[2],walk[3]],ultimate:await sheet('ultimate-'+i,4,2),angel};}));
 });
 skins.forEach((s,i)=>register('biel',()=>new BielRenderer(s),i?'casual':'original'));
}
export function disposeBiel(){cache.dispose();}
