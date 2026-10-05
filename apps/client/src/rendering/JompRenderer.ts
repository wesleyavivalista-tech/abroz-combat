import {RetryableAssets} from './RetryableAssets.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {JOMP} from '../../../../packages/game-core/simulation/JompSystem.js';
import {framesFrom,type Frame} from './DodoRenderer.js';
import {loadTexture} from './TextureCache.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
export function jompPose(f:Fighter):[number,number]{
 if(f.move){
  if(f.move==='coolMuscles')return [2,1];
  if(f.move==='perfection'&&f.moveFrame>=240)return [2,1];
  if(f.move==='perfection')return [2,Math.floor(Math.max(0,f.moveFrame)/30)%2?5:4];
  if(f.move==='gymBro'){
   if(f.state!=='GymBro')return [2,2+Math.floor(f.stateFrame/6)%2];
   const elapsed=Math.max(0,f.moveFrame-18);
   return [2,6+Math.min(2,Math.floor(elapsed/(JOMP.repFrames*3)))*2+(Math.floor(elapsed/(JOMP.repFrames/2))%2)];
  }
  if(f.move==='investida'){
   const startup=characters.jomp.moves.investida.startupFrames;
   if(f.moveFrame<startup)return [4,1];
   if(f.moveFrame>startup+characters.jomp.moves.investida.activeFrames)return [4,0];
   return [4,2+Math.floor(f.stateFrame/4)%6];
  }
  const m=characters.jomp.moves[f.move];
  if(f.moveFrame<m.startupFrames||f.moveFrame>m.startupFrames+m.activeFrames+m.recoveryFrames*.6)return [0,0];
  return [1,({jab:1,cross:2,comboKick:3,heavyKick:4,heavyPunch:5,low:6,air:7} as Record<string,number>)[f.move]??0];
 }
 if(f.state.startsWith('Walk')){const n=Math.floor(f.stateFrame/5)%8;return [3,f.state==='WalkBackward'?(8-n)%8:n];}
 if(f.state.startsWith('Dash'))return [0,7];
 if(['KO','MatchLose','Knockdown','Respawning'].includes(f.state))return [1,10];
 if(f.state==='MatchWin')return [1,11];
 if(f.state.includes('HitStun')||f.state==='GetUp')return [1,9];
 if(f.state.startsWith('Block'))return [1,8];
 if(['Crouch','JumpStartup','Land'].includes(f.state))return [0,6];
 if(['Jump','Fall'].includes(f.state))return [0,5];
 return [0,0];
}
export class JompRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite,this.aura,this.shimmer];}
 root=new THREE.Group();shadow:THREE.Mesh;
 private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private shimmer:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 private aura:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 constructor(private sheets:Frame[][]){
  this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));
  this.aura=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,color:0xffd277,opacity:.16,depthWrite:false,toneMapped:false}));
  // Sample the current isolated silhouette so highlights never form a rectangle.
  this.shimmer=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({
   transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,
   uniforms:{map:{value:null},clock:{value:0}},
   vertexShader:`varying vec2 uvLocal;void main(){uvLocal=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
   fragmentShader:`uniform sampler2D map;uniform float clock;varying vec2 uvLocal;
    void main(){
     vec4 skin=texture2D(map,uvLocal);
     float warm=smoothstep(.035,.13,skin.r-skin.g)*smoothstep(.015,.09,skin.g-skin.b)*smoothstep(.25,.55,skin.r);
     // Restrict shimmer to the upper body, excluding shoes and beige shorts.
     warm*=smoothstep(.42,.55,uvLocal.y)*(1.0-smoothstep(.86,.96,uvLocal.y));
     vec2 grid=uvLocal*vec2(7.,9.);vec2 cell=floor(grid);vec2 p=abs(fract(grid)-.5);
     float seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
     float pulse=pow(max(0.,sin(clock*3.4+seed*24.)),7.);
     float star=max((1.-smoothstep(.015,.065,p.x))*(1.-smoothstep(.05,.32,p.y)),(1.-smoothstep(.015,.065,p.y))*(1.-smoothstep(.05,.32,p.x)));
     float sweep=pow(max(0.,sin(uvLocal.y*13.+uvLocal.x*5.-clock*3.)),18.)*.14;
     float shine=(star*pulse*1.3+sweep)*warm*skin.a;
     gl_FragColor=vec4(1.,.88,.52,shine);
    }`
  }));
  this.root.add(this.aura,this.sprite,this.shimmer);
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.4,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter,time:number):void{
  const [sheet,pose]=jompPose(f),frame=this.sheets[sheet][pose],scale=1.76/this.sheets[sheet][0].height;
  this.sprite.material.map=frame.texture;this.sprite.scale.set(frame.width*scale,frame.height*scale,1);
  this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,0);
  this.aura.material.map=frame.texture;this.aura.scale.copy(this.sprite.scale).multiplyScalar(1.045);this.aura.position.copy(this.sprite.position);this.aura.position.z=-.005;
  this.aura.visible=f.weaponUntil>0||f.move==='coolMuscles';this.aura.material.opacity=.1+(1+Math.sin(time*7))*.025;
  this.shimmer.visible=this.aura.visible&&!['KO','Respawning','MatchLose'].includes(f.state);
  this.shimmer.material.uniforms.map.value=frame.texture;this.shimmer.material.uniforms.clock.value=time;
  this.shimmer.scale.copy(this.sprite.scale);this.shimmer.position.copy(this.sprite.position);this.shimmer.position.z=.006;
  this.root.position.set(worldX(f.x),f.y/100,.12);this.root.scale.set(f.facing,1,1);
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 dispose(){for(const mesh of [this.sprite,this.aura,this.shimmer,this.shadow]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
const cached=new RetryableAssets<Frame[][][]>();
export async function loadJomp(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 const skins=await cached.get(async own=>Promise.all([1,2].map(skin=>Promise.all(['movement','combat','abilities','walk','charge'].map(async kind=>{
  const frames=framesFrom(await loadTexture('/art/jomp/'+kind+'-'+skin+(kind==='charge'?'-v3.png':'-tocha-v2.png')),4,['movement','walk','charge'].includes(kind)?2:3,true,['movement','walk','charge'].includes(kind));
  for(const frame of frames)own(frame.texture);return frames;
 })))));

 skins.forEach((sheets,i)=>register('jomp',()=>new JompRenderer(sheets),i?'charcoal':'original'));
}
export async function disposeJomp(){cached.dispose();}
