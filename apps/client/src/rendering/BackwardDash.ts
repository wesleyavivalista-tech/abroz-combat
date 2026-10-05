import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {loadTexture} from './TextureCache.js';
import {RetryableAssets} from './RetryableAssets.js';
/** Load, retreat, catch: presentation follows simulation frames, never wall time. */
export function backwardDashPose(f:Fighter):number|null{
 if(f.move||f.state!=='DashBackward'||f.jopaRide!==undefined||f.jopaTree!==undefined)return null;
 return f.stateFrame<2?0:f.stateFrame<9?1:2;
}
const cache=new RetryableAssets<Frame[]>();
export async function loadBackwardDashArt():Promise<Frame[]>{
 return cache.get(async own=>{
  const texture=await loadTexture('/art/shared/astolfo-jopa-backdash-v1.png');texture.colorSpace=THREE.SRGBColorSpace;
  const frames=framesFrom(texture,3,4,true,true);
  frames.forEach((f,i)=>{f.referenceHeight=frames[Math.floor(i/3)*3].height;own(f.texture);});
  return frames;
 });
}
export function disposeBackwardDashArt(){cache.dispose();}
