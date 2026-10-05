import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MountedVisual} from '../apps/client/src/rendering/MountedVisual.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {worldX} from '../apps/client/src/rendering/StageCoordinates.js';

test('Gym Bro display offsets clear on release, death and respawn for both skins',()=>{
 for(const skin of ['original','charcoal'])for(const state of ['Idle','AirHitStun','Respawning','Fall'] as const){
  const root=new THREE.Group();const body=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());root.add(body);
  const base={root,update(f:ReturnType<typeof createFighter>){root.position.set(worldX(f.x),f.y/100,.12);},dispose(){body.geometry.dispose();body.material.dispose();}};
  const visual=new MountedVisual(base,'jomp',skin),f=createFighter('jomp',600,1);
  // SceneRenderer applies this pose to the outer wrapper during a Gym Bro lift.
  visual.root.position.set(7,5,0);visual.root.rotation.z=-Math.PI/2;
  f.state=state;f.y=80;visual.update(f,0);visual.root.updateMatrixWorld(true);
  assert.deepEqual(visual.root.position.toArray(),[0,0,0]);assert.equal(visual.root.rotation.z,0);
  const shown=body.getWorldPosition(new THREE.Vector3());assert.equal(shown.x,worldX(f.x));assert.equal(shown.y,f.y/100);
  visual.dispose();
 }
});
