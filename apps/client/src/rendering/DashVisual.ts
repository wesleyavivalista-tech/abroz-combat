import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import type {FighterVisual} from './FighterRenderer.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';

const catalog:Record<string,{path:string;rows:number;height:number}>={
 fausto:{path:'fausto/dash-v1',rows:3,height:1.66},
 napa:{path:'napa/dash-v1',rows:2,height:1.76},
 dodo:{path:'dodo/dash-v1',rows:2,height:1.82},
 companions:{path:'dodo/companions-dash-v1',rows:3,height:1.86},
 monster:{path:'napa/monster-dash-v1',rows:1,height:3.1},
};
export function dashVariant(id:string,skin:string,f:Fighter){
 if(f.move||!['DashForward','DashBackward'].includes(f.state))return;
 let key=id,row=0;
 if(id==='fausto')row=f.weaponUntil>0?2:skin==='casual'?1:0;
 else if(id==='napa'){if(skin==='cookie-monster')key='monster';else row=skin==='gym'?1:0;}
 else if(id==='dodo'){if(/^pain-killer-[012]$/.test(skin)){key='companions';row=Number(skin.slice(-1));}else return;}
 else return;
 return {key,row,pose:f.state==='DashForward'?1:2,height:catalog[key].height};
}
const caches=new Map<string,RetryableAssets<Frame[]>>(),ready=new Map<string,Frame[]>();
export async function loadDashArt(id:string){
 const keys=id==='napa'?['napa','monster']:id==='dodo'?['dodo','companions']:id==='fausto'?['fausto']:[];
 await Promise.all(keys.map(async key=>{
  let cache=caches.get(key);if(!cache){cache=new RetryableAssets<Frame[]>();caches.set(key,cache);}
  ready.set(key,await cache.get(async own=>{
   const spec=catalog[key],texture=await loadTexture('/art/'+spec.path+'.png');texture.colorSpace=THREE.SRGBColorSpace;
   const frames=framesFrom(texture,3,spec.rows,true,true);
   frames.forEach((f,i)=>{f.referenceHeight=frames[Math.floor(i/3)*3].height;own(f.texture);});return frames;
  }));
 }));
}
export function disposeDashArt(){caches.forEach(c=>c.dispose());caches.clear();ready.clear();}
/** Preserve base effects and replace only the body during neutral dashes. */
export class DashVisual implements FighterVisual{
 readonly root:THREE.Group;readonly shadow?:THREE.Mesh;
 private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 private hidden:Array<[THREE.Object3D,boolean]>=[];private rage={value:0};
 get fallBodies(){return [...(this.base.fallBodies??[]),this.sprite];}
 constructor(private base:FighterVisual,private id:string,private skin:string,private art:ReadonlyMap<string,Frame[]>=ready){
  this.root=base.root;this.shadow=base.shadow;this.sprite.name='dedicated-dash';this.sprite.visible=false;this.root.add(this.sprite);
  const rage=this.rage;this.sprite.material.onBeforeCompile=shader=>{
   shader.uniforms.dashRage=rage;shader.fragmentShader='uniform float dashRage;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat skin=step(.12,diffuseColor.r)*step(diffuseColor.g*1.35,diffuseColor.r)*step(diffuseColor.b*1.3,diffuseColor.r);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(diffuseColor.r*.9,diffuseColor.g*.25,diffuseColor.b*.3),skin*dashRage);');
  };
 }
 update(f:Fighter,time:number,simulationFrame?:number){
  for(const [o,v] of this.hidden)o.visible=v;this.hidden=[];
  this.base.update(f,time,simulationFrame);this.sprite.visible=false;
  const variant=dashVariant(this.id,this.skin,f);if(!variant)return;
  const frame=this.art.get(variant.key)?.[variant.row*3+variant.pose];if(!frame)return;
  for(const o of this.base.fallBodies??[]){this.hidden.push([o,o.visible]);o.visible=false;}
  const scale=variant.height/frame.referenceHeight!;
  this.sprite.visible=true;this.sprite.material.map=frame.texture;
  this.rage.value=this.id==='fausto'&&(f.angerUntil??0)>0?Math.min(.85,.65+(f.angerStacks??0)*.025):0;
  this.sprite.scale.set(frame.width*scale,frame.height*scale,1);
  this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,.002);
 }
 dispose(){for(const [o,v] of this.hidden)o.visible=v;this.root.remove(this.sprite);this.sprite.geometry.dispose();this.sprite.material.dispose();this.base.dispose();}
}
