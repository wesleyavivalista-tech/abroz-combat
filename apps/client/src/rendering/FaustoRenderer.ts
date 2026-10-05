import {AngerIndicator,angerVisualIntensity} from './AngerIndicator.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {RetryableAssets} from './RetryableAssets.js';
import {loadTexture} from './TextureCache.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
export function faustoPose(f:Fighter):number{
 if(f.move){const m=characters.fausto.moves[f.move];
  if(f.move==='origami')return f.moveFrame<12?18:f.moveFrame<28?19:f.moveFrame<40?20:21;
  if(f.move==='cloud')return 22;
  if(f.move==='ancestry')return 23;
  if(f.move==='bravinho')return 6;
  if(f.move==='flash')return f.moveFrame<m.startupFrames/2?18:f.moveFrame<m.startupFrames?19:f.moveFrame<m.startupFrames+m.activeFrames?20:21;
  if(f.moveFrame<m.startupFrames*.65||f.moveFrame>=m.startupFrames+m.activeFrames+m.recoveryFrames*.6)return 6;
  return ({punch:7,comboKick:8,finishPunch:9,heavyKick:10,heavyPunch:11,low:12,air:13,slash:7,swordKick:8,finishSlash:9,swordHeavy:11,swordLow:12,swordAir:13} as Record<string,number>)[f.move]??6;
 }
 if(['Jump','Fall','JumpStartup'].includes(f.state))return 25;
 if(f.state==='Crouch'||f.state==='BlockCrouching')return 24;if(f.state.startsWith('Block'))return 14;
 if(['KO','Respawning','Knockdown','MatchLose'].includes(f.state))return 16;
 if(f.state.includes('HitStun')||f.state==='GetUp')return 15;if(f.state==='MatchWin')return 17;return 6;
}
interface FaustoArt {sheets:Frame[][];walking:Frame[][];specialFrames:Frame[];corrections:Frame[]}
export class FaustoRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 private angerIndicator=new AngerIndicator();private rageTint={value:0};private aura=new THREE.Group();private auraClock=0;private lastAuraTime:number|undefined;
 root=new THREE.Group();shadow:THREE.Mesh;private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 constructor(private normal:FaustoArt,private skin:number,private rage:FaustoArt){this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));this.root.add(this.sprite,this.aura,this.angerIndicator.root);
 const tint=this.rageTint;this.sprite.material.onBeforeCompile=shader=>{shader.uniforms.rageTint=tint;shader.fragmentShader='uniform float rageTint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat skin=step(diffuseColor.g*1.35,diffuseColor.r)*step(diffuseColor.b*1.3,diffuseColor.r)*step(.12,diffuseColor.r);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(diffuseColor.r*.9,diffuseColor.g*.25,diffuseColor.b*.3),skin*rageTint);');};
 for(let i=0;i<24;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.025,.25),new THREE.MeshBasicMaterial({color:0xff4633,transparent:true,opacity:.15,depthWrite:false,blending:THREE.AdditiveBlending}));m.rotation.z=(i%2?1:-1)*.3;this.aura.add(m);}
 this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.4,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;}
 update(f:Fighter,time=0):void{
  const angry=(f.angerUntil??0)>0,art=angry?this.rage:this.normal;
  this.rageTint.value=angry?Math.min(.85,(!f.move&&faustoPose(f)>=24?.65:0)+(f.angerStacks??0)*.025):0;
  this.aura.visible=angry;
  const stacks=f.angerStacks??0,intensity=angerVisualIntensity(stacks);
  const dt=this.lastAuraTime===undefined?0:Math.max(0,Math.min(.1,time-this.lastAuraTime));this.lastAuraTime=time;
  this.auraClock=angry?this.auraClock+dt*(1+intensity*3):0;
  this.aura.scale.setScalar(1+intensity*.2);
  this.aura.children.forEach((o,i)=>{
   const m=o as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
   m.visible=i<Math.min(24,8+Math.max(0,stacks)*2);
   const phase=(this.auraClock*.65+i/24)%1;
   m.position.set(Math.sin(this.auraClock*3+i*2.4)*(.55+intensity*.12),.15+phase*1.65,.04);
   m.scale.set(1+intensity*1.8,1+intensity*1.2,1);
   m.material.opacity=Math.sin(phase*Math.PI)*(.16+intensity*.55);
  });
  // Both outfits share one samurai form; casting keeps the normal folding/scratch poses.
  const mode=!!f.weaponUntil,special=mode&&['origami','cloud'].includes(f.move??''),index=mode?2:this.skin;
  const walking=!f.move&&(f.state.startsWith('Walk')||f.state.startsWith('Dash'));
  const phase=Math.floor(f.stateFrame/7)%4,frames=walking?art.walking[index]:art.sheets[index];
  const hair=f.move==='cloud',punch=f.move==='heavyPunch'&&!mode;
  const correction=hair?index*4+Math.floor(f.moveFrame/6)%2:punch?index*4+(f.moveFrame<characters.fausto.moves.heavyPunch.startupFrames?2:3):-1;
  const frame=correction>=0?art.corrections[correction]:special?art.specialFrames[faustoPose(f)-18]:frames[walking?(f.state==='WalkBackward'?(4-phase)%4:phase):faustoPose(f)];
  const scale=1.66/(frame.referenceHeight??(correction>=0?art.corrections[index*4+3].height:special?art.specialFrames[5].height:walking?(frame.referenceHeight??frames[0].height):art.sheets[index][6].height));
  this.sprite.material.map=frame.texture;this.sprite.material.opacity=f.move==='flash'&&f.moveFrame>=characters.fausto.moves.flash.startupFrames&&f.moveFrame<characters.fausto.moves.flash.startupFrames+characters.fausto.moves.flash.activeFrames?.3:1;
  this.sprite.scale.set(frame.width*scale,frame.height*scale,1);this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,0);
  this.angerIndicator.update(angry,f.angerStacks??0,time,Math.min(1.75,frame.height*scale));
  this.root.position.set(worldX(f.x),f.y/100,.12);this.root.scale.set(f.facing,1,1);this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose(){this.angerIndicator.dispose();this.aura.children.forEach(o=>{const m=o as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;m.geometry.dispose();m.material.dispose();});this.sprite.geometry.dispose();this.sprite.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();}
}
const assets=new RetryableAssets<{normal:FaustoArt;rage:FaustoArt}>();
export async function loadFausto(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 const a=await assets.get(async own=>{
  const read=async(path:string,c:number,r:number)=>{const t=await loadTexture('/art/fausto/'+path+'.png');t.colorSpace=THREE.SRGBColorSpace;const frames=framesFrom(t,c,r,true,true);for(const f of frames)own(f.texture);return frames;};
  const neutral=await read('neutral-poses-v1',3,3);
  for(let i=0;i<3;i++)for(const f of neutral.slice(i*3,i*3+3))f.referenceHeight=neutral[i*3].height;
  const set=async(prefix:string):Promise<FaustoArt>=>{
   const sheets=await Promise.all(['combat-1','combat-2','samurai'].map(p=>read(prefix+p,6,4)));
   for(let i=0;i<3;i++)sheets[i].push(neutral[i*3+1],neutral[i*3+2]);
   const walk=await read(prefix+'walk-samurai',2,2),near=await read(prefix+'walk-near-v2',3,2),far=await read(prefix+'walk-far-v2',3,2);
   for(let skin=0;skin<2;skin++)for(const sheet of [near,far])for(let i=0;i<3;i++)sheet[skin*3+i].referenceHeight=sheet[skin*3].height;
   return {sheets,specialFrames:await read(prefix+'samurai-specials',3,2),corrections:await read(prefix+'corrections-v2',4,3),walking:[[near[0],near[1],far[0],far[1]],[near[3],near[4],far[3],far[4]],walk]};
  };
  return {normal:await set(''),rage:await set('rage-')};
 });
 for(let i=0;i<2;i++)register('fausto',()=>new FaustoRenderer(a.normal,i,a.rage),i?'casual':'original');
}
export function disposeFausto(){assets.dispose();}
