import {isLowProfile} from '../../../../packages/game-core/simulation/DodoSystem.js';
import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {actors} from '../../../../packages/game-core/simulation/Actors.js';
import {floodHeight} from '../../../../packages/game-core/simulation/BloodSystem.js';
import {worldX} from './StageCoordinates.js';
/** Fixed mesh pool: particles are reconstructed from snapshot time, safe across rollback. */
export class BloodEffects{
 root=new THREE.Group();private pool:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[]=[];private used=0;
 private mesh(x:number,y:number,w:number,h:number,color:number,opacity:number,mode=0,foreground=false):void{
  let m=this.pool[this.used++];
  if(!m){m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color()},alpha:{value:1},mode:{value:0},t:{value:0},waveScale:{value:.01},overlay:{value:0},surface:{value:1}},vertexShader:'varying vec2 p;uniform float overlay;void main(){p=uv;gl_Position=overlay>.5?vec4(position.xy*2.,0.,1.):projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 p;uniform vec3 color;uniform float alpha;uniform float mode;uniform float t;uniform float waveScale;uniform float overlay;uniform float surface;void main(){float a=1.;if(overlay>.5){float wave=surface+.002*sin(p.x*65.+t*2.)+.001*sin(p.x*113.-t*3.);a=(1.-smoothstep(wave-.002,wave,p.y))*(.92+.08*sin(p.y*60.+t));}else if(mode<.5){float d=length((p-.5)*2.);a=1.-smoothstep(.65,1.,d);}else{float wave=1.-waveScale+waveScale*.5*sin(p.x*45.+t*2.)+waveScale*.25*sin(p.x*89.-t*3.);a=(1.-smoothstep(wave-waveScale*.25,wave,p.y))*(.85+.15*sin(p.y*60.+t));}gl_FragColor=vec4(color,alpha*a);}'}));this.pool.push(m);this.root.add(m);}
  // Flood is a foreground layer: depth sorting must never place fighters over it.
  // Reset both properties because this mesh can be reused for an ordinary particle.
  m.renderOrder=foreground?100:0;m.material.depthTest=!foreground;m.frustumCulled=!foreground;m.material.uniforms.overlay.value=foreground?1:0;m.userData.surfaceY=(y+h/2)/100;
  m.visible=true;m.position.set(worldX(x),y/100,.24);m.scale.set(w/100,h/100,1);m.material.uniforms.color.value.set(color);m.material.uniforms.alpha.value=opacity;m.material.uniforms.mode.value=mode;m.material.uniforms.waveScale.value=Math.min(.04,8/Math.max(1,h));
 }
 /** Project the surface after camera tracking; fill every screen pixel below it. */
 updateCamera(camera:THREE.Camera):void{
  for(const m of this.pool){
   if(!m.visible||!m.material.uniforms.overlay.value)continue;
   const surface=new THREE.Vector3(m.position.x,m.userData.surfaceY,m.position.z).project(camera);
   m.material.uniforms.surface.value=(surface.y+1)/2;
  }
 }
 update(s:SimulationSnapshot,menu:boolean):void{
  this.pool.forEach(m=>m.visible=false);this.used=0;if(menu||s.phase!=='fight')return;
  for(const h of s.hazards){
   if(!h.kind?.startsWith('blood-'))continue;
   const fade=Math.min(1,(h.expiresAt-s.frame)/15);
   if(h.kind==='blood-flood'){const height=h.y+floodHeight(h,s.frame);this.mesh(h.x,(height-650)/2,(h.width??2400)+600,height+650,0x960d25,.78*fade,1,true);}
   else {this.mesh(h.x,h.y+3,h.width??48,16,0x830b20,.9*fade);this.mesh(h.x,h.y+5,(h.width??48)*.8,5,0xd32943,.5*fade);}
  }
  for(const {fighter:f} of actors(s)){
   if(!f.health||f.respawnAt||isLowProfile(f,s.frame))continue;
   const poisoned=f.poisonUntil>s.frame,bloody=f.bloodSlowUntil>s.frame||f.areaSlow<1,master=f.bloodMasterUntil>s.frame;
   const shadow=f.characterId==='caio'&&(f.state.startsWith('Dash')||(f.move==='vanish'&&f.moveFrame<12));
   const jump=f.characterId==='caio'&&f.airJumpsUsed===2&&f.stateFrame<18;
   if(f.characterId==='caio'&&f.move==='flood'&&f.moveFrame>=30&&f.moveFrame<130){
    // A continuous source from the back of the squat feeds the rising flood.
    for(let i=0;i<24;i++){
     const p=((s.frame*.065+i/24)%1),x=f.x-f.facing*(24+p*100),y=f.y+48-p*65+Math.sin(p*3.14)*18;
     this.mesh(x,y,20+p*28,14+p*12, i%2?0x9e1028:0xde2945,.95*(1-p*.6));
    }
   }
   if(shadow&&f.state.startsWith('Dash')){
    const direction=f.facing*(f.state==='DashBackward'?-1:1);
    for(let i=0;i<22;i++){
     const p=i/22,flutter=Math.sin(i*2.3+s.frame*.9);
     this.mesh(f.x-direction*p*210,f.y+55+flutter*(15+p*30),75-p*45,80*(1-p)+12, i%3?0x10091c:0x462456,(1-p)*.8);
    }
   }
   if(poisoned||bloody||master||shadow||jump){
    for(let i=0;i<14;i++){
     const phase=((s.frame*(shadow?.075:.025)+i*.37)%1),angle=i*2.399+s.frame*.04;
     const color=shadow?0x160e24:poisoned?(i%2?0x9bc94d:0x9c49cb):0xaf1336;
     const x=f.x+Math.sin(angle)*(shadow?48:35)-(jump?f.facing*25:0);
     const y=jump?f.y+40-phase*85:f.y+phase*170;
     this.mesh(x,y,shadow?30:10,shadow?50:20,color,(1-phase)*(shadow?.75:.65));
    }
   }
  }
  for(const p of s.projectiles){if(p.active&&s.fighters[p.owner].characterId==='caio'&&p.move==='dart'){this.mesh(p.x,p.y,38,4,0xdcb584,1,1);this.mesh(p.x+Math.sign(p.vx)*17,p.y,9,7,0x91f15f,1);}}
  for(let i=0;i<this.used;i++)this.pool[i].material.uniforms.t.value=s.frame/60;
 }
}
