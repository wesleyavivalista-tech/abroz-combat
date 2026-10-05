import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX} from './StageCoordinates.js';
export function nikalzPose(f:Fighter):number{
 if(f.meteorStart!==undefined)return f.stateFrame<48?10:7;
 if(f.move){const m=characters.nikalz.moves[f.move];if(f.moveFrame<m.startupFrames*.55||f.moveFrame>m.startupFrames+m.activeFrames+m.recoveryFrames*.7)return 0;
 return ({jab:1,straight:2,cross:3,forehead:4,heavyHead:4,heavyPunch:5,low:6,air:3,foreheadDive:7,testada:8,bees:9,meteor:8,beeHouse:9,placeBox:6} as Record<string,number>)[f.move]??0;}
 if(f.state==='MatchWin')return 15;
 if(['KO','Knockdown','Respawning','MatchLose'].includes(f.state))return 14;
 if(f.state.includes('HitStun')||f.state==='GetUp')return 13;
 if(f.state.startsWith('Block'))return 12;
 if(['Jump','JumpStartup'].includes(f.state))return 10;
 if(f.state==='Fall')return 11;
 if(['Crouch','Land'].includes(f.state))return 6;
 return 0;
}
/** Dedicated anticipation, forehead contact and recovery poses follow the hit frame. */
export function nikalzMeteorAge(f:Fighter,simulationFrame?:number):number{
 return simulationFrame===undefined?f.stateFrame-characters.nikalz.moves.meteor.startupFrames:simulationFrame-(f.meteorStart??simulationFrame);
}
export function nikalzActionPose(f:Fighter,simulationFrame?:number):number|null{
 if(f.meteorStart!==undefined)return nikalzMeteorAge(f,simulationFrame)<48?null:7;
 if(f.move==='foreheadDive')return f.moveFrame<6?4:7;
 if(f.move==='heavyHead'||f.move==='forehead'){
  const m=characters.nikalz.moves[f.move],t=f.moveFrame;
  return t<m.startupFrames-3?1:t<m.startupFrames+m.activeFrames+4?2:t<m.startupFrames+m.activeFrames+13?3:0;
 }
 if(f.move==='testada'||f.move==='meteor'){
  const m=characters.nikalz.moves[f.move],t=f.moveFrame;
  if(f.move==='meteor'&&t<m.startupFrames)return null;
  return t<m.startupFrames-6?4:t<m.startupFrames?5:t<m.startupFrames+13?6:t<m.startupFrames+23?5:4;
 }
 if(f.move==='placeBox')return f.moveFrame<7?8:f.moveFrame<21?11:f.beeBoxes?8:0;
 if(f.beeBoxes&&!f.state.includes('HitStun')&&!['KO','Knockdown','Respawning'].includes(f.state))return f.state.startsWith('Walk')||f.state.startsWith('Dash')?(Math.floor(f.stateFrame/9)%2?9:10):8;
 return null;
}
export function nikalzCarryPose(f:Fighter):number|null{
 if(!f.beeBoxes||f.move||f.state.includes('HitStun'))return null;
 if(f.state==='Jump')return 1;
 if(f.state==='Fall')return 2;
 if(f.state==='DashForward')return 3;
 if(f.state==='DashBackward')return 4;
 if(['JumpStartup','Land','Crouch'].includes(f.state))return 5;
 return null;
}
export const nikalzWalkFrame=(frame:number,backward=false)=>{const phase=Math.floor(frame/7)%4;return backward?(4-phase)%4:phase;};
export function nikalzMovementPose(f:Fighter):number|null{
 if(f.move)return null;
 if(f.beeBoxes&&f.state.startsWith('Walk'))return 8+nikalzWalkFrame(f.stateFrame,f.state==='WalkBackward');
 if(f.beeBoxes)return null;
 const phase=f.stateFrame<3?0:f.stateFrame<9?1:2;
 if(f.state==='DashForward')return 1+phase;
 if(f.state==='DashBackward')return 4+phase;
 return null;
}
export function nikalzUsesCrouchGuard(f:Fighter):boolean{
 return !f.move&&!f.beeBoxes&&f.meteorStart===undefined&&(f.state==='Crouch'||f.state==='BlockCrouching');
}
export class NikalzRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 root=new THREE.Group();private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 constructor(private combat:Frame[],private walk:Frame[],private actions:Frame[],private carry:Frame[],private movement:Frame[],private crouch:Frame){this.root.add(this.sprite);}
 update(f:Fighter,_time=0,simulationFrame?:number):void{
  const walking=!f.move&&(f.state.startsWith('Walk')||f.state.startsWith('Dash'));
  const action=nikalzActionPose(f,simulationFrame),carry=nikalzCarryPose(f),movement=nikalzMovementPose(f);
  const frame=nikalzUsesCrouchGuard(f)?this.crouch:movement!==null?this.movement[movement]:carry!==null?this.carry[carry]:action!==null?this.actions[action]:walking?this.walk[nikalzWalkFrame(f.stateFrame,f.state==='WalkBackward')]:this.combat[nikalzPose(f)];
  const scale=1.78/(frame.referenceHeight??this.combat[0].height);
  this.sprite.material.map=frame.texture;this.sprite.scale.set(frame.width*scale,frame.height*scale,1);this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,0);
  this.sprite.rotation.z=0;
  if(f.meteorStart!==undefined&&nikalzMeteorAge(f,simulationFrame)>=48){
   // Rotate around the forehead, so it leads the dive and meets the impact origin.
   const turn=Math.min(1,Math.max(0,(nikalzMeteorAge(f,simulationFrame)-48)/6));
   const angle=-.52*turn,width=frame.width*scale,height=frame.height*scale;
   const cx=width*(.5-.88),cy=height*(.5-.04);
   this.sprite.rotation.z=angle;
   this.sprite.position.set(cx*Math.cos(angle)-cy*Math.sin(angle),cx*Math.sin(angle)+cy*Math.cos(angle),0);
  }
  this.root.position.set(worldX(f.x),f.y/100,.14);this.root.scale.set(f.facing,1,1);this.root.visible=f.jopaTree===undefined;
 }
 dispose(){this.sprite.geometry.dispose();this.sprite.material.dispose();}
}
const cache=new RetryableAssets<{combat:Frame[];walk:Frame[];actions:Frame[];carry:Frame[];movement:Frame[];crouch:Frame}[]>();
export async function loadNikalz(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 const skins=await cache.get(async own=>Promise.all([1,2].map(async i=>{
  const read=async(name:string,cols:number,rows:number)=>{const t=await loadTexture('/art/nikalz/'+name+'.png');t.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(t,cols,rows,false,true);frames.forEach(f=>own(f.texture));return frames;};
  const [combat,walk,actions,carry,movement,crouches]=await Promise.all([read('combat-'+i,4,4),read('walk-'+i,2,2),read('actions-v2-'+i,4,3),read('carry-v2-'+i,3,2),read('movement-v3-'+i,4,3),read('crouch-guard-v1',2,1)]);
  for(const [n,f] of movement.entries())f.referenceHeight=n>=7?f.height:movement[0].height;
  for(const f of carry)f.referenceHeight=carry[0].height;
  for(const f of actions)f.referenceHeight=actions[0].height;
  // Forehead contact stays aligned with the gameplay impact origin.
  for(const n of [5,6,7])actions[n].pivot=actions[n].width*.84;
  for(const f of walk)f.referenceHeight=f.height;
  const crouch=crouches[i-1];
  // The crouched silhouette is 62% of standing height; keep its feet grounded.
  crouch.referenceHeight=crouch.height/.62;
  return {combat,walk,actions,carry,movement,crouch};
 })));
 skins.forEach((s,i)=>register('nikalz',()=>new NikalzRenderer(s.combat,s.walk,s.actions,s.carry,s.movement,s.crouch),i?'palmeiras':'original'));
}
export function disposeNikalz(){cache.dispose();}
