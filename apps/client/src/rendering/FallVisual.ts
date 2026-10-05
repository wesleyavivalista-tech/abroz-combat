import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import type {FighterVisual} from './FighterRenderer.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';

export const fallCatalog:Record<string,{rows:number;height:number;second:string}>={
 fausto:{rows:3,height:1.66,second:'casual'},napa:{rows:2,height:1.76,second:'gym'},
 dodo:{rows:2,height:1.82,second:'black'},jomp:{rows:2,height:1.76,second:'charcoal'},
 tocha:{rows:2,height:1.74,second:'shirtless'},gut:{rows:2,height:1.8,second:'kung-fu'},
 bozo:{rows:3,height:1.64,second:'basketball'},drupa:{rows:3,height:1.75,second:'purple'},
 caio:{rows:3,height:1.75,second:'black'},roms:{rows:3,height:1.81,second:'hoodie'},
 luizinho:{rows:2,height:1.7,second:'black'},
};
export function fallVariant(id:string,skin:string,f:Fighter):{sheet:string;row:number;height:number}|undefined{
 const spec=fallCatalog[id];
 if(!spec||f.state!=='Fall'||f.move)return;
 if(skin!=='original'&&skin!==spec.second&&!(id==='bozo'&&skin==='hair-clone'))return;
 let row=skin===spec.second?1:0,sheet=id,height=spec.height;
 if(id==='fausto'&&f.weaponUntil>0)row=2;
 if(id==='bozo'&&(skin==='hair-clone'||f.armorUntil>0))row=2;
 if(id==='drupa'&&f.weaponUntil>0){sheet='drupa-buda';row=0;height*=3;}
 if(id==='caio'&&f.bloodMasterUntil>0){row=2;if(skin==='black'){sheet='caio-master-black';row=0;}}
 if(id==='roms'&&f.armorUntil>0)row=2;
 if(id==='gut'&&f.weaponUntil>0)sheet='gut-spear';
 return {sheet,row,height};
}
const caches=new Map<string,RetryableAssets<Frame[]>>(),ready=new Map<string,Frame[]>();
export async function loadFallArt(id:string):Promise<void>{
 if(!fallCatalog[id])return;
 const extra:Record<string,string>={gut:'gut-spear',drupa:'drupa-buda',caio:'caio-master-black'};
 await Promise.all((extra[id]?[id,extra[id]]:[id]).map(async key=>{
  const rows=key===id?fallCatalog[id].rows:key==='gut-spear'?2:1;
  let cache=caches.get(key);if(!cache){cache=new RetryableAssets<Frame[]>();caches.set(key,cache);}
  const frames=await cache.get(async own=>{
   const path=key===id?`/art/${id}/fall-v1.png`:`/art/${id}/fall-${key.slice(id.length+1)}-v1.png`;
   const texture=await loadTexture(path);
   texture.colorSpace=THREE.SRGBColorSpace;
   const frames=framesFrom(texture,2,rows,true,true);
   for(let row=0;row<rows;row++){
    frames[row*2+1].referenceHeight=frames[row*2].height;
   }
   frames.forEach(f=>own(f.texture));return frames;
  });ready.set(key,frames);
 }));
}
export function disposeFallArt():void{caches.forEach(c=>c.dispose());caches.clear();ready.clear();}

/** Replace only the neutral falling body. Base updates still drive all mode effects. */
export class FallVisual implements FighterVisual{
 readonly root:THREE.Group;readonly shadow?:THREE.Mesh;
 private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 private glow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,opacity:.18,color:0x70d9ff,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide}));
 private hidden:Array<[THREE.Object3D,boolean]>=[];
 private rage={value:0};
 constructor(private base:FighterVisual,private id:string,private skin:string,private art:ReadonlyMap<string,Frame[]>=ready){
  this.root=base.root;this.shadow=base.shadow;this.sprite.name='neutral-fall';this.sprite.visible=this.glow.visible=false;
  this.root.add(this.glow,this.sprite);
  const rage=this.rage;
  this.sprite.material.onBeforeCompile=shader=>{
   shader.uniforms.fallRage=rage;shader.fragmentShader='uniform float fallRage;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat skin=step(diffuseColor.g*1.35,diffuseColor.r)*step(diffuseColor.b*1.3,diffuseColor.r)*step(.12,diffuseColor.r);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(diffuseColor.r*.9,diffuseColor.g*.25,diffuseColor.b*.3),skin*fallRage);');
  };
 }
 update(f:Fighter,time:number,simulationFrame?:number):void{
  for(const [object,visible] of this.hidden)object.visible=visible;this.hidden=[];
  this.base.update(f,time,simulationFrame);this.sprite.visible=this.glow.visible=false;
  const variant=fallVariant(this.id,this.skin,f);if(!variant)return;
  const frame=this.art.get(variant.sheet)?.[variant.row*2+1];if(!frame||!this.base.fallBodies?.length)return;
  for(const object of this.base.fallBodies){this.hidden.push([object,object.visible]);object.visible=false;}
  const scale=variant.height/frame.referenceHeight!;
  this.sprite.visible=true;this.sprite.material.map=frame.texture;
  this.sprite.material.color.setScalar(this.id==='drupa'&&variant.row===2?.8:1);
  this.rage.value=this.id==='caio'&&f.bloodMasterUntil>0?.75:this.id==='fausto'&&(f.angerUntil??0)>0?Math.min(.85,.65+(f.angerStacks??0)*.025):0;
  this.sprite.scale.set(frame.width*scale,frame.height*scale,1);
  this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,.001);
  if(this.id==='jomp'&&f.weaponUntil>0){
   this.glow.visible=true;this.glow.material.map=frame.texture;this.glow.material.opacity=.15+Math.sin(time*7)*.03;
   this.glow.scale.copy(this.sprite.scale).multiplyScalar(1.045);this.glow.position.copy(this.sprite.position);this.glow.position.z=-.005;
  }
 }
 dispose():void{
  for(const [object,visible] of this.hidden)object.visible=visible;
  for(const mesh of [this.sprite,this.glow]){this.root.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
  this.base.dispose();
 }
}
