import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FireEffects} from '../apps/client/src/rendering/FireEffects.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
test('fire effects render only fire/pentagrams, never a spear or hair projectile, including recycled slots',()=>{
 const s=new GameSimulation(['tocha','gut','bozo']);s.state.phase='fight';const effects=new FireEffects();const shots=effects.root.children.slice(-64);
 for(const [owner,move,visible] of [[0,'fireball',true],[0,'satan',true],[1,'spearThrow',false],[2,'grip',false]] as const){
  Object.assign(s.state.projectiles[0],{active:true,owner,move,x:100,y:100,vx:10,life:50});effects.update(s.state,false);assert.equal(shots[0].visible,visible,move);
 }
 s.state.projectiles[0].active=false;effects.update(s.state,false);assert.equal(shots[0].visible,false);
});
