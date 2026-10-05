import * as THREE from 'three';
import type { Fighter } from '../../../../packages/game-core/types.js';
import { SpriteIsolation } from './SpriteIsolation.js';
export const gutMovementFrames=[[121,13,354,268],[516,11,672,271],[837,11,1057,269],[1211,11,1429,271],[161,281,320,520],[480,281,688,518],[835,283,1056,520],[1234,339,1434,520],[120,527,354,781],[514,525,672,782],[836,527,1061,780],[1209,527,1428,784],[161,776,321,1018],[480,783,687,1017],[834,777,1063,1018],[1232,835,1430,1018]];
const hips=[231,557,932,1317,207,561,935,1330,231,557,932,1317,207,561,935,1330];
export function gutWalkFrame(frame:number,backward:boolean):number {
 const step=Math.floor(frame/(backward?7:6))%6;
 return backward?(6-step)%6:step;
}
export class GutMovement {
 private texture:THREE.Texture;
 constructor(atlas:THREE.Texture){this.texture=atlas.clone();this.texture.needsUpdate=true;}
 apply(f:Fighter,skin:number,sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>,isolation:SpriteIsolation):boolean {
  const meditation=f.move==='meditation';
  if(!meditation&&(f.move||!f.state.startsWith('Walk')))return false;
  const pose=skin*8+(meditation?7:gutWalkFrame(f.stateFrame,f.state==='WalkBackward'));
  const [l,t,r,b]=gutMovementFrames[pose],w=r-l+2,h=b-t+2;
  // Uniform scale keeps the guard's head-to-floor height stable through each step.
  const scale=1.8/(meditation?gutMovementFrames[skin*8+6][3]-gutMovementFrames[skin*8+6][1]+2:h);
  this.texture.repeat.set(w/1536,h/1024);this.texture.offset.set((l-1)/1536,1-(b+1)/1024);
  sprite.material.map=this.texture;isolation.select(this.texture,gutMovementFrames,pose);
  sprite.scale.set(w*scale,h*scale,1);sprite.position.set(((l+r)/2-hips[pose])*scale,h*scale/2,0);
  return true;
 }
 dispose():void{this.texture.dispose();}
}
