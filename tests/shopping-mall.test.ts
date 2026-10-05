import {RollbackManager} from '../packages/networking/RollbackManager.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingMall,stages} from '../packages/game-core/stages/registry.js';
import {stageAtTick,platformX} from '../packages/game-core/stages/motion.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {activateEide} from '../packages/game-core/simulation/EideSystem.js';
import {activateStructure} from '../packages/game-core/simulation/StructureSystem.js';
const game=(ids=['biel','gut'])=>{const g=new GameSimulation(ids,false,shoppingMall);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');return g;};

test('mall decks stay inside bounds at separate heights through opposite full loops',()=>{
 const [a,b]=shoppingMall.platforms!;assert.notEqual(a.y,b.y);assert.equal(a.width,b.width);
 for(let tick=0;tick<=1920;tick++){
  const x=platformX(a,tick),y=platformX(b,tick);
  assert.ok(x>=0&&x+a.width<=shoppingMall.width);assert.equal(x+y,1920);
  if(tick)assert.ok(Math.abs(x-platformX(a,tick-1))<=4);
 }
 assert.equal(platformX(a,480),1920);assert.equal(platformX(a,960),0);
});

test('all fighters ride both decks through reversals, land, jump, and can reach the next tier',()=>{
 for(const id of Object.keys(characters))for(const index of [0,1]){
  const g=game([id,'gut']);g.state.platformTick=430;
  const p=stageAtTick(shoppingMall,430).platforms![index],f=g.state.fighters[0];
  Object.assign(f,{x:p.x+p.width/2,y:p.y+60,vy:-1,state:'Fall'});
  for(let i=0;i<32;i++)g.step([0,0]);assert.equal(f.y,p.y,`${id} lands`);
  const offset=f.x-stageAtTick(shoppingMall,g.state.platformTick!).platforms![index].x;
  for(let i=0;i<1000;i++)g.step([0,0]);
  const current=stageAtTick(shoppingMall,g.state.platformTick!).platforms![index];
  assert.equal(f.y,p.y,id);assert.ok(Math.abs(f.x-current.x-offset)<.2,id);
  let peak=f.y;g.step([Button.Up,0]);
  for(let i=0;i<70;i++){g.step([i===16?Button.Up:0,0]);peak=Math.max(peak,f.y);}
  assert.ok(peak>p.y+300,`${id} reaches next height`);
 }
});

test('motion freezes during intro, hitstop and results; reset and rollback restore its clock',()=>{
 const g=game(),f=g.state.fighters[0];Object.assign(f,{x:240,y:300,vy:0});
 g.state.phase='intro';g.step([0,0]);assert.equal(g.state.platformTick,undefined);
 g.state.phase='fight';g.step([0,0]);assert.equal(f.x,244);
 g.state.hitstop=3;const snap=g.snapshot();for(let i=0;i<3;i++)g.step([0,0]);assert.equal(f.x,244);assert.equal(g.state.platformTick,1);
 for(let i=0;i<60;i++)g.step([0,0]);const hash=hashState(g.state);
 g.restore(snap);for(let i=0;i<63;i++)g.step([0,0]);assert.equal(hashState(g.state),hash);
 g.state.phase='result';const tick=g.state.platformTick;g.step([0,0]);assert.equal(g.state.platformTick,tick);
 g.resetPositions();assert.equal(g.state.platformTick,0);
});

test('Eide companions intercept the moving decks and remain aboard across reversals',()=>{
 for(const start of [0,420,880]){
  const g=game(['eide','gut']);g.state.platformTick=start;
  activateEide(g.state,stageAtTick(shoppingMall,start),g.state.fighters[0],0,characters.eide.moves.love);
  for(let i=0;i<80;i++)g.step([0,0]);const snap=g.snapshot();
  const run=()=>{for(let i=0;i<1000;i++){
   g.step([0,0]);
   if(i<45)continue;
   const platforms=stageAtTick(shoppingMall,g.state.platformTick!).platforms!;
   for(const c of g.state.clones){const p=platforms[c.fighter.npcPlatform!];assert.equal(c.fighter.y,p.y);assert.equal(c.fighter.x,p.x+p.width/2);}
  }};
  run();const hash=hashState(g.state);g.restore(snap);run();assert.equal(hashState(g.state),hash);
 }
});

test('constructed walls, their riders, and surface traps follow their supporting deck',()=>{
 const g=game(['luizinho','gut']),f=g.state.fighters[0];Object.assign(f,{x:240,y:300});
 const move=Object.values(characters.luizinho.moves).find(m=>m.structure?.kind==='wall')!;
 activateStructure(g.state,stageAtTick(shoppingMall,0),f,0,move);
 const wall=g.state.structures![0],start=wall.x;Object.assign(f,{x:wall.x,y:wall.y+wall.height,vy:0});
 for(const kind of ['origami','blood-pool','honey','fire-trail'] as const)g.state.hazards.push({kind,owner:0,x:200,y:300,createdAt:0,expiresAt:500,move:move.id,nextTicks:[]});
 for(let i=0;i<20;i++)g.step([0,0]);
 assert.equal(wall.x,start+80);assert.equal(f.x,wall.x);assert.equal(f.y,wall.y+wall.height);
 for(const h of g.state.hazards)assert.equal(h.x,280);
});

test('all fighter skins and four abilities remain finite and replayable on every moving tier',()=>{
 for(const c of Object.values(characters))for(const skin of c.skins??[{id:'original'}])for(const index of [-1,0,1])for(const button of [Button.Special,Button.Special2,Button.Super1,Button.Super2]){
  const g=new GameSimulation([c.id,'gut'],false,shoppingMall,undefined,[skin.id,'original']);g.state.phase='fight';g.state.platformTick=400;
  const p=stageAtTick(shoppingMall,400).platforms![Math.max(0,index)],f=g.state.fighters[0],d=g.state.fighters[1];
  Object.assign(f,{x:index<0?1100:p.x+180,y:index<0?0:p.y,state:'Idle',meter:100});Object.assign(d,{x:f.x+140,y:f.y,state:'Idle'});
  g.step([button,0]);assert.ok(f.move,`${c.id}/${skin.id}/${button}/${index} activates`);
  for(let i=0;i<90;i++)g.step([0,0]);const snap=g.snapshot();
  const run=()=>{for(let i=0;i<200;i++)g.step([0,0]);};run();
  for(const f of [...g.state.fighters,...g.state.clones.map(c=>c.fighter)]){
   for(const key of ['x','y','vx','vy','health','meter'] as const)assert.ok(Number.isFinite(f[key]),`${c.id}/${key}`);
   assert.ok(f.y>=0,`${c.id} above floor`);
  }
  const hash=hashState(g.state);g.restore(snap);run();assert.equal(hashState(g.state),hash,`${c.id}/${skin.id}/${button}/${index}`);
 }
 assert.equal(stages[shoppingMall.id],shoppingMall);
});

test('every fighter can transfer from lower to upper deck at the crossing window',()=>{
 for(const id of Object.keys(characters)){
  const g=game([id,'gut']);g.state.platformTick=210;
  const p=stageAtTick(shoppingMall,210).platforms![0],f=g.state.fighters[0];Object.assign(f,{x:p.x+240,y:p.y,vy:0});
  let landed=false;
  for(let i=0;i<120;i++){g.step([i===0||i===16?Button.Up:0,0]);if(f.y===600&&f.vy===0)landed=true;}
  assert.ok(landed,id);
 }
});

test('Tocha sigils and Astolfo spiders remain attached to a moving surface',()=>{
 for(const id of ['tocha','astolfo']){
  const g=game([id,'gut']),f=g.state.fighters[0];Object.assign(f,{x:240,y:300,vy:0,meter:100});
  g.step([Button.Special2,0]);for(let i=0;i<50;i++)g.step([0,0]);
  if(id==='tocha'){
   const h=g.state.hazards.find(h=>!h.kind)!;assert.ok(h);assert.equal(h.y,300);
   const x=h.x;g.step([0,0]);assert.equal(h.x,x+4);
  }else{
   const h=g.state.hazards.find(h=>h.kind==='spider')!;assert.ok(h);assert.equal(h.y,300);
   const x=h.x;g.step([0,0]);assert.equal(h.x,x+8);assert.equal(h.y,300);
  }
 }
});


test('delayed multiplayer inputs converge with moving platforms and Eide summons',()=>{
 for(const count of [2,4,6,8]){
  const ids=['biel','eide','tocha','luizinho','caio','bozo','jopa','astolfo'].slice(0,count);
  const baseline=game(ids),predicted=game(ids);
  for(const g of [baseline,predicted]){g.state.platformTick=440;g.state.fighters.forEach((f,i)=>{f.meter=100;f.x=500+i*150;});}
  const rb=new RollbackManager(predicted,0,0,8);
  const inputs=Array.from({length:600},(_,frame)=>ids.map((_,i)=>frame===0?Button.Super1:frame===160?Button.Special2:frame%90===0?Button.Up:i===0&&frame%80<25?Button.Right:0));
  for(let frame=0;frame<inputs.length;frame++){
   baseline.step(inputs[frame]);rb.local.set(frame,inputs[frame][0]);rb.tick();
   if(frame>=3)for(let seat=1;seat<count;seat++)rb.receive(frame-3,inputs[frame-3][seat],seat);
  }
  for(let frame=inputs.length-3;frame<inputs.length;frame++)for(let seat=1;seat<count;seat++)rb.receive(frame,inputs[frame][seat],seat);
  assert.equal(rb.desync,'OK');assert.ok(rb.rollbackCount>0);assert.equal(hashState(predicted.state),hashState(baseline.state),String(count));
 }
});
