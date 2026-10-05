import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {backwardDashPose} from '../apps/client/src/rendering/BackwardDash.js';
import {AstolfoRenderer} from '../apps/client/src/rendering/AstolfoRenderer.js';
import {JopaRenderer} from '../apps/client/src/rendering/JopaRenderer.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import type {Frame} from '../apps/client/src/rendering/DodoRenderer.js';
const frames=(n:number):Frame[]=>Array.from({length:n},()=>({texture:new THREE.Texture() as THREE.CanvasTexture,width:80,height:100,pivot:40,referenceHeight:100}));
test('backward dash uses simulation-timed preparation, retreat and landing; rejects other actions',()=>{
 const f=new GameSimulation(['jopa','astolfo']).state.fighters[0];f.state='DashBackward';
 for(const [time,pose] of [[0,0],[1,0],[2,1],[8,1],[9,2],[11,2]]){f.stateFrame=time;assert.equal(backwardDashPose(f),pose);}
 f.move='jab';assert.equal(backwardDashPose(f),null);f.move=null;f.jopaRide=1;assert.equal(backwardDashPose(f),null);delete f.jopaRide;f.jopaTree=1;assert.equal(backwardDashPose(f),null);delete f.jopaTree;f.state='DashForward';assert.equal(backwardDashPose(f),null);
});
for(const character of ['astolfo','jopa'])test(`${character} renderer selects retreat art, preserves facing and returns to existing forward/idle art`,()=>{
 const f=new GameSimulation([character,'gut']).state.fighters[0],base=frames(24),movement=frames(12),back=frames(3);
 const visual=character==='astolfo'?new AstolfoRenderer(base,frames(4),movement,true,back):new JopaRenderer(base,undefined,movement,0,[],back);
 const body=visual.root.children.find(o=>o instanceof THREE.Mesh) as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 for(const facing of [-1,1] as const){f.facing=facing;f.state='DashBackward';for(const [time,pose] of [[0,0],[5,1],[10,2]]){f.stateFrame=time;const before=JSON.stringify(f);visual.update(f,0);assert.equal(body.material.map,back[pose].texture);assert.equal(visual.root.scale.x,facing);assert.equal(JSON.stringify(f),before);}}
 f.state='DashForward';f.stateFrame=0;visual.update(f,0);assert.equal(body.material.map,character==='astolfo'?movement[0].texture:base[5].texture);
 f.state='Idle';visual.update(f,0);assert.equal(body.material.map,base[0].texture);visual.dispose();
});
