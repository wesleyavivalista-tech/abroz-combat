import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {screenMusic} from '../apps/client/src/audio/GameAudio.js';
import {readFileSync} from 'node:fs';
import {chooseMusic,tracks,type MusicState} from '../apps/client/src/audio/MusicRegistry.js';

test('every playable arena and music state resolves to a shipped score',()=>{
 for(const arena of ['the-foundry','basketball-court','shopping-mall','aeroporto-church'])
 for(const state of ['menu','selection','intro','match','final','sudden-death','victory','defeat','championship','party','championship-final'] as MusicState[]){
  const t=chooseMusic(state,arena);assert.ok(t?.url,`${arena}/${state}`);
  const bytes=readFileSync(new URL(`../apps/client/public${t.url}`,import.meta.url));if(t.url.endsWith('.mp3'))assert.equal(bytes.toString('ascii',0,3),'ID3');else assert.equal(bytes.toString('ascii',0,4),'RIFF');
 }
 assert.equal(tracks.victory_01.loop,false);assert.equal(tracks.defeat_01.loop,false);
});
test('PCM score has audible headroom, exact bar lengths and clean loop boundaries',()=>{
 for(const t of Object.values(tracks).filter(t=>t.url&&t.bpm!==undefined)){
  const data=readFileSync(new URL(`../apps/client/public${t.url}`,import.meta.url));
  assert.equal(data.toString('ascii',8,12),'WAVE');assert.equal(data.readUInt16LE(22),2);
  const rate=data.readUInt32LE(24),frames=(data.length-44)/4;let peak=0,sum=0;
  for(let i=44;i<data.length;i+=2){const v=data.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  assert.ok(peak<.9&&Math.sqrt(sum/((data.length-44)/2))>.03,t.id);
  assert.ok(Math.abs(frames/rate-(t.loop?64:16)*60/t.bpm!)<1/rate,t.id);
  if(t.loop)for(let channel=0;channel<2;channel++)assert.ok(Math.abs(data.readInt16LE(44+channel*2)-data.readInt16LE(data.length-4+channel*2))/32768<.12,`${t.id} seam`);
 }
});

test('all menu screens share the exact supplied track, with arena music preserved',()=>{
 const url='/audio/music/abroz-main-menu-theme-v8.mp3';
 for(const screen of ['home','settings','select','stage','roster','loading','lobby','local-match-setup','championship-setup','championship-bracket','elimination-setup']){
  const track=chooseMusic(screenMusic(screen),'shopping-mall');assert.equal(track?.url,url,screen);assert.equal(track?.id,'menu_01');assert.equal(track?.loop,true);
 }
 assert.equal(chooseMusic('match','shopping-mall')?.id,'mall_01');
 assert.equal(chooseMusic('championship','shopping-mall')?.id,'championship_01');
 const bytes=readFileSync(new URL(`../apps/client/public${url}`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'91390f62f00da51e47b43506fdba87743b1cf82b65c69425920e5c782da7fd27');
});

 test('Rooftop consistently selects the supplied arena song',()=>{
 for(const previous of [undefined,'rooftop_01','rooftop_02']){
  const t=chooseMusic('match','the-foundry',previous,()=>.99);
  assert.equal(t?.url,'/audio/music/rooftop-sunset-showdown.mp3');assert.equal(t?.loop,true);
 }
 const bytes=readFileSync(new URL('../apps/client/public/audio/music/rooftop-sunset-showdown.mp3',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'9c05461d14b948e1c65a2ce0e0516389d98662bdbf3decde12352c6a9c4a1b3a');
});

test('Church consistently selects the supplied arena song',()=>{
 for(const previous of [undefined,'church_01']){
  const t=chooseMusic('match','aeroporto-church',previous,()=>.99);
  assert.equal(t?.url,'/audio/music/ceremonial-steel.mp3');assert.equal(t?.loop,true);
 }
 const bytes=readFileSync(new URL('../apps/client/public/audio/music/ceremonial-steel.mp3',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'b89afca855e2b141cb817ddf808a99c7301835c017f73e5cff5a68f18e0df518');
});

test('Mall consistently selects the supplied arena song',()=>{
 for(const previous of [undefined,'mall_01']){
  const t=chooseMusic('match','shopping-mall',previous,()=>.99);
  assert.equal(t?.url,'/audio/music/mall-theme.mp3');assert.equal(t?.loop,true);
 }
 const bytes=readFileSync(new URL('../apps/client/public/audio/music/mall-theme.mp3',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'e5751e588bf6fa7a5654f6debef2be2d4b61b8c28fc4538e8b3489269776e8a2');
});

test('Basketball Court consistently selects the supplied arena song',()=>{
 for(const previous of [undefined,'court_01']){
  const t=chooseMusic('match','basketball-court',previous,()=>.99);
  assert.equal(t?.url,'/audio/music/basketball-court-theme.mp3');assert.equal(t?.loop,true);
 }
 const bytes=readFileSync(new URL('../apps/client/public/audio/music/basketball-court-theme.mp3',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'5e9ba65bd73cb05ee21cb2b0909daefe67edcae38125852058288cb06a0b3dcb');
});

 test('victory screens use the supplied song across all arenas',()=>{
 for(const arena of ['the-foundry','basketball-court','shopping-mall','aeroporto-church']){
  const t=chooseMusic('victory',arena);assert.equal(t?.url,'/audio/music/victory-theme.mp3');assert.equal(t?.loop,false);
  assert.equal(chooseMusic('defeat',arena)?.id,'defeat_01');
 }
 const bytes=readFileSync(new URL('../apps/client/public/audio/music/victory-theme.mp3',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'755422877f9c3d5db28bdb3c9cfc072df73e5aac0ede352556a79771ea8e9469');
});
