import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {RenderInterpolation} from '../apps/client/src/rendering/RenderInterpolation.js';
import {animationTick,playbackFrame,validateFrameTiming} from '../apps/client/src/rendering/AnimationPlayback.js';
import {actionMotion} from '../apps/client/src/rendering/ActionMotion.js';
import {CrouchAttackVisual} from '../apps/client/src/rendering/CrouchAttackVisual.js';
import {AirAttackVisual} from '../apps/client/src/rendering/AirAttackVisual.js';
import {DashVisual} from '../apps/client/src/rendering/DashVisual.js';
import {FallVisual} from '../apps/client/src/rendering/FallVisual.js';
import {MountedVisual} from '../apps/client/src/rendering/MountedVisual.js';

test('authored frame holds preserve exact boundaries, loops and the last recovery pose',()=>{
 const clip={frames:4,ticksPerFrame:6,loop:true,frameDurations:[8,2,5,9]};validateFrameTiming(clip);
 assert.deepEqual([0,7,8,9,10,14,15,23,24,32].map(t=>playbackFrame(t,clip)),[0,0,1,1,2,2,3,3,0,1]);
 assert.equal(playbackFrame(100,{...clip,loop:false}),3);
 assert.equal(playbackFrame(-1,clip),0);
 assert.throws(()=>validateFrameTiming({...clip,frameDurations:[1,0,2,3]}));
 assert.throws(()=>validateFrameTiming({...clip,frameDurations:[1,2]}));
 for(let tick=0;tick<200;tick++)assert.equal(playbackFrame(tick,{frames:4,ticksPerFrame:7,loop:true}),Math.floor(tick/7)%4);
});

test('safe movement transitions interpolate positions without delaying new poses or touchdown',()=>{
 for(const [before,after] of [['Idle','WalkForward'],['WalkForward','Idle'],['Jump','Fall'],['Fall','Land']]){
  const sim=new GameSimulation(),view=new RenderInterpolation();sim.state.phase='fight';const f=sim.state.fighters[0];f.state=before;f.stateFrame=8;
  view.capture(sim.state);sim.state.frame++;f.x+=10;f.state=after;f.stateFrame=0;
  const display=view.view(sim.state,.5).fighters[0];assert.equal(display.state,after);assert.equal(display.stateFrame,0);
  assert.equal(display.x,f.x-(after==='Land'?0:5));
 }
});

for(const id of Object.keys(characters))test(`${id}: every move retains impact alignment, combat clocks and snapshot hash`,()=>{
 const sim=new GameSimulation([id,id],true),view=new RenderInterpolation();sim.state.phase='fight';const f=sim.state.fighters[0];
 for(const move of Object.values(characters[id].moves)){
  for(const frame of [0,Math.max(0,move.startupFrames-3),move.startupFrames,move.startupFrames+move.activeFrames-1,move.startupFrames+move.activeFrames+5]){
   f.move=move.id;f.state=move.state;f.moveFrame=frame;f.stateFrame=frame;
   view.capture(sim.state);sim.state.frame++;f.moveFrame++;f.stateFrame++;f.x+=4;
   const hash=hashState(sim.state),display=view.view(sim.state,.5).fighters[0];
   assert.equal(display.moveFrame,f.moveFrame);assert.equal(display.stateFrame,f.stateFrame);
   if(f.moveFrame>=move.startupFrames&&f.moveFrame<move.startupFrames+move.activeFrames)assert.equal(display.x,f.x);
   assert.equal(hashState(sim.state),hash);assert.equal(animationTick(f),f.stateFrame);
  }
 }
});

test('cosmetic motion progresses between display frames and freezes on pause and hitstop',()=>{
 const sim=new GameSimulation(['tocha','gut'],true),view=new RenderInterpolation();sim.state.phase='fight';const f=sim.state.fighters[0];f.state='WalkForward';f.stateFrame=3;
 view.capture(sim.state);sim.state.frame++;f.stateFrame++;
 const a=view.view(sim.state,.25).fighters[0],b=view.view(sim.state,.75).fighters[0];
 assert.equal(animationTick(a),3.25);assert.equal(animationTick(b),3.75);
 assert.notDeepEqual(actionMotion(a),actionMotion(b));assert.equal(animationTick(f),4);
 view.reset();assert.equal(animationTick(view.view(sim.state,.1).fighters[0]),4);
 view.capture(sim.state);sim.state.frame++;sim.state.hitstop=5;
 assert.equal(view.view(sim.state,.25),sim.state);assert.equal(view.view(sim.state,.75),sim.state);
});

