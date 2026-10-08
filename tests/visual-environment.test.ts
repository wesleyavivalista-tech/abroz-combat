import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {trainingRoom,shoppingMall} from '../packages/game-core/stages/registry.js';
import {stageAtTick} from '../packages/game-core/stages/motion.js';
import {arenaIlluminationFor,lightingFor,visualShadowSurface,shadowProfile,visualSurfaceBelow,visualPresets} from '../apps/client/src/rendering/StageLighting.js';
import {VisualLightPool} from '../apps/client/src/rendering/VisualLightPool.js';
import {EnvironmentShader} from '../apps/client/src/rendering/EnvironmentShader.js';
test('stage lighting defaults and clamps preserve readability',()=>{
 const c=lightingFor(trainingRoom,{shadingStrength:99,shadowOpacity:99,bloomStrength:99});assert.equal(c.shadingStrength,.22);assert.equal(c.shadowOpacity,.45);assert.equal(c.bloomStrength,.3);
 assert.equal(lightingFor({...trainingRoom,id:'future'}).ambientIntensity,.25);
});
test('visual shadows follow closest surface below, including moving decks',()=>{
 assert.equal(visualSurfaceBelow(trainingRoom,500,500),340);assert.equal(visualSurfaceBelow(trainingRoom,500,200),0);
 for(const tick of [0,90,300]){const s=stageAtTick(shoppingMall,tick);const p=s.platforms![1];assert.equal(visualSurfaceBelow(s,p.x+p.width/2,p.y+100),p.y);}
 const c=lightingFor(trainingRoom),ground=shadowProfile(0,c,'high'),air=shadowProfile(500,c,'high');assert.ok(air.opacity<ground.opacity);assert.ok(air.size<ground.size);assert.ok(air.softness>=ground.softness);assert.equal(air.contact,0);
});
test('bounded lights prioritize, deduplicate, expire and disable on low',()=>{
 const p=new VisualLightPool();for(let i=0;i<100;i++)p.spawn({id:String(i),x:1000,y:100,radius:300,intensity:.3,color:'#ff9900',duration:.2});assert.equal(p.slots.filter(s=>s.life>0).length,32);
 p.spawn({id:'important',x:1000,y:100,radius:400,intensity:.6,color:'#ffffff',duration:.2,priority:10});p.update(0,4,1000,2400,1);assert.equal(p.count,4);assert.equal(p.positions[0].w,.6);
 for(let i=0;i<3;i++)p.update(.1,8,1000,2400,1);assert.equal(p.count,0);
 p.spawn({id:'important',x:1000,y:100,radius:400,intensity:.6,color:'#fff',duration:1});assert.equal(p.slots.filter(s=>s.life>0).length,0);
 p.clear();p.spawn({id:'again',x:0,y:0,radius:100,intensity:1,color:'#fff',duration:1});p.update(0,visualPresets.low.lights,0,2400,1);assert.equal(p.count,0);
});
test('environment shader composes existing isolation hooks and leaves custom VFX alone',()=>{
 const e=new EnvironmentShader(),m=new THREE.MeshBasicMaterial({map:new THREE.Texture(),transparent:true});let calls=0;
 m.onBeforeCompile=s=>{calls++;s.fragmentShader='// original-isolation\n'+s.fragmentShader;};m.customProgramCacheKey=()=> 'isolation';
 const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.PlaneGeometry(),m));e.apply(root);e.apply(root);
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <opaque_fragment>'};m.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
 assert.equal(calls,1);assert.ok(shader.fragmentShader.includes('original-isolation'));assert.ok(shader.fragmentShader.includes('envLightCount'));assert.equal(m.customProgramCacheKey(),'isolation|environment-v3');
});

test('manager updates are cosmetic, shadows are cleaned and dynamic lights reset',async()=>{
 const {StageVisualEnvironment}=await import('../apps/client/src/rendering/StageVisualEnvironment.js');
 const {GameSimulation,hashState}=await import('../packages/game-core/simulation/GameSimulation.js');
 const g=new GameSimulation(['nikalz','tocha','drupa','gut']);g.state.phase='fight';
 const env=new StageVisualEnvironment(trainingRoom),root=new THREE.Group(),shadow=new THREE.Mesh();
 const before=hashState(g.state);env.begin(g.state,trainingRoom,.016,0,false);env.shadow('fighter',g.state.fighters[0],{root,shadow},trainingRoom,g.state);
 assert.equal(shadow.visible,false);assert.equal(env.root.children.length,4);assert.equal(hashState(g.state),before);
 env.finish(false,{} as THREE.WebGLRenderer);env.begin(g.state,trainingRoom,.016,0,false);env.finish(false,{} as THREE.WebGLRenderer);assert.equal(env.root.children.length,3);
 env.spawnDynamicLight({id:'hit',x:1000,y:100,radius:200,intensity:.4,color:'#ff9900',duration:1});env.begin(g.state,trainingRoom,.016,0,false);assert.ok(env.lights.count>0);
 env.begin(g.state,trainingRoom,.016,0,true);assert.equal(env.lights.count,0);env.dispose();
});

