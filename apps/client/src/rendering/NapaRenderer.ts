import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
export function napaPose(f:Fighter):[number,number]{
 if(f.move==='cookieMonster')return [1,f.moveFrame<30?Math.floor(Math.max(0,f.moveFrame)/8)%2:f.moveFrame<50?2:f.moveFrame<75?3:f.moveFrame<95?4:f.moveFrame<115?5:f.moveFrame<135?6:7];
 if(f.move){const m=characters.napa.moves[f.move];if(f.move==='sniff')return [0,20];if(f.move==='sneeze')return [0,f.moveFrame<45?22:23];if(f.move==='cookie')return [0,f.moveFrame<18?18:19];if(f.moveFrame<m.startupFrames*.65||f.moveFrame>=m.startupFrames+m.activeFrames+m.recoveryFrames*.6)return [0,6];return [0,({jab:7,cross:8,comboKick:9,heavyKick:10,heavyPunch:11,low:12,air:13} as Record<string,number>)[f.move]??6];}
 if(f.state.startsWith('Walk')||f.state.startsWith('Dash')){const p=Math.floor(f.stateFrame/6)%8;return [2,f.state==='WalkBackward'?(8-p)%8:p];}
 if(['Jump','Fall','JumpStartup'].includes(f.state))return [3,2];
 if(f.state==='Crouch'||f.state==='BlockCrouching')return [3,1];if(f.state.startsWith('Block'))return [0,14];
 if(['KO','Respawning','Knockdown','MatchLose'].includes(f.state))return [0,16];if(f.state.includes('HitStun')||f.state==='GetUp')return [0,15];if(f.state==='MatchWin')return [0,17];return [0,6];
}
/** Movement uses its own sheet; monster attacks keep their original poses. */
export function cookieMonsterPose(f:Fighter):[number,number]{
 if(f.move==='bossSlam')return [0,f.moveFrame<48?4:5];
 if(f.move==='bossChomp')return [0,6];
 if(f.move==='bossBarrage')return [0,4];
 if(!f.move){
  if(f.state==='JumpStartup')return [1,1];
  if(f.state==='Jump')return [1,f.vy>4||f.stateFrame<3?2:3];
  if(f.state==='Fall')return [1,4];
  if(f.state==='Land')return [1,5];
  if(f.state.startsWith('Walk'))return [0,[1,2,3,2][Math.floor(f.stateFrame/12)%4]];
 }
 return [0,0];
}
export class NapaRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 root=new THREE.Group();shadow:THREE.Mesh;private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 constructor(private sheets:Frame[][],private monster=false){this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));this.root.add(this.sprite);this.shadow=new THREE.Mesh(new THREE.CircleGeometry(monster?.7:.4,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;}
 update(f:Fighter):void{
  const [sheet,pose]=this.monster?cookieMonsterPose(f):napaPose(f);
  const frame=this.sheets[sheet][pose],reference=this.sheets[sheet][sheet===0&&!this.monster?6:0],scale=(this.monster?3.1:1.76)/reference.height;
  this.sprite.material.map=frame.texture;this.sprite.scale.set(frame.width*scale,frame.height*scale,1);this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,0);
  this.root.position.set(worldX(f.x),f.y/100,.12);this.root.scale.set(f.facing,1,1);this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose(){for(const mesh of [this.sprite,this.shadow]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
const cached=new RetryableAssets<{skins:Frame[][][];monster:Frame[];monsterJump:Frame[]}>();
export async function loadNapa(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 const data=await cached.get(async own=>{const sheet=async(path:string,c:number,r:number)=>{const texture=await loadTexture('/art/napa/'+path+'.png');texture.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(texture,c,r,true,true);for(const f of frames)own(f.texture);return frames;};return {skins:await Promise.all([1,2].map(i=>Promise.all([sheet('combat-'+i,6,4),sheet('baking-'+i,4,2),sheet('walk-'+i,4,2),sheet('neutral-poses-v1',3,2).then(frames=>frames.slice((i-1)*3,i*3))]))),monster:await sheet('monster',4,2),monsterJump:await sheet('monster-jump-v1',3,2)};});
 data.skins.forEach((s,i)=>register('napa',()=>new NapaRenderer(s),i?'gym':'original'));register('napa',()=>new NapaRenderer([data.monster,data.monsterJump],true),'cookie-monster');
}
export function disposeNapa(){cached.dispose();}