test('same melee windup and recovery interpolate; impact and mode changes snap',()=>{
 const sim=new GameSimulation(['tocha','gut'],true),view=new RenderInterpolation();sim.state.phase='fight';const f=sim.state.fighters[0],m=characters.tocha.moves.heavy;
 for(const [frame,smooth] of [[1,true],[m.startupFrames,true],[m.startupFrames+m.activeFrames+5,true]] as const){
  f.move='heavy';f.state=m.state;f.moveFrame=frame;view.capture(sim.state);sim.state.frame++;f.x+=10;f.moveFrame++;
  const impact=frame===m.startupFrames;assert.equal(view.view(sim.state,.5).fighters[0].x,f.x-(!impact&&smooth?5:0));
 }
 view.capture(sim.state);sim.state.frame++;f.x+=10;f.weaponUntil=sim.state.frame+100;
 assert.equal(view.view(sim.state,.5).fighters[0],f);
});

test('all rendering adapters forward the authoritative frame to the base visual',()=>{
 const f=new GameSimulation(['nikalz','gut']).state.fighters[0];f.state='Idle';let seen:number|undefined;
 const base={root:new THREE.Group(),fallBodies:[],update(_f:unknown,_t:number,frame?:number){seen=frame;},dispose(){}};
 const wrappers=[new CrouchAttackVisual(base),new AirAttackVisual(base,'nikalz','original'),new DashVisual(base,'nikalz','original'),new FallVisual(base,'nikalz','original'),new MountedVisual(base,'nikalz','original')];
 for(const visual of wrappers){seen=undefined;visual.update(f,2,1234);assert.equal(seen,1234);visual.dispose();}
});

test('cosmetic clock survives every fighter state change and freezes during hitstop, pause and stalled ticks',()=>{
 for(const id of Object.keys(characters)){
  const sim=new GameSimulation([id,id]),view=new RenderInterpolation();sim.state.phase='fight';
  for(const state of ['Idle','WalkForward','DashForward','Jump','Fall','Land','LightAttack','HitStunStanding','Knockdown','GetUp']){
   const before=view.seconds();view.capture(sim.state);sim.state.frame++;sim.state.fighters[0].state=state;sim.state.fighters[0].stateFrame=0;view.complete(sim.state);
   assert.ok(Math.abs(view.seconds()-before-1/60)<1e-9,id+state);
   assert.ok(view.seconds(.75)>view.seconds(.25));
  }
  const before=view.seconds();view.capture(sim.state);sim.state.frame++;sim.state.hitstop=4;view.complete(sim.state);
  assert.equal(view.seconds(.1),before);assert.equal(view.seconds(.9),before);
  view.reset();assert.equal(view.seconds(.2),before);
  view.capture(sim.state);assert.equal(view.seconds(.5),before); // No successful network tick.
  const hash=hashState(sim.state);view.seconds(.4);assert.equal(hashState(sim.state),hash);
 }
});

test('all fighters interpolate neutral dash transitions while facing changes and damage stay exact',()=>{
 for(const id of Object.keys(characters))for(const [from,to] of [['Idle','DashForward'],['WalkBackward','DashBackward'],['DashForward','Idle'],['DashBackward','Fall']]){
  const sim=new GameSimulation([id,id]),view=new RenderInterpolation();sim.state.phase='fight';const f=sim.state.fighters[0];f.state=from;f.move=null;
  view.capture(sim.state);sim.state.frame++;f.x+=12;f.state=to;f.stateFrame=0;
  const display=view.view(sim.state,.5).fighters[0];assert.equal(display.x,f.x-6,id);assert.equal(display.state,to);assert.equal(display.stateFrame,0);
  f.facing=f.facing===1?-1:1;assert.equal(view.view(sim.state,.5).fighters[0],f);
 }
});

test('cosmetic clock counts successful fixed steps, not display refreshes or rollback replay',()=>{
 const sim=new GameSimulation(),view=new RenderInterpolation();sim.state.phase='fight';
 for(let i=0;i<60;i++){view.capture(sim.state);sim.state.frame++;view.complete(sim.state);for(let refresh=0;refresh<5;refresh++)view.seconds(refresh/5);}
 assert.equal(view.seconds(),1);
 const before=hashState(sim.state);view.capture(sim.state);
 const restored=structuredClone(sim.state);restored.frame++;view.complete(restored);
 assert.equal(view.seconds(.5),1);assert.equal(hashState(sim.state),before);
 view.reset();assert.equal(view.seconds(),1);
});
