import {isLowProfile} from '../../../../packages/game-core/simulation/DodoSystem.js';
import { HairGripProjectile } from "./HairGripProjectile.js";
import * as THREE from "three";
import type { SimulationSnapshot } from "../../../../packages/game-core/types.js";
import { characters } from "../../../../packages/game-core/characters/registry.js";
import { actors } from "../../../../packages/game-core/simulation/Actors.js";
import { worldX } from "./StageCoordinates.js";
function binding():THREE.Group {
 const root=new THREE.Group();
 for(let ring=0;ring<7;ring++)for(let strand=0;strand<4;strand++){
  const points=Array.from({length:49},(_,i)=>{const t=i/48*Math.PI*2;return new THREE.Vector3(Math.cos(t)*(.43+strand*.012),.25+ring*.17+Math.sin(t*3+strand)*.025,Math.sin(t)*.16);});
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.014,3,false),new THREE.MeshBasicMaterial({color:strand%2?'#72513b':'#241b18',toneMapped:false})));
 }
 return root;
}
/** Hair coils fit every roster member; their sway supplies a shared trapped animation. */
export class HairEffects {
 root=new THREE.Group();private bindings=Array.from({length:32},binding);
 private shots=Array.from({length:64},()=>new HairGripProjectile());
 constructor(){this.root.add(...this.bindings,...this.shots);}
 update(s:SimulationSnapshot,menu:boolean):void{
  this.root.visible=!menu;this.bindings.forEach(g=>g.visible=false);
  actors(s).forEach(({fighter:f},i)=>{const g=this.bindings[i];if(!g)return;
   g.visible=!isLowProfile(f,s.frame)&&f.trappedUntil>s.frame&&f.health>0&&!f.respawnAt;
   g.position.set(worldX(f.x),f.y/100,.22);g.rotation.z=Math.sin(s.frame*.25+i)*.025;
  });
  this.shots.forEach((g,i)=>{
   const p=s.projectiles[i];g.visible=!!p?.active&&p.move==='grip';if(!g.visible)return;
   g.position.set(worldX(p.x),p.y/100,.25);g.scale.x=p.vx<0?-1:1;
   const lifetime=characters[s.fighters[p.owner].characterId].moves[p.move].projectile!.lifetime;
   g.animate(s.frame,i,lifetime-p.life);
  });
 }
}
