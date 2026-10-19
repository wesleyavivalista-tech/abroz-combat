import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera, Vector3} from 'three';
import {CameraTracking} from '../apps/client/src/rendering/CameraTracking.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';
import {hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {dashCameraReplay} from './helpers/dash-camera-replay.js';

for (const delay of [4, 8, 12]) test(`late dash inputs (${delay} frames): camera rejects scenery jolts without altering combat`, () => {
  const cameras = [false,true].map(online => {
    const camera = new PerspectiveCamera(35,16/9,.1,80);
    camera.position.set(0,3.4,12);
    return {camera,tracking:new CameraTracking(),online,previous:0,peak:0};
  });
  let rendered = 0;
  const result = dashCameraReplay(delay, state => {
    const before = hashState(state);
    const positions = state.fighters.map(f=>f.x);
    const left=Math.min(...positions),right=Math.max(...positions);
    const mid=((left+right)/2-trainingRoom.width/2)/100;
    const x=Math.max((trainingRoom.cameraBounds[0]-trainingRoom.width/2)/100,Math.min((trainingRoom.cameraBounds[1]-trainingRoom.width/2)/100,mid));
    const z=Math.max(13.5,((right-left)/200+Math.abs(mid-x)+2)/(Math.tan(35*Math.PI/360)*16/9));
    for(const c of cameras){
      c.tracking.update(c.camera,{x,y:3.15,z,aimY:2.1},1/60,5,c.online);
      c.camera.updateMatrixWorld();
      const px=new Vector3(0,0,0).project(c.camera).x*480;
      if(rendered>60)c.peak=Math.max(c.peak,Math.abs(px-c.previous));
      c.previous=px;
    }
    rendered++;
    assert.equal(hashState(state),before,'camera cannot mutate gameplay');
  });
  assert.ok(result.rollbacks>0 && result.dashFrames>0,'exercise real dash prediction corrections');
  assert.ok(result.converged);
  assert.deepEqual(result.desync,['OK','OK']);
  assert.ok(cameras[0].peak>8,'reproduce the original camera jolt');
  assert.ok(cameras[1].peak<cameras[0].peak*.4,`scenery movement ${cameras[0].peak} → ${cameras[1].peak}`);
});

test('local tracking retains the existing camera transform',()=>{
  const actual=new PerspectiveCamera(),expected=new PerspectiveCamera(),tracking=new CameraTracking();
  for(let i=0;i<60;i++){
    const x=Math.sin(i)*4,y=3+i/20,z=14+i/10,aimY=2+i/30,dt=1/60,k=1-Math.exp(-dt*5);
    expected.position.x+=(x-expected.position.x)*k;expected.position.z+=(z-expected.position.z)*k;expected.position.y=y;expected.lookAt(x,aimY,0);
    tracking.update(actual,{x,y,z,aimY},dt,5,false);
    assert.ok(actual.position.distanceTo(expected.position)<1e-12);
    assert.ok(actual.quaternion.angleTo(expected.quaternion)<1e-7);
  }
});

test('online tracking is time based and resets cleanly at arena/match changes',()=>{
  const results=[30,60,144].map(fps=>{
    const camera=new PerspectiveCamera(),tracking=new CameraTracking();
    tracking.update(camera,{x:0,y:3,z:14,aimY:2},0,5,true);
    for(let i=0;i<fps;i++)tracking.update(camera,{x:4,y:5,z:16,aimY:3},1/fps,5,true);
    const position=camera.position.clone(),rotation=camera.quaternion.clone();
    tracking.reset();tracking.update(camera,{x:-4,y:3,z:14,aimY:2},0,5,true);
    const expected=camera.clone();expected.lookAt(-4,2,0);
    assert.ok(camera.quaternion.angleTo(expected.quaternion)<1e-7);
    assert.equal(camera.position.y,3);
    return {position,rotation};
  });
  for(const result of results){assert.ok(result.position.distanceTo(results[0].position)<1e-10);assert.ok(result.rotation.angleTo(results[0].rotation)<1e-7);}
});
