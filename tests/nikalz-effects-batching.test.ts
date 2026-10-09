import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {NikalzEffects} from '../apps/client/src/rendering/NikalzEffects.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {spawnBees} from '../packages/game-core/simulation/NikalzSystem.js';
import {worldX} from '../apps/client/src/rendering/StageCoordinates.js';

test('bee batch preserves transforms, handles growth/reset/menu, and releases resources',t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const context=new Proxy({},{get:()=>()=>{}});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:128,height:128,getContext:()=>context})}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');});
 const fx=new NikalzEffects(),sim=new GameSimulation(['nikalz','jopa']);
 sim.state.phase='fight';sim.state.frame=73;spawnBees(sim.state,0,500,90);
 const snapshot=JSON.stringify(sim.state);fx.update(sim.state,false);
 const batch=()=>fx.root.children.find(c=>c instanceof THREE.InstancedMesh) as THREE.InstancedMesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 const first=batch();assert.equal(first.count,18);assert.equal(fx.root.children.length,1);assert.equal(first.frustumCulled,false);
 const actual=new THREE.Matrix4(),expected=new THREE.Object3D(),b=sim.state.bees![0];
 for(let i=0;i<18;i++){
  const a=sim.state.frame*.0275+i*2.399+b.id,r=12+(i%5)*7,flap=.7+.3*Math.abs(Math.sin(sim.state.frame*.9+i));
  expected.position.set(worldX(b.x+Math.cos(a)*r),(b.y+Math.sin(a*1.17)*r*.65)/100,.36);
  expected.scale.set((10+(i%3)*2)/100,(8+(i%3))*flap/100,1);expected.rotation.z=Math.sin(a)*.16;expected.updateMatrix();first.getMatrixAt(i,actual);actual.elements[14]+=first.position.z;
  actual.elements.forEach((v,j)=>assert.ok(Math.abs(v-expected.matrix.elements[j])<1e-5));
 }
 assert.equal(JSON.stringify(sim.state),snapshot,'rendering must not mutate simulation');
 let retired=0;first.addEventListener('dispose',()=>retired++);
 for(let i=1;i<100;i++)spawnBees(sim.state,0,500,90);
 fx.update(sim.state,false);const grown=batch();assert.equal(retired,1);assert.equal(grown.count,1800);assert.equal(grown.geometry,first.geometry);assert.equal(grown.material,first.material);
 fx.update(sim.state,true);assert.equal(fx.root.visible,false);assert.equal(grown.count,0);
 fx.update(sim.state,false);assert.equal(grown.count,1800);assert.equal(batch(),grown);
 sim.state.bees=[];sim.state.fighters[0].beeSlowUntil=100;fx.update(sim.state,false);
 assert.equal(grown.count,0);assert.equal(grown.visible,false);assert.equal(fx.root.children.filter(m=>m.visible&&m instanceof THREE.Mesh).length,3,'sting effect remains visible');
 sim.resetPositions();fx.update(sim.state,false);assert.equal(fx.root.children.filter(m=>m.visible).length,0);
 let disposed=0;const onDispose=()=>{disposed++;};grown.addEventListener('dispose',onDispose);grown.geometry.addEventListener('dispose',onDispose);grown.material.addEventListener('dispose',onDispose);grown.material.map!.addEventListener('dispose',onDispose);
 fx.dispose();assert.equal(disposed,4);assert.equal(fx.root.children.length,0);
});
