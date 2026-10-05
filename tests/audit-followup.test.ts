import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type {WebSocket} from 'ws';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {activateStructure,hitStructureProjectile} from '../packages/game-core/simulation/StructureSystem.js';
import {initializeProjectile} from '../packages/game-core/simulation/ProjectilePool.js';
import {advanceRespawns} from '../packages/game-core/simulation/LifeSystem.js';
import {RetryableAssets} from '../apps/client/src/rendering/RetryableAssets.js';
import {SceneRenderer} from '../apps/client/src/rendering/SceneRenderer.js';
import {registerFighterVisual} from '../apps/client/src/rendering/VisualRegistry.js';
import {send,MAX_SOCKET_BUFFER_BYTES} from '../apps/server/src/rooms.js';
import {deterministicHypot,deterministicSin,deterministicCos} from '../packages/game-core/simulation/DeterministicMath.js';
const match=(ids=['gut','luizinho'])=>{const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.y=g.stage.floorHeight;});return g;};
test('guard and grounded hit reactions recognize built roof surfaces',()=>{
 for(const kind of ['wall','home'])for(const guard of [true,false]){
  const g=match();const [a,d]=g.state.fighters;activateStructure(g.state,g.stage,d,1,characters.luizinho.moves[kind]);if(kind==='home')activateStructure(g.state,g.stage,d,1,characters.luizinho.moves.build);
  const b=g.state.structures![0];a.x=b.x-30;d.x=b.x;a.y=d.y=b.y+b.height;
  g.hit(0,characters.gut.moves.palm,guard?Button.Right:0,false,1,1);assert.equal(d.state,guard?'BlockStanding':'HitStunStanding');
 }
});
test('distinct companion shots damage structures independently; repeated same shot does not',()=>{
 const g=match(['dodo','luizinho']);g.state.fighters[0].x=100;activateStructure(g.state,g.stage,g.state.fighters[1],1,characters.luizinho.moves.wall);const b=g.state.structures![0],hp=b.health;
 const m=Object.values(characters.dodo.moves).find(m=>m.projectile&&m.id.includes('ball'))!;
 for(const id of [0,1,0]){const p=g.state.projectiles[0];initializeProjectile(p,{active:true,owner:0,companionId:id,move:m.id,serial:1,x:b.x+60,y:b.y+80,vx:10,vy:0,life:60});assert.ok(hitStructureProjectile(g.state,p,{x:b.x-70,y:b.y+80},g.stage));}
 assert.equal(hp-b.health,m.damage*2);
});
test('respawn clears optional state while preserving actor identity and life contracts',()=>{
 const g=match(),f=g.state.fighters[0];Object.assign(f,{dazed:true,gymLandingStun:true,modeFinaleUntil:999,respawnAt:1,meter:42,lives:2,attackSerial:17,usedSupers:['test']});g.state.frame=1;
 advanceRespawns(g.state);assert.equal(g.state.fighters[0],f);assert.equal(f.dazed,undefined);assert.equal(f.gymLandingStun,undefined);assert.equal(f.modeFinaleUntil,undefined);assert.equal(f.meter,42);assert.equal(f.lives,2);assert.equal(f.attackSerial,18);assert.deepEqual(f.usedSupers,['test']);
});
test('failed asset attempts dispose late resources and retry without poisoning the cache',async()=>{
 const cache=new RetryableAssets<number>();let finish!:()=>void;let disposed=0;
 const failed=cache.get(async own=>{own({dispose(){disposed++;}});void new Promise<void>(r=>finish=r).then(()=>own({dispose(){disposed++;}}));throw Error('network');});
 await assert.rejects(failed,/network/);assert.equal(disposed,1);assert.equal(await cache.get(async()=>7),7);finish();await Promise.resolve();assert.equal(disposed,2);assert.equal(await cache.get(async()=>8),7);cache.dispose();
});
test('disposing pending assets prevents registration and allows a new attempt',async()=>{
 const cache=new RetryableAssets<number>();let finish!:()=>void;let disposed=0;
 const pending=cache.get(async own=>{await new Promise<void>(r=>finish=r);own({dispose(){disposed++;}});return 1;});await Promise.resolve();cache.dispose();const fresh=cache.get(async()=>2);finish();await assert.rejects(pending,/cancelled/);assert.equal(await fresh,2);assert.equal(disposed,1);assert.equal(await cache.get(async()=>3),2);
});
test('rollback replaces mismatched companion visuals and disposes the old one',()=>{
 let disposed=0;for(const variant of [0,1])registerFighterVisual('dodo',()=>({root:new THREE.Group(),update(){},dispose(){disposed++;}}),`pain-killer-${variant}`);
 const renderer=Object.assign(Object.create(SceneRenderer.prototype),{scene:new THREE.Scene(),clones:new Map(),cloneIdentities:new Map()}) as SceneRenderer;
 const g=match(['dodo','gut']);g.state.clones=[{id:0,owner:0,kind:'basketball',variant:0,fighter:structuredClone(g.state.fighters[0])}];renderer.syncCloneVisuals(g.state,false,0);const old=renderer.clones.get(0);g.state.clones[0].variant=1;renderer.syncCloneVisuals(g.state,false,0);assert.notEqual(renderer.clones.get(0),old);assert.equal(disposed,1);renderer.syncCloneVisuals(g.state,false,0);assert.equal(disposed,1);g.state.clones=[];renderer.syncCloneVisuals(g.state,false,0);assert.equal(disposed,2);
});
test('socket queue budget terminates slow consumers without enqueueing more output',()=>{
 let sent=0,closed=0;const socket={readyState:1,bufferedAmount:0,send(){sent++;},terminate(){closed++;this.readyState=3;}};send(socket as unknown as WebSocket,{type:'pong',sent:1});assert.equal(sent,1);socket.bufferedAmount=MAX_SOCKET_BUFFER_BYTES+1;send(socket as unknown as WebSocket,{type:'pong',sent:2});send(socket as unknown as WebSocket,{type:'pong',sent:3});assert.equal(closed,1);assert.equal(sent,1);
});
test('shared deterministic math preserves numerical accuracy without native transcendental calls',()=>{
 for(let i=-1000;i<=1000;i++){const a=i/37;assert.ok(Math.abs(deterministicSin(a)-Math.sin(a))<1e-13);assert.ok(Math.abs(deterministicCos(a)-Math.cos(a))<1e-13);assert.ok(Math.abs(deterministicHypot(i,731)-Math.hypot(i,731))<1e-10);}
 assert.equal(deterministicHypot(0,0),0);assert.equal(deterministicCos(0),1);assert.equal(deterministicSin(-Math.PI/2),-1);
});
test('swept projectile hits nearer later-seat opponent, with stable ties and no double hit',()=>{
 const g=match(['dodo','gut','gut']);const [a,far,near]=g.state.fighters;a.x=100;far.x=600;near.x=535;const hp=near.health;
 initializeProjectile(g.state.projectiles[0],{active:true,owner:0,move:'chord',serial:1,x:520,y:80,vx:13,vy:0,life:20});g.step([0,0,0]);assert.ok(near.health<hp);assert.equal(far.health,hp);assert.equal(g.state.projectiles[0].active,false);const after=near.health;g.step([0,0,0]);assert.equal(near.health,after);
});
