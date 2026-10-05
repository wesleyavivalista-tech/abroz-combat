import {renderStage} from './StageCoordinates.js';
import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
import {drupaPunchData} from './drupaPunchData.js';
import {drupaMotionData} from './drupaMotionData.js';
import * as THREE from 'three';
import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {lightBeam} from '../../../../packages/game-core/simulation/LightBeamSystem.js';
import {drupaAtlases} from './DrupaAtlas.js';
import {SpriteIsolation} from './SpriteIsolation.js';
import {worldX,arenaWidth} from './StageCoordinates.js';
import type {FighterVisual} from './FighterRenderer.js';
export function drupaDashPhase(frame:number):number{
 return frame<2?0:frame<5?1:frame<7?2:frame<10?3:4;
}
export function drupaCrossPhase(frame:number,startup:number,active:number):number{
 return frame<startup-3?0:frame<startup?1:frame<startup+active?2:3;
}
export function drupaPose(f:Fighter,buda:boolean):number{
 const m=f.move?characters.drupa.moves[f.move]:undefined;
 if(buda){
  if(f.stun||f.state.includes('HitStun'))return 14;
  if(f.move==='budaBeam')return 11;
  if(f.move==='budaForward')return 8;
  if(f.move==='budaSky')return f.moveFrame<(m?.startupFrames??12)?9:f.moveFrame<(m?.startupFrames??12)+(m?.activeFrames??8)?10:0;
  if(f.move?.startsWith('buda')&&m?.damage)return f.moveFrame<m.startupFrames?4:f.moveFrame<m.startupFrames+m.activeFrames?(f.move==='budaSwing2'?6:5):7;
  if(f.state.startsWith('Walk'))return [1,2,3,2][Math.floor(f.stateFrame/7)%4];
  if(f.state.startsWith('Dash'))return 13;
  if(['Jump','Fall','JumpStartup'].includes(f.state))return 12;
  if(f.state.includes('Crouch'))return 15;
  return 0;
 }
 if(['KO','Knockdown','Respawning'].includes(f.state))return 13;
 if(f.stun||f.state.includes('HitStun'))return 12;
 if(f.move==='rolling'&&m&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames)return 15;
 if(f.move==='air')return 6;
 if(f.move==='bellyDive')return f.moveFrame<9?6:14;
 if(m?.damage&&!m.beam){
  if(f.moveFrame<m.startupFrames)return 8;
  if(f.moveFrame>=m.startupFrames+m.activeFrames+7)return 0;
  if(['belly','bellyFinish'].includes(f.move!))return 11;
  if(f.move==='low')return 5;
  return 9;
 }
 if(f.state.startsWith('Walk')){const phase=Math.floor(f.stateFrame/7)%4;return [1,2,3,4][f.state==='WalkBackward'?(4-phase)%4:phase];}
 if(f.state.startsWith('Dash'))return 7;
 if(['Jump','Fall','JumpStartup'].includes(f.state))return 6;
 if(f.state.includes('Crouch')||f.state==='Land')return 5;
 return 0;
}
export class DrupaRenderer implements FighterVisual{
 get fallBodies():THREE.Object3D[]{return [this.sprite];}
 root=new THREE.Group();shadow:THREE.Mesh;
 private sprite:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private isolation:SpriteIsolation;
 private textures:THREE.Texture[];
 private beam=new THREE.Group();private stream=new THREE.Group();private sunlight=new THREE.Group();private warning:THREE.Mesh;private aura:THREE.Mesh;private glint:THREE.Mesh;
 constructor(atlases:THREE.Texture[],private skin:number){
  this.textures=atlases.map(t=>{const v=t.clone();v.needsUpdate=true;return v;});
  this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.4,toneMapped:false,side:THREE.DoubleSide}));
  this.isolation=new SpriteIsolation(this.sprite.material);this.root.add(this.sprite,this.beam,this.sunlight);this.beam.add(this.stream);
  this.warning=new THREE.Mesh(new THREE.PlaneGeometry(1,.045),new THREE.MeshBasicMaterial({color:0xe9db92,transparent:true,depthWrite:false,toneMapped:false}));this.root.add(this.warning);
  for(let i=0;i<22;i++){const p=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:i%2?0xffffff:0xb8d9ff,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));this.stream.add(p);}
  for(let i=0;i<3;i++){const p=new THREE.Mesh(new THREE.PlaneGeometry(.04+i*.05,5),new THREE.MeshBasicMaterial({color:0xffdd80,transparent:true,opacity:.5/(i+1),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));p.position.set(-1.2,3.845,.07);p.rotation.z=.5;this.sunlight.add(p);}
  for(const [width,opacity,color] of [[1.12,.12,0xc7dcff],[1,.88,0xf3f6ff],[.55,1,0xffffff]]){
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,uniforms:{t:{value:0},tint:{value:new THREE.Color(color)},alpha:{value:opacity}},vertexShader:'varying vec2 p; void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 p;uniform float t;uniform vec3 tint;uniform float alpha;void main(){float edge=1.0-smoothstep(.93,1.0,abs(p.y-.5)*2.0);float flow=.88+.08*sin(p.x*150.0-t*1.2+p.y*18.0)+.04*sin(p.x*310.0-t*2.1);gl_FragColor=vec4(tint,alpha*edge*flow);}'}));mesh.userData.width=width;this.beam.add(mesh);
  }
  this.aura=new THREE.Mesh(new THREE.RingGeometry(.85,.865,64),new THREE.MeshBasicMaterial({color:0xe4edff,transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));this.root.add(this.aura);
  this.glint=new THREE.Mesh(new THREE.CircleGeometry(.12,16),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.root.add(this.glint);
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.48,24),new THREE.MeshBasicMaterial({color:0x15121a,transparent:true,opacity:.22,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;
 }
 update(f:Fighter):void{
  const buda=f.weaponUntil>0||f.move==='budaBeam'||f.move==='buda';
  const forwardDash=!buda&&f.state==='DashForward'&&!f.move;
  const move=f.move?characters.drupa.moves[f.move]:undefined;
  const boxing=!buda&&!f.stun&&['swing1','swing2'].includes(f.move??'');
  const punching=boxing&&!!move&&f.moveFrame<move.startupFrames+move.activeFrames+7;
  const walking=!buda&&!f.move&&!f.stun&&f.state.startsWith('Walk');
  const belly=!buda&&!f.stun&&['belly','bellyFinish'].includes(f.move??'');
  const idle=!buda&&!f.move&&!f.stun&&drupaPose(f,false)===0;
  const unified=boxing||walking||belly||idle;
  const correction=!buda&&f.move==='bellyDive';
  const index=buda?2:punching?7:unified?6:forwardDash?4:correction?3:this.skin;
  const data=punching?drupaPunchData:unified?drupaMotionData:drupaAtlases[buda?'buda-complete-v4':forwardDash?'dash-forward-v1':correction?'combat-v2':this.skin?'atlas-2':'atlas-1'];
  let pose=drupaPose(f,buda);
  if(correction)pose=this.skin*4+3;
  if(unified){
   pose=this.skin*8;
   if(punching&&move)pose=this.skin*8+(f.move==='swing2'?4:0)+drupaCrossPhase(f.moveFrame,move.startupFrames,move.activeFrames);
   if(belly&&move)pose+=f.moveFrame<move.startupFrames?6:7;
   if(walking){const phase=Math.floor(f.stateFrame/8)%4;pose+=[1,2,3,2][f.state==='WalkBackward'?(4-phase)%4:phase];}
  }
  if(forwardDash)pose=this.skin*5+drupaDashPhase(f.stateFrame);
  const [l,t,r,b]=data.frames[pose],w=r-l+2,h=b-t+2,texture=this.textures[index];
  const giant=f.weaponUntil>0?3:f.move==='buda'?1+Math.min(1,f.moveFrame/36)*2:1;
  const baseline=unified?data.frames[this.skin*8]:forwardDash?data.frames[this.skin*5+4]:correction?data.frames[this.skin*4]:data.frames[0];
  const scale=1.75/(baseline[3]-baseline[1])*giant;
  texture.repeat.set(w/data.width,h/data.height);texture.offset.set((l-1)/data.width,1-(b+1)/data.height);
  this.sprite.material.map=texture;this.isolation.select(texture,data.frames,pose);
  this.sprite.scale.set(w*scale,h*scale,1);this.sprite.position.set(0,h*scale/2,0);this.sprite.rotation.z=0;
  // One atlas, anatomical scale and body pivot for every transformed movement.
  if(buda){const pivot=[162,475,784,1108,163,476,789,1107,163,477,771,1093,162,477,793,1102][pose];this.sprite.position.x=((l+r)/2-pivot)*scale;}
  // Keep luminous whites below the scene bloom threshold so the sprite stays crisp.
  this.sprite.material.color.setRGB(buda?.8:1,buda?.8:1,buda?.8:1);
  // Shared head/body scale and authored hip anchor prevent identity/size jumps between states.
  if(unified&&!punching)this.sprite.position.x=((l+r)/2-drupaMotionData.pivots[pose])*scale;
  if(punching)this.sprite.position.x=((l+r)/2-drupaPunchData.pivots[pose])*scale;
  if(f.move==='rolling'&&pose===15)this.sprite.rotation.z=-f.stateFrame*.3;
  const m=f.move?characters.drupa.moves[f.move]:undefined;
  this.aura.visible=buda;this.aura.position.set(0,.95*giant,-.03);this.aura.scale.setScalar(giant*(1+Math.sin(f.stateFrame*.07)*.03));
  const ray=lightBeam(f,arenaWidth*100,renderStage.floorHeight);this.beam.visible=!!ray;
  if(ray){
   this.beam.position.set((m?.beam?.originX??0)/100,(ray.y-f.y)/100,.04);this.beam.rotation.z=m?.beam?.downward?-Math.PI/2:m?.beam?.upward?Math.PI/2:f.beamAim*Math.PI/180;
   for(const child of this.beam.children){if(child===this.stream)continue;(child as THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>).material.uniforms.t.value=f.moveFrame;child.position.x=ray.length/200;child.scale.set(ray.length/100,ray.width/100*child.userData.width*(1+Math.sin(f.moveFrame*.7)*.07),1);}
   this.stream.children.forEach((child,i)=>{const travel=((f.moveFrame*.23+i*.73)%(ray.length/100));child.position.set(travel,Math.sin(i*2.4+f.moveFrame*.24)*ray.width/240,.02);child.scale.set(.3+(i%4)*.22,.02+(i%3)*.014,1);});
  }
  this.sunlight.visible=f.move==='bald';
  this.sunlight.scale.setScalar(1+Math.sin(f.moveFrame*.6)*.035);
  this.warning.visible=!!m?.beam?.downward&&f.moveFrame<m.startupFrames;
  this.warning.position.set((m?.beam?.originX??0)/100,-f.y/100+.035,.09);
  this.warning.scale.x=(m?.beam?.width??0)/100;
  (this.warning.material as THREE.MeshBasicMaterial).opacity=.3+.5*Math.abs(Math.sin(f.moveFrame*.15));
  this.glint.visible=!!m?.beam;this.glint.position.set((m?.beam?.originX??0)/100,(m?.beam?.originY??150)/100,.06);
  this.glint.scale.setScalar(m?Math.min(1,.3+f.moveFrame/Math.max(1,m.startupFrames)*.6):1);
  this.root.position.set(worldX(f.x),f.y/100,.1);this.root.scale.x=f.facing;
  this.shadow.position.set(worldX(f.x),surfaceBelow(renderStage,f.x,f.y)/100+.02,0);this.shadow.scale.set(giant,.5*giant,1);
 }
 dispose():void{
  this.textures.forEach(t=>t.dispose());
  this.root.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();(obj.material as THREE.Material).dispose();}});
  this.shadow.geometry.dispose();(this.shadow.material as THREE.Material).dispose();
 }
}
