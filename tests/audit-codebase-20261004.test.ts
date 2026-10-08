import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {stages} from '../packages/game-core/stages/registry.js';
import * as THREE from 'three';
import {HairCloneGrowth} from '../apps/client/src/rendering/HairCloneGrowth.js';
import {registerFighterVisual} from '../apps/client/src/rendering/VisualRegistry.js';

test('Bozo clone growth supports every seat in 2–8 player matches and hides on interruption',()=>{
 registerFighterVisual('bozo',()=>({root:new THREE.Group(),update(){},dispose(){}}),'hair-clone');
 for(let count=2;count<=8;count++){
  const game=new GameSimulation(Array(count).fill('bozo'));
  game.state.phase='fight';
  game.state.fighters.forEach(f=>{f.move='clones';f.moveFrame=5;});
  const growth=new HairCloneGrowth();
  try{
   assert.doesNotThrow(()=>growth.update(game.state,false,0),`${count} simultaneous casters`);
   assert.equal(growth.root.children.filter(c=>c instanceof THREE.Mesh&&c.visible).length,count*3);
   game.state.fighters.forEach(f=>{f.move=null;});
   growth.update(game.state,false,0);
   assert.ok(growth.root.children.every(c=>!c.visible));
   game.state.fighters.forEach(f=>{f.move='clones';f.moveFrame=5;});
   growth.update(game.state,true,0);
   assert.equal(growth.root.visible,false);
  }finally{growth.dispose();}
 }
});

test('all roster pairings retain finite combat state and replay exactly from a snapshot',()=>{
 const ids=Object.keys(characters);
 const buttons=[0,Button.Left,Button.Right,Button.Up,Button.Down,Button.Light,Button.Medium,Button.Heavy,Button.Special,Button.Special2,Button.Super1,Button.Super2];
 for(const stage of Object.values(stages))for(let i=0;i<ids.length;i++)for(let j=0;j<ids.length;j++){
  const game=new GameSimulation([ids[i],ids[j]],false,stage);
  game.state.phase='fight';
  game.state.fighters.forEach((f,k)=>{f.state='Idle';f.x=1000+k*140;f.meter=100;});
  let seed=i*7919+j*104729+1;
  const inputs=Array.from({length:240},()=>[0,1].map(()=>{
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   return buttons[seed%buttons.length];
  }));
  for(const input of inputs.slice(0,120))game.step(input);
  const snapshot=game.snapshot();
  for(const input of inputs.slice(120)){
   game.step(input);
   for(const f of [...game.state.fighters,...game.state.clones.map(c=>c.fighter)]){
    for(const key of ['x','y','vx','vy','health','meter','stun'] as const)
     assert.ok(Number.isFinite(f[key]),`${ids[i]}/${ids[j]} ${key}`);
    assert.ok(f.health>=0&&f.lives>=0);
    if(f.move)assert.ok(characters[f.characterId].moves[f.move]);
   }
  }
  const expected=hashState(game.state);
  game.restore(snapshot);
  for(const input of inputs.slice(120))game.step(input);
  assert.equal(hashState(game.state),expected,`${ids[i]}/${ids[j]}`);
 }
});

test('scene teardown disposes clone preview textures exactly once',async()=>{
 const {SceneRenderer}=await import('../apps/client/src/rendering/SceneRenderer.js');
 let disposed=0;
 registerFighterVisual('bozo',()=>{
  const texture=new THREE.Texture();texture.addEventListener('dispose',()=>disposed++);
  return {root:new THREE.Group(),update(){},dispose(){texture.dispose();}};
 },'hair-clone');
 const game=new GameSimulation(Array(8).fill('bozo'));game.state.phase='fight';
 game.state.fighters.forEach(f=>{f.move='clones';f.moveFrame=5;});
 const cloneGrowth=new HairCloneGrowth();cloneGrowth.update(game.state,false,0);
 const scene=new THREE.Scene();scene.add(cloneGrowth.root);
 const noop={dispose(){}};
 const renderer=Object.assign(Object.create(SceneRenderer.prototype),{
  environment:noop,undead:{dispose(){},root:new THREE.Group()},cloneGrowth,scene,observer:{disconnect(){}},stage:noop,structures:noop,napa:noop,
  jopa:noop,finance:noop,eide:noop,nikalz:noop,fausto:noop,astolfo:noop,
  fighters:[],clones:new Map(),composer:{passes:[],dispose(){}},renderer:noop,
 }) as InstanceType<typeof SceneRenderer>;
 renderer.dispose();assert.equal(disposed,24);assert.equal(scene.children.length,0);
});
