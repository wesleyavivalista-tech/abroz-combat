import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DodoRenderer,type Frame} from '../apps/client/src/rendering/DodoRenderer.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
const frames=(n:number):Frame[]=>Array.from({length:n},()=>({texture:new THREE.CanvasTexture(undefined),width:80,height:100,pivot:40,referenceHeight:100}));
test('Dodo cycles four leg strides per dash, restarts on repeats and restores idle pose',()=>{
 for(const facing of [-1,1] as const)for(const state of ['DashForward','DashBackward'] as const){
  const base=frames(18),walk=frames(4),playing=frames(4),visual=new DodoRenderer(base,playing,[],false,walk);
  const body=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  const f=createFighter('dodo',1000,facing);f.state=state;
  for(const weapon of [0,1000])for(let repeat=0;repeat<3;repeat++)for(let tick=0;tick<12;tick++){
   f.weaponUntil=weapon;f.stateFrame=tick;visual.update(f,tick);
   const step=Math.floor(tick/3);assert.equal(body.material.map,walk[state==='DashBackward'?(4-step)%4:step].texture);
   assert.equal(visual.root.scale.x,facing);assert.equal(body.scale.y,1.82);
  }
  f.weaponUntil=0;f.state='Idle';visual.update(f,0);assert.equal(body.material.map,base[0].texture);assert.equal(body.rotation.z,0);
  visual.dispose();[...base,...walk,...playing].forEach(f=>f.texture.dispose());
 }
});
