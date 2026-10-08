import * as THREE from 'three';
import type {StageDefinition} from '../../../../packages/game-core/types.js';
import {arenaFloorMap,addDeckFinish} from './ArenaFinish.js';
import {arenaMaterial, batchArenaBoxes} from './ArenaMaterials.js';

/** Mall concourse and rail-mounted display decks. Decoration has no collision. */
export function buildMallArena(root: THREE.Group, stage: StageDefinition): THREE.Group[] {
  const stone=arenaMaterial('#766d71','stone',2), marble=arenaMaterial('#b3a99a','stone',2);
  const brass=arenaMaterial('#a88756','metal',2), plum=arenaMaterial('#46343f','paint',2);
  const dark=arenaMaterial('#29282e','metal'), light=new THREE.MeshBasicMaterial({color:'#ffe3ad'});
  const leaves=arenaMaterial('#3c5949','paint');leaves.side=THREE.DoubleSide;
  const box=(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  box(root,0,-.15,0,50,.30,9,marble);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,9),new THREE.MeshStandardMaterial({map:arenaFloorMap('mall'),roughness:.72}));
  floor.rotation.x=-Math.PI/2;floor.position.y=.001;floor.receiveShadow=true;root.add(floor);
  box(root,0,-1.6,4,50,2.6,.6,plum);
  box(root,0,-.12,4.32,50,.12,.06,brass);
  // Inlaid bands keep the combat lane clean, framed by perimeter decoration.
  for(const z of [-1.75,1.75,3.7])box(root,0,.007,z,50,.012,.055,brass);
  for(let x=-24;x<=24;x+=2.4){
    box(root,x,.008,0,.018,.015,7.4,stone);
    box(root,x,-1.2,4.32,.035,2.2,.035,brass);
  }
  box(root,0,.25,-3.7,50,.5,.5,plum);box(root,0,.54,-3.7,50,.08,.62,brass);
  for(const side of [-1,1]){
    const x=side*12.7;
    box(root,x,4.6,-2.8,.6,9.2,.8,stone);
    box(root,x,4.6,-2.37,.1,9.2,.04,brass);
    for(const y of [1.8,5,8])box(root,x,y,-2.3,.17,.9,.06,light);
    for(const px of [side*8.6,side*11]){
      box(root,px,.32,-2.8,1.1,.64,.85,plum);
      box(root,px,.65,-2.8,1.15,.07,.9,brass);
      box(root,px,.72,-2.8,.98,.06,.73,dark);
      // Low-poly folded leaves replace the spherical placeholder shrub.
      const vertices:number[]=[];
      for(let leaf=0;leaf<18;leaf++){
        const a=leaf*2.399,r=.32+(leaf%4)*.07,tipY=1.1+(leaf%5)*.12;
        const tx=px+Math.cos(a)*r,tz=-2.8+Math.sin(a)*r;
        const sx=Math.cos(a+Math.PI/2)*.1,sz=Math.sin(a+Math.PI/2)*.1;
        vertices.push(px,.73,-2.8,tx+sx,tipY-.22,tz+sz,tx,tipY,tz,
          px,.73,-2.8,tx,tipY,tz,tx-sx,tipY-.22,tz-sz);
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
      const foliage=new THREE.Mesh(geometry,leaves);foliage.castShadow=foliage.receiveShadow=true;root.add(foliage);
    }
    box(root,side*5,.4,-2.8,2,.12,.65,marble);
    for(const dx of [-.7,.7])box(root,side*5+dx,.2,-2.8,.18,.4,.55,plum);
  }
  const decks=(stage.platforms??[]).map((p,index)=>{
    const y=(p.y-stage.floorHeight)/100,w=p.width/100;
    // Keep stone/paint/brass grain at the original world scale on wider decks.
    const across=(material:THREE.MeshStandardMaterial)=>{
      const tiled=material.clone(),map=material.map!.clone();
      map.repeat.x*=w/4.8;tiled.map=tiled.bumpMap=map;
      return tiled;
    };
    const deckStone=across(marble),deckPlum=across(plum),deckBrass=across(brass);
    // Recessed rear tracks explain the motion without obstructing fighters.
    box(root,0,y-.22,-1.05,stage.width/100,.09,.11,dark);
    box(root,0,y-.28,-1.06,stage.width/100,.025,.12,brass);
    for(const x of [-11.9,11.9])box(root,x,y-.22,-1.04,.18,.32,.2,plum);
    const group=new THREE.Group();group.position.y=y;root.add(group);
    box(group,0,-.11,0,w,.22,1.5,deckStone);
    box(group,0,-.29,0,w-.12,.17,1.3,deckPlum);
    box(group,0,-.075,.77,w,.07,.04,deckBrass);
    box(group,0,-.2,.775,w-.35,.025,.025,light);
    for(const side of [-1,1]){
      box(group,side*(w/2-.10),-.18,.79,.14,.32,.055,brass);
      box(group,side*(w/2-.4),-.33,-.8,.4,.25,.55,dark);
    }
    // Directional chevrons are restrained accents on the moving fascia.
    for(let i=0;i<3;i++){
      const mark=box(group,(i-1)*.25,-.30,.68,.09,.035,.025,brass);mark.rotation.z=index===0?.5:-.5;
    }
    addDeckFinish(group,0,0,w,'mall',index);
    batchArenaBoxes(group);return group;
  });
  batchArenaBoxes(root);return decks;
}
