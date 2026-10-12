import {framesFrom} from '../../rendering/DodoRenderer.js';
import {loadTexture} from '../../rendering/TextureCache.js';
import * as THREE from 'three';
import {RomsRenderer,hoseBounds} from '../../rendering/RomsRenderer.js';
import {romsSheets} from '../../rendering/RomsAtlas.js';
import {prepareSpriteIsolation} from '../../rendering/SpriteIsolation.js';
import {validateAnimationManifest} from '../../rendering/AnimationContract.js';
import type {FighterVisual} from '../../rendering/FighterRenderer.js';
export async function loadRomsPresentation(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void):Promise<void>{
 const required=['spin','dash','juggle'];
 const manifest={frameCount:12,actions:{spin:[0,1,2,3],dash:[4,5,6,7],juggle:[8,9,10,11]}};
 validateAnimationManifest(manifest,required);
 const textures=await Promise.all(['movement','combat-1','combat-2','gear','juggling','return-walk','motion-1-v2','motion-2-v2','motion-gear-v2','combat-gear-v2'].map(async(name,i)=>{
  const t=await loadTexture(`/art/roms/${name}.png`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;
  prepareSpriteIsolation(t,romsSheets[i].frames);return t;
 }));
 const hose=await Promise.all(['hose-directions-v1','hose-inbetweens-v1'].map(async name=>{
  const t=await loadTexture(`/art/roms/${name}.png`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;prepareSpriteIsolation(t,hoseBounds);return t;
 }));
 const lowTexture=await loadTexture('/art/roms/crouch-attack-v1.png');lowTexture.colorSpace=THREE.SRGBColorSpace;
 const lowFrames=framesFrom(lowTexture,2,3,true,true);
 for(let row=0;row<3;row++)lowFrames[row*2+1].referenceHeight=lowFrames[row*2].height;
 register('roms',()=>new RomsRenderer(textures,0,lowFrames,hose));register('roms',()=>new RomsRenderer(textures,1,lowFrames,hose),'hoodie');
}
