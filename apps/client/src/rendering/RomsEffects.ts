import {hoseVisualOrigin} from '../../../../packages/game-core/simulation/HoseAim.js';
import {renderStage} from './StageCoordinates.js';
import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {lightBeam,beamHitsFighter} from '../../../../packages/game-core/simulation/LightBeamSystem.js';
import {worldX,arenaWidth} from './StageCoordinates.js';
const colors=[0xf85442,0xf9c848,0x44bced,0x8c72df,0x61dfa0];
export class RomsEffects {
 root=new THREE.Group();private meshes:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[]=[];private used=0;
 private add(x:number,y:number,w:number,h:number,color:number,mode=0,angle=0,alpha=1,t=0){
  let mesh=this.meshes[this.used++];
  if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color()},alpha:{value:1},mode:{value:0},t:{value:0}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform vec3 color;uniform float alpha;uniform float mode;uniform float t;void main(){float a=1.;vec3 c=color;if(mode<.5){float d=length((p-.5)*2.);a=1.-smoothstep(.86,1.,d);c*=.6+.4*(1.-p.y);c+=vec3(.4)*exp(-length(p-vec2(.35,.7))*18.);}else if(mode>1.5){float edge=abs(p.y-.5)*2./mix(.18,1.,smoothstep(0.,.10,p.x));a=(1.-smoothstep(.65,1.,edge))*(.7+.3*sin(p.x*180.-t*2.+p.y*20.));c+=vec3(.2)*pow(max(0.,sin(p.x*110.-t*3.+p.y*32.)),8.);}gl_FragColor=vec4(c,a*alpha);}'}));this.meshes.push(mesh);this.root.add(mesh);}
  mesh.visible=true;mesh.position.set(worldX(x),y/100,.3);mesh.scale.set(w/100,h/100,1);mesh.rotation.z=angle;mesh.material.uniforms.color.value.set(color);mesh.material.uniforms.mode.value=mode;mesh.material.uniforms.alpha.value=alpha;mesh.material.uniforms.t.value=t;
 }
 update(s:SimulationSnapshot,menu:boolean):void {
  this.meshes.forEach(m=>m.visible=false);this.used=0;if(menu)return;
  for(const p of s.projectiles){if(!p.active||!p.trajectory)continue;
   if(p.trajectory==='axe'){const a=(p.age??0)*.28;this.add(p.x,p.y,8,72,0x82572e,1,a);this.add(p.x-Math.sin(a)*27,p.y+Math.cos(a)*27,42,25,0xb92525,1,a);this.add(p.x-Math.sin(a)*27-10*Math.cos(a),p.y+Math.cos(a)*27,13,28,0xd7dbe1,1,a);}
   else this.add(p.x,p.y,29,29,colors[p.serial%5]);
  }
  s.fighters.forEach((f,owner)=>{
   if(f.characterId!=='roms'||!f.health||f.respawnAt)return;
   if(f.weaponUntil){const out=s.projectiles.filter(p=>p.active&&p.owner===owner&&p.trajectory&&p.trajectory!=='axe').length;for(let i=0;i<4-out;i++){const phase=(f.stateFrame%40)/40;const q=(phase+i*.25)%1;const side=i%2?1:-1;this.add(f.x+f.facing*(54+side*(q-.5)*48),f.y+105+4*q*(1-q)*100,22,22,colors[i]);}}
   const hitRay=lightBeam(f,arenaWidth*100,renderStage.floorHeight);if(!hitRay)return;
   const nozzle=hoseVisualOrigin(f.beamAim),ray={...hitRay,x:f.x+f.facing*nozzle.x,y:f.y+nozzle.y};
   let length=ray.length;
   if(ray.dx>0)length=Math.min(length,(arenaWidth*100-ray.x)/ray.dx);else if(ray.dx<0)length=Math.min(length,-ray.x/ray.dx);
   if(ray.dy<0)length=Math.min(length,-ray.y/ray.dy);
   length=Math.max(0,length);const a=Math.atan2(ray.dy,ray.dx),x=ray.x+ray.dx*length/2,y=ray.y+ray.dy*length/2;
   this.add(x,y,length,54,0x70c5ec,2,a,.42,s.frame);this.add(x,y,length,38,0xb4eafa,2,a,.95,s.frame);this.add(x,y,length,16,0xe2faff,2,a,.8,s.frame);
   const impacts=[{x:ray.x+ray.dx*length,y:ray.y+ray.dy*length},...s.fighters.filter((d,i)=>s.teams[i]!==s.teams[owner]&&beamHitsFighter(hitRay,d)).map(d=>{const along=Math.max(0,Math.min(ray.length,(d.x-ray.x)*ray.dx+(d.y+60-ray.y)*ray.dy));return {x:ray.x+ray.dx*along,y:Math.max(d.y,ray.y+ray.dy*along)};})];
   for(const hit of impacts)for(let i=0;i<14;i++){const phase=(s.frame*.08+i/14)%1,angle=i*2.4;this.add(hit.x+Math.cos(angle)*phase*90,hit.y+Math.sin(angle)*phase*70,7+phase*10,10+phase*10,0xc8f4ff,0,0,(1-phase)*.8);}
  });
 }
}
