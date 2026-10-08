import {animationTick} from './AnimationPlayback.js';
import {dodoCompanions,companionJumpPose} from './DodoCompanionPresentation.js';
import {RetryableAssets} from './RetryableAssets.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import type {FighterVisual} from './FighterRenderer.js';
import {worldX,renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
import {loadTexture} from './TextureCache.js';
import {isolateSprites} from './DodoSpriteIsolation.js';
export interface Frame {texture:THREE.CanvasTexture;width:number;height:number;pivot:number;referenceHeight?:number;sourceLeft?:number;sourceTop?:number}
export function dodoPose(f:Fighter):number{
 if(f.move){
  const m=characters.dodo.moves[f.move];
  if(f.move==='starWave'||f.move==='chord'||f.move==='guitarStar'||f.move==='painKillers')return 14;
  if(f.moveFrame<m.startupFrames)return ['heavy','guitarSwing'].includes(f.move)?8:0;
  if(f.moveFrame>=m.startupFrames+m.activeFrames+Math.ceil(m.recoveryFrames*.6))return 0;
  return ({jab:5,comboKick:6,guitarSwing:7,heavy:7,kick:6,low:9,air:10} as Record<string,number>)[f.move]??0;
 }
 if(f.state.startsWith('Walk')){const phase=Math.floor(f.stateFrame/6)%4;return [1,2,3,4][f.state==='WalkBackward'?(4-phase)%4:phase];}
 if(f.state.startsWith('Dash'))return 2;
 if(['Jump','JumpStartup','Fall'].includes(f.state))return 17;
 if(f.state==='Crouch'||f.state==='BlockCrouching')return 16;
 if(f.state.startsWith('Block'))return 11;
 if(['KO','Respawning','Knockdown'].includes(f.state))return 13;
 if(f.state.includes('HitStun')||f.state==='GetUp')return 12;
 if(f.state==='MatchWin')return 15;
 return f.weaponUntil?14:0;
}
/** Each GPU texture contains exactly one connected silhouette, including limbs
 * that extend beyond the nominal layout cell. No neighbouring pose can bleed in. */
export function framesFrom(t:THREE.Texture,columns:number,rows:number,pixelArt=false,hipAnchor=false,seam?:{xFrom:number;y:number}):Frame[]{
 const im=t.image as HTMLImageElement,c=document.createElement('canvas');c.width=im.width;c.height=im.height;
 const cx=c.getContext('2d')!;cx.drawImage(im,0,0);const source=cx.getImageData(0,0,c.width,c.height);
 return isolateSprites(source.data,c.width,c.height,columns,rows,seam).map(island=>{
  const width=island.right-island.left+1,height=island.bottom-island.top+1;
  const canvas=document.createElement('canvas');canvas.width=width+4;canvas.height=height+4;
  const context=canvas.getContext('2d')!,pixels=context.createImageData(canvas.width,canvas.height);
  for(const p of island.pixels){const x=p%c.width-island.left+2,y=Math.floor(p/c.width)-island.top+2,offset=(y*canvas.width+x)*4;pixels.data.set(source.data.subarray(p*4,p*4+4),offset);}
  context.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=t.colorSpace;texture.generateMipmaps=false;texture.minFilter=pixelArt?THREE.NearestFilter:THREE.LinearFilter;texture.magFilter=pixelArt?THREE.NearestFilter:THREE.LinearFilter;
  const feet=island.pixels.filter(p=>Math.floor(p/c.width)>island.bottom-height*.15).map(p=>p%c.width);
  let footLeft=island.right,footRight=island.left;
  for(const x of feet){footLeft=Math.min(footLeft,x);footRight=Math.max(footRight,x);}
  // A walk pivots around the hips, not the changing midpoint between its shoes.
  const hips=hipAnchor?island.pixels.filter(p=>{const y=Math.floor(p/c.width)-island.top;return y>height*.48&&y<height*.58;}):[];
  const pivot=hips.length?hips.reduce((sum,p)=>sum+p%c.width,0)/hips.length:(footLeft+footRight)/2;
  return {texture,width:canvas.width,height:canvas.height,pivot:pivot-island.left+2,sourceLeft:island.left,sourceTop:island.top};
 });
}
export class DodoRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 root=new THREE.Group();shadow:THREE.Mesh;
 private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 constructor(private frames:Frame[],private playing:Frame[]=[],private attacks:Frame[]=[],private companion=false,private walking:Frame[]=[],private jumping:Frame[]=[]){
  this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:frames[0].texture,transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false}));this.root.add(this.sprite);
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.4,24),new THREE.MeshBasicMaterial({color:0x101020,transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter,_time:number):void{
  let frame:Frame;
  if(this.companion){
   const active=f.move&&f.moveFrame>=characters.dodo.moves[f.move].startupFrames;
   const pose=active?(f.move==='ball'?5:f.move==='pkJab'?3:4):f.state.startsWith('Walk')?1+Math.floor(f.stateFrame/6)%2:0;
   const count=this.walking.length,step=Math.floor(f.stateFrame/6)%count;
   const jump=companionJumpPose(f);
   frame=jump!==null&&this.jumping.length?this.jumping[jump]:!f.move&&f.state.startsWith('Walk')&&count?this.walking[f.state==='WalkBackward'?(count-step)%count:step]:this.frames[pose];
  }else{
   const pose=dodoPose(f);
   const performing=this.playing.length>0&&(pose===14||f.weaponUntil>0)&&!['KO','Respawning','Knockdown','GetUp','MatchWin','MatchLose'].includes(f.state)&&!f.state.includes('HitStun');
   const dashing=!f.move&&f.state.startsWith('Dash');
   const count=this.walking.length,step=Math.floor(f.stateFrame/(dashing?3:7))%count;
   const recovering=f.move&&f.moveFrame>=characters.dodo.moves[f.move].startupFrames+characters.dodo.moves[f.move].activeFrames;
   frame=dashing&&count?this.walking[f.state==='DashBackward'?(count-step)%count:step]:performing?this.playing[Math.floor(animationTick(f)/6)%this.playing.length]:!f.move&&f.state.startsWith('Walk')&&count?this.walking[f.state==='WalkBackward'?(count-step)%count:step]:this.attacks.length&&[7,8].includes(pose)?this.attacks[pose===8?1:recovering?2:0]:this.frames[pose];
  }
  // Different sheets can have different pixel scales; their own standing frame anchors height.
  const source=this.walking.includes(frame)?this.walking:this.playing.includes(frame)?this.playing:this.attacks.includes(frame)?this.attacks:this.frames;
  const scale=(this.companion?1.86:1.82)/(frame.referenceHeight??source[0].height);
  this.sprite.material.map=frame.texture;
  this.sprite.scale.set(frame.width*scale,frame.height*scale,1);this.sprite.position.set((frame.width/2-frame.pivot)*scale,frame.height*scale/2,0);
  this.sprite.rotation.z=f.state==='DashForward'?-.12:f.state==='DashBackward'?.08:0;
  this.root.position.set(worldX(f.x),f.y/100,.12);this.root.scale.set(f.facing,1,1);
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(1,.5,1);
 }
 // Isolated textures are shared by all instances and retained by the loader cache.
 dispose(){this.sprite.geometry.dispose();this.sprite.material.dispose();this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();}
}
const assets=new RetryableAssets<{base:Frame[][];playing:Frame[][];walking:Frame[][];attacks:Frame[];companions:Frame[][];companionWalks:Frame[][];companionJumps:Frame[][]}>();
export async function loadDodo(register:(id:string,factory:()=>FighterVisual,skin?:string)=>void){
 const a=await assets.get(async own=>{
  const read=async(name:string,cols:number,rows:number,pixelArt=false,hipAnchor=false)=>{const frames=framesFrom(await loadTexture(`/art/dodo/${name}.png`),cols,rows,pixelArt,hipAnchor);for(const f of frames)own(f.texture);return frames;};
  const base=await Promise.all([read('roster-atlas-1',4,4,true),read('roster-black-matched-v4',4,4,true)]);
  for(const frame of base[1])frame.referenceHeight=base[1][0].height;
  const neutral=await read('neutral-poses-v1',3,2,true,true);
  for(let i=0;i<2;i++){const [standing,crouch,jump]=neutral.slice(i*3,i*3+3);crouch.referenceHeight=jump.referenceHeight=standing.height;base[i].push(crouch,jump);}
  const guitar=await read('guitar-black-v4',3,2,true);
  for(const frame of guitar)frame.referenceHeight=guitar[0].height;

  base[1][0]=guitar[0];base[1][7]=guitar[2];base[1][8]=guitar[1];
  const playing=await Promise.all([read('roster-playing-1',2,2,true),read('roster-playing-2',2,2,true)]);
  const walk=await read('walk-matched-v4',4,2,true,true);
  const walking=[walk.slice(0,4),walk.slice(4,8)];
  // Retain all repair frames for disposal; only the intended strike/windup pair is selected.
  const attacks:Frame[]=[guitar[2],guitar[1],guitar[3],guitar[4],guitar[5]];
  const companions=await Promise.all(dodoCompanions.map(c=>read(c.atlas,3,2,true)));
  const companionWalks=await Promise.all(dodoCompanions.map(c=>read(c.walk,4,2,true,true)));
  const companionJumps=await Promise.all(dodoCompanions.map((_,i)=>read(`companion-jump-v1-${i}`,3,2,true,true)));
  for(const frames of companionJumps)for(const frame of frames)frame.referenceHeight=frames[0].height;
  return {base,playing,walking,attacks,companions,companionWalks,companionJumps};
 });
 for(let i=0;i<2;i++)register('dodo',()=>new DodoRenderer(a.base[i],a.playing[i],i?a.attacks:[],false,a.walking[i]),i?'black':'original');
 for(let i=0;i<3;i++)register('dodo',()=>new DodoRenderer(a.companions[i],[],[],true,a.companionWalks[i],a.companionJumps[i]),`pain-killer-${i}`);
}

export async function disposeDodoAssets():Promise<void>{assets.dispose();}
