import {renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
import {caioMasterData,caioMasterBoxingData} from './caioMasterData.js';
import {caioBoxingData} from './caioBoxingData.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {worldX} from './StageCoordinates.js';
import type {FighterVisual} from './FighterRenderer.js';
import {caioAtlases} from './CaioAtlas.js';
import {SpriteIsolation} from './SpriteIsolation.js';
export function caioPose(f:Fighter):number{
 if(['KO','Knockdown','Respawning'].includes(f.state))return 15;
 if(f.stun||f.state.includes('HitStun'))return 14;
 if(f.move){
  if(['pool','flood','master'].includes(f.move))return 13;
  if(f.move==='dart')return 12;
  const m=characters.caio.moves[f.move];
  if(m.damage&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames+5)return ({light:8,chain2:9,chain3:10,heavy:11,crouch:10,air:11} as Record<string,number>)[f.move]??8;
 }
 if(f.state.startsWith('Walk')){const p=Math.floor(f.stateFrame/7)%4;return [1,2,3,4][f.state==='WalkBackward'?(4-p)%4:p];}
 if(f.state.startsWith('Dash'))return 7;
 if(['Jump','Fall','JumpStartup'].includes(f.state))return 6;
 if(f.state.includes('Crouch')||f.state==='Land')return 5;
 return 0;
}
export class CaioRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 root=new THREE.Group();shadow:THREE.Mesh;
 private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private master:THREE.Texture;private masterBoxing:THREE.Texture;private boxing:THREE.Texture;private texture:THREE.Texture;private isolation:SpriteIsolation;
 constructor(texture:THREE.Texture,private skin:number,boxing:THREE.Texture,master:THREE.Texture=texture,masterBoxing:THREE.Texture=boxing){
  this.master=master.clone();this.master.needsUpdate=true;this.masterBoxing=masterBoxing.clone();this.masterBoxing.needsUpdate=true;
  this.boxing=boxing.clone();this.boxing.needsUpdate=true;
  this.texture=texture.clone();this.texture.needsUpdate=true;
  this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.texture,transparent:true,alphaTest:.4,toneMapped:false,side:THREE.DoubleSide}));
  this.isolation=new SpriteIsolation(this.sprite.material);this.root.add(this.sprite);
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.42,24),new THREE.MeshBasicMaterial({color:0x16121c,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter):void{
  const boxing=(f.move==='light'||f.move==='chain2')&&!f.stun;
  const m=f.move?characters.caio.moves[f.move]:undefined;
  const active=m&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames+3;
  const master=!!f.bloodMasterUntil;
  const original=boxing?caioBoxingData:caioAtlases[this.skin];
  const data=master?(boxing?caioMasterBoxingData:caioMasterData[this.skin]):original,pose=boxing?this.skin*3+(active?(f.move==='light'?1:2):0):caioPose(f);
  const [l,t,r,b]=data.frames[pose],w=r-l+3,h=b-t+3,base=original.frames[boxing?this.skin*3:0],scale=1.75/(base[3]-base[1]+3),texture=master?(boxing?this.masterBoxing:this.master):boxing?this.boxing:this.texture;
  texture.repeat.set(w/data.width,h/data.height);texture.offset.set((l-1)/data.width,1-(b+1)/data.height);
  this.sprite.material.map=texture;this.isolation.select(texture,data.frames,pose);
  this.sprite.scale.set(w*scale,h*scale,1);
  const anchor=boxing?(pose%3===0?.5:.37):[.5,.5,.5,.5,.5,.5,.5,.5,.37,.37,.27,.23,.33,.5,.5,.5][pose];
  this.sprite.position.set((.5-anchor)*w*scale,h*scale/2,0);
  // Draw droplets below the shoe baseline without shrinking the transformed body.
  if(master)this.sprite.position.y-=(b-original.frames[pose][3])*scale;
  this.sprite.material.color.set(0xffffff);
  if(f.move==='dart'){
   const muzzleX=this.skin?305:333,muzzleY=this.skin?988:992;
   this.sprite.position.x=1.25-(muzzleX-(l+r)/2)*scale;
   this.sprite.position.y=1.45-((t+b)/2-muzzleY)*scale;
  }
  this.root.position.set(worldX(f.x),f.y/100,.1);this.root.scale.x=f.facing;
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose():void{this.master.dispose();this.masterBoxing.dispose();this.texture.dispose();this.boxing.dispose();this.sprite.geometry.dispose();this.sprite.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();}
}
