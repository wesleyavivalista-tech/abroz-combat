import {validateAtlasFrames} from './AnimationContract.js';
import * as THREE from "three";
export type SpriteBounds = readonly (readonly number[])[];
/** Label connected opaque artwork, not grid cells: limbs can cross cell boundaries. */
export function labelSpritePixels(alpha: Uint8Array, width: number, height: number, bounds: SpriteBounds): Uint8Array {
  const owners=new Uint8Array(width*height),seen=new Uint8Array(width*height),queue=new Int32Array(width*height);
  for(let start=0;start<alpha.length;start++) {
    if(seen[start]||alpha[start]<51)continue;
    let head=0,tail=1;queue[0]=start;seen[start]=1;
    let left=width,top=height,right=0,bottom=0;
    while(head<tail){
      const p=queue[head++],x=p%width,y=Math.floor(p/width);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const q of [x>0?p-1:-1,x<width-1?p+1:-1,y>0?p-width:-1,y<height-1?p+width:-1]) {
        if(q>=0&&!seen[q]&&alpha[q]>=51){seen[q]=1;queue[tail++]=q;}
      }
    }
    // The owning pose contains the whole component; adjacent crops contain only a sliver.
    let owner=-1,best=-Infinity;
    bounds.forEach(([l,t,r,b],i)=>{
      const overlap=Math.max(0,Math.min(right,r)-Math.max(left,l)+1)*Math.max(0,Math.min(bottom,b)-Math.max(top,t)+1);
      if(!overlap)return;
      const coverage=overlap/((right-left+1)*(bottom-top+1));
      const distance=Math.abs((left+right-l-r)/2)/Math.max(1,r-l)+Math.abs((top+bottom-t-b)/2)/Math.max(1,b-t);
      const score=coverage*100-distance;
      if(score>best){best=score;owner=i;}
    });
    if(owner>=0)for(let i=0;i<tail;i++)owners[queue[i]]=owner+1;
  }
  return owners;
}
let cache=new WeakMap<object,THREE.DataTexture>();
const ownedMasks=new Set<THREE.DataTexture>();
export function disposeSpriteMasks():void{ownedMasks.forEach(t=>t.dispose());ownedMasks.clear();cache=new WeakMap();}
function maskFor(texture:THREE.Texture,bounds:SpriteBounds):THREE.DataTexture|undefined {
  const image=texture.image as HTMLImageElement|undefined;
  if(!image||!image.width||typeof document==='undefined')return;
  validateAtlasFrames(bounds,image.width,image.height);
  const existing=cache.get(image);if(existing)return existing;
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(image,0,0);
  const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
  const alpha=Uint8Array.from({length:canvas.width*canvas.height},(_,i)=>rgba[i*4+3]);
  const labels=labelSpritePixels(alpha,canvas.width,canvas.height,bounds);
  const mask=new THREE.DataTexture(labels,canvas.width,canvas.height,THREE.RedFormat);
  mask.flipY=true;mask.magFilter=mask.minFilter=THREE.NearestFilter;mask.generateMipmaps=false;mask.needsUpdate=true;
  ownedMasks.add(mask);cache.set(image,mask);return mask;
}
/** Build ownership during loading, not on the first punch or clone footstep. */
export function prepareSpriteIsolation(texture:THREE.Texture,bounds:SpriteBounds):void { maskFor(texture,bounds); }
/** Per-instance uniforms keep shared atlas ownership safe in mirror matches and rollback. */
export class SpriteIsolation {
  private mask={value:null as THREE.Texture|null};
  private pose={value:0};
  private enabled={value:0};
  constructor(material:THREE.MeshBasicMaterial){
    material.onBeforeCompile=shader=>{
      shader.uniforms.spriteOwnerMask=this.mask;shader.uniforms.spriteOwner=this.pose;shader.uniforms.spriteIsolationEnabled=this.enabled;
      shader.fragmentShader='uniform sampler2D spriteOwnerMask; uniform float spriteOwner; uniform float spriteIsolationEnabled;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        #ifdef USE_MAP
        if(spriteIsolationEnabled > 0.5 && abs(floor(texture2D(spriteOwnerMask,vMapUv).r*255.0+0.5)-spriteOwner)>0.5) discard;
        #endif`);
    };
    material.customProgramCacheKey=()=>"isolated-sprite-v1";
  }
  select(texture:THREE.Texture,bounds:SpriteBounds,pose:number):void {
    const mask=maskFor(texture,bounds);this.mask.value=mask??null;this.pose.value=pose+1;this.enabled.value=mask?1:0;
  }
}
