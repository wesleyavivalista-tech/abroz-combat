import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {activateStructure,advanceStructures,collideStructures,attackStructures,hitStructureProjectile} from '../packages/game-core/simulation/StructureSystem.js';
import {spawnReturningProjectile,advanceReturningProjectiles} from '../packages/game-core/simulation/ReturningProjectileSystem.js';
import {initializeProjectile} from '../packages/game-core/simulation/ProjectilePool.js';
import {luizinhoPose} from '../apps/client/src/characters/luizinho/presentation.js';
const match=(other='gut')=>{const g=new GameSimulation(['luizinho',other]);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.y=g.stage.floorHeight;});g.state.fighters[0].x=300;g.state.fighters[1].x=1800;return g;};
const run=(g:GameSimulation,n:number,input=0)=>{for(let i=0;i<n;i++)g.step([input,0]);};
const make=(g:GameSimulation,move:string)=>{activateStructure(g.state,g.stage,g.state.fighters[0],0,characters.luizinho.moves[move]);return g.state.structures!.at(-1)!;};
test('Seller cycles all ten products deterministically, deals damage and mirrors release',()=>{
 for(const face of [1,-1] as const){const g=match(),[f,d]=g.state.fighters;f.x=1000;f.facing=face;d.x=f.x+face*180;
 f.meter=100;run(g,1,Button.Special);run(g,18);const p=g.state.projectiles.find(p=>p.active)!;assert.equal(p.variant,0);assert.equal(Math.sign(p.vx),face);const hp=d.health;run(g,12);assert.ok(d.health<hp);}
 const g=match(),f=g.state.fighters[0];const variants=[];
 for(let i=0;i<11;i++){f.meter=100;run(g,1,Button.Special);run(g,18);variants.push(g.state.projectiles.find(p=>p.active&&p.serial===f.attackSerial)?.variant);g.state.projectiles.forEach(p=>p.active=false);run(g,30);}
 assert.deepEqual(variants,[0,1,2,3,4,5,6,7,8,9,0]);
});
test('wall blocks enemies including a dash across its full width, but lets its owner pass',()=>{
 const g=match(),b=make(g,'wall'),[f,d]=g.state.fighters;
 const before=new Map([[d,{x:b.x+200,y:d.y}],[f,{x:b.x-100,y:f.y}]]);d.x=b.x-100;f.x=b.x;
 collideStructures(g.state,before);assert.equal(d.x,b.x+b.width/2+31);assert.equal(f.x,b.x);
 assert.equal(b.health,420);g.state.frame=b.expiresAt-1;advanceStructures(g.state,g.stage);assert.equal(g.state.structures!.length,1);g.state.frame++;advanceStructures(g.state,g.stage);assert.equal(b.phase,'collapsed');g.state.frame+=45;advanceStructures(g.state,g.stage);assert.equal(g.state.structures!.length,0);
});
test('projectiles hit the first blocking surface; fighter before a wall takes priority',()=>{
 const g=match('luizinho'),b=make(g,'wall'),p=g.state.projectiles[0],f=g.state.fighters[0];f.x=100;
 initializeProjectile(p,{active:true,owner:1,move:'seller',serial:1,x:b.x-100,y:100,vx:-200,life:100});
 assert.equal(hitStructureProjectile(g.state,p,{x:b.x+100,y:100},g.stage),true);assert.equal(p.active,false);assert.equal(b.health,355);
 f.x=b.x+70;initializeProjectile(p,{active:true,owner:1,move:'seller',serial:2,x:b.x-100,y:100,vx:-200,life:100});
 assert.equal(hitStructureProjectile(g.state,p,{x:b.x+150,y:100},g.stage),false);assert.equal(b.health,355);
});
test('a returning ball is blocked before damaging a player behind a wall',()=>{
 const g=match('roms'),b=make(g,'wall'),[f,d]=g.state.fighters;f.x=b.x-60;d.x=b.x+100;d.facing=-1;
 spawnReturningProjectile(g.state,1,'straight','straight');const p=g.state.projectiles.find(p=>p.active)!;p.x=b.x+50;p.vx=-100;p.y=110;
 const hp=f.health;advanceReturningProjectiles(g.state,g.stage);assert.equal(f.health,hp);assert.equal(p.returning,true);assert.ok(b.health<420);
});
test('turret has 800 health, shoots from its platform and expires at 80 seconds during hitstop',()=>{
 const g=match();g.stage={...g.stage,platforms:[{x:200,y:200,width:300}]};g.state.fighters[0].y=200;const b=make(g,'turret');
 assert.equal(b.health,800);assert.equal(b.y,200);assert.equal(b.expiresAt,4800);g.state.frame=72;advanceStructures(g.state,g.stage);const p=g.state.projectiles.find(p=>p.active)!;assert.equal(p.move,'cannon');assert.ok(p.y<285&&p.y>200);assert.ok((p.vy??0)<0);assert.ok(Math.abs(Math.hypot(p.vx,p.vy??0)-16.2)<.001);
 g.state.frame=4799;g.state.hitstop=10;run(g,1);assert.equal(b.phase,'collapsed');assert.equal(b.shots,1);run(g,45);assert.equal(g.state.structures!.length,0);
});
test('house marks first and builds with a free second Ultimate press after continued movement',()=>{
 const g=match(),f=g.state.fighters[0];f.meter=100;run(g,1,Button.Super2);run(g,55);assert.equal(g.state.structures![0].phase,'marked');assert.ok(f.usedSupers.includes('home'));f.meter=0;const x=f.x;run(g,12,Button.Left);assert.ok(f.x<x);run(g,1);run(g,1,Button.Super2);run(g,18);assert.equal(g.state.structures![0].phase,'built');assert.equal(g.state.structures![0].health,1400);assert.equal(f.meter,0);
});
test('house confines occupants at both sides and roof, while outsiders can stand and jump on its roof',()=>{
 const g=match(),b=make(g,'home'),d=g.state.fighters[1];d.x=b.x;make(g,'build');assert.ok(b.trapped.includes('seat:1'));assert.ok(b.height>340);
 for(const sign of [-1,1]){d.x=b.x+sign*1000;d.y=b.y+900;collideStructures(g.state,new Map());assert.ok(d.x>=b.x-b.width/2+53&&d.x<=b.x+b.width/2-53);assert.equal(d.y,b.y+b.height-22-154);}
 const f=g.state.fighters[0];f.x=b.x;f.y=b.y+b.height;f.vy=0;f.state='Idle';run(g,1,Button.Up);run(g,8);assert.ok(f.y>b.y+b.height);
});
test('all players can destroy the house; collapse damages and stuns occupants once for seven seconds',()=>{
 const g=match(),b=make(g,'home'),[f,d]=g.state.fighters;f.x=b.x-b.width/2+55;d.x=b.x;make(g,'build');f.facing=-1;f.move='heavyKick';f.moveFrame=23;f.attackSerial++;b.health=1;
 const hp=d.health;attackStructures(g.state,g.stage);assert.equal(b.phase,'collapsed');assert.equal(d.health,hp-400);assert.equal(d.stun,420);assert.equal(d.dazed,true);attackStructures(g.state,g.stage);assert.equal(d.health,hp-400);
});
test('collapse preserves knockdown and get-up protection',()=>{
 for(const state of ['Knockdown','GetUp'] as const){const g=match(),b=make(g,'home'),[f,d]=g.state.fighters;d.x=b.x;d.state=state;make(g,'build');f.x=b.x-b.width/2+55;f.facing=-1;f.move='heavyKick';f.moveFrame=23;b.health=1;const hp=d.health;attackStructures(g.state,g.stage);assert.equal(d.health,hp);}
});
test('structure attacks deduplicate one swing, reset after a new swing, and bound hit history',()=>{
 const g=match('luizinho'),b=make(g,'wall'),d=g.state.fighters[1];d.x=b.x+80;d.facing=-1;d.move='punch';d.moveFrame=12;d.attackSerial=1;attackStructures(g.state,g.stage);assert.equal(b.health,350);attackStructures(g.state,g.stage);assert.equal(b.health,350);d.attackSerial++;attackStructures(g.state,g.stage);assert.equal(b.health,280);
 for(let i=0;i<300;i++)b.hits[`projectile:1:seller:${i}`]=Number.MAX_SAFE_INTEGER;attackStructures(g.state,g.stage);assert.ok(Object.keys(b.hits).length<10);
});
test('interruption before startup creates nothing; activated structures persist until death, forfeit or reset',()=>{
 const g=match(),f=g.state.fighters[0];f.meter=100;run(g,1,Button.Special2);f.move=null;f.stun=20;run(g,40);assert.equal(g.state.structures,undefined);
 const b=make(g,'home'),d=g.state.fighters[1];d.x=b.x;make(g,'build');d.health=0;run(g,1);assert.ok(!b.trapped.includes('seat:1'));assert.equal(g.state.structures!.length,1);
 f.health=0;run(g,1);assert.equal(g.state.structures!.length,0);make(g,'turret');g.resetPositions();assert.equal(g.state.structures!.length,0);make(g,'turret');g.step([0,0],[0]);assert.equal(g.state.structures!.length,0);
});
test('six builders have bounded structures and deterministic snapshot replay',()=>{
 const g=new GameSimulation(Array(6).fill('luizinho'));g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});
 for(let j=0;j<3;j++)for(let i=0;i<6;i++)activateStructure(g.state,g.stage,g.state.fighters[i],i,characters.luizinho.moves.turret);assert.equal(g.state.structures!.length,6);
 const snap=g.snapshot();for(let i=0;i<240;i++)g.step([Button.Right,0,0,0,0,0]);const result=hashState(g.state);g.restore(snap);for(let i=0;i<240;i++)g.step([Button.Right,0,0,0,0,0]);assert.equal(hashState(g.state),result);
});
test('both skins share alternating gait, opposite punches and state-aware dash frames',()=>{
 const g=match(),f=g.state.fighters[0];f.state='WalkForward';const poses=[];for(const t of [0,7,14,21]){f.stateFrame=t;poses.push(luizinhoPose(f).pose);}assert.deepEqual(poses,[1,2,3,4]);f.state='DashForward';assert.equal(luizinhoPose(f).pose,5);f.state='DashBackward';assert.equal(luizinhoPose(f).pose,6);f.move='jab';f.moveFrame=8;assert.equal(luizinhoPose(f).pose,1);f.move='cross';f.moveFrame=10;assert.equal(luizinhoPose(f).pose,3);assert.deepEqual(characters.luizinho.skins!.map(s=>s.id),['original','black']);
});
test('turret shots keep their release angle and can be dodged with a later jump',()=>{
 const g=match(),d=g.state.fighters[1];make(g,'turret');d.x=600;g.state.frame=71;run(g,1);const p=g.state.projectiles.find(p=>p.active)!;assert.equal(p.vy,0);const hp=d.health;d.vy=21;d.state='Jump';run(g,22);assert.equal(d.health,hp);assert.equal(p.vy,0);
});
test('turrets hit platform targets on either side and ground targets from above',()=>{
 for(const direction of [-1,1,0]){const g=match(),[f,d]=g.state.fighters;f.x=direction===-1?1100:600;f.y=direction===0?340:0;d.x=direction===0?1100:direction===-1?700:800;d.y=direction===0?0:340;const b=make(g,'turret');g.state.frame=71;const hp=d.health;run(g,1);const p=g.state.projectiles.find(p=>p.active)!;assert.equal(Math.sign(p.vy??0),direction===0?-1:1);assert.equal(Math.sign(p.vx),direction===-1?-1:1);assert.ok(Math.abs(Math.hypot(p.vx,p.vy??0)-16.2)<.001);assert.equal(b.health,800);run(g,35);assert.ok(d.health<hp);}
});
test('delayed remote inputs converge through mark, build, shots and destructible walls',async()=>{
 const {RollbackManager}=await import('../packages/networking/RollbackManager.js');const a=match('luizinho'),b=match('luizinho');
 for(const g of [a,b]){g.state.fighters[1].x=650;g.state.fighters.forEach(f=>f.meter=100);make(g,'turret');}
 const rb=new RollbackManager(b,0,0,8);
 for(let frame=0;frame<240;frame++){const local=frame===0||frame===65?Button.Super2:frame===150?Button.Special2:0,remote=frame===20?Button.Special:frame>80&&frame<145?Button.Left:frame===180?Button.Medium:0;a.step([local,remote]);rb.local.set(frame,local);rb.tick();rb.receive(frame,remote,1);}
 assert.equal(hashState(a.state),hashState(b.state));assert.ok(rb.rollbackCount>0);
});
test('walls use the caster platform and stay supported at either platform edge',()=>{
 for(const facing of [-1,1] as const){const g=match(),f=g.state.fighters[0];const platform=g.stage.platforms![0];f.x=facing===1?platform.x+platform.width-5:platform.x+5;f.y=platform.y;f.facing=facing;const wall=make(g,'wall');assert.equal(wall.y,platform.y);assert.ok(wall.x-wall.width/2>=platform.x);assert.ok(wall.x+wall.width/2<=platform.x+platform.width);const d=g.state.fighters[1];d.x=wall.x;d.y=0;collideStructures(g.state,new Map());assert.equal(d.x,wall.x,'players below the platform are not blocked');}
});
test('house roof takes damage from active airborne strikes at the ceiling, not idle head bumps or attacks below it',()=>{
 const g=match(),b=make(g,'home'),f=g.state.fighters[0];f.x=b.x;make(g,'build');f.y=b.y+b.height-22-154;f.state='Fall';attackStructures(g.state,g.stage);assert.equal(b.health,1400);
 f.move='air';f.moveFrame=9;f.attackSerial++;attackStructures(g.state,g.stage);assert.equal(b.health,1330);assert.equal(b.lastHitAt,g.state.frame);attackStructures(g.state,g.stage);assert.equal(b.health,1330);
 f.attackSerial++;f.y-=60;attackStructures(g.state,g.stage);assert.equal(b.health,1330);
});
test('house walls and roof all accept projectile hits from inside the house',()=>{
 for(const direction of ['left','right','up']){const g=match(),b=make(g,'home');make(g,'build');g.state.fighters[1].x=1800;const p=g.state.projectiles[0];initializeProjectile(p,{active:true,owner:0,move:'seller',serial:1,x:direction==='left'?b.x-b.width:b.x+(direction==='right'?b.width:0),y:direction==='up'?b.y+b.height+100:100,vx:0,life:100});assert.equal(hitStructureProjectile(g.state,p,{x:b.x,y:100},g.stage),true);assert.equal(b.health,1335);}
});
test('every destructible structure records a fresh impact point only when an attack deals damage',()=>{
 for(const kind of ['wall','turret','home']){const g=match('luizinho'),b=make(g,kind);if(kind==='home')make(g,'build');g.state.fighters[0].x=100;g.state.fighters[1].x=1900;g.state.frame=100;const p=g.state.projectiles[0];const hitY=b.y+70;initializeProjectile(p,{active:true,owner:1,move:'seller',serial:15,x:b.x-b.width,y:hitY,vx:-100,life:10});hitStructureProjectile(g.state,p,{x:b.x+b.width,y:hitY},g.stage);assert.equal(b.lastHitAt,100);assert.equal(b.hitY,hitY);assert.ok(b.hitX!>b.x);g.state.frame=105;p.active=true;p.x=b.x-b.width;hitStructureProjectile(g.state,p,{x:b.x+b.width,y:hitY},g.stage);assert.equal(b.lastHitAt,100);}
});
test('demolition and impact visuals replay by frame and retain a bounded mesh pool',async()=>{
 const {StructureEffects}=await import('../apps/client/src/characters/luizinho/StructureEffects.js');const g=match(),b=make(g,'home');make(g,'build');b.phase='collapsed';b.createdAt=100;const fx=new StructureEffects();const positions=()=>fx.root.children.filter(c=>c.visible).map(c=>[...c.position.toArray(),...c.scale.toArray(),c.rotation.z]);g.state.frame=105;fx.update(g.state,false);const early=positions();g.state.frame=122;fx.update(g.state,false);assert.notDeepEqual(positions(),early);const count=fx.root.children.length;for(let i=0;i<200;i++){g.state.frame=100+i%45;fx.update(g.state,false);}assert.equal(fx.root.children.length,count);g.state.frame=105;fx.update(g.state,false);assert.deepEqual(positions(),early);g.state.structures=[];fx.update(g.state,false);assert.equal(positions().length,0);fx.dispose();assert.equal(fx.root.children.length,0);
});
test('destroyed walls and turrets stop interacting while their debris plays then cleans up',()=>{
 for(const move of ['wall','turret']){
  const g=match('luizinho'),b=make(g,move),d=g.state.fighters[1];
  d.x=b.x+60;d.facing=-1;d.move='punch';d.moveFrame=12;b.health=1;
  attackStructures(g.state,g.stage);assert.equal(b.phase,'collapsed');assert.equal(b.health,0);
  const shots=b.shots;g.state.frame+=30;advanceStructures(g.state,g.stage);assert.equal(b.shots,shots);
  const old=new Map([[d,{x:b.x+200,y:b.y}]]);d.x=b.x;collideStructures(g.state,old);assert.equal(d.x,b.x);
  g.state.frame=b.expiresAt;advanceStructures(g.state,g.stage);assert.equal(g.state.structures!.length,0);
 }
});
test('wall and turret debris animates deterministically with bounded rendering resources',async()=>{
 const {StructureEffects}=await import('../apps/client/src/characters/luizinho/StructureEffects.js');
 for(const move of ['wall','turret']){
  const g=match(),b=make(g,move);b.phase='collapsed';b.createdAt=100;
  const fx=new StructureEffects(),positions=()=>fx.root.children.filter(c=>c.visible).map(c=>[...c.position.toArray(),...c.scale.toArray(),c.rotation.z]);
  g.state.frame=105;fx.update(g.state,false);const early=positions();assert.ok(early.length>=16);
  g.state.frame=125;fx.update(g.state,false);assert.notDeepEqual(positions(),early);
  const count=fx.root.children.length;for(let i=0;i<100;i++){g.state.frame=100+i%45;fx.update(g.state,false);}assert.equal(fx.root.children.length,count);
  g.state.frame=105;fx.update(g.state,false);assert.deepEqual(positions(),early);
  g.state.structures=[];fx.update(g.state,false);assert.equal(positions().length,0);fx.dispose();assert.equal(fx.root.children.length,0);
 }
});

 test('turret waits 72 ticks before its first shot and between subsequent shots',()=>{
  const g=match(),b=make(g,'turret');
  for(const frame of [71,72,143,144]){
   g.state.frame=frame;advanceStructures(g.state,g.stage);
   assert.equal(b.shots,frame<72?0:frame<144?1:2);
  }
 });
