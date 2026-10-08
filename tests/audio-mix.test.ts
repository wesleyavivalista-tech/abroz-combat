import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicDucking,sampleCalibration,safetyCurve,mixLevels} from '../apps/client/src/audio/AudioMix.js';
import {sounds} from '../apps/client/src/audio/SoundRegistry.js';
import {readFileSync} from 'node:fs';
test('duck requests do not compound or keep the deepest duck alive after its event ends',()=>{
 const d=new MusicDucking();d.request('ko',0);d.request('impact',800);assert.equal(d.gain(850),.55);assert.equal(d.gain(901),.82);assert.equal(d.gain(1061),1);
 for(let i=0;i<8;i++)d.request('ultimate',2000);assert.equal(d.gain(2001),.62);d.clear();assert.equal(d.gain(2002),1);
});
test('sample correction ignores silence, caps quiet boosts, and protects source headroom',()=>{
 const buffer=(a:Float32Array<ArrayBuffer>)=>({numberOfChannels:1,length:a.length,sampleRate:1000,getChannelData:()=>a});
 const tone=new Float32Array(1000).fill(.1),padded=new Float32Array(2000);padded.set(tone);
 assert.ok(Math.abs(sampleCalibration(buffer(tone)).gain-sampleCalibration(buffer(padded)).gain)<1e-6);
 assert.equal(sampleCalibration(buffer(new Float32Array(1000).fill(.02))).gain,1.8);
 const hot=sampleCalibration(buffer(new Float32Array(1000).fill(.99)));assert.ok(hot.gain*hot.peak<=.88);
 assert.equal(sampleCalibration(buffer(new Float32Array(1000))).gain,1);
});
test('peak safety has a linear normal range and bounded symmetric overload',()=>{
 const c=safetyCurve();assert.ok(Math.max(...c)<.94);assert.equal(c[2048],0);assert.equal(c[0],-c[c.length-1]);assert.ok(Math.abs(c[3072]-.5)<1e-6);
 assert.ok(mixLevels.music<mixLevels.combat);assert.ok(mixLevels.ambience<mixLevels.music);
});
test('recorded countdown uses voice routing, no pitch variation, and fits existing beats',()=>{
 for(const [i,id] of ['countdown_3','countdown_2','countdown_1','round_start'].entries()){
  const d=sounds[id];assert.equal(d.bus,'voice');assert.equal(d.variation,0);assert.equal(d.loop,undefined);
  const bytes=readFileSync(new URL(`../apps/client/public${d.assets![0]}`,import.meta.url));assert.equal(bytes.toString('ascii',8,12),'WAVE');
  const duration=(bytes.length-44)/bytes.readUInt32LE(28);assert.ok(duration> .5&&duration<(i===3?2:1.2));
 }
});
