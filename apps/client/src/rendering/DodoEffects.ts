import * as THREE from 'three';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {isLowProfile,MUSIC_RADIUS} from '../../../../packages/game-core/simulation/DodoSystem.js';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {worldX} from './StageCoordinates.js';
/** Snapshot-driven rings and basketballs; no timers outside the simulation. */
export class DodoEffects{
 root=new THREE.Group();private rings:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>[]=[];private balls:THREE.Group[]=[];private count=0;
 private ring(x:number,y:number,r:number,opacity:number,front=0){
  let m=this.rings[this.count++];
  if(!m){m=new THREE.Mesh(new THREE.RingGeometry(.94,1,64,1,front?-Math.PI/2:0,front?Math.PI:Math.PI*2),new THREE.MeshBasicMaterial({color:0x8aeaff,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));m.userData.front=front;this.rings.push(m);this.root.add(m);}
  if(m.userData.front!==front){m.geometry.dispose();m.geometry=new THREE.RingGeometry(.94,1,64,1,front?-Math.PI/2:0,front?Math.PI:Math.PI*2);m.userData.front=front;}
  m.visible=true;m.position.set(worldX(x),y/100,.3);m.scale.set(r/100*(front||1),r/100,1);m.material.opacity=opacity;
 }
 update(s:SimulationSnapshot,menu:boolean){
  this.root.visible=!menu&&s.phase==='fight';this.rings.forEach(m=>m.visible=false);this.balls.forEach(m=>m.visible=false);this.count=0;if(!this.root.visible)return;
  for(const f of s.fighters){
   if(f.characterId!=='dodo'||!f.health||f.respawnAt||isLowProfile(f,s.frame))continue;
   if(f.weaponUntil>s.frame)for(let j=0;j<3;j++){
    const phase=((s.frame+j*10)%30)/30;this.ring(f.x,f.y+90,30+phase*(MUSIC_RADIUS-30),(1-phase)*.55);
   }
   if(f.move==='starWave'&&f.moveFrame<characters.dodo.moves.starWave.chargeFrames!){const phase=Math.max(0,f.moveFrame)/characters.dodo.moves.starWave.chargeFrames!;this.ring(f.x+f.facing*65,f.y+105,15+phase*50,.35+phase*.6);}
  }
  s.projectiles.forEach((p,i)=>{
   if(!p.active||s.fighters[p.owner].characterId!=='dodo'||isLowProfile(s.fighters[p.owner],s.frame))return;
   const spec=characters.dodo.moves[p.move].projectile;
   if(spec?.visual==='sound')for(let j=0;j<3;j++)this.ring(p.x-Math.sign(p.vx)*j*16,p.y,(spec.radius??48)*(1-j*.12),.9-j*.2,Math.sign(p.vx));
   if(spec?.visual==='basketball'){
    let g=this.balls[i];if(!g){g=new THREE.Group();g.add(new THREE.Mesh(new THREE.SphereGeometry(.18,16,12),new THREE.MeshBasicMaterial({color:0xe6842b,toneMapped:false})));
     for(let j=0;j<3;j++){const seam=new THREE.Mesh(new THREE.TorusGeometry(.182,.009,4,32),new THREE.MeshBasicMaterial({color:0x352316}));seam.rotation.set(j===0?Math.PI/2:0,j===1?Math.PI/2:0,0);g.add(seam);}this.balls[i]=g;this.root.add(g);}
    g.visible=true;g.position.set(worldX(p.x),p.y/100,.3);g.rotation.z=s.frame*.15;
   }
  });
 }
}
