import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import type {FighterVisual} from './FighterRenderer.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import {worldX} from './StageCoordinates.js';
export const mountedCatalog=[['astolfo','fausto','napa','jomp'],['dodo','luizinho','roms','caio'],['drupa','gut','bozo','tocha'],['biel'],['eide'],['nikalz']];
const heights:Record<string,number>={nikalz:1.78,astolfo:1.6,fausto:1.66,napa:1.76,jomp:1.76,dodo:1.82,luizinho:1.7,roms:1.81,caio:1.75,drupa:1.75,gut:1.8,bozo:1.64,tocha:1.74};
const caches=new Map<number,RetryableAssets<Frame[]>>(),ready=new Map<string,Frame[]>();
export async function loadMountedArt(id:string):Promise<void>{
 // Bozo has a dedicated corrected pair. Other riders keep their shared atlas.
 if(id==='bozo'){
  const key=mountedCatalog.length;let cache=caches.get(key);if(!cache){cache=new RetryableAssets<Frame[]>();caches.set(key,cache);}
  const frames=await cache.get(async own=>{const texture=await loadTexture('/art/bozo/model-mounted-v1.png');texture.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(texture,2,1,true,true);frames.forEach(f=>own(f.texture));return frames;});
  ready.set(id,frames);return;
 }
 const group=mountedCatalog.findIndex(ids=>ids.includes(id));if(group<0)return;
 let cache=caches.get(group);if(!cache){cache=new RetryableAssets<Frame[]>();caches.set(group,cache);}
 const frames=await cache.get(async own=>{const texture=await loadTexture(group===5?'/art/nikalz/mounted-v2.png':group===4?'/art/eide/mounted-v2.png':group===3?'/art/biel/mounted-v3.png':`/art/jopa/mounted-${['a','b','c'][group]}-v2.png`);texture.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(texture,group>=3?2:4,group>=3?1:2,true,true);frames.forEach(f=>own(f.texture));return frames;});
 // Loading Gut/Drupa/Tocha later must not replace Bozo with the old shared pair.
 mountedCatalog[group].forEach((id,i)=>{if(id!=='bozo')ready.set(id,frames.slice(i*2,i*2+2));});
}
export function disposeMountedArt(){caches.forEach(c=>c.dispose());caches.clear();ready.clear();}
/** An authored seated silhouette for every roster skin, shared by any allied knight. */
export class MountedVisual implements FighterVisual{
 root=new THREE.Group();readonly shadow?:THREE.Mesh;
 private rider=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 constructor(private base:FighterVisual,private id:string,private skin:string){this.shadow=base.shadow;this.root.add(base.root,this.rider);this.rider.visible=false;}
 update(f:Fighter,time:number,simulationFrame?:number):void{
  // Scene-level grab posing must not survive release, knockout or respawn.
  // The child renderer supplies world coordinates; this wrapper stays at identity.
  this.root.position.set(0,0,0);this.root.rotation.set(0,0,0);
  this.base.update(f,time,simulationFrame);const mounted=f.jopaRide!==undefined,frames=ready.get(this.id),frame=frames?.[this.skin===characters[this.id].skins?.[1]?.id?1:0];
  this.base.root.visible=!mounted;this.rider.visible=mounted&&!!frame;
  if(mounted&&frame){const h=(heights[this.id]??1.76)*.98;this.rider.material.map=frame.texture;this.rider.scale.set(f.facing*h*frame.width/frame.height,h,1);this.rider.position.set(worldX(f.x)+f.facing*(frame.width/2-frame.pivot)*h/frame.height,f.y/100+.81-h*.47+h/2,.22);if(this.shadow)this.shadow.visible=false;}
 }
 dispose(){this.base.dispose();this.rider.geometry.dispose();this.rider.material.dispose();}
}
