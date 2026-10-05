import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../packages/game-core/types.js';
import {advanceStatuses} from '../packages/game-core/simulation/StatusSystem.js';
const setup=()=>{const g=new GameSimulation(['tocha','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});g.state.fighters[0].x=700;g.state.fighters[1].x=1500;g.step([Button.Super2,0]);return g;};
test('Head Banging ignites its ground immediately for exactly 17 seconds and survives interruption',()=>{
 const g=setup(),h=g.state.hazards[0];assert.ok(h);assert.equal(h.expiresAt-g.state.frame,1020);assert.equal(h.x,700);
 g.state.fighters[0].move=null;g.step([0,0]);assert.equal(g.state.hazards.length,1);g.state.frame=h.expiresAt-1;advanceStatuses(g.state);assert.equal(g.state.hazards.length,1);g.state.frame++;advanceStatuses(g.state);assert.equal(g.state.hazards.length,0);
});
test('ground patch ignites touching enemies purple, not owner or airborne opponents',()=>{
 const g=setup(),[a,d]=g.state.fighters;d.x=a.x;d.y=a.y+100;advanceStatuses(g.state);assert.equal(d.burnUntil,0);d.y=a.y;advanceStatuses(g.state);assert.equal(d.burnKind,'purple');assert.equal(d.burnDamage,20);assert.equal(d.burnUntil,g.state.frame+720);assert.equal(a.burnUntil,0);
 const tick=d.burnNextTick;g.state.frame++;advanceStatuses(g.state);assert.equal(d.burnNextTick,tick);
});
test('purple ground replays deterministically and clears on round reset',()=>{
 const g=setup(),snap=g.snapshot();for(let i=0;i<120;i++)g.step([0,0]);const hash=hashState(g.state);g.restore(snap);for(let i=0;i<120;i++)g.step([0,0]);assert.equal(hashState(g.state),hash);g.resetPositions();assert.equal(g.state.hazards.length,0);
});
import {FireEffects} from '../apps/client/src/rendering/FireEffects.js';
import * as THREE from 'three';
test('ground flame renderer shows purple and resets the reused mesh for ordinary fire',()=>{
 const g=setup(),visual=new FireEffects();visual.update(g.state,false);
 const ground=visual.root.children.find(o=>o instanceof THREE.Mesh&&o.visible&&o.material instanceof THREE.ShaderMaterial&&o.material.uniforms.purple?.value===1)! as THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 assert.ok(ground);assert.equal(visual.root.children.filter(o=>o instanceof THREE.Mesh&&o.visible&&o.material instanceof THREE.ShaderMaterial&&o.material.uniforms.purple?.value===1).length,10);g.state.hazards=[{kind:'fire-trail',owner:0,x:700,y:0,move:'ignite',expiresAt:100,nextTicks:[]}];visual.update(g.state,false);assert.equal(ground.material.uniforms.purple.value,0);
 g.state.hazards=[];visual.update(g.state,false);assert.equal(ground.visible,false);
});

test('purple fire ignites the expanded ground blocks but does not reach beyond them',()=>{
 const g=setup(),[a,d]=g.state.fighters;d.x=a.x+220;advanceStatuses(g.state);assert.equal(d.burnKind,'purple');d.burnUntil=0;d.x=a.x+270;advanceStatuses(g.state);assert.equal(d.burnUntil,0);
});
