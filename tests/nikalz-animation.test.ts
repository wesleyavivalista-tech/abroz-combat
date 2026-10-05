import type {CanvasTexture} from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {nikalzMovementPose,nikalzCarryPose,nikalzActionPose,NikalzRenderer} from '../apps/client/src/rendering/NikalzRenderer.js';
test('Nikalz dash has authored anticipation, burst and braking frames in both directions',()=>{
 const f=new GameSimulation(['nikalz','gut']).state.fighters[0];f.move=null;
 for(const [state,start] of [['DashForward',1],['DashBackward',4]] as const){f.state=state;for(const [time,offset] of [[0,0],[4,1],[10,2]]){f.stateFrame=time;assert.equal(nikalzMovementPose(f),start+offset);}}
 f.beeBoxes=5;assert.equal(nikalzMovementPose(f),null);assert.equal(nikalzCarryPose(f),4);
});
test('carrying walk uses four alternating contact and passing poses without overriding jump or placement',()=>{
 const f=new GameSimulation(['nikalz','gut']).state.fighters[0];f.move=null;f.beeBoxes=5;f.state='WalkForward';
 assert.deepEqual([0,7,14,21,28].map(t=>{f.stateFrame=t;return nikalzMovementPose(f);}),[8,9,10,11,8]);
 f.state='Jump';assert.equal(nikalzMovementPose(f),null);assert.equal(nikalzCarryPose(f),1);
 f.move='placeBox';assert.equal(nikalzMovementPose(f),null);assert.equal(nikalzCarryPose(f),null);f.moveFrame=12;assert.equal(nikalzActionPose(f),11);
});


test('meteor uses simulation age for its head-first pose and resets its rotation afterwards',()=>{
 const f=new GameSimulation(['nikalz','gut']).state.fighters[0];
 f.move='meteor';f.meteorStart=100;f.stateFrame=999;
 assert.equal(nikalzActionPose(f,147),null);assert.equal(nikalzActionPose(f,148),7);
 const frame={width:200,height:360,pivot:100,texture:null as unknown as CanvasTexture};
 const frames=Array.from({length:16},()=>frame);
 const visual=new NikalzRenderer(frames,frames,frames,frames,frames,frame);
 visual.update(f,0,154);
 const sprite=visual.root.children[0];assert.equal(sprite.rotation.z,-.52);
 for(const facing of [1,-1] as const){f.facing=facing;visual.update(f,0,170);assert.equal(visual.root.scale.x,facing);assert.equal(sprite.rotation.z,-.52);}
 delete f.meteorStart;f.move=null;f.state='Idle';visual.update(f,0,180);assert.equal(sprite.rotation.z,0);
 visual.dispose();
});
