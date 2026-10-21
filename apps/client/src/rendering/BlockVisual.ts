import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import type {FighterVisual} from './FighterRenderer.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';

export const blockCatalog:Record<string,{columns:number;second:string;height:number}>={
 drupa:{columns:3,second:'purple',height:1.75},
 caio:{columns:4,second:'black',height:1.75},
 gut:{columns:2,second:'kung-fu',height:1.8},
};
/** Presentation only: never changes the authoritative fighter or guard rules. */
export function blockVariant(id:string,skin:string,f:Fighter):{index:number;height:number}|undefined{
 const spec=blockCatalog[id];
 if(!spec||f.state!=='BlockStanding'||f.move||f.stun||f.jopaRide!==undefined)return;
 if(skin!=='original'&&skin!==spec.second)return;
 let index=skin===spec.second?1:0,height=spec.height;
 if(id==='gut'&&f.weaponUntil<=0)return;
 if(id==='drupa'&&f.weaponUntil>0){index=2;height*=3;}
 if(id==='caio'&&f.bloodMasterUntil>0)index+=2;
 return {index,height};
}
const caches=new Map<string,RetryableAssets<Frame[]>>(),ready=new Map<string,Frame[]>();
export async function loadBlockArt(id:string):Promise<void>{
 const spec=blockCatalog[id];if(!spec)return;
 let cache=caches.get(id);if(!cache){cache=new RetryableAssets<Frame[]>();caches.set(id,cache);}
 const frames=await cache.get(async own=>{
  const texture=await loadTexture(`/art/${id}/block-standing-v1.png`);
  const frames=framesFrom(texture,spec.columns,1,true,true);
  // Spear tips extend above the head; scale Gut by body height, not weapon bounds.
  if(id==='gut')frames.forEach(frame=>{frame.referenceHeight=frame.height*.87;});
  frames.forEach(frame=>own(frame.texture));return frames;
 });ready.set(id,frames);
}
export function disposeBlockArt():void{caches.forEach(cache=>cache.dispose());caches.clear();ready.clear();}

export class BlockVisual implements FighterVisual{
 readonly root:THREE.Group;readonly shadow?:THREE.Mesh;
 private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 private hidden:Array<[THREE.Object3D,boolean]>=[];
 get fallBodies():readonly THREE.Object3D[]{return [...(this.base.fallBodies??[]),this.sprite];}
 constructor(private base:FighterVisual,private id:string,private skin:string,private art:ReadonlyMap<string,Frame[]>=ready){
  this.root=base.root;this.shadow=base.shadow;this.sprite.name='standing-block';this.sprite.visible=false;this.root.add(this.sprite);
 }
 update(f:Fighter,time:number,simulationFrame?:number):void{
  for(const [body,visible] of this.hidden)body.visible=visible;this.hidden=[];
  this.base.update(f,time,simulationFrame);this.sprite.visible=false;
  const variant=blockVariant(this.id,this.skin,f);if(!variant)return;
  const frame=this.art.get(this.id)?.[variant.index];if(!frame||!this.base.fallBodies?.length)return;
  for(const body of this.base.fallBodies){this.hidden.push([body,body.visible]);body.visible=false;}
  const scale=variant.height/(frame.referenceHeight??frame.height);
  this.sprite.material.map=frame.texture;this.sprite.visible=true;
  this.sprite.scale.set(frame.width*scale,frame.height*scale,1);
  this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,.002);
 }
 dispose():void{
  for(const [body,visible] of this.hidden)body.visible=visible;
  this.root.remove(this.sprite);this.sprite.geometry.dispose();this.sprite.material.dispose();this.base.dispose();
 }
}
