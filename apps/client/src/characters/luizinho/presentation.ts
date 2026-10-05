import * as THREE from 'three';
import {loadTexture} from '../../rendering/TextureCache.js';
import {prepareSpriteIsolation,SpriteIsolation} from '../../rendering/SpriteIsolation.js';
import {validateAnimationManifest} from '../../rendering/AnimationContract.js';
import {worldX,renderStage} from '../../rendering/StageCoordinates.js';
import {surfaceBelow} from '../../../../../packages/game-core/simulation/StageCollision.js';
import {characters} from '../../../../../packages/game-core/characters/registry.js';
import type {Fighter} from '../../../../../packages/game-core/types.js';
import type {FighterVisual} from '../../rendering/FighterRenderer.js';
import {luizinhoAtlases} from './atlas.js';
export const luizinhoActions={idle:[0],walk:[1,2,3,4],dash:[5,6],jump:[7,8],crouch:[9],guard:[10],hit:[11,12],knockdown:[13,14],victory:[15]};
export function luizinhoPose(f:Fighter):{sheet:0|1;pose:number}{
 if(f.move){
  const m=characters[f.characterId].moves[f.move],active=f.moveFrame>=m.startupFrames,late=f.moveFrame>=m.startupFrames+m.activeFrames+Math.ceil(m.recoveryFrames*.5);
  if(late)return {sheet:0,pose:0};
  const pairs:Record<string,[number,number]>={jab:[0,1],cross:[2,3],comboKick:[4,5],heavyKick:[6,7],punch:[0,8],low:[9,9],air:[10,10],seller:[11,12],wall:[13,15],turret:[13,15],home:[13,14],build:[13,15]};
  const pair=pairs[f.move];if(pair)return {sheet:1,pose:pair[active?1:0]};
 }
 const state=f.state;
 if(state.startsWith('Walk')){const phase=Math.floor(f.stateFrame/7)%4;return {sheet:0,pose:1+(state==='WalkBackward'?(4-phase)%4:phase)};}
 return {sheet:0,pose:state==='DashForward'?5:state==='DashBackward'?6:state==='Jump'||state==='JumpStartup'?7:state==='Fall'||state==='Land'?8:state==='Crouch'?9:state.startsWith('Block')?10:state==='AirHitStun'?12:state.includes('HitStun')||state==='HairTrapped'||state==='Grappled'?11:state==='Knockdown'||state==='KO'||state==='Respawning'?13:state==='GetUp'?14:state==='MatchWin'?15:0};
}
class LuizinhoRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 root=new THREE.Group();shadow:THREE.Mesh;private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;private textures:THREE.Texture[];private isolation:SpriteIsolation;
 constructor(textures:THREE.Texture[],private skin:number){
  this.textures=textures.map(t=>{const copy=t.clone();copy.needsUpdate=true;return copy;});
  this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.4,side:THREE.DoubleSide,toneMapped:false}));this.root.add(this.sprite);this.isolation=new SpriteIsolation(this.sprite.material);
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.4,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter):void{
  const {sheet,pose}=luizinhoPose(f),name=`${sheet?'combat':'movement'}-${this.skin+1}` as keyof typeof luizinhoAtlases;
  const data=luizinhoAtlases[name],idle=luizinhoAtlases[`movement-${this.skin+1}` as 'movement-1'|'movement-2'].frames[0];
  const texture=this.textures[sheet],[l,t,r,b]=data.frames[pose];
  const scale=1.7/(idle[3]-idle[1]),w=r-l+1,h=b-t+1;
  texture.repeat.set(w/data.width,h/data.height);texture.offset.set(l/data.width,1-(b+1)/data.height);
  this.sprite.material.map=texture;this.isolation.select(texture,data.frames,pose);
  this.sprite.scale.set(w*scale,h*scale,1);
  const cellCenter=(pose%4+.5)*data.width/4;
  this.sprite.position.set(((l+r)/2-cellCenter)*scale,h*scale/2,0);
  this.root.position.set(worldX(f.x),f.y/100,.1);this.root.scale.set(f.facing,1,1);
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose():void{this.textures.forEach(t=>t.dispose());this.sprite.geometry.dispose();this.sprite.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();}
}
export async function loadLuizinhoPresentation(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void):Promise<void>{
 validateAnimationManifest({frameCount:16,actions:luizinhoActions},['idle','walk','dash','jump','crouch','guard','hit','knockdown','victory']);
 for(const skin of [0,1]){
  const textures=await Promise.all(['movement','combat'].map(async kind=>{const name=`${kind}-${skin+1}` as keyof typeof luizinhoAtlases;const t=await loadTexture(`/art/luizinho/${name}.png`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;prepareSpriteIsolation(t,luizinhoAtlases[name].frames);return t;}));
  register('luizinho',()=>new LuizinhoRenderer(textures,skin),skin?'black':'original');
 }
}
