import test from 'node:test';
import assert from 'node:assert/strict';
import {characters} from '../packages/game-core/characters/registry.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {nikalzUsesCrouchGuard,nikalzPose} from '../apps/client/src/rendering/NikalzRenderer.js';

test('stationary crouch and low block use the dedicated guard without replacing attacks or carrying',()=>{
 const f=new GameSimulation(['nikalz','gut']).state.fighters[0];
 f.move=null;
 for(const state of ['Crouch','BlockCrouching'] as const){
  f.state=state;assert.equal(nikalzUsesCrouchGuard(f),true);
 }
 f.state='Crouch';f.move='low';f.moveFrame=characters.nikalz.moves.low.startupFrames;
 assert.equal(nikalzUsesCrouchGuard(f),false);
 assert.equal(nikalzPose(f),6);
 f.move=null;f.beeBoxes=2;
 assert.equal(nikalzUsesCrouchGuard(f),false);
 f.beeBoxes=0;f.state='Idle';
 assert.equal(nikalzUsesCrouchGuard(f),false);
});
