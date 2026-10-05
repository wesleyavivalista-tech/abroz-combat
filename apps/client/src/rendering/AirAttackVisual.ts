import * as THREE from 'three';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
import type {FighterVisual} from './FighterRenderer.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {loadTexture} from './TextureCache.js';
import {RetryableAssets} from './RetryableAssets.js';

export const airAttackCatalog:Record<string,{height:number;second:string;rows?:number}>={
 roms:{height:1.81,second:'hoodie',rows:3},
 nikalz:{height:1.78,second:'palmeiras'},drupa:{height:1.75,second:'purple'},
 caio:{height:1.75,second:'black'},gut:{height:1.8,second:'kung-fu'},biel:{height:1.76,second:'casual'},
};
export function usesDedicatedAirAttack(id:string,f:Fighter):boolean{
 if(f.stun||f.jopaRide!==undefined)return false;
 if(id==='roms'){const move=characters.roms.moves.air;return f.move==='air'&&f.moveFrame>=move.startupFrames&&f.moveFrame<move.startupFrames+move.activeFrames+3;}
 if(id==='nikalz')return f.move==='air'&&!f.beeBoxes;
 if(id==='drupa'){const move=characters.drupa.moves.air;return f.move==='air'&&!f.weaponUntil&&f.moveFrame>=move.startupFrames&&f.moveFrame<move.startupFrames+move.activeFrames+3;}
 if(id==='caio')return f.move==='air';
 if(id==='gut')return f.move==='spearAir'&&!!f.weaponUntil;
 if(id==='biel')return f.move==='stamp'&&(f.state==='AirAttack'||f.y>surfaceBelow(renderStage,f.x,f.y));
 return false;
}
export function usesDedicatedCrouchAttack(id:string,f:Fighter):boolean{
 if(f.stun||f.jopaRide!==undefined||f.state!=='CrouchingAttack')return false;
 const name=id==='drupa'&&!f.weaponUntil?'low':id==='caio'?'crouch':undefined;
 if(!name||f.move!==name)return false;
 const move=characters[id].moves[name];
 return f.moveFrame>=move.startupFrames&&f.moveFrame<move.startupFrames+move.activeFrames+3;
}
const caches=new Map<string,RetryableAssets<Frame[]>>(),ready=new Map<string,Frame[]>();
export async function loadAirAttackArt(id:string):Promise<void>{
 if(!airAttackCatalog[id])return;
 await Promise.all((['drupa','caio'].includes(id)?['air','crouch']:['air']).map(async kind=>{
 const key=kind==='air'?id:id+'-crouch';
 let cache=caches.get(key);if(!cache){cache=new RetryableAssets<Frame[]>();caches.set(key,cache);}
 const frames=await cache.get(async own=>{
  const texture=await loadTexture(`/art/${id}/${kind==='air'&&id==='drupa'?'air-kick-v2':kind+'-attack-v1'}.png`);texture.colorSpace=THREE.SRGBColorSpace;
  const rows=kind==='air'?(airAttackCatalog[id].rows??2):2;
  const frames=framesFrom(texture,2,rows,true,true);
  for(let row=0;row<rows;row++)frames[row*2+1].referenceHeight=frames[row*2].height;
  frames.forEach(f=>own(f.texture));return frames;
 });ready.set(key,frames);
 }));
}
export function disposeAirAttackArt(){caches.forEach(c=>c.dispose());caches.clear();ready.clear();}
/** Keep gameplay positioning and mode effects while replacing dedicated attack bodies. */
export class AirAttackVisual implements FighterVisual{
 readonly root:THREE.Group;readonly shadow?:THREE.Mesh;
 private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 private hidden:Array<[THREE.Object3D,boolean]>=[];
 get fallBodies(){return [...(this.base.fallBodies??[]),this.sprite];}
 constructor(private base:FighterVisual,private id:string,private skin:string){
  this.root=base.root;this.shadow=base.shadow;this.sprite.name='airborne-attack';this.sprite.visible=false;this.root.add(this.sprite);
 }
 update(f:Fighter,time:number,simulationFrame?:number){
  for(const [object,visible] of this.hidden)object.visible=visible;this.hidden=[];
  this.base.update(f,time,simulationFrame);this.sprite.visible=false;
  const crouch=usesDedicatedCrouchAttack(this.id,f);
  if(!crouch&&!usesDedicatedAirAttack(this.id,f))return;
  const spec=airAttackCatalog[this.id],frame=ready.get(crouch?this.id+'-crouch':this.id)?.[this.id==='roms'&&f.armorUntil?5:this.skin===spec.second?3:1];
  if(!frame||!this.base.fallBodies?.length)return;
  for(const object of this.base.fallBodies){this.hidden.push([object,object.visible]);object.visible=false;}
  const scale=spec.height/frame.referenceHeight!;
  this.sprite.material.map=frame.texture;this.sprite.material.color.set(this.id==='caio'&&f.bloodMasterUntil?0xd83737:0xffffff);
  this.sprite.scale.set(frame.width*scale,frame.height*scale,1);
  this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,.002);this.sprite.visible=true;
 }
 dispose(){for(const [object,visible] of this.hidden)object.visible=visible;this.root.remove(this.sprite);this.sprite.geometry.dispose();this.sprite.material.dispose();this.base.dispose();}
}
