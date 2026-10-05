import {animationTick} from './AnimationPlayback.js';
import { updateHairSpear, hairSpearExtension } from './BozoHairSpear.js';
import { AuthoredWalk } from './AuthoredWalk.js';
import { ExpandedAnimation } from './ExpandedAnimation.js';
import { actionMotion } from './ActionMotion.js';
import { BozoWalk } from "./BozoWalk.js";
import { GuardedMovement } from "./GuardedMovement.js";
import { SpriteIsolation } from "./SpriteIsolation.js";
import * as THREE from "three";
import type { Fighter } from "../../../../packages/game-core/types.js";
import { characters } from "../../../../packages/game-core/characters/registry.js";
import type { FighterVisual } from "./FighterRenderer.js";
import { bozoFrames } from "./BozoAtlas.js";
import { worldX } from "./StageCoordinates.js";
import { surfaceBelow } from "../../../../packages/game-core/simulation/StageCollision.js";
import {renderStage as trainingRoom} from "./StageCoordinates.js";
export function bozoPose(f:Fighter):number {
 if(f.move==='spear'){const m=characters.bozo.moves.spear;return f.moveFrame>=8&&f.moveFrame<m.startupFrames+m.activeFrames+16?13:0;}
 if(f.move==='clones'&&f.moveFrame>=4)return 14;
 if(f.move){const m=characters.bozo.moves[f.move];if(f.moveFrame<Math.max(2,m.startupFrames-5)||f.moveFrame>m.startupFrames+m.activeFrames+8)return f.state==='CrouchingAttack'?18:f.state==='AirAttack'?17:0;
 return ({jab:6,cross:7,beard:8,heavy:9,kick:10,crouch:11,air:12,spear:13,grip:14,armor:15,clones:14} as Record<string,number>)[f.move]??0;}
 if(['KO','Knockdown','Respawning'].includes(f.state))return 21;
 if(f.state.includes('HitStun')||f.state==='HairTrapped')return 20;
 if(['Crouch','BlockCrouching','GetUp'].includes(f.state))return 18;
 if(f.state==='BlockStanding')return 19;
 if(['Jump','Fall'].includes(f.state))return 17;
 if(f.state==='Land')return 23;
 if(f.state.startsWith('Dash'))return f.state==='DashForward'?4:5;
 if(f.state.startsWith('Walk'))return 2+Math.floor(Math.abs(f.x)/22)%2;
 return f.state==='MatchWin'?22:0;
}
export class BozoRenderer implements FighterVisual {
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 root=new THREE.Group();shadow:THREE.Mesh;
 private authoredWalk?:AuthoredWalk;
 private authoredCloneWalk?:AuthoredWalk;
 private isolation:SpriteIsolation;
 private expansion?:ExpandedAnimation;
 private cloneExpansion?:ExpandedAnimation;
 private movement?:GuardedMovement;
 private cloneMovement?:GuardedMovement;
 private walk?:BozoWalk;
 private textures:THREE.Texture[];
 private restingGeometry=new THREE.PlaneGeometry(1,1,1,12);
 private spearGeometry=new THREE.PlaneGeometry();
 private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 constructor(atlases:THREE.Texture[],private skin=0,private clone=false,movementAtlas?:THREE.Texture,cloneMovementAtlas?:THREE.Texture,walkAtlas?:THREE.Texture,expansionAtlas?:THREE.Texture,cloneExpansionAtlas?:THREE.Texture,walkTextures?:THREE.Texture[],cloneWalkTextures?:THREE.Texture[]){
  if(walkTextures)this.authoredWalk=new AuthoredWalk(walkTextures,"bozo");
  if(cloneWalkTextures)this.authoredCloneWalk=new AuthoredWalk(cloneWalkTextures,"clone");
  if(expansionAtlas)this.expansion=new ExpandedAnimation(expansionAtlas,"bozo");
  if(cloneExpansionAtlas)this.cloneExpansion=new ExpandedAnimation(cloneExpansionAtlas,"clone");
  if(walkAtlas)this.walk=new BozoWalk(walkAtlas);
  if(cloneMovementAtlas)this.cloneMovement=new GuardedMovement(cloneMovementAtlas,"clone");
  if(movementAtlas)this.movement=new GuardedMovement(movementAtlas,"bozo");
  this.textures=atlases.map(t=>{const c=t.clone();c.needsUpdate=true;return c;});
  this.sprite=new THREE.Mesh(this.restingGeometry,new THREE.MeshBasicMaterial({transparent:true,alphaTest:.2,toneMapped:false,side:THREE.DoubleSide}));this.root.add(this.sprite);
  this.isolation=new SpriteIsolation(this.sprite.material);
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.43,24),new THREE.MeshBasicMaterial({color:0x15121a,transparent:true,opacity:.22,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter,_time:number):void {
  const hairy=this.clone||f.armorUntil>0;
  const key=hairy?'clone':this.skin?'2':'1';const frames=bozoFrames[key],pose=bozoPose(f);
  const [l,t,r,b]=frames[pose];const w=r-l+2,h=b-t+2;const texture=this.textures[hairy?2:this.skin];
  texture.repeat.set(w/1536,h/1024);texture.offset.set((l-1)/1536,1-(b+1)/1024);this.sprite.material.map=texture;this.isolation.select(texture,frames,pose);
  const scale=1.64/(frames[0][3]-frames[0][1]);
  const pivot=[.5,.5,.5,.5,.48,.5,.4,.4,.32,.36,.3,.35,.35,.32,.35,.5,.5,.5,.5,.5,.5,.5,.5,.5][pose];
  this.sprite.scale.set(w*scale,h*scale,1);this.sprite.position.set(((l+r)/2-(l+(r-l)*pivot))*scale,(h/2)*scale,0);
  this.sprite.geometry=pose===13?this.spearGeometry:this.restingGeometry;
  if(pose===13){
   const move=characters.bozo.moves.spear;
   const reach=(move.hitboxes[0].x+move.hitboxes[0].w)/100;
   const tip=(r-(l+(r-l)*pivot))*scale;
   const extension=Math.max(0,reach-tip)*hairSpearExtension(f.moveFrame,move.startupFrames,move.activeFrames);
   updateHairSpear(this.spearGeometry,l-1,w,extension/scale,hairy?510:450,(b+1-(hairy?674:this.skin?654:621))/h,(b+1-(hairy?630:this.skin?607:580))/h);
  }

  // A tiny chest lift, weighted above the knees: shoes remain fixed to the floor.
  const positions=this.restingGeometry.attributes.position;
  for(let row=0;row<=12;row++)for(let col=0;col<=1;col++){
   const y=.5-row/12;const breath=f.state==='Idle'&&!f.move?Math.sin(animationTick(f)*Math.PI/60)*.006*Math.max(0,(y+.5-.35)/.65):0;
   positions.setY(row*2+col,y+breath);
  }
  positions.needsUpdate=true;
  if(hairy)this.cloneMovement?.apply(f,this.skin,this.sprite,this.isolation);
  else if(!this.walk?.apply(f,this.skin,this.sprite,this.isolation))this.movement?.apply(f,this.skin,this.sprite,this.isolation);
  (hairy?this.cloneExpansion:this.expansion)?.apply(f,this.skin,this.sprite,this.isolation);
  (hairy?this.authoredCloneWalk:this.authoredWalk)?.apply(f,this.skin,this.sprite,this.isolation);
  const motion=actionMotion(f,f.move?characters.bozo.moves[f.move]:undefined);
  this.sprite.position.x+=motion.x;this.sprite.rotation.z=motion.angle;
  this.root.position.set(worldX(f.x),f.y/100,.1);this.root.scale.x=f.facing;
  this.shadow.position.set(worldX(f.x),surfaceBelow(trainingRoom,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose():void{this.authoredWalk?.dispose();this.authoredCloneWalk?.dispose();this.expansion?.dispose();this.cloneExpansion?.dispose();this.walk?.dispose();this.cloneMovement?.dispose();this.movement?.dispose();this.textures.forEach(t=>t.dispose());this.restingGeometry.dispose();this.spearGeometry.dispose();this.sprite.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();}
}
