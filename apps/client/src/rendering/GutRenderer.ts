import {animationTick} from './AnimationPlayback.js';
import {renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
import { AuthoredWalk } from './AuthoredWalk.js';
import { ExpandedAnimation } from './ExpandedAnimation.js';
import { actionMotion, attackPhase } from './ActionMotion.js';
import { GutSpearVisual } from './GutSpearVisual.js';
import { GutMovement } from './GutMovement.js';
import * as THREE from 'three';
import type { Fighter } from '../../../../packages/game-core/types.js';
import { characters } from '../../../../packages/game-core/characters/registry.js';
import { SpriteIsolation } from './SpriteIsolation.js';
import { gutFrames } from './GutAtlas.js';
import { worldX } from './StageCoordinates.js';
import type { FighterVisual } from './FighterRenderer.js';
export function gutPose(f:Fighter):number {
 if(f.state==='BlockStanding')return 16;
 if(f.state==='Grappling')return 16;
 if(f.state==='Grappled'||f.state.includes('HitStun')||f.state==='HairTrapped')return 21;
 if(['KO','Knockdown','Respawning'].includes(f.state))return 22;
 if(f.move==='spearThrow')return 15;
 if(f.move){if(f.move==='immortal')return 18;
  const m=characters.gut.moves[f.move];
  if(['palm','cross','finish','axe','swing'].includes(f.move)&&attackPhase(f.moveFrame,m)==='guard')return 0;
  if(f.move==='axe')return f.moveFrame<m.startupFrames?10:11;
  if(f.moveFrame<Math.max(2,m.startupFrames-5))return 0;
  return ({palm:7,cross:8,finish:9,swing:12,crouch:13,air:14,hug:15,meditation:23,panda:23} as Record<string,number>)[f.move]??0;
 }
 if(f.state.startsWith('Walk')){const step=Math.floor(f.stateFrame/6)%4;return 1+(f.state==='WalkBackward'?(4-step)%4:step);}
 if(f.state.startsWith('Dash'))return f.state==='DashForward'?5:6;
 if(['Jump','Fall','JumpStartup'].includes(f.state))return 20;
 if(f.state.includes('Crouch')||f.state==='Land')return 19;
 return f.state==='MatchWin'?23:0;
}
export class GutRenderer implements FighterVisual {
 get fallBodies():THREE.Object3D[]{return [this.sprite,this.spear.root];}
 root=new THREE.Group();shadow:THREE.Mesh;
 private authoredWalk?:AuthoredWalk;
 private textures:THREE.Texture[];
 private movement:GutMovement;
 private plainGeometry=new THREE.PlaneGeometry(1,1);
 private spear:GutSpearVisual;
 private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private isolation:SpriteIsolation;
 private expansion?:ExpandedAnimation;
 private cross=new THREE.Group();
 constructor(atlases:THREE.Texture[],private skin=0,expansionAtlas?:THREE.Texture,walkTextures?:THREE.Texture[],spearWalkTextures?:THREE.Texture[]){
  if(walkTextures)this.authoredWalk=new AuthoredWalk(walkTextures,"gut");
  if(expansionAtlas)this.expansion=new ExpandedAnimation(expansionAtlas,"gut");
  this.movement=new GutMovement(atlases[2]);
  this.spear=new GutSpearVisual(atlases[3],atlases[4],spearWalkTextures);
  this.textures=atlases.map(t=>{const v=t.clone();v.needsUpdate=true;return v;});
  this.sprite=new THREE.Mesh(this.plainGeometry,new THREE.MeshBasicMaterial({transparent:true,alphaTest:.2,toneMapped:false,side:THREE.DoubleSide}));this.isolation=new SpriteIsolation(this.sprite.material);this.root.add(this.sprite,this.cross,this.spear.root);
  for(const glow of [true,false])for(const horizontal of [true,false]){
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(horizontal?1.25:.18,horizontal?.18:2.1),new THREE.MeshBasicMaterial({color:glow?'#ffb84b':'#fff9cc',transparent:true,opacity:glow?.25:.95,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));mesh.position.set(0,horizontal?1.45:1,-.08);if(glow)mesh.scale.set(1.3,1.3,1);this.cross.add(mesh);
  }
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.45,24),new THREE.MeshBasicMaterial({color:0x15121a,transparent:true,opacity:.22,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter,_time:number):void{
  const base=gutPose(f);
  const weapon=f.weaponUntil>0&&!['KO','Knockdown','Respawning','Grappled','Grappling','HairTrapped'].includes(f.state)&&!f.state.includes('HitStun')&&(!f.move||['thrust','sweep','spearFinish','spearHeavy','spearSwing','spearLow','spearAir','spearDive','panda'].includes(f.move));
  const frames=gutFrames[`atlas-${this.skin+1}`],pose=base;
  const [l,t,r,b]=frames[pose],w=r-l+2,h=b-t+2,texture=this.textures[this.skin];
  texture.repeat.set(w/1536,h/1024);texture.offset.set((l-1)/1536,1-(b+1)/1024);this.sprite.material.map=texture;this.isolation.select(texture,frames,pose);
  const scale=1.8/(frames[0][3]-frames[0][1]);
  const pivot=l+(r-l)*([7,8,9,12,13,14,15,17].includes(base)?.36:.5);
  const breath=!f.move&&f.state==='Idle'?Math.sin(animationTick(f)*Math.PI/60)*.007:0;
  this.sprite.scale.set(w*scale,h*scale+breath,1);this.sprite.position.set(((l+r)/2-pivot)*scale,(h*scale+breath)/2,0);
  this.sprite.visible=!weapon;this.spear.root.visible=weapon;
  if(weapon)this.spear.update(f,this.skin);
  else {this.movement.apply(f,this.skin,this.sprite,this.isolation);this.expansion?.apply(f,this.skin,this.sprite,this.isolation);this.authoredWalk?.apply(f,this.skin,this.sprite,this.isolation);}
  const motion=actionMotion(f,f.move?characters.gut.moves[f.move]:undefined);
  this.sprite.position.x+=motion.x;this.sprite.rotation.z=motion.angle;
  this.spear.root.position.x=f.state.startsWith('Walk')?0:motion.x;this.spear.root.rotation.z=motion.angle;
  this.cross.visible=f.move==='immortal';this.cross.scale.setScalar(1+Math.sin(f.moveFrame*.25)*.03);
  const lift=this.cross.visible?Math.sin(Math.min(1,f.moveFrame/76)*Math.PI)*.8:0;
  this.root.position.set(worldX(f.x),f.y/100+lift,.1);this.root.scale.x=f.facing;
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose():void{this.authoredWalk?.dispose();this.expansion?.dispose();this.movement.dispose();this.plainGeometry.dispose();this.spear.dispose();this.textures.forEach(t=>t.dispose());this.sprite.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();this.cross.children.forEach(c=>{const m=c as THREE.Mesh;m.geometry.dispose();(m.material as THREE.Material).dispose();});}
}
