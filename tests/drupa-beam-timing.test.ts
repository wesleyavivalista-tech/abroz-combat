import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {DrupaRenderer} from '../apps/client/src/rendering/DrupaRenderer.js';
import {RenderInterpolation} from '../apps/client/src/rendering/RenderInterpolation.js';

test('bald-head damage starts on the visible beam frame in both skins and directions',()=>{
 for(const skin of [0,1])for(const facing of [-1,1] as const){
  const g=new GameSimulation(['drupa','gut']);g.state.phase='fight';
  const [a,d]=g.state.fighters;a.state=d.state='Idle';a.meter=100;a.x=1200;a.facing=facing;d.x=a.x+facing*400;
  const visual=new DrupaRenderer(Array.from({length:8},()=>new THREE.Texture()),skin);
  const beam=visual.root.children[1],interpolation=new RenderInterpolation();let hits=0;
  try{
   for(let n=0;n<110;n++){
    const hp=d.health;interpolation.capture(g.state);g.step([n===0?Button.Special2:0,0]);interpolation.complete(g.state);
    for(const alpha of [0,.5,1]){
     visual.update(interpolation.view(g.state,alpha).fighters[0]);
     if(d.health<hp){assert.equal(a.moveFrame,characters.drupa.moves.bald.startupFrames);assert.equal(beam.visible,true);}
     if(a.move==='bald'&&a.moveFrame<characters.drupa.moves.bald.startupFrames){assert.equal(beam.visible,false);assert.equal(d.health,characters.gut.stats.maxHealth);}
    }
    if(d.health<hp)hits++;
   }
   assert.equal(hits,1);assert.equal(beam.visible,false);
  }finally{visual.dispose();}
 }
});

test('late online inputs cannot show bald-head damage before its beam across catch-up renders',async()=>{
 const {RollbackManager}=await import('../packages/networking/RollbackManager.js');
 const {hashState}=await import('../packages/game-core/simulation/GameSimulation.js');
 for(const delay of [0,3,8])for(const drawEvery of [1,3,6])for(const armored of [false,true]){
  const make=()=>{const g=new GameSimulation([armored?'drupa':'gut','drupa']);g.state.phase='fight';g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',meter:100,x:700-i*400,facing:i?1:-1}));if(armored)g.state.fighters[0].weaponUntil=1000;return g;};
  const authoritative=make(),predicted=make(),peer=new RollbackManager(predicted,0,0,8);
  const visual=new DrupaRenderer(Array.from({length:8},()=>new THREE.Texture()),0),beam=visual.root.children[1];
  const remote=(frame:number)=>frame===10?Button.Special2:0;
  let lastHealth=predicted.state.fighters[0].health,seenBeam=false;
  const draw=()=>{visual.update(predicted.state.fighters[1]);seenBeam ||=beam.visible;
   const hp=predicted.state.fighters[0].health;
   if(hp<lastHealth)assert.ok(seenBeam,`delay=${delay}, render interval=${drawEvery}, armor=${armored}, frame=${predicted.state.frame}`);
   lastHealth=hp;
  };
  try{
   for(let frame=0;frame<110;frame++){
    authoritative.step([0,remote(frame)]);
    if(frame>=delay)peer.receive(frame-delay,remote(frame-delay),1);
    peer.local.set(frame,0);assert.equal(peer.tick(),true);
    if(frame%drawEvery===0)draw();
   }
   for(let frame=110-delay;frame<110;frame++)peer.receive(frame,remote(frame),1);
   draw();assert.ok(seenBeam);assert.ok(lastHealth<characters[predicted.state.fighters[0].characterId].stats.maxHealth);
   assert.equal(hashState(predicted.state),hashState(authoritative.state));assert.equal(peer.desync,'OK');
  }finally{visual.dispose();}
 }
});
