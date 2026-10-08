import * as THREE from 'three';
import type {Fighter,HairClone} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {ZOMBIE_CLAW,ZOMBIE_RISE_FRAMES,ZOMBIE_DEATH_FRAMES} from '../../../../packages/game-core/simulation/UndeadSystem.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {loadTexture} from './TextureCache.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadGraveArt,disposeGraveArt} from './GraveArt.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
type Undead=NonNullable<HairClone['undead']>;
const assets=new Map<string,RetryableAssets<Frame[]>>(),loaded=new Map<string,Frame[]>();
export const zombieAirGroups:readonly (readonly string[])[]=[
 ['nikalz','drupa','bozo','caio'],
 ['gut','luizinho','roms','jopa'],
 ['eide','napa','astolfo','fausto'],
 ['biel','jomp','dodo','tocha'],
];
const airAssets=new Map<number,RetryableAssets<Frame[]>>();
async function loadAirFrames(id:string):Promise<Frame[]>{
 const group=zombieAirGroups.findIndex(ids=>ids.includes(id));
 if(group<0)throw new Error(`Missing zombie air artwork: ${id}`);
 let cache=airAssets.get(group);if(!cache){cache=new RetryableAssets<Frame[]>();airAssets.set(group,cache);}
 const frames=await cache.get(async own=>{
  const sheet=await loadTexture(`/art/zombies/air-${group}-v1.png`);
  const poses=framesFrom(sheet,3,4,false,true);
  poses.forEach((pose,i)=>{own(pose.texture);pose.referenceHeight=poses[Math.floor(i/3)*3].height;});
  return poses;
 });
 const offset=zombieAirGroups[group].indexOf(id)*3;
 return frames.slice(offset+1,offset+3);
}
export async function loadZombieSprites(ids:readonly string[]=Object.keys(characters)):Promise<void>{
 await loadGraveArt();
 await Promise.all([...new Set(ids)].map(async id=>{
  if(!characters[id])return;
  let cache=assets.get(id);if(!cache){cache=new RetryableAssets<Frame[]>();assets.set(id,cache);}
  const frames=await cache.get(async own=>{
   const sheet=await loadTexture(`/art/zombies/${id}-v1.png`);
   const frames=framesFrom(sheet,4,2,false,true);frames.forEach(f=>own(f.texture));
   // Every drawing shares the idle's pixel scale; lying down must not enlarge the body.
   for(const f of frames)f.referenceHeight=frames[0].height;
   return [...frames,...await loadAirFrames(id)];
  });loaded.set(id,frames);
 }));
}
export function disposeZombieSprites():void{for(const cache of assets.values())cache.dispose();for(const cache of airAssets.values())cache.dispose();assets.clear();airAssets.clear();loaded.clear();disposeGraveArt();}
export function zombieSpritePose(f:Fighter,u:Undead,frame:number,distance:number):number{
 if(f.undead==='dying')return frame-u.phaseAt<8?6:7;
 if(f.undead==='rising')return 0;
 if(f.stun>0||f.state.includes('HitStun'))return 6;
 if(f.state==='LightAttack')return u.attackFrame<ZOMBIE_CLAW.startupFrames?4:u.attackFrame<ZOMBIE_CLAW.startupFrames+ZOMBIE_CLAW.activeFrames?5:0;
 if(f.state.startsWith('Walk'))return [1,2,3,2][Math.floor(distance/16)%4];
 if(f.state==='Jump'||f.state==='JumpStartup')return 8;
 if(f.state==='Fall')return 9;
 return 0;
}
/** Authored illustrated frames, using the same transparent plane pipeline as living fighters. */
export class ZombieSpriteRenderer {
 readonly root=new THREE.Group();
 readonly sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 readonly shadow:THREE.Mesh;
 private distance=0;private lastX:number|undefined;private lastFrame=-1;
 constructor(readonly characterId:string,private frames?:readonly Frame[]){
  this.root.name=`zombie-${characterId}`;this.root.add(this.sprite);this.sprite.visible=false;
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.35,20),new THREE.MeshBasicMaterial({color:'#101020',transparent:true,opacity:.23,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.shadow.scale.set(1,.5,1);
 }
 update(f:Fighter,u:Undead,frame:number):void{
  if(frame!==this.lastFrame){
   if(this.lastX!==undefined&&f.state.startsWith('Walk'))this.distance+=Math.min(8,Math.abs(f.x-this.lastX));
   this.lastX=f.x;this.lastFrame=frame;
  }
  this.frames??=loaded.get(this.characterId);
  this.root.position.set(worldX(f.x),f.y/100,.16);this.root.scale.set(f.facing,1,1);this.root.rotation.set(0,0,0);
  this.sprite.visible=!!this.frames;this.sprite.rotation.z=0;this.sprite.material.opacity=1;
  const age=frame-u.phaseAt;
  if(this.frames){
   const pose=zombieSpritePose(f,u,frame,this.distance),art=this.frames[pose];
   // Slightly lower than upright fighters because the painted stance is hunched.
   const scale=1.7/(art.referenceHeight??this.frames[0].height);
   this.sprite.material.map=art.texture;this.sprite.scale.set(art.width*scale,art.height*scale,1);
   this.sprite.position.set((art.width/2-art.pivot)*scale,art.height*scale/2,0);
  }
  if(f.undead==='rising'){
   const t=Math.min(1,age/ZOMBIE_RISE_FRAMES);this.root.position.y-=1.05*(1-t);this.sprite.material.opacity=Math.min(1,t*3);
  }
  if(f.undead==='dying')this.sprite.material.opacity=1-Math.max(0,(age/ZOMBIE_DEATH_FRAMES-.65)/.35);
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.012,0);this.shadow.visible=f.undead!=='dying'&&!!this.frames;
 }
 dispose():void{this.sprite.geometry.dispose();this.sprite.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();}
}
