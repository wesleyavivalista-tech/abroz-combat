import * as THREE from 'three';
import type {StageDefinition} from '../../../../packages/game-core/types.js';
import {arenaFloorMap,addDeckFinish} from './ArenaFinish.js';
import {arenaMaterial,batchArenaBoxes} from './ArenaMaterials.js';

/** Reference-inspired wood floor, blue seating and a single carpeted stage deck. */
export function buildChurchArena(root:THREE.Group,stage:StageDefinition):void {
  const timber=arenaMaterial('#a6906d','paint',3), charcoal=arenaMaterial('#30363e','metal');
  const carpet=arenaMaterial('#525d6d','carpet',4), wall=arenaMaterial('#aaa99f','stone');
  const blue=arenaMaterial('#334973','paint'), trim=arenaMaterial('#bbb2a0','metal');
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const texture=arenaFloorMap('church');
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,9),new THREE.MeshStandardMaterial({map:texture,roughness:.86}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;root.add(floor);
  box(0,-.18,3.9,50,.35,.35,timber);box(0,-1.6,4,50,2.5,.35,charcoal);
  box(0,-.04,4.09,50,.035,.04,trim);
  // Rear skirting and low chair groups stay behind the fighting lane.
  box(0,.12,-3.8,50,.24,.15,timber);
  const chairBacks=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.3,.15,3,8),blue,6);
  chairBacks.castShadow=chairBacks.receiveShadow=true;root.add(chairBacks);
  let chairIndex=0;
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const x=side*(8.3+i*1.1);
    box(x,.46,-2.75,.74,.12,.65,blue);
    const back=new THREE.Object3D();
    back.scale.set(1,.85,.22);back.position.set(x,.92,-3.02);back.rotation.x=-.10;
    back.updateMatrix();chairBacks.setMatrixAt(chairIndex++,back.matrix);
    box(x,.61,-3.02,.68,.045,.15,charcoal);
    for(const dx of [-.28,.28]){
      box(x+dx,.22,-2.65,.045,.44,.045,charcoal);
      box(x+dx,.48,-3.0,.045,.96,.045,charcoal);
    }
    box(x,.08,-2.84,.82,.06,.06,charcoal);
  }
  chairBacks.computeBoundingSphere();
  for(const side of [-1,1]){
    box(side*12.8,4.4,-3.2,.38,8.8,.55,wall);
    box(side*12.6,5.9,-2.75,.65,1.1,.5,charcoal);
    for(let y=5.52;y<6.35;y+=.12)box(side*12.6,y,-2.49,.52,.025,.012,carpet);
  }
  for(const p of stage.platforms??[]){
    const x=(p.x+p.width/2-stage.width/2)/100,y=(p.y-stage.floorHeight)/100,w=p.width/100;
    box(x,y-.07,0,w,.14,1.65,carpet);
    box(x,y-.22,0,w,.16,1.65,timber);
    box(x,y-.04,.84,w,.035,.025,trim);
    box(x,y-.34,0,w-.12,.10,1.48,charcoal);
    addDeckFinish(root,x,y,w,'church');
    // Clear underpass: all legs and braces are recessed behind the combat plane.
    for(const dx of [-w/2+.24,w/2-.24]){
      box(x+dx,(y-.4)/2,-.77,.14,y-.4,.14,charcoal);
      box(x+dx,.05,-.77,.45,.1,.42,trim);
      const brace=box(x+dx*.9,y-.64,-.78,.09,.7,.09,charcoal);brace.rotation.z=dx<0?-.7:.7;
    }
    for(let dx=-w/2+.2;dx<w/2;dx+=.8)box(x+dx,y-.22,.835,.018,.12,.01,charcoal);
  }
  batchArenaBoxes(root);
}
