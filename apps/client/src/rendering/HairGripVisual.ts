import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {inLove} from '../../../../packages/game-core/simulation/EideSystem.js';
import type {FighterVisual} from './FighterRenderer.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import {worldX} from './StageCoordinates.js';

export const hairGripCatalog:Record<string,{rows:number;height:number;extras?:Record<string,number>}>= {
 nikalz:{rows:2,height:1.78},jopa:{rows:2,height:1.76},
 biel:{rows:2,height:1.76,extras:{angel:1}},eide:{rows:2,height:1.76,extras:{love:2,mutant:1}},
 astolfo:{rows:2,height:1.6},fausto:{rows:3,height:1.66},napa:{rows:2,height:1.76},
 jomp:{rows:2,height:1.76},dodo:{rows:2,height:1.82},tocha:{rows:2,height:1.74},
 gut:{rows:2,height:1.8,extras:{spear:2}},bozo:{rows:3,height:1.64},
 drupa:{rows:3,height:1.75,extras:{buda:1}},caio:{rows:3,height:1.75,extras:{'master-black':1}},
 roms:{rows:3,height:1.81},luizinho:{rows:2,height:1.7},
};
/** Presentation only: the authoritative deadline controls the struggle and release. */
export function hairGripPose(f:Fighter,simulationFrame:number):number|null {
 const remaining=f.trappedUntil-simulationFrame;
 if(remaining<=0||f.health<=0||f.lives<=0||f.respawnAt||f.state!=='HairTrapped')return null;
 if(remaining<=8)return 5;
 if(remaining<=20)return 4;
 const elapsed=Math.max(0,characters.bozo.moves.grip.trapFrames!-remaining);
 return elapsed<12?1:2+Math.floor((elapsed-12)/12)%2;
}
export function hairGripVariant(id:string,skin:string,f:Fighter):{sheet:string;row:number;height:number}|undefined {
 const spec=hairGripCatalog[id];if(!spec||f.undead||f.loveNpc||f.jopaSummon||f.jopaTree!==undefined||f.jopaRide!==undefined)return;
 const second=characters[id].skins?.[1]?.id;
 const personality=id==='astolfo'&&/^(sad|angry)(-casual)?$/.test(skin);
 if(skin!=='original'&&skin!==second&&!personality&&!(id==='bozo'&&skin==='hair-clone'))return;
 let row=skin===second||personality&&skin.endsWith('-casual')?1:0,sheet=id,height=spec.height;
 if(id==='fausto'&&f.weaponUntil>0)row=2;
 if(id==='bozo'&&(skin==='hair-clone'||f.armorUntil>0))row=2;
 if(id==='roms'&&f.armorUntil>0)row=2;
 if(id==='gut'&&f.weaponUntil>0)sheet='gut-spear';
 if(id==='drupa'&&f.weaponUntil>0){sheet='drupa-buda';row=0;height*=3;}
 if(id==='caio'&&f.bloodMasterUntil>0){row=2;if(skin===second){sheet='caio-master-black';row=0;}}
 if(id==='biel'&&f.angelUntil){sheet='biel-angel';row=0;height=2.25;}
 if(id==='eide'){
  if(f.weaponUntil){sheet='eide-mutant';row=0;height=3.52;}
  else if(inLove(f))sheet='eide-love';
 }
 return {sheet,row,height};
}
export function hairGripPath(key:string):string {
 const [id,...form]=key.split('-');return `/art/${id}/hair-grip${form.length?'-'+form.join('-'):''}-v1.png`;
}
const caches=new Map<string,RetryableAssets<Frame[]>>(),ready=new Map<string,Frame[]>();
export async function loadHairGripArt(id:string):Promise<void>{
 const spec=hairGripCatalog[id];if(!spec)return;
 await Promise.all([[id,spec.rows] as const,...Object.entries(spec.extras??{}).map(([form,rows])=>[`${id}-${form}`,rows] as const)].map(async([key,rows])=>{
  let cache=caches.get(key);if(!cache){cache=new RetryableAssets<Frame[]>();caches.set(key,cache);}
  const frames=await cache.get(async own=>{
   const texture=await loadTexture(hairGripPath(key));texture.colorSpace=THREE.SRGBColorSpace;
   const frames=framesFrom(texture,6,rows,true,true);
   for(let row=0;row<rows;row++)for(const frame of frames.slice(row*6,row*6+6))frame.referenceHeight=frames[row*6].height;
   frames.forEach(frame=>own(frame.texture));return frames;
  });ready.set(key,frames);
 }));
}
export function disposeHairGripArt():void{caches.forEach(cache=>cache.dispose());caches.clear();ready.clear();}

/** A separate atlas extends each fighter without changing any existing frame mappings. */
export class HairGripVisual implements FighterVisual {
 readonly root=new THREE.Group();readonly shadow?:THREE.Mesh;
 private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 private tint={value:0};
 constructor(private base:FighterVisual,private id:string,private skin:string,private art:ReadonlyMap<string,Frame[]>=ready){
  this.shadow=base.shadow;this.sprite.name='hair-grip-body';this.sprite.visible=false;this.root.add(base.root,this.sprite);
  const tint=this.tint;
  this.sprite.material.onBeforeCompile=shader=>{
   shader.uniforms.gripTint=tint;shader.fragmentShader='uniform float gripTint;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat skin=step(.12,diffuseColor.r)*step(diffuseColor.g*1.5,diffuseColor.r)*step(diffuseColor.b*1.3,diffuseColor.r);vec3 hue=gripTint<0.?vec3(.32,.55,1.):vec3(1.,.19,.12);diffuseColor.rgb=mix(diffuseColor.rgb,hue*max(.3,diffuseColor.r),skin*abs(gripTint));');
  };
 }
 update(f:Fighter,time:number,simulationFrame?:number):void {
  this.root.position.set(0,0,0);this.root.rotation.set(0,0,0);
  this.base.root.visible=true;
  this.base.update(f.state==='HairTrapped'?{...f,state:'HitStunStanding'}:f,time,simulationFrame);
  this.sprite.visible=false;this.root.userData.hairGripActive=false;
  const pose=hairGripPose(f,simulationFrame??f.trappedUntil-characters.bozo.moves.grip.trapFrames!+f.stateFrame);
  const variant=hairGripVariant(this.id,this.skin,f);if(pose===null||!variant)return;
  const frame=this.art.get(variant.sheet)?.[variant.row*6+pose];if(!frame)return;
  this.base.root.visible=false;this.sprite.visible=true;this.root.userData.hairGripActive=true;
  const scale=variant.height/frame.referenceHeight!;
  this.sprite.material.map=frame.texture;
  this.tint.value=this.id==='astolfo'?(f.personality==='sad'?-.7:f.personality==='angry'?.7:0):this.id==='fausto'&&(f.angerUntil??0)>0?.7:0;
  this.sprite.scale.set(f.facing*frame.width*scale,frame.height*scale,1);
  this.sprite.position.set(worldX(f.x)+f.facing*(frame.width/2-frame.pivot)*scale,f.y/100+frame.height*scale/2,.12);
 }
 dispose():void{this.base.root.visible=true;this.root.remove(this.sprite,this.base.root);this.sprite.geometry.dispose();this.sprite.material.dispose();this.base.dispose();}
}
