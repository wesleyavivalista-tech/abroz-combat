import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DodoRenderer} from '../apps/client/src/rendering/DodoRenderer.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {characters} from '../packages/game-core/characters/registry.js';
const frame=(height=200)=>({texture:new THREE.CanvasTexture({width:1,height:1} as HTMLCanvasElement),width:120,height,pivot:60,referenceHeight:200});
test('victory pose overrides an unfinished Guitar Star performance',()=>{
 const base=Array.from({length:16},()=>frame()),playing=Array.from({length:4},()=>frame());
 const visual=new DodoRenderer(base,playing),f=createFighter('dodo',1200,1),sprite=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 f.weaponUntil=1000;f.state='Idle';visual.update(f,0);assert.equal(sprite.material.map,playing[0].texture);
 f.state='MatchWin';visual.update(f,1);assert.equal(sprite.material.map,base[15].texture);visual.dispose();
});
test('Dodo walks through both leg halves in either direction and stops on the correct guard',()=>{
 const base=Array.from({length:16},()=>frame()),walk=Array.from({length:4},()=>frame());
 const visual=new DodoRenderer(base,[],[],false,walk),f=createFighter('dodo',1200,1),sprite=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 for(const state of ['WalkForward','WalkBackward'] as const){f.state=state;const expected=state==='WalkForward'?[0,1,2,3]:[0,3,2,1];for(let i=0;i<4;i++){f.stateFrame=i*7;visual.update(f,0);assert.equal(sprite.material.map,walk[expected[i]].texture);}}
 f.state='Idle';visual.update(f,0);assert.equal(sprite.material.map,base[0].texture);visual.dispose();
});
test('black guitar attack uses windup, strike and recovery with a shared body scale',()=>{
 const base=Array.from({length:16},()=>frame()),attacks=[frame(160),frame(260),frame(200)];const visual=new DodoRenderer(base,[],attacks),f=createFighter('dodo',1200,1),sprite=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 for(const id of ['guitarSwing','heavy']){const m=characters.dodo.moves[id];f.move=id;for(const [tick,index] of [[0,1],[m.startupFrames,0],[m.startupFrames+m.activeFrames,2]]){f.moveFrame=tick;visual.update(f,0);assert.equal(sprite.material.map,attacks[index].texture);assert.equal(sprite.scale.y,attacks[index].height*1.82/200);}}
 visual.dispose();
});
test('companions complete eight-step walk in both directions and yield immediately to attacks',()=>{
 const base=Array.from({length:6},()=>frame()),walk=Array.from({length:8},()=>frame());
 const visual=new DodoRenderer(base,[],[],true,walk),f=createFighter('dodo',1200,1),sprite=visual.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 for(const state of ['WalkForward','WalkBackward'] as const){f.state=state;for(let i=0;i<8;i++){f.stateFrame=i*6;visual.update(f,0);assert.equal(sprite.material.map,walk[state==='WalkBackward'?(8-i)%8:i].texture);}}
 f.move='pkJab';f.moveFrame=characters.dodo.moves.pkJab.startupFrames;visual.update(f,0);assert.equal(sprite.material.map,base[3].texture);
 f.move=null;f.state='Idle';visual.update(f,0);assert.equal(sprite.material.map,base[0].texture);visual.dispose();
});
