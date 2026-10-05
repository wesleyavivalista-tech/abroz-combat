import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../packages/game-core/types.js';
function game(){const g=new GameSimulation(['tocha','gut'],true);g.state.fighters[0].x=700;g.state.fighters[1].x=1000;return g;}
test('movement selects facing; neutral, opposing inputs and enemy crossings do not turn it',()=>{
 const g=game(),f=g.state.fighters[0],d=g.state.fighters[1];
 g.step([Button.Left,0]);assert.equal(f.facing,-1);assert.ok(f.x<700);
 g.step([0,0]);assert.equal(f.facing,-1);
 d.x=400;g.step([Button.Left|Button.Right,0]);assert.equal(f.facing,-1);
 g.step([Button.Right,0]);assert.equal(f.facing,1);
 d.x=500;g.step([0,0]);assert.equal(f.facing,1);
});
test('direction plus attack turns before starting; an ongoing attack does not reverse',()=>{
 const g=game(),f=g.state.fighters[0];
 g.step([Button.Left|Button.Light,0]);assert.equal(f.facing,-1);assert.ok(f.move);
 g.step([Button.Right,0]);assert.equal(f.facing,-1);
});
test('projectile fires away from the opponent in the selected direction',()=>{
 const g=game(),f=g.state.fighters[0];
 g.step([Button.Left|Button.Special,0]);
 for(let i=0;i<35;i++)g.step([0,0]);
 const p=g.state.projectiles.find(p=>p.active&&p.owner===0);
 assert.ok(p);assert.ok(p.vx<0);assert.ok(p.x<f.x);assert.equal(f.facing,-1);
});
test('double taps dash left and right regardless of initial facing; mixed taps do not dash',()=>{
 for(const input of [Button.Left,Button.Right])for(const facing of [-1,1] as const){
 const g=game(),f=g.state.fighters[0];f.facing=facing;
 g.step([input,0]);g.step([0,0]);g.step([input,0]);
 assert.equal(f.state,'DashForward');assert.equal(f.facing,input===Button.Left?-1:1);
 const direction=f.facing;g.step([input===Button.Left?Button.Right:Button.Left,0]);assert.equal(f.facing,direction);
 }
 const g=game();g.step([Button.Left,0]);g.step([0,0]);g.step([Button.Right,0]);assert.equal(g.state.fighters[0].state,'WalkForward');
});
test('airborne input turns facing without changing jump momentum',()=>{
 const g=game(),f=g.state.fighters[0];Object.assign(f,{y:220,state:'Fall',vx:3});
 g.step([Button.Left,0]);assert.equal(f.facing,-1);assert.equal(f.vx,3);
});
test('restoring a snapshot reproduces movement-facing and attack outcomes',()=>{
 const g=game();g.step([Button.Left,0]);const saved=g.snapshot();
 const inputs=[0,Button.Right,0,Button.Right,0,Button.Light,0,Button.Left];
 for(const input of inputs)g.step([input,0]);const expected=g.snapshot();
 g.restore(saved);for(const input of inputs)g.step([input,0]);assert.deepEqual(g.snapshot(),expected);
});
test('guard blocks by holding away from the incoming attack on either side',async()=>{
 const {characters}=await import('../packages/game-core/characters/registry.js');
 for(const side of [-1,1] as const){
  const g=game(),[a,d]=g.state.fighters;a.facing=side;d.facing=side;
  g.hit(0,characters.tocha.moves.jab,side===1?Button.Right:Button.Left,false,1,side);
  assert.equal(d.state,'BlockStanding');
 }
});
test('knockback and recovery do not turn the fighter with held movement',()=>{
 for(const state of ['AirHitStun','Knockdown','GetUp'] as const){
 const g=game(),f=g.state.fighters[0];Object.assign(f,{state,stateFrame:0,stun:10,facing:1});
 g.step([Button.Left,0]);assert.equal(f.facing,1);
 }
});
