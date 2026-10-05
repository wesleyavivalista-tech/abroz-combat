import {backwardDashPose,loadBackwardDashArt} from './BackwardDash.js';
import * as THREE from 'three';
import type {Fighter,SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {JOPA} from '../../../../packages/game-core/simulation/JopaSystem.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
export function jopaPose(f:Fighter):number{
 if(f.jopaRide!==undefined)return 23;
 if(f.move==='chess'&&f.moveFrame>=characters.jopa.moves.chess.startupFrames)return f.moveFrame<32?17:0;
 if(f.move){const m=characters.jopa.moves[f.move];if(f.moveFrame<m.startupFrames*.5)return 0;return ({jab:6,comboKick:7,cross:8,heavyKick:9,heavyPunch:8,low:11,air:12,football:20,chess:21,tree:22,knight:22} as Record<string,number>)[f.move]??0;}
 if(f.state.startsWith('Walk'))return 1+Math.floor(f.stateFrame/7)%4;
 if(f.state.startsWith('Dash'))return 5;
 if(f.state==='Jump'||f.state==='JumpStartup')return 18;
 if(f.state==='Fall')return 19;
 if(f.state==='Crouch'||f.state==='BlockCrouching')return 17;
 if(f.state.startsWith('Block'))return 13;
 if(f.state.includes('HitStun')||f.state==='GetUp')return 14;
 if(['KO','Knockdown','Respawning','MatchLose'].includes(f.state))return 15;
 if(f.state==='MatchWin')return 16;return 0;
}
export class JopaRenderer implements FighterVisual{
 root=new THREE.Group();shadow:THREE.Mesh;
 private sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
 constructor(private frames:Frame[],private summon?:string,private movement:Frame[]=[],private skin=0,private actions:Frame[]=[],private backward:Frame[]=[]){this.root.add(this.sprite);this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.45,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;}
 update(f:Fighter):void{
  const pose=this.summon==='tree'?1:this.summon==='tentacle'?(f.state==='HeavyAttack'?3:2):this.summon==='knight'?4:jopaPose(f);
  const walking=f.state.startsWith('Walk')&&!f.move&&!this.summon,transforming=f.move==='tree'&&f.moveFrame>=20&&this.movement.length;
  const step=Math.floor(f.stateFrame/7)%4,walkIndex=f.state==='WalkBackward'?(4-step)%4:step;
  const action=this.actions.length?(this.summon==='knight'?0:f.jopaRide!==undefined?1+this.skin:f.move==='chess'&&f.moveFrame>=5&&f.moveFrame<characters.jopa.moves.chess.startupFrames?3+this.skin:-1):-1;
  const backPose=this.summon?null:backwardDashPose(f),back=backPose===null?undefined:this.backward[backPose];
  const frame=back??(action>=0?this.actions[action]:transforming?this.movement[f.moveFrame<35?8:f.moveFrame<50?9:10]:walking&&this.movement.length?this.movement[this.skin*4+walkIndex]:this.frames[pose]),reference=this.frames[this.summon==='tree'?1:this.summon==='tentacle'?2:this.summon==='knight'?4:0],scale=(this.summon==='tree'?3.4:this.summon==='knight'?2.7:this.summon==='tentacle'?1.5:1.76)/(back?back.referenceHeight! : action>=0?this.actions[this.summon==='knight'?0:5].height:walking||transforming?this.movement[11].height:reference.height);
  this.sprite.material.map=frame.texture;this.sprite.scale.set(frame.width*scale,frame.height*scale,1);this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,0);this.sprite.visible=f.jopaTree===undefined;
  this.root.position.set(worldX(f.x),f.y/100,this.summon?.length?.1:.14);this.root.scale.set(f.facing,1,1);
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);this.shadow.visible=f.jopaTree===undefined&&f.jopaRide===undefined;
 }
 dispose(){for(const mesh of [this.sprite,this.shadow]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
const cache=new RetryableAssets<{skins:Frame[][];abilities:Frame[];movement:Frame[];actions:Frame[]}>();
let abilityFrames:Frame[]=[],knightFrame:Frame|undefined;
export async function loadJopa(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 const data=await cache.get(async own=>{const sheet=async(path:string,c:number,r:number)=>{const t=await loadTexture('/art/jopa/'+path+'.png');t.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(t,c,r,true,true,path==='movement-v2'?{xFrom:1100,y:735}:undefined);frames.forEach(f=>own(f.texture));return frames;};return {skins:await Promise.all([1,2].map(i=>sheet('combat-'+i,6,4))),abilities:await sheet('abilities-v2',4,3),movement:await sheet('movement-v2',4,3),actions:await sheet('actions-v2',3,2)};});
 const backward=await loadBackwardDashArt();
 abilityFrames=data.abilities;knightFrame=data.actions[0];data.skins.forEach((frames,i)=>register('jopa',()=>new JopaRenderer(frames,undefined,data.movement,i,data.actions,backward.slice(6+i*3,9+i*3)),i?'casual':'original'));for(const kind of ['tree','tentacle','knight'])register('jopa',()=>new JopaRenderer(data.abilities,kind,[],0,data.actions),kind);
}
export function disposeJopa(){cache.dispose();abilityFrames=[];knightFrame=undefined;}
export class JopaEffects{
 root=new THREE.Group();private sprites:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
 update(s:SimulationSnapshot,menu:boolean):void{
  this.root.visible=!menu;let used=0;
  for(const mesh of this.sprites){mesh.material.opacity=1;mesh.material.color.setHex(0xffffff);}
  for(const p of s.projectiles){if(!p.active||!p.jopaKind||!abilityFrames.length)continue;const frame=p.jopaKind==='chess'&&p.variant===4&&knightFrame?knightFrame:abilityFrames[p.jopaKind==='football'?7:[8,9,10,11,4][p.variant??0]];
   let mesh=this.sprites[used++];if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,toneMapped:false,side:THREE.DoubleSide}));this.sprites.push(mesh);this.root.add(mesh);}
   mesh.visible=true;mesh.material.map=frame.texture;const h=p.jopaKind==='football'?.44:.55;mesh.scale.set(h*frame.width/frame.height,h,1);mesh.position.set(worldX(p.x),p.y/100,.2);mesh.rotation.z=p.jopaKind==='football'?-s.frame*p.vx*.012:0;
  }
  for(const f of s.fighters){
   if(f.characterId!=='jopa'||f.move!=='tree'||f.moveFrame<20||!abilityFrames.length)continue;
   const frame=abilityFrames[0],growth=Math.min(1,(f.moveFrame-20)/30);let mesh=this.sprites[used++];
   if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,toneMapped:false,side:THREE.DoubleSide}));this.sprites.push(mesh);this.root.add(mesh);}
   mesh.visible=true;mesh.material.map=frame.texture;mesh.scale.set(3.4*frame.width/frame.height*Math.max(.1,growth),3.4*growth,1);mesh.position.set(worldX(f.x),f.y/100+1.7*growth,.08);mesh.rotation.z=0;
  }
  // Collapse around the roots, shudder, darken and dissolve over one second.
  for(const death of s.treeDeaths??[]){
   if(!abilityFrames.length)continue;
   const t=Math.max(0,Math.min(1,(s.frame-death.startedAt)/JOPA.treeDeathFrames)),frame=abilityFrames[1];
   let mesh=this.sprites[used++];if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.01,toneMapped:false,side:THREE.DoubleSide,depthWrite:false}));this.sprites.push(mesh);this.root.add(mesh);}
   const collapse=Math.max(0,(t-.15)/.85),h=3.4*(1-.92*collapse*collapse),angle=death.facing*(Math.sin(t*45)*.035*(1-t)+collapse*.32);
   mesh.visible=true;mesh.material.map=frame.texture;mesh.material.opacity=1-Math.max(0,(t-.45)/.55);mesh.material.color.setRGB(1-t*.65,1-t*.72,1-t*.72);
   mesh.scale.set(death.facing*3.4*frame.width/frame.height*(1+collapse*.22),h,1);mesh.rotation.z=angle;
   mesh.position.set(worldX(death.x)-Math.sin(angle)*h/2,death.y/100+Math.cos(angle)*h/2,.18);
  }
  for(let i=used;i<this.sprites.length;i++)this.sprites[i].visible=false;
 }
 dispose(){for(const m of this.sprites){m.geometry.dispose();m.material.dispose();}this.root.clear();this.sprites=[];}
}
