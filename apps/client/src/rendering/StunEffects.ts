import {isLowProfile} from '../../../../packages/game-core/simulation/DodoSystem.js';
import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {worldX} from './StageCoordinates.js';
/** Orbiting stars follow the actual stunned fighter, including hair clones. */
export class StunEffects {
 root=new THREE.Group();private pool:THREE.Group[]=[];
 update(s:SimulationSnapshot,hidden:boolean){
  const actors=[...s.fighters,...s.clones.map(c=>c.fighter)];
  this.pool.forEach(g=>g.visible=false);
  actors.forEach((f,i)=>{
   if(hidden||isLowProfile(f,s.frame)||!f.dazed||!f.stun||f.lives<=0||f.respawnAt)return;
   let g=this.pool[i];if(!g){g=new THREE.Group();this.pool[i]=g;this.root.add(g);
    const shape=new THREE.Shape();for(let k=0;k<10;k++){const a=k*Math.PI/5+Math.PI/2,r=k%2?.055:.13;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(k)shape.lineTo(x,y);else shape.moveTo(x,y);}shape.closePath();
    for(let j=0;j<3;j++)g.add(new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xffe676,depthTest:false,toneMapped:false,side:THREE.DoubleSide})));
   }
   const scale=f.weaponUntil>s.frame?characters[f.characterId].weaponModifiers?.bodyScale??1:1;
   g.visible=true;g.position.set(worldX(f.x),f.y/100+1.8*scale+.2,.3);
   g.children.forEach((star,j)=>{const angle=s.frame*.09+j*Math.PI*2/3;star.position.set(Math.cos(angle)*.4*scale,Math.sin(angle)*.1,.1);star.rotation.z=-angle;});
  });
 }
}
