import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FullEnergyEffect} from '../apps/client/src/rendering/FullEnergyEffect.js';
const sprite=()=>new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial({map:new THREE.Texture(),transparent:true}));
test('full energy fades in at 100 and fades out immediately below it',()=>{
 const effect=new FullEnergyEffect(),root=new THREE.Group();
 effect.update(root,99.99,.1,0);assert.equal(effect.strength.value,0);
 effect.update(root,100,.09,1);assert.equal(effect.strength.value,.5);
 effect.update(root,100,.09,2);assert.equal(effect.strength.value,1);
 effect.update(root,99,.07,3);assert.equal(effect.strength.value,.75);
 for(let i=0;i<3;i++)effect.update(root,0,.07,4);assert.equal(effect.strength.value,0);
});
test('eight fighters keep independent strength and reuse original resources across animation changes',()=>{
 const effects=Array.from({length:8},()=>new FullEnergyEffect());
 const sprites=effects.map(()=>sprite());
 effects.forEach((effect,i)=>effect.update(sprites[i],i%2?100:40,.1,1));
 effects.forEach((effect,i)=>assert.equal(effect.strength.value,i%2?.1/.18:0));
 const mesh=sprites[1],material=mesh.material,geometry=mesh.geometry,hook=material.onBeforeCompile,version=material.version;
 mesh.material.map=new THREE.Texture();mesh.scale.x=-1;mesh.rotation.z=.4;
 effects[1].update(mesh,100,.1,2);
 assert.equal(mesh.material,material);assert.equal(mesh.geometry,geometry);assert.equal(mesh.children.length,0);
 assert.equal(material.onBeforeCompile,hook);assert.equal(material.version,version);
 effects[1].update(mesh,100,.1,3,false);assert.ok(effects[1].strength.value<1);
});
test('shader composes with existing skin/isolation and environment effects, without changing alpha',()=>{
 const mesh=sprite(),effect=new FullEnergyEffect();let calls=0;
 mesh.material.onBeforeCompile=()=>{calls++;};mesh.material.customProgramCacheKey=()=> 'skin-isolation';
 effect.update(mesh,100,.1,1);
 const shader={uniforms:{},fragmentShader:'#include <opaque_fragment>',vertexShader:''} as unknown as Parameters<THREE.Material['onBeforeCompile']>[0];
 mesh.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 assert.equal(calls,1);assert.equal(shader.uniforms.fullEnergyStrength,effect.strength);
 assert.match(shader.fragmentShader,/outgoingLight\+=/);assert.doesNotMatch(shader.fragmentShader,/diffuseColor\.a\s*=/);
 assert.equal(mesh.material.customProgramCacheKey(),'skin-isolation|full-energy-v1');
});
