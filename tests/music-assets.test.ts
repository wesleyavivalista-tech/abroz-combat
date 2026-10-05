import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseMusic,tracks,type MusicState} from '../apps/client/src/audio/MusicRegistry.js';

test('every playable arena and music state resolves to a shipped score',()=>{
 for(const arena of ['the-foundry','basketball-court','shopping-mall','aeroporto-church'])
 for(const state of ['menu','selection','intro','match','final','sudden-death','victory','defeat','championship','party','championship-final'] as MusicState[]){
  const t=chooseMusic(state,arena);assert.ok(t?.url,`${arena}/${state}`);
  const bytes=readFileSync(new URL(`../apps/client/public${t.url}`,import.meta.url));assert.equal(bytes.toString('ascii',0,4),'RIFF');
 }
 assert.equal(tracks.victory_01.loop,false);assert.equal(tracks.defeat_01.loop,false);
});
test('PCM score has audible headroom, exact bar lengths and clean loop boundaries',()=>{
 for(const t of Object.values(tracks).filter(t=>t.url)){
  const data=readFileSync(new URL(`../apps/client/public${t.url}`,import.meta.url));
  assert.equal(data.toString('ascii',8,12),'WAVE');assert.equal(data.readUInt16LE(22),2);
  const rate=data.readUInt32LE(24),frames=(data.length-44)/4;let peak=0,sum=0;
  for(let i=44;i<data.length;i+=2){const v=data.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  assert.ok(peak<.9&&Math.sqrt(sum/((data.length-44)/2))>.03,t.id);
  assert.ok(Math.abs(frames/rate-(t.loop?64:16)*60/t.bpm!)<1/rate,t.id);
  if(t.loop)for(let channel=0;channel<2;channel++)assert.ok(Math.abs(data.readInt16LE(44+channel*2)-data.readInt16LE(data.length-4+channel*2))/32768<.12,`${t.id} seam`);
 }
});
