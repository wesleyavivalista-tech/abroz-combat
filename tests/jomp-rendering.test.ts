import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {JompRenderer,jompPose} from '../apps/client/src/rendering/JompRenderer.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
test('Investida uses anticipation, six running phases while the move clock is held, and recovery',()=>{
 const f=createFighter('jomp',1200,1);f.move='investida';f.moveFrame=0;
 assert.deepEqual(jompPose(f),[4,1]);f.moveFrame=14;
 const poses=new Set<number>();for(let tick=0;tick<24;tick++){f.stateFrame=tick;poses.add(jompPose(f)[1]);}
 assert.equal(poses.size,6);f.moveFrame=16;assert.deepEqual(jompPose(f),[4,0]);
});
test('muscle shimmer follows the selected frame and switches off after the modes end',()=>{
 const sheets=Array.from({length:5},()=>Array.from({length:12},()=>({texture:new THREE.CanvasTexture({width:1,height:1} as HTMLCanvasElement),width:100,height:200,pivot:50})));
 const visual=new JompRenderer(sheets),f=createFighter('jomp',1200,1);
 const shimmer=visual.root.children[2] as THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 visual.update(f,0);assert.equal(shimmer.visible,false);
 f.move='coolMuscles';visual.update(f,1);assert.equal(shimmer.visible,true);assert.equal(shimmer.material.uniforms.map.value,sheets[2][1].texture);
 f.move=null;f.weaponUntil=100;visual.update(f,2);assert.equal(shimmer.visible,true);assert.equal(shimmer.material.uniforms.map.value,sheets[0][0].texture);
 f.weaponUntil=0;visual.update(f,3);assert.equal(shimmer.visible,false);visual.dispose();
});