test('arena illumination retains the established fill and hemisphere palettes',()=>{
 const rooftop=arenaIlluminationFor(trainingRoom);
 assert.equal(rooftop.fillIntensity,6);assert.equal(rooftop.keyIntensity,2.7);
 assert.equal(rooftop.ground,'#645347');
 assert.equal(arenaIlluminationFor(shoppingMall).fillIntensity,3);
 assert.equal(arenaIlluminationFor({...trainingRoom,theme:'church'}).fillIntensity,2);
 assert.equal(arenaIlluminationFor({...trainingRoom,theme:'basketball'}).fillIntensity,3);
});
test('sprite environment shader never modifies lit stage or instanced materials',()=>{
 const e=new EnvironmentShader(),root=new THREE.Group();
 const standard=new THREE.MeshStandardMaterial({map:new THREE.Texture()});
 const hook=standard.onBeforeCompile,key=standard.customProgramCacheKey(),version=standard.version;
 root.add(new THREE.Mesh(new THREE.PlaneGeometry(),standard));
 root.add(new THREE.InstancedMesh(new THREE.BoxGeometry(),standard,2));
 e.apply(root);
 assert.equal(standard.onBeforeCompile,hook);assert.equal(standard.customProgramCacheKey(),key);assert.equal(standard.version,version);
});

test('shadow receivers retain the moving platform edges and floor fallback',()=>{
 for(const tick of [0,90,300]){
  const stage=stageAtTick(shoppingMall,tick),p=stage.platforms![1];
  assert.deepEqual(visualShadowSurface(stage,p.x+p.width/2,p.y+10),{height:p.y,left:p.x,right:p.x+p.width});
 }
 assert.equal(visualShadowSurface(trainingRoom,1200,0).height,trainingRoom.floorHeight);
});
test('ability arena lights are bounded, shadowless and clear on menus, low and reset',async()=>{
 const {StageVisualEnvironment}=await import('../apps/client/src/rendering/StageVisualEnvironment.js');
 const {GameSimulation}=await import('../packages/game-core/simulation/GameSimulation.js');
 const g=new GameSimulation(['nikalz','jopa']);g.state.phase='fight';
 const env=new StageVisualEnvironment(trainingRoom);env.setQuality('medium');
 env.spawnDynamicLight({id:'pulse',x:1000,y:0,radius:300,intensity:.65,color:'#ff9933',duration:1});
 env.begin(g.state,trainingRoom,0,0,false);
 assert.equal(env.arenaLights.length,2);assert.ok(env.arenaLights[0].intensity>0);
 for(const l of env.arenaLights){assert.equal(l.castShadow,false);assert.ok(l.intensity<=1.2);}
 env.begin(g.state,trainingRoom,0,0,true);assert.ok(env.arenaLights.every(l=>l.intensity===0));
 env.setQuality('low');env.begin(g.state,trainingRoom,0,0,false);assert.ok(env.arenaLights.every(l=>l.intensity===0));
 env.reset();assert.ok(env.arenaLights.every(l=>l.intensity===0));env.dispose();
});

test('native arena lighting is centrally configurable with a readable minimum',async()=>{
 const {StageVisualEnvironment}=await import('../apps/client/src/rendering/StageVisualEnvironment.js');
 const env=new StageVisualEnvironment(trainingRoom),scene=new THREE.Scene();
 const sky=new THREE.HemisphereLight(),key=new THREE.DirectionalLight(),rim=new THREE.DirectionalLight(),fill=new THREE.PointLight();
 sky.name='arena-sky';key.name='arena-key';rim.name='arena-rim';fill.name='arena-fill';scene.add(sky,key,rim,fill);
 env.applyStageLights(scene);assert.equal(sky.intensity,1.3);assert.equal(fill.intensity,6);
 env.configure(trainingRoom,{geometry:{skyIntensity:0,keyIntensity:NaN,fillIntensity:-10,key:'#ffeecc'}});
 for(const quality of ['low','medium','high'] as const){env.setQuality(quality);env.applyStageLights(scene);assert.equal(sky.intensity,.8);assert.equal(key.intensity,1.2);assert.equal(fill.intensity,1);assert.equal(key.color.getHexString(),'ffeecc');}
 env.dispose();
});
test('invalid shader color strings fall back instead of leaking invalid colors',()=>{
 const c=lightingFor(trainingRoom,{ambientColor:'invalid'});assert.equal(c.ambientColor,'#c5d0df');
});
