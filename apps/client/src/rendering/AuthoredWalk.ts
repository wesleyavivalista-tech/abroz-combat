import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {SpriteIsolation,prepareSpriteIsolation} from './SpriteIsolation.js';
import {walkAtlases,type WalkCharacter} from './WalkAtlas.js';
export function authoredWalkFrame(f:Fighter):number|null {
 if(f.move||!['WalkForward','WalkBackward'].includes(f.state))return null;
 const phase=Math.floor(f.stateFrame/(f.state==='WalkBackward'?8:7))%4;
 return f.state==='WalkBackward'?(4-phase)%4:phase;
}
export function prepareWalkTextures(textures:THREE.Texture[],kind:WalkCharacter):void {
 const data=walkAtlases[kind];textures.forEach((t,i)=>prepareSpriteIsolation(t,data.frames.filter(f=>f.atlas===i).map(f=>f.bounds)));
}
/** Full drawn poses only: no skeletal deformation, vertex edits, or limb stretching. */
export class AuthoredWalk {
 private textures:THREE.Texture[];
 private selections: {bounds: readonly number[][];index:number}[];
 constructor(atlases:THREE.Texture[],private kind:WalkCharacter){
  const frames=walkAtlases[kind].frames;
  this.selections=frames.map(frame=>{const source=frames.filter(f=>f.atlas===frame.atlas);return {bounds:source.map(f=>f.bounds),index:source.indexOf(frame)};});
  this.textures=atlases.map(atlas=>{const t=atlas.clone();t.needsUpdate=true;return t;});}
 apply(f:Fighter,skin:number,sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>,isolation:SpriteIsolation):boolean {
  const phase=authoredWalkFrame(f);if(phase===null)return false;
  const data=walkAtlases[this.kind],frame=data.frames[(this.kind==='clone'?0:skin)*4+phase];
  const [l,t,r,b]=frame.bounds,w=r-l+2,h=b-t+2,source=data.sources[frame.atlas],texture=this.textures[frame.atlas];
  const scale=data.height/frame.height;
  texture.repeat.set(w/source.width,h/source.height);texture.offset.set((l-1)/source.width,1-(b+1)/source.height);
  sprite.material.map=texture;
  const selection=this.selections[(this.kind==='clone'?0:skin)*4+phase];isolation.select(texture,selection.bounds,selection.index);
  sprite.scale.set(w*scale,h*scale,1);sprite.position.set(((l+r)/2-frame.pivot)*scale,h*scale/2,0);
  return true;
 }
 dispose():void{this.textures.forEach(t=>t.dispose());}
}
