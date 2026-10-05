import * as THREE from "three";
import type { Fighter } from "../../../../packages/game-core/types.js";
import { SpriteIsolation } from "./SpriteIsolation.js";

const frames=[[19,67,300,488],[297,66,490,488],[527,65,724,487],[754,65,1029,486],[1048,65,1245,488],[1293,65,1496,487],[18,530,301,952],[297,530,495,951],[539,530,740,951],[763,530,1050,952],[1063,530,1262,951],[1309,530,1509,951]];
// Anchor the hips, rather than the changing silhouette of the extended shoes.
const pivots=[139,382,616,868,1136,1380,139,383,626,890,1150,1400];
/** Authored from the standing sprites; one uniform scale per skin, no stretching. */
export class BozoWalk {
  private texture:THREE.Texture;
  constructor(atlas:THREE.Texture){this.texture=atlas.clone();this.texture.needsUpdate=true;}
  apply(f:Fighter,skin:number,sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>,isolation:SpriteIsolation):boolean{
    if(f.move || !['WalkForward','WalkBackward'].includes(f.state))return false;
    const backward=f.state==='WalkBackward';
    const step=Math.floor(f.stateFrame/(backward?6:5))%6;
    const pose=skin*6+(backward?(6-step)%6:step);
    const [l,t,r,b]=frames[pose],width=r-l+2,height=b-t+2;
    const scale=1.64/420;
    this.texture.repeat.set(width/1536,height/1024);this.texture.offset.set((l-1)/1536,1-(b+1)/1024);
    sprite.material.map=this.texture;isolation.select(this.texture,frames,pose);
    sprite.scale.set(width*scale,height*scale,1);
    sprite.position.set(((l+r)/2-pivots[pose])*scale,height*scale/2,0);
    return true;
  }
  dispose():void{this.texture.dispose();}
}
