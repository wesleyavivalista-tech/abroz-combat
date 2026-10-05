import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {hairSpearExtension,updateHairSpear} from '../apps/client/src/rendering/BozoHairSpear.js';
test('hair spear eases out before contact, holds, and retracts',()=>{
 assert.equal(hairSpearExtension(8,26,8),0);
 assert.ok(hairSpearExtension(17,26,8)>.4&&hairSpearExtension(17,26,8)<.6);
 for(let f=26;f<=34;f++)assert.equal(hairSpearExtension(f,26,8),1);
 assert.equal(hairSpearExtension(42,26,8),.5);
 assert.equal(hairSpearExtension(50,26,8),0);
});
test('all hair spear quads keep source pixel proportions, including body and tip',()=>{
 for(const extra of [0,15,357,900]){
  const geometry=new THREE.BufferGeometry();updateHairSpear(geometry,263,276,extra,450,.62,.81);
  const p=geometry.attributes.position,u=geometry.attributes.uv;
  for(let i=0;i<geometry.drawRange.count;i+=6){
   assert.ok(Math.abs(Math.abs(p.getX(i+1)-p.getX(i))-Math.abs(u.getX(i+1)-u.getX(i)))<.00001);
   assert.ok(Math.abs((p.getY(i+2)-p.getY(i))-(u.getY(i+2)-u.getY(i)))<.00001);
  }
  assert.ok(Math.abs(p.getX(1)-.5)<.00001,'lower body never extends');
  geometry.dispose();
 }
});
