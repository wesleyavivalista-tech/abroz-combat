import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {BozoRenderer,bozoPose} from '../apps/client/src/rendering/BozoRenderer.js';
import {bozoFrames} from '../apps/client/src/rendering/BozoAtlas.js';
import {walkAtlases} from '../apps/client/src/rendering/WalkAtlas.js';
import {expansionFrames} from '../apps/client/src/rendering/ExpansionAtlas.js';
import {validateAtlasFrames} from '../apps/client/src/rendering/AnimationContract.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';

const art='apps/client/public/art/bozo/';
const texture=(name:string)=>{const t=new THREE.Texture();t.name=name;return t;};
function visual(skin:number,clone=false){
 const sources=['polo','basketball','clone','movement','cloneMovement','expansion','cloneExpansion','near','far','cloneNear','cloneFar','bodyHair'].map(texture);
 return {sources,renderer:new BozoRenderer(sources.slice(0,3),skin,clone,sources[3],sources[4],undefined,sources[5],sources[6],sources.slice(7,9),sources.slice(9,11),sources[11])};
}
test('Bozo replacement sheets retain atlas dimensions and complete frame mappings',()=>{
 for(const [name,width,height] of [['base-polo',1536,1024],['base-basketball',1536,1024],['movement',1536,1024],['expansion',1536,1024],['walk-near',1536,1024],['walk-far',1536,1024],['fall',1024,1536],['mounted',1536,1024]] as const){
  const png=readFileSync(`${art}model-${name}-v1.png`);assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);assert.equal(png[25],6,'RGBA transparency is required');
 }
 for(const frames of Object.values(bozoFrames)){assert.equal(frames.length,24);validateAtlasFrames(frames,1536,1024);}
 validateAtlasFrames(expansionFrames.bozo.frames,1536,1024);assert.equal(expansionFrames.bozo.frames.length,24);
 const walk=walkAtlases.bozo;assert.equal(walk.frames.length,8);
 for(const frame of walk.frames){validateAtlasFrames([frame.bounds],1536,1024);assert.ok(frame.pivot>frame.bounds[0]&&frame.pivot<frame.bounds[2]);assert.equal(frame.height,frame.bounds[3]-frame.bounds[1]+2);}
});
test('every Bozo move and reaction renders without mutating combat state, including armor and clones',()=>{
 const states=['Idle','WalkForward','WalkBackward','JumpStartup','Jump','Fall','Land','DashForward','DashBackward','Crouch','BlockStanding','BlockCrouching','HitStunStanding','HitStunCrouching','AirHitStun','HairTrapped','Knockdown','GetUp','KO','Respawning','MatchWin','MatchLose'];
 for(const skin of [0,1])for(const mode of ['normal','armor','clone']){
  const {renderer,sources}=visual(skin,mode==='clone');const f=createFighter('bozo',900,1);if(mode==='armor')f.armorUntil=9999;
  const check=()=>{const before=JSON.stringify(f);renderer.update(f,0);assert.equal(JSON.stringify(f),before);assert.ok(bozoPose(f)>=0&&bozoPose(f)<24);renderer.root.traverse(o=>{assert.ok([...o.position.toArray(),...o.scale.toArray()].every(Number.isFinite));if(o instanceof THREE.Mesh)assert.ok(o.material.map,'all body poses retain a texture');});};
  for(const state of states)for(let tick=0;tick<40;tick++){Object.assign(f,{state,stateFrame:tick,move:null});check();}
  for(const move of Object.values(characters.bozo.moves))for(let tick=0;tick<=move.startupFrames+move.activeFrames+move.recoveryFrames;tick++){Object.assign(f,{state:move.state,move:move.id,moveFrame:tick,stateFrame:tick});check();}
  renderer.dispose();sources.forEach(t=>t.dispose());
 }
});
test('both Bozo skins use corrected walking art at constant stature in both directions',()=>{
 for(const skin of [0,1])for(const state of ['WalkForward','WalkBackward']){
  const {renderer,sources}=visual(skin),f=createFighter('bozo',900,1);f.state=state;const seen=new Set<string>();
  for(let tick=0;tick<32;tick++){
   f.stateFrame=tick;renderer.update(f,0);const sprite=renderer.fallBodies[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
   assert.ok(['near','far'].includes(sprite.material.map!.name));assert.ok(Math.abs(sprite.scale.y-1.64)<1e-9);assert.ok(Math.abs(sprite.position.y-.82)<1e-9);seen.add(sprite.material.map!.name+sprite.material.map!.offset.toArray().join());
  }
  assert.equal(seen.size,4);renderer.dispose();sources.forEach(t=>t.dispose());
 }
});
