import test from 'node:test';
import assert from 'node:assert/strict';
import {aeroportoChurch,trainingRoom,stages} from '../packages/game-core/stages/registry.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {surfaceBelow} from '../packages/game-core/simulation/StageCollision.js';
import {activateEide} from '../packages/game-core/simulation/EideSystem.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {contentVersion} from '../packages/shared/contentVersion.js';
const game=(ids=['biel','gut'])=>{const g=new GameSimulation(ids,false,aeroportoChurch);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');return g;};

test('church has exactly one stationary, centered platform twice normal width',()=>{
 assert.equal(stages[aeroportoChurch.id],aeroportoChurch);
 assert.equal(aeroportoChurch.platforms!.length,1);
 const p=aeroportoChurch.platforms![0];assert.equal(p.width,trainingRoom.platforms![0].width*2);
 assert.equal(p.x+p.width/2,aeroportoChurch.width/2);assert.equal(p.motion,undefined);
 for(const x of [p.x,p.x+p.width/2,p.x+p.width])assert.equal(surfaceBelow(aeroportoChurch,x,p.y),p.y);
 for(const x of [p.x-1,p.x+p.width+1])assert.equal(surfaceBelow(aeroportoChurch,x,p.y),0);
 assert.equal(surfaceBelow(aeroportoChurch,1200,p.y-1),0);
});

test('every fighter jumps through and lands on the wide church deck, then walks off either edge',()=>{
 const p=aeroportoChurch.platforms![0];
 for(const id of Object.keys(characters)){
  const g=game([id,'gut']),f=g.state.fighters[0];Object.assign(f,{x:1200,y:0,vy:0});
  let reached=false;
  for(let i=0;i<100;i++){
   g.step([i===0||i===16?Button.Up:0,0]);
   if(f.y>p.y)reached=true;
  }
  assert.ok(reached,id);assert.equal(f.y,p.y,id);assert.equal(f.vy,0,id);
  for(const side of [-1,1]){
   Object.assign(f,{x:side<0?p.x+8:p.x+p.width-8,y:p.y,vy:0,state:'Idle',move:null});
   for(let i=0;i<80;i++)g.step([side<0?Button.Left:Button.Right,0]);
   assert.equal(f.y,0,`${id} exits ${side}`);
  }
 }
});

test('Eide companions enter from opposite sides and occupy separate quarter points on the shared deck',()=>{
 const g=game(['eide','gut']);activateEide(g.state,aeroportoChurch,g.state.fighters[0],0,characters.eide.moves.love);
 assert.deepEqual(g.state.clones.map(c=>c.fighter.npcEntrance!.targetX),[960,1440]);
 for(let i=0;i<80;i++)g.step([0,0]);const snap=g.snapshot();
 const run=()=>{for(let i=0;i<350;i++)g.step([0,0]);};run();
 assert.equal(g.state.clones.length,2);
 assert.deepEqual(g.state.clones.map(c=>[c.fighter.x,c.fighter.y,c.fighter.npcEntrance]),[[960,340,undefined],[1440,340,undefined]]);
 const hash=hashState(g.state);g.restore(snap);run();assert.equal(hashState(g.state),hash);
});

test('all fighter skins and four abilities work from the floor, deck center and both deck edges',()=>{
 for(const c of Object.values(characters))for(const skin of c.skins??[{id:'original'}])for(const [x,y] of [[1200,0],[1200,340],[730,340],[1670,340]])for(const button of [Button.Special,Button.Special2,Button.Super1,Button.Super2]){
  const g=new GameSimulation([c.id,'gut'],false,aeroportoChurch,undefined,[skin.id,'original']);g.state.phase='fight';
  const f=g.state.fighters[0],d=g.state.fighters[1];
  Object.assign(f,{x,y,state:'Idle',meter:100,facing:x>1200?-1:1});Object.assign(d,{x:x+f.facing*130,y,state:'Idle'});
  g.step([button,0]);assert.ok(f.move,`${c.id}/${skin.id}/${button}/${x},${y}`);
  for(let i=0;i<100;i++)g.step([0,0]);const snap=g.snapshot();
  const run=()=>{for(let i=0;i<200;i++)g.step([0,0]);};run();
  for(const a of [...g.state.fighters,...g.state.clones.map(c=>c.fighter)]){
   for(const key of ['x','y','vx','vy','health','meter'] as const)assert.ok(Number.isFinite(a[key]),`${c.id}/${key}`);
   assert.ok(a.y>=0,`${c.id} above floor`);
  }
  for(const p of g.state.projectiles.filter(p=>p.active))assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
  const hash=hashState(g.state);g.restore(snap);run();assert.equal(hashState(g.state),hash,`${c.id}/${skin.id}/${button}/${x},${y}`);
 }
});

test('church content compatibility includes Eide landing offsets',()=>{
 const old=aeroportoChurch.eideLoveOffsets!,version=contentVersion();
 try{aeroportoChurch.eideLoveOffsets=[.2,.8];assert.notEqual(contentVersion(),version);}finally{aeroportoChurch.eideLoveOffsets=old;}
});

test('church battles and shared-deck summons converge after delayed multiplayer inputs',()=>{
 for(const count of [2,4,6,8]){
  const ids=['biel','eide','tocha','luizinho','caio','bozo','jopa','astolfo'].slice(0,count);
  const baseline=game(ids),predicted=game(ids);
  for(const g of [baseline,predicted])g.state.fighters.forEach((f,i)=>{f.meter=100;f.x=500+i*150;});
  const rb=new RollbackManager(predicted,0,0,8);
  const inputs=Array.from({length:480},(_,frame)=>ids.map((_,i)=>frame===0?Button.Super1:frame===160?Button.Special2:frame%90===0?Button.Up:i===0&&frame%80<25?Button.Right:0));
  for(let frame=0;frame<inputs.length;frame++){
   baseline.step(inputs[frame]);rb.local.set(frame,inputs[frame][0]);rb.tick();
   if(frame>=3)for(let seat=1;seat<count;seat++)rb.receive(frame-3,inputs[frame-3][seat],seat);
  }
  for(let frame=inputs.length-3;frame<inputs.length;frame++)for(let seat=1;seat<count;seat++)rb.receive(frame,inputs[frame][seat],seat);
  assert.equal(rb.desync,'OK');assert.ok(rb.rollbackCount>0);assert.equal(hashState(predicted.state),hashState(baseline.state),String(count));
 }
});
