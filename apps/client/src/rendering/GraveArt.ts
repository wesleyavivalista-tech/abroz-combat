import * as THREE from 'three';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {loadTexture} from './TextureCache.js';
import {RetryableAssets} from './RetryableAssets.js';
import {GRAVE_HP,ZOMBIE_RISE_FRAMES} from '../../../../packages/game-core/simulation/UndeadSystem.js';
const cache=new RetryableAssets<Frame[]>();
let ready:Frame[]|undefined;
export function graveDamagePose(health:number,rising:boolean,age:number):number{
 if(rising)return age<10?3:age<24?4:5;
 const damage=1-health/GRAVE_HP;
 return damage>.72?3:damage>.48?2:damage>.22?1:0;
}
export function graveRubbleOpacity(age:number):number{return Math.max(0,Math.min(1,(ZOMBIE_RISE_FRAMES-age)/18));}
export async function loadGraveArt():Promise<void>{
 ready=await cache.get(async own=>{
  const [intact]=framesFrom(await loadTexture('/art/zombies/grave-cross-v1.png'),1,1);own(intact.texture);
  const sheet=await loadTexture('/art/zombies/grave-break-v1.png');
  const image=sheet.image as HTMLImageElement,source=document.createElement('canvas');source.width=image.width;source.height=image.height;
  const context=source.getContext('2d')!;context.drawImage(image,0,0);
  const poses:Frame[]=[];
  // Fixed cells retain ALL disconnected chips; silhouette isolation would discard debris.
  for(let i=0;i<6;i++){
   const x=Math.floor(i%3*image.width/3),y=Math.floor(Math.floor(i/3)*image.height/2);
   const w=Math.floor((i%3+1)*image.width/3)-x,h=Math.floor((Math.floor(i/3)+1)*image.height/2)-y;
   const data=context.getImageData(x,y,w,h);let left=w,right=0,top=h,bottom=0;
   for(let p=0;p<w*h;p++)if(data.data[p*4+3]>=32){left=Math.min(left,p%w);right=Math.max(right,p%w);top=Math.min(top,Math.floor(p/w));bottom=Math.max(bottom,Math.floor(p/w));}else data.data[p*4+3]=0;
   if(left>right)throw new Error(`Empty grave damage frame ${i}`);
   const canvas=document.createElement('canvas');canvas.width=right-left+1;canvas.height=bottom-top+1;
   canvas.getContext('2d')!.putImageData(data,-left,-top);
   const texture=own(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
   poses.push({texture,width:canvas.width,height:canvas.height,pivot:w/2-left});
  }
  const reference=poses[0].height;
  poses.forEach(f=>f.referenceHeight=reference);
  // Keep the approved healthy tomb; scale damaged sheets from their own intact reference.
  intact.referenceHeight=intact.height;return [intact,...poses.slice(1)];
 });
}
export const graveArt=()=>ready;
export function disposeGraveArt():void{cache.dispose();ready=undefined;}
