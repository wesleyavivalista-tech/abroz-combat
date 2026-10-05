import * as THREE from 'three';
import type {SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {worldX} from './StageCoordinates.js';
import {GUT_SPEAR_LENGTH} from './GutSpearVisual.js';
/** The same rigid artwork as the held spear. Projectile coordinates track its tip. */
export class SpearProjectiles {
 readonly root=new THREE.Group();
 private shots:THREE.Mesh[]=[];
 constructor(){
  const texture=new THREE.TextureLoader().load('/art/gut/spear-weapon-v3.png');
  texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
  texture.repeat.set(1406/1536,165/1024);texture.offset.set(64/1536,1-632/1024);
  const geometry=new THREE.PlaneGeometry(GUT_SPEAR_LENGTH,165*GUT_SPEAR_LENGTH/1406);
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.2,side:THREE.DoubleSide,toneMapped:false});
  for(let i=0;i<64;i++){const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;this.shots.push(mesh);this.root.add(mesh);}
 }
 update(s:SimulationSnapshot,menu:boolean):void{
  this.root.visible=!menu;
  this.shots.forEach((mesh,i)=>{const p=s.projectiles[i];mesh.visible=!!p?.active&&p.move==='spearThrow';if(!mesh.visible)return;
   const facing=p.vx<0?-1:1;
   mesh.scale.x=facing;mesh.position.set(worldX(p.x)-facing*GUT_SPEAR_LENGTH/2,p.y/100-(549.5-496)*GUT_SPEAR_LENGTH/1406,.25);
  });
 }
}
