import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {worldX} from './StageCoordinates.js';
function paperTexture(variant:number){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;
 const poly=(points:number[][],fill:string)=>{x.fillStyle=fill;x.strokeStyle='#788b9f';x.lineWidth=2;x.beginPath();points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();x.stroke();};
 if(variant===0){poly([[12,75],[58,56],[84,12],[74,77]],'#f5f7ff');poly([[58,56],[35,15],[40,83],[75,84]],'#b8cbe4');poly([[72,80],[95,45],[113,55],[98,56],[86,90],[44,94]],'#edf3ff');}
 if(variant===1){poly([[22,80],[29,46],[47,37],[81,37],[100,49],[104,83],[64,96]],'#cbe4be');poly([[26,83],[7,100],[48,101],[62,76]],'#e6f3db');poly([[99,83],[120,100],[80,101],[65,76]],'#b5d7a7');poly([[38,50],[49,25],[59,54]],'#edf7e3');poly([[72,54],[83,25],[94,50]],'#edf7e3');}
 if(variant===2){poly([[63,65],[14,17],[7,68],[48,88],[24,110],[63,93]],'#e4d6fa');poly([[65,65],[113,17],[121,68],[80,88],[104,110],[65,93]],'#c1a9df');poly([[58,47],[69,47],[67,108],[61,108]],'#f4edff');}
 if(variant===3){poly([[18,24],[52,40],[79,40],[111,23],[98,81],[65,112],[28,82]],'#eab87f');poly([[28,70],[65,112],[49,72]],'#fff0d9');poly([[98,70],[65,112],[80,72]],'#f8e3c7');poly([[56,91],[74,91],[65,104]],'#86664a');}
 if(variant===4){for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;poly([[64,68],[64+Math.cos(a-.4)*35,64+Math.sin(a-.4)*35],[64+Math.cos(a)*56,64+Math.sin(a)*56],[64+Math.cos(a+.4)*35,64+Math.sin(a+.4)*35]],i%2?'#e7c4db':'#f6ddea');}poly([[51,57],[76,57],[80,78],[49,78]],'#f2d58f');}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
/** Pooled, snapshot-driven effects. No per-ability timers or lingering objects. */
export class FaustoEffects{
 root=new THREE.Group();private paper:THREE.InstancedMesh[]=[];private clouds:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[]=[];private slashes:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];private matrix=new THREE.Matrix4();private rotation=new THREE.Quaternion();private point=new THREE.Vector3();private size=new THREE.Vector3();
 constructor(){
  for(let i=0;i<5;i++){const m=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:paperTexture(i),transparent:true,alphaTest:.08,depthWrite:false,toneMapped:false}),1024);m.frustumCulled=false;this.paper.push(m);this.root.add(m);}
  for(let i=0;i<256;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{clock:{value:0},fade:{value:1}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float clock;uniform float fade;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}void main(){vec2 p=(v-.5)*2.;float n=noise(v*5.+vec2(clock*.13,-clock*.1))*.65+noise(v*11.-clock*.08)*.35;float a=(1.-smoothstep(.22,1.,length(p)))*(.45+.55*n)*.65*fade;gl_FragColor=vec4(vec3(.75+.15*n),a);}'}));this.clouds.push(m);this.root.add(m);}
  for(let i=0;i<128;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xe7f6ff,transparent:true,depthWrite:false,toneMapped:false}));this.slashes.push(m);this.root.add(m);}
 }
 update(s:SimulationSnapshot,menu:boolean){
  this.root.visible=!menu&&s.phase==='fight';this.paper.forEach(m=>m.count=0);this.clouds.forEach(m=>m.visible=false);this.slashes.forEach(m=>m.visible=false);if(!this.root.visible)return;
  let cloud=0,slash=0;
  const mist=(x:number,y:number,w:number,h:number,fade:number,seed:number)=>{const m=this.clouds[cloud++];if(!m)return;m.visible=true;m.position.set(worldX(x),y/100,.45);m.scale.set(w/100,h/100,1);m.material.uniforms.clock.value=s.frame/12+seed;m.material.uniforms.fade.value=Math.max(0,fade);};
  // Hair-born puffs accompany White Cloud.
  for(const f of s.fighters){
   if(f.characterId!=='fausto'||f.move!=='cloud')continue;
   const duration=characters.fausto.moves[f.move!].startupFrames,t=f.moveFrame;
   if(t>=duration)continue;
   const progress=t/duration,fade=Math.min(1,t/5)*Math.min(1,(duration-t)/10);
   for(let j=0;j<12;j++){const a=j*2.4,r=90*progress*(.45+(j%3)*.25);mist(f.x+Math.cos(a)*r,f.y+150+Math.sin(a)*r*.3+progress*20,45+progress*90,35+progress*65,fade,j);}
  }
  const place=(variant:number,x:number,y:number,scale:number,angle=0)=>{const m=this.paper[variant%5];if(m.count>=1024)return;this.point.set(worldX(x),y/100,.35);this.size.setScalar(scale);this.rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),angle);this.matrix.compose(this.point,this.rotation,this.size);m.setMatrixAt(m.count++,this.matrix);};
  for(const h of s.hazards){const age=s.frame-(h.createdAt??s.frame);
   if(h.kind==='origami')place(h.variant??0,h.x,h.y+17,.45);
   if(h.kind==='paper-burst')for(let j=0;j<6;j++)place((h.variant??0)+j,h.x+Math.cos(j*2.4)*age*3,h.y+20+Math.sin(j*2.4)*age*2+age*2,.18*(1-age/30),age*.12+j);
   if(h.kind==='white-cloud'){const m=this.clouds[cloud++];if(m){m.visible=true;m.position.set(worldX(h.x),h.y/100+(h.height??190)/200,.3);m.scale.set((h.width??300)/100,(h.height??190)/100,1);m.material.uniforms.clock.value=s.frame/30;m.material.uniforms.fade.value=Math.min(1,age/8,(h.expiresAt-s.frame)/20);}}
   if(h.kind==='flash-slash'&&age>=5){const m=this.slashes[slash++];if(m){m.visible=true;m.position.set(worldX(h.x),h.y/100+.9,.4);m.scale.set(1.5,.035,1);m.rotation.z=.6;m.material.opacity=(1-(age-5)/19);}}
  }
  for(const f of s.fighters)if(f.move==='flash'&&f.moveFrame>=characters.fausto.moves.flash.startupFrames&&f.moveFrame<characters.fausto.moves.flash.startupFrames+characters.fausto.moves.flash.activeFrames){const m=this.slashes[slash++];if(m){m.visible=true;m.position.set(worldX(f.x-f.facing*70),f.y/100+.7,.25);m.scale.set(1.6,.04,1);m.rotation.z=0;m.material.opacity=.6;}}
  this.paper.forEach(m=>m.instanceMatrix.needsUpdate=true);
 }
 dispose(){for(const m of this.paper){m.geometry.dispose();const mat=m.material as THREE.MeshBasicMaterial;mat.map?.dispose();mat.dispose();}for(const m of [...this.clouds,...this.slashes]){m.geometry.dispose();m.material.dispose();}this.root.clear();}
}
