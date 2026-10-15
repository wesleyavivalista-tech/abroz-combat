import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {BozoBodyHair,bodyHairArt} from '../apps/client/src/rendering/BozoBodyHair.js';
import {characters} from '../packages/game-core/characters/registry.js';

test('Body Hair reaches exactly twice its prior outer reach with original cost, timing and damage',()=>{
 const m=characters.bozo.moves.spear,b=m.hitboxes[0];
 assert.equal(b.x,15);assert.equal(b.x+b.w,2*(15+638));assert.equal(b.h,50);
 assert.deepEqual([m.damage,m.meterCost,m.startupFrames,m.activeFrames,m.recoveryFrames],[100,25,26,8,30]);
 const png=readFileSync('apps/client/public'+bodyHairArt.path);assert.equal(png.readUInt32BE(16),bodyHairArt.width);assert.equal(png.readUInt32BE(20),bodyHairArt.height);assert.equal(png[25],6);
});
test('new full-length hair art reveals at uniform pixel density throughout growth and retraction',()=>{
 const t=new THREE.Texture(),art=new BozoBodyHair(t);
 const width=285,height=223,bodyScale=1.64/239,left=260,bottom=761,pivot=351.56,seam=450;
 const fullLength=13.06-(seam-pivot)*bodyScale;
 const expectedPixelScale=fullLength/(bodyHairArt.right-bodyHairArt.left);
 for(const phase of [0,.1,.5,1,.7,.2,0]){
  art.update(left,bottom,width,height,bodyScale,pivot,seam,600,13.06,544,phase);
  const map=art.mesh.material.map!,visiblePixels=map.repeat.x*bodyHairArt.width;
  const worldWidth=art.mesh.scale.x*width*bodyScale,worldHeight=art.mesh.scale.y*height*bodyScale;
  assert.ok(Math.abs(worldWidth/visiblePixels-expectedPixelScale)<1e-9);
  assert.ok(Math.abs(worldHeight/(map.repeat.y*bodyHairArt.height)-expectedPixelScale)<1e-9,'same scale in X and Y');
  assert.ok(Math.abs((map.offset.x+map.repeat.x)*bodyHairArt.width-bodyHairArt.right)<1e-9,'pointed tip always retained');
  const origin=(seam-pivot)*bodyScale;
  if(phase===1)assert.ok(Math.abs(origin+worldWidth-13.06)<1e-9,'art endpoint equals damaging reach');
 }
 art.dispose();t.dispose();
});
