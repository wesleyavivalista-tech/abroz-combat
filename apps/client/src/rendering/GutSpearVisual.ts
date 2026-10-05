import {walkAtlases} from './WalkAtlas.js';
import { AuthoredWalk,authoredWalkFrame } from './AuthoredWalk.js';
import {gutWalkFrame} from './GutMovement.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {SpriteIsolation} from './SpriteIsolation.js';
import {ease} from './ActionMotion.js';
export const GUT_SPEAR_LENGTH=4.3;
const frames=[[26,28,215,262],[299,29,479,262],[529,29,734,262],[781,28,975,262],[1040,29,1245,262],[1305,29,1484,262],[22,291,245,515],[253,299,524,515],[526,323,768,515],[774,284,1015,515],[1038,358,1293,515],[1309,299,1527,462],[23,539,214,774],[299,539,479,774],[528,541,730,774],[781,539,974,774],[1039,541,1245,774],[1305,539,1486,774],[21,791,245,1019],[253,805,525,1019],[524,827,768,1019],[773,784,1014,1019],[1038,858,1293,1019],[1309,804,1526,964]];
// Source-space grip centers. Both grips determine the rigid weapon angle.
const grips=[[109,153,201,102],[379,153,467,100],[625,154,722,101],[873,147,963,102],[1137,153,1232,101],[1438,122,1472,101],[109,410,233,330],[445,373,512,362],[649,425,757,426],[881,378,1001,298],[1226,441,1280,438],[1409,356,1513,430],[108,662,201,614],[375,663,467,614],[624,664,721,614],[872,660,963,614],[1138,663,1233,614],[1439,637,1473,613],[108,914,233,830],[444,878,512,868],[649,934,756,930],[881,877,1001,798],[1225,943,1280,941],[1408,862,1513,934]];
const pivots=[120,384,638,893,1150,1405,120,380,640,893,1150,1405];
export class GutSpearVisual {
 readonly root=new THREE.Group();
 readonly weapon=new THREE.Group();
 readonly blade:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private authoredWalk?:AuthoredWalk;
 private body:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private texture:THREE.Texture;
 private weaponTexture:THREE.Texture;
 private isolation:SpriteIsolation;
 constructor(bodyAtlas:THREE.Texture,weaponAtlas:THREE.Texture,walkTextures?:THREE.Texture[]){
  if(walkTextures)this.authoredWalk=new AuthoredWalk(walkTextures,"spear");
  this.texture=bodyAtlas.clone();this.texture.needsUpdate=true;
  this.weaponTexture=weaponAtlas.clone();this.weaponTexture.needsUpdate=true;
  this.body=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.texture,transparent:true,alphaTest:.2,toneMapped:false,side:THREE.DoubleSide}));
  this.isolation=new SpriteIsolation(this.body.material);
  // Crop transparent margins via UVs; one uniform scale, immutable geometry in every pose.
  const width=1406,height=165,scale=GUT_SPEAR_LENGTH/width;
  this.weaponTexture.repeat.set(width/1536,height/1024);this.weaponTexture.offset.set(64/1536,1-632/1024);
  this.blade=new THREE.Mesh(new THREE.PlaneGeometry(width*scale,height*scale),new THREE.MeshBasicMaterial({map:this.weaponTexture,transparent:true,alphaTest:.2,toneMapped:false,side:THREE.DoubleSide}));
  this.blade.position.set(GUT_SPEAR_LENGTH/2,(496-(467+632)/2)*scale,.01);
  this.weapon.add(this.blade);this.root.add(this.body,this.weapon);
 }
 update(f:Fighter,skin:number):void {
  const move=f.move?characters.gut.moves[f.move]:undefined;
  const recovering=!!move&&f.moveFrame>=move.startupFrames+move.activeFrames;
  const walking=!f.move&&f.state.startsWith('Walk');
  let pose=walking?gutWalkFrame(f.stateFrame,f.state==='WalkBackward'):6;
  if(f.move)pose=({thrust:7,spearFinish:7,sweep:8,spearSwing:8,spearHeavy:9,spearLow:10,spearAir:7,spearDive:recovering?10:11} as Record<string,number>)[f.move]??6;
  else if(f.state.includes('Crouch')||f.state==='Land')pose=10;
  else if(['Jump','Fall'].includes(f.state))pose=11;
  else if(f.state.startsWith('Dash'))pose=5;
  const groundedAttack=!!move&&move.hitboxes.length>0&&!['spearDive','spearAir'].includes(f.move!);
  const release=move?move.startupFrames+move.activeFrames:0;
  // Wind up, drive into the hit, then recover. The shaft itself is never stretched.
  const extension=groundedAttack?f.moveFrame<move!.startupFrames
   ?ease((f.moveFrame-Math.max(0,move!.startupFrames-6))/6)
   :1-ease((f.moveFrame-release)/Math.max(1,move!.recoveryFrames)):1;
  if(groundedAttack&&extension<.45)pose=6;
  const index=skin*12+pose,[l,t,r,b]=frames[index],w=r-l+2,h=b-t+2;
  const scale=walking?1.8/h:1.8/230,pivot=pivots[pose];
  // Walking switches the material to a separate atlas. Restore the body atlas
  // before selecting its pose mask when returning to idle or attacking.
  this.body.material.map=this.texture;
  this.texture.repeat.set(w/1536,h/1024);this.texture.offset.set((l-1)/1536,1-(b+1)/1024);this.isolation.select(this.texture,frames,index);
  this.body.scale.set(w*scale,h*scale,1);this.body.position.set(((l+r)/2-pivot)*scale,h*scale/2,0);
  let [ax,ay,bx,by]=grips[index];
  let gripScale=scale,gripPivot=pivot,gripBottom=b;
  if(this.authoredWalk?.apply(f,skin,this.body,this.isolation)){
   const data=walkAtlases.spear,frame=data.frames[skin*4+authoredWalkFrame(f)!];
   [ax,ay,bx,by]=frame.grips!;gripScale=data.height/frame.height;gripPivot=frame.pivot;gripBottom=frame.bounds[3];
  }
  const rear=new THREE.Vector2((ax-gripPivot)*gripScale,(gripBottom-ay)*gripScale);
  const angle=Math.atan2(ay-by,bx-ax);
  // Fixed grip: reach comes from arm extension, never sliding the shaft.
  const grip=.85;
  this.weapon.rotation.z=angle;
  this.weapon.position.set(rear.x-Math.cos(angle)*grip,rear.y-Math.sin(angle)*grip,0);
 }
 dispose():void{this.authoredWalk?.dispose();this.texture.dispose();this.weaponTexture.dispose();this.body.geometry.dispose();this.body.material.dispose();this.blade.geometry.dispose();this.blade.material.dispose();}
}
