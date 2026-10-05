import * as THREE from 'three';
import type { SimulationSnapshot } from '../../../../packages/game-core/types.js';
import { characters } from '../../../../packages/game-core/characters/registry.js';
import { createFighterVisual } from './VisualRegistry.js';
import type { FighterVisual } from './FighterRenderer.js';
import { worldX } from './StageCoordinates.js';

const strands=12,segments=28;
function bundle(){
 const geometry=new THREE.BufferGeometry();
 const positions=new Float32Array(strands*(segments+1)*2*3),colors=new Float32Array(positions.length),indices:number[]=[];
 for(let strand=0;strand<strands;strand++)for(let j=0;j<=segments;j++)for(let side=0;side<2;side++){
  const v=(strand*(segments+1)+j)*2+side;
  const color=new THREE.Color(['#211813','#493023','#73513b'][strand%3]);colors.set([color.r,color.g,color.b],v*3);
  if(j<segments&&side===0)indices.push(v,v+1,v+2,v+1,v+3,v+2);
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false}));mesh.frustumCulled=false;return mesh;
}
/** Presentation derives entirely from move ticks, so rewinds don't restart the growth. */
export class HairCloneGrowth {
 root=new THREE.Group();
 private previews:FighterVisual[][]=[];
 // Three growth strands for each of the eight supported player seats.
 private bundles=Array.from({length:8*3},bundle);
 constructor(){this.root.add(...this.bundles);}
 update(s:SimulationSnapshot,menu:boolean,time:number):void{
  this.root.visible=!menu&&s.phase==='fight';
  this.previews.flat().forEach(v=>v.root.visible=false);this.bundles.forEach(b=>b.visible=false);
  if(!this.root.visible)return;
  s.fighters.forEach((f,owner)=>{
   if(f.characterId!=='bozo'||f.move!=='clones'||f.health<=0)return;
   const startup=characters.bozo.moves.clones.startupFrames;
   if(f.moveFrame<4)return;
   const progress=THREE.MathUtils.clamp((f.moveFrame-4)/(startup-4),0,1);
   const detach=THREE.MathUtils.clamp((f.moveFrame-startup)/18,0,1);
   if(detach>=1)return;
   const previews=this.previews[owner]??=Array.from({length:3},()=>{const v=createFighterVisual(characters.bozo,'hair-clone');this.root.add(v.root);return v;});
   const spawned=s.clones.filter(c=>c.owner===owner);
   for(let i=0;i<3;i++){
    const growth=THREE.MathUtils.smoothstep(progress,0.08+i*.12,1);
    const size=.04+.96*growth;
    const originX=worldX(f.x)+(i===0?.19:i===1?-.22:.25)*f.facing;
    const originY=f.y/100+(i===0?1.18:.92);
    const target=spawned[i]?.fighter;
    const endX=target?worldX(target.x):worldX(f.x)+(i-1)*.75;
    const endY=target?target.y/100:f.y/100;
    const x=THREE.MathUtils.lerp(originX,endX,growth);
    const y=THREE.MathUtils.lerp(originY-.75*size,endY,growth);
    const v=previews[i];v.root.visible=f.moveFrame<startup;
    if(v.root.visible){v.update({...f,state:'Idle',move:null,stateFrame:s.frame,armorUntil:0},time);v.root.position.set(x,y,.04+i*.005);v.root.scale.set(f.facing*size,size,1);}
    const mesh=this.bundles[owner*3+i];mesh.visible=true;mesh.material.opacity=1-detach;
    const p=mesh.geometry.attributes.position;
    for(let strand=0;strand<strands;strand++)for(let j=0;j<=segments;j++){
     const t=j/segments,spread=Math.sin(t*Math.PI),phase=t*16+strand*2.4-s.frame*.2;
     const width=(.003+.008*Math.sin(t*Math.PI))*(1-detach)*(.3+progress*.7);
     const px=THREE.MathUtils.lerp(originX,x,t)+Math.sin(phase)*.035*spread;
     const py=THREE.MathUtils.lerp(originY,y+.85*size,t)+Math.sin(t*Math.PI)*(.2+i*.10)+Math.cos(phase)*.055*spread+(strand-5.5)*.012*spread;
     for(let side=0;side<2;side++)p.setXYZ((strand*(segments+1)+j)*2+side,px,py+(side?width:-width),.18+strand*.0002);
    }
    p.needsUpdate=true;
   }
  });
 }
 dispose():void{this.previews.flat().forEach(v=>v.dispose());this.bundles.forEach(b=>{b.geometry.dispose();b.material.dispose();});}
}
