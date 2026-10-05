import {renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
import {attachmentOffset} from './AnimationContract.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {worldX} from './StageCoordinates.js';
import {SpriteIsolation} from './SpriteIsolation.js';
import type {FighterVisual} from './FighterRenderer.js';
import {romsMovement,romsSheets} from './RomsAtlas.js';
import type {Frame} from './DodoRenderer.js';
import {romsPose,romsLowStrike} from './RomsPose.js';
export class RomsRenderer implements FighterVisual {
 get fallBodies():THREE.Object3D[]{return [this.sprite,this.legs,this.lowSprite];}
 root=new THREE.Group();shadow:THREE.Mesh;
 private lowSprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private textures:THREE.Texture[];private isolation:SpriteIsolation;
 private legs:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;private legIsolation:SpriteIsolation;
 constructor(textures:THREE.Texture[],private skin:number,private lowFrames:Frame[]=[]){
  this.lowFrames=lowFrames.map(f=>({...f,texture:f.texture.clone()}));this.lowSprite.visible=false;this.root.add(this.lowSprite);
  this.textures=textures.map(t=>{const c=t.clone();c.needsUpdate=true;return c;});
  this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.4,side:THREE.DoubleSide,toneMapped:false}));this.root.add(this.sprite);this.isolation=new SpriteIsolation(this.sprite.material);
  this.legs=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.4,side:THREE.DoubleSide,toneMapped:false}));this.root.add(this.legs);this.legIsolation=new SpriteIsolation(this.legs.material);
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.45,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter):void {
  this.sprite.visible=true;this.lowSprite.visible=false;
  const {sheet,pose}=romsPose(f,this.skin);
  const data=romsSheets[sheet],texture=this.textures[sheet];
  let scale=1.81/234,anchor=(pose%4)*384+([1,5].includes(pose)?145:pose===9?165:192);
  if(sheet===0||sheet===4||sheet===5){scale=1.81/380;anchor=romsMovement.pivots[pose];}
  if(sheet===3){scale=1.81/335;anchor=(pose%4)*384+192;}
  if(sheet===9)scale=1.81/245;
  if(sheet>=6&&sheet<=8){
   scale=1.81/(sheet===8?365:354);
   anchor=[164,478,816,1104,194,531,852,1120,159,472,787,1096][pose];
  }
  const [l,t,r,originalBottom]=data.frames[pose];
  const walkingJuggle=sheet>=6&&sheet<=8&&pose>=8&&f.state.startsWith('Walk');
  const cut=walkingJuggle?.9:0,b=originalBottom-cut/scale,w=r-l+3,h=b-t+3;
  this.legs.visible=walkingJuggle;
  if(walkingJuggle){
   // Keep the authored alternating leg cycle beneath the independent hand cycle.
   const step=Math.floor(f.stateFrame/7)%4,phase=f.state==='WalkBackward'?(4-step)%4:step;
   const armored=sheet===8,ls=armored?3:4,lp=armored?phase:this.skin*5+phase+1;
   const ld=romsSheets[ls],ltx=this.textures[ls],sc=1.81/(armored?335:380);
   const [ll,,lr,lb]=ld.frames[lp],lh=cut/sc,lw=lr-ll+3;
   ltx.repeat.set(lw/ld.width,lh/ld.height);ltx.offset.set((ll-1)/ld.width,1-(lb+1)/ld.height);
   this.legs.material.map=ltx;this.legIsolation.select(ltx,ld.frames,lp);
   this.legs.scale.set(lw*sc,cut,1);this.legs.position.set(((ll+lr)/2-(armored?(lp%4)*384+192:romsMovement.pivots[lp]))*sc,cut/2,0);
  }
  texture.repeat.set(w/data.width,h/data.height);texture.offset.set((l-1)/data.width,1-(b+1)/data.height);this.sprite.material.map=texture;this.isolation.select(texture,data.frames,pose);
  this.sprite.scale.set(w*scale,h*scale,1);this.sprite.position.set(((l+r)/2-anchor)*scale,h*scale/2+cut,0);
  // The water simulation and artwork meet at the hose's nozzle.
  if(sheet===3&&pose===10){const nozzle=characters.roms.moves.water.beam!;const point=attachmentOffset([l,t,r,b],[1196,843],[(nozzle.originX??0)/100,nozzle.originY/100],scale);this.sprite.position.x=point.x;this.sprite.position.y=point.y;}
  if(romsLowStrike(f)){
   const frame=this.lowFrames[f.armorUntil?5:this.skin*2+1];
   if(frame){const sc=1.81/frame.referenceHeight!;this.sprite.visible=false;this.legs.visible=false;this.lowSprite.visible=true;
    this.lowSprite.material.map=frame.texture;this.lowSprite.scale.set(frame.width*sc,frame.height*sc,1);
    this.lowSprite.position.set((frame.width/2-frame.pivot)*sc,frame.height*sc/2,.002);
   }
  }
  this.root.position.set(worldX(f.x),f.y/100,.1);this.root.scale.set(f.facing,1,1);
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose():void {this.lowFrames.forEach(f=>f.texture.dispose());this.lowSprite.geometry.dispose();this.lowSprite.material.dispose();this.textures.forEach(t=>t.dispose());this.sprite.geometry.dispose();this.sprite.material.dispose();this.legs.geometry.dispose();this.legs.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();}
}
