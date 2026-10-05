import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {inLove} from '../../../../packages/game-core/simulation/EideSystem.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX} from './StageCoordinates.js';
type Sheets={combat:Frame[];walk:Frame[];love:Frame[];loveWalk:Frame[];mutant:Frame[];blondes:Frame[];forms:Frame[]};
export function eidePose(f:Fighter):{sheet:keyof Sheets;index:number}{
 if(f.loveNpc)return {sheet:'blondes',index:f.health<=0?(f.stateFrame<16?4:5):f.state==='HitStunStanding'?3:f.state.startsWith('Walk')?6+Math.floor(f.stateFrame/7)%4:f.state==='Jump'?10:f.state==='Fall'||f.state==='Land'?11:Math.floor(f.stateFrame/18)%3};
 if(f.weaponUntil){
  if(f.move&&f.move!=='mutant'){const m=characters.eide.moves[f.move];return {sheet:'mutant',index:f.moveFrame<m.startupFrames?8:f.moveFrame>=m.startupFrames+m.activeFrames?0:({giantPunch:9,charge:10,flyingKick:11}[f.move]??0)};}
  return {sheet:'mutant',index:f.stun?13:['KO','Knockdown','Respawning'].includes(f.state)?14:f.state==='MatchWin'?15:f.state.startsWith('Walk')?[1,2,3,4][Math.floor(f.stateFrame/8)%4]:f.state==='Jump'?5:f.state==='Fall'?6:f.state==='Crouch'||f.state==='Land'?7:f.state.startsWith('Dash')?10:0};
 }
 if(f.move==='mutant')return {sheet:'forms',index:f.moveFrame<25?0:f.moveFrame<65?1:2};
 const love=inLove(f);
 if(!f.move&&f.state.startsWith('Walk')){const phase=Math.floor(f.stateFrame/8)%4;return {sheet:love?'loveWalk':'walk',index:[0,2,4,5][f.state==='WalkBackward'?(4-phase)%4:phase]};}
 let index=0;
 if(f.move){const m=characters.eide.moves[f.move],late=f.moveFrame>=m.startupFrames+m.activeFrames+Math.ceil(m.recoveryFrames*.55);
  if(f.move==='seller')index=f.moveFrame<m.startupFrames?18:late?0:19;
  else if(f.move==='bahia')index=f.moveFrame<m.startupFrames?20:late?0:21;
  else if(f.move==='love')return {sheet:'love',index:11};
  else index=f.moveFrame<m.startupFrames*.4||late?0:({jab:1,cross:2,hook:3,heavyKick:4,heavyPunch:5,low:6,air:7}[f.move]??0);
 }else index=f.state==='JumpStartup'?12:f.state==='Jump'?13:f.state==='Fall'?14:f.state==='Land'?15:f.state==='DashForward'?16:f.state==='DashBackward'?17:f.state==='Crouch'||f.state==='BlockCrouching'?22:f.state.startsWith('Block')?8:f.state.includes('HitStun')?9:['KO','Knockdown','Respawning','MatchLose'].includes(f.state)?10:f.state==='GetUp'?23:f.state==='MatchWin'?11:0;
 return {sheet:love?'love':'combat',index};
}
export class EideRenderer implements FighterVisual{
 root=new THREE.Group();private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 constructor(private sheets:Sheets){this.root.add(this.sprite);}
 update(f:Fighter):void{
  const pose=eidePose(f),frames=this.sheets[pose.sheet],frame=frames[pose.index],reference=frames[0];
  const bodyHeight=pose.sheet==='mutant'?3.52:pose.sheet==='blondes'?1.7:1.76;
  const scale=bodyHeight/(frame.referenceHeight??reference.height);
  this.sprite.material.map=frame.texture;this.sprite.scale.set(frame.width*scale,frame.height*scale,1);this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,0);
  this.sprite.visible=f.jopaTree===undefined;this.root.position.set(worldX(f.x),f.y/100,.14);this.root.scale.set(f.facing,1,1);
  this.sprite.material.opacity=f.health<=0&&f.loveNpc?Math.max(0,1-f.stateFrame/36):1;
 }
 dispose(){this.sprite.geometry.dispose();this.sprite.material.dispose();}
}
const cache=new RetryableAssets<{skins:Sheets[];blondeB:Frame[]}>();
export let applianceFrames:Frame[]=[];
export async function loadEide(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 const {skins,blondeB}=await cache.get(async own=>{
  const sheet=async(name:string,cols:number,rows:number)=>{const t=await loadTexture('/art/eide/'+name+(['forms','walk-opposite-final','love-opposite','blonde-a-v2','blonde-opposite-v2','blonde-a-opposite-final'].includes(name)?'':'-clean')+'.png');t.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(t,cols,rows,true,true);frames.forEach(f=>own(f.texture));return frames;};
  const [mutant,blondes,blondeB,blondeOpposite,blueOpposite,props,forms,opposite,loveOpposite,mutantOpposite]=await Promise.all([sheet('mutant',4,4),sheet('blonde-a-v2',4,3),sheet('blonde-b-v2',4,3),sheet('blonde-opposite-v2',2,2),sheet('blonde-a-opposite-final',2,2),sheet('appliances',5,2),sheet('forms',4,2),sheet('walk-opposite-final',2,2),sheet('love-opposite',2,2),sheet('mutant-opposite',2,1)]);applianceFrames=props;[blondes,blondeB].forEach((frames,i)=>{frames[8]=i?blondeOpposite[2]:blueOpposite[0];frames[9]=i?blondeOpposite[3]:blueOpposite[1];for(const f of frames.slice(6,10))f.referenceHeight=f.height;});mutant[3]=mutantOpposite[0];mutant[4]=mutantOpposite[1];for(const f of mutantOpposite)f.referenceHeight=f.height;
  const skins=await Promise.all([1,2].map(async i=>{const [combat,walk,love,loveWalk]=await Promise.all([sheet('combat-'+i,6,4),sheet('walk-'+i,4,2),sheet('love-'+i,6,4),sheet('love-walk-'+i,4,2)]);
   walk[4]=opposite[(i-1)*2];walk[5]=opposite[(i-1)*2+1];loveWalk[4]=loveOpposite[(i-1)*2];loveWalk[5]=loveOpposite[(i-1)*2+1];
   for(const frames of [walk,loveWalk])for(const f of frames)f.referenceHeight=f.height;
   return {combat,walk,love,loveWalk,mutant,blondes,forms:forms.slice((i-1)*4,i*4)};
  }));
  return {skins,blondeB};
 });skins.forEach((s,i)=>register('eide',()=>new EideRenderer(s),i?'gym':'original'));register('eide',()=>new EideRenderer(skins[0]),'blonde');register('eide',()=>new EideRenderer(skins[0]),'blonde-0');register('eide',()=>new EideRenderer({...skins[0],blondes:blondeB}),'blonde-1');
}
export function disposeEide(){cache.dispose();applianceFrames=[];}
