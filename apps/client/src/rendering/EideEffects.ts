import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {inLove} from '../../../../packages/game-core/simulation/EideSystem.js';
import {applianceFrames} from './EideRenderer.js';
import {worldX} from './StageCoordinates.js';
export class EideEffects{
 root=new THREE.Group();private meshes:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];private heart:THREE.CanvasTexture;
 constructor(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d')!;x.fillStyle='#ff5d8f';x.beginPath();x.moveTo(32,56);x.bezierCurveTo(-16,23,9,-8,32,15);x.bezierCurveTo(55,-8,80,23,32,56);x.fill();this.heart=new THREE.CanvasTexture(c);this.heart.colorSpace=THREE.SRGBColorSpace;}
 update(s:SimulationSnapshot,menu:boolean){this.root.visible=!menu;let used=0;const draw=(texture:THREE.Texture,x:number,y:number,w:number,h:number,angle=0)=>{let mesh=this.meshes[used++];if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,toneMapped:false,depthWrite:false,side:THREE.DoubleSide}));this.meshes.push(mesh);this.root.add(mesh);}mesh.visible=true;mesh.material.map=texture;mesh.position.set(worldX(x),y/100,.35);mesh.scale.set(w/100,h/100,1);mesh.rotation.z=angle;};
  if(!menu){for(const p of s.projectiles)if(p.active&&characters[s.fighters[p.owner].characterId].moves[p.move].projectile?.visual==='appliance'){const f=applianceFrames[p.variant??0];if(f){const size=90,ratio=f.width/f.height;draw(f.texture,p.x,p.y,size*Math.min(1,ratio),size/Math.max(1,ratio),p.move==='bahia'?-s.frame*.05:Math.sin(s.frame*.07)*.08);}}
   for(const f of s.fighters)if(f.characterId==='eide'&&(f.move==='seller'||f.move==='bahia')&&f.moveFrame<characters.eide.moves[f.move].startupFrames){const frame=applianceFrames[f.applianceVariant??0];if(frame){const ratio=frame.width/frame.height;draw(frame.texture,f.x+f.facing*(f.move==='seller'?60:5),f.y+(f.move==='seller'?115:195),90*Math.min(1,ratio),90/Math.max(1,ratio));}}
   for(const f of s.fighters)if(inLove(f)&&f.health>0)for(let i=0;i<3;i++){const age=(s.frame*1.2+i*27)%85;draw(this.heart,f.x-30+i*30+Math.sin(age*.08)*10,f.y+170+age*.7,15,15);}
  }for(let i=used;i<this.meshes.length;i++)this.meshes[i].visible=false;
 }
 dispose(){this.meshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});this.heart.dispose();}
}
