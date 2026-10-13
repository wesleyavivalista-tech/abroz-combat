import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {activateJopa,advanceJopa,cleanupJopa,JOPA,mountableKnight} from '../packages/game-core/simulation/JopaSystem.js';
import {applyDamage} from '../packages/game-core/combat/DamageSystem.js';
import {canReceiveDirectHit} from '../packages/game-core/combat/ContactPolicy.js';
import {mountedCatalog} from '../apps/client/src/rendering/MountedVisual.js';
function game(){const g=new GameSimulation(['jopa','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});g.state.fighters[0].x=300;g.state.fighters[1].x=1800;return g;}
const run=(g:GameSimulation,n:number,inputs=[0,0])=>{for(let i=0;i<n;i++)g.step(inputs);};
const activate=(g:GameSimulation,id:string)=>activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves[id]);
test('Jopa has approved skin order, a punch/kick/punch chain and all roster mounted art',()=>{assert.deepEqual(characters.jopa.skins?.map(s=>s.name),['Santos jersey','White tee']);assert.deepEqual(characters.jopa.basicAttacks?.chain,['jab','comboKick','cross']);for(const id of Object.keys(characters))assert.ok(id==='jopa'||mountedCatalog.flat().includes(id));});
test('football has a two-second absolute lifetime even during hitstop and bounces from arena edges',()=>{const g=game();activate(g,'football');const p=g.state.projectiles.find(p=>p.active)!;p.x=g.stage.width-24;g.step([0,0]);assert.ok(p.vx<0);g.state.hitstop=200;run(g,118);assert.equal(p.active,true);run(g,1);assert.equal(p.active,false);});
test('football rebounds and can damage the same opponent again',()=>{const g=game(),d=g.state.fighters[1];d.x=450;activate(g,'football');const p=g.state.projectiles.find(p=>p.active)!;g.state.fighters[0].x=100;run(g,8);assert.equal(d.health,1500-52);assert.ok(p.vx<0);const hp=d.health;run(g,13);p.x=d.x-65;p.y=d.y+24;p.vx=16;run(g,3);assert.ok(d.health<hp);});
test('five deterministic chess variants hop straight and stun for one second',()=>{const g=game();for(let i=0;i<5;i++)activate(g,'chess');assert.deepEqual(g.state.projectiles.filter(p=>p.active).map(p=>p.variant),[0,1,2,3,4]);g.state.projectiles.forEach(p=>p.active=false);g.state.fighters[1].x=410;activate(g,'chess');run(g,1);const d=g.state.fighters[1];assert.ok(d.health<1500);assert.equal(d.jopaStunUntil! - g.state.frame,60);run(g,60);assert.equal(d.jopaStunUntil,undefined);assert.equal(d.stun,0);});
test('tree protects and locks Jopa, spawns on cadence, and releases five tentacles exactly once',()=>{const g=game(),f=g.state.fighters[0];activate(g,'tree');const tree=g.state.clones[0];assert.equal(tree.fighter.health,980);assert.equal(canReceiveDirectHit(f,g.state.frame),false);applyDamage(g.state,f,999);assert.equal(f.health,1400);run(g,179,[Button.Right|Button.Light,0]);assert.equal(f.x,300);assert.equal(g.state.clones.length,1);run(g,1);assert.equal(g.state.clones.filter(c=>c.kind==='tentacle').length,1);assert.equal(g.state.clones[1].fighter.health,140);tree.fighter.health=0;cleanupJopa(g.state,g.stage);assert.equal(f.jopaTree,undefined);assert.equal(g.state.clones.filter(c=>c.kind==='tentacle').length,6);cleanupJopa(g.state,g.stage);assert.equal(g.state.clones.filter(c=>c.kind==='tentacle').length,6);});
test('knight protects rider, moves and double jumps, then dismounts on second basic',()=>{const g=game(),f=g.state.fighters[0];activate(g,'knight');const c=g.state.clones[0];assert.equal(c.fighter.health,700);assert.equal(c.rider,0);applyDamage(g.state,f,100);assert.equal(c.fighter.health,600);assert.equal(f.health,1400);run(g,10,[Button.Right,0]);assert.equal(c.fighter.x,300);g.step([Button.Up|Button.Right,0]);assert.equal(c.fighter.x,305.4);assert.ok(c.fighter.vy>0);run(g,4);g.step([Button.Up,0]);assert.equal(c.fighter.airJumpsUsed,1);run(g,4);g.step([Button.Up,0]);assert.equal(c.fighter.airJumpsUsed,1);g.step([Button.Medium,0]);assert.equal(f.jopaRide,undefined);assert.equal(c.rider,undefined);assert.equal(f.move,null);});
test('allied riders can mount, enemies cannot, and occupied mounts cannot be stolen',()=>{const g=new GameSimulation(['jopa','gut','tocha','bozo'],false,undefined,[0,0,1,1]);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');activate(g,'knight');const c=g.state.clones[0];g.step([Button.Medium,0,0,0]);c.fighter.x=600;c.fighter.y=0;c.fighter.vy=0;c.nextAction=1000;const ally=g.state.fighters[1],enemy=g.state.fighters[2];ally.x=700;enemy.x=730;g.step([0,Button.Medium,Button.Medium,0]);assert.equal(c.rider,1);assert.equal(ally.jopaRide,c.id);assert.equal(enemy.jopaRide,undefined);c.fighter.health=0;g.step([0,0,0,0]);assert.equal(ally.jopaRide,undefined);});
test('knight landing causes heavy damage and one-second stun',()=>{const g=game();activate(g,'knight');const c=g.state.clones[0],d=g.state.fighters[1];c.fighter.x=d.x;c.fighter.y=2;c.fighter.vy=-10;g.step([0,0]);assert.equal(d.health,1500-JOPA.knightDamage);assert.equal(d.jopaStunUntil! - g.state.frame,60);run(g,58);assert.ok(d.stun>0);run(g,2);assert.equal(d.stun,0);assert.equal(d.jopaStunUntil,undefined);});
test('summons disappear with owner elimination, riders recover, and reset clears all Jopa state',()=>{const g=game();activate(g,'knight');g.state.fighters[0].lives=1;g.state.fighters[0].health=0;g.step([0,0]);g.step([0,0]);assert.equal(g.state.clones.length,0);assert.equal(g.state.fighters[0].jopaRide,undefined);g.resetPositions();assert.ok(g.state.fighters.every(f=>f.jopaRide===undefined&&f.jopaTree===undefined));});
test('Jopa abilities replay deterministically through snapshot restore',()=>{const g=game();activate(g,'tree');activate(g,'football');activate(g,'chess');const snap=g.snapshot();run(g,500);const hash=hashState(g.state);g.restore(snap);run(g,500);assert.equal(hashState(g.state),hash);});
test('tree and knight summon through actual input and startup',()=>{for(const [id,button] of [['tree',Button.Super1],['knight',Button.Super2]] as const){const g=game();g.step([button,0]);run(g,characters.jopa.moves[id].startupFrames);assert.ok(g.state.clones.some(c=>c.kind===id));assert.ok(g.state.fighters[0].usedSupers.includes(id));}});
test('tree expires at 70 seconds even during hitstop, releases owner once and animates death for one second',()=>{
 const g=game();activate(g,'tree');const tree=g.state.clones[0];g.state.frame=JOPA.treeLifetime-1;cleanupJopa(g.state,g.stage);assert.ok(tree.fighter.health>0);
 g.state.hitstop=100;g.step([0,0]);assert.equal(tree.fighter.health,0);assert.equal(g.state.fighters[0].jopaTree,undefined);assert.equal(g.state.treeDeaths?.length,1);assert.equal(g.state.clones.filter(c=>c.kind==='tentacle').length,5);
 const snap=g.snapshot();run(g,59);assert.equal(g.state.treeDeaths?.length,1);run(g,1);assert.equal(g.state.treeDeaths?.length,0);const hash=hashState(g.state);g.restore(snap);run(g,60);assert.equal(hashState(g.state),hash);
 g.resetPositions();assert.equal(g.state.treeDeaths?.length,0);
});
test('combat destruction starts the same tree death animation exactly once',()=>{const g=game();activate(g,'tree');g.state.clones[0].fighter.health=0;cleanupJopa(g.state,g.stage);cleanupJopa(g.state,g.stage);assert.equal(g.state.treeDeaths?.length,1);assert.equal(g.state.clones.filter(c=>c.kind==='tentacle').length,5);});
test('knight still has no lifetime limit',()=>{const k=game();activate(k,'knight');k.state.frame=10000;advanceJopa(k.state,k.stage);assert.ok(k.state.clones.some(c=>c.kind==='knight'));});

test('tentacle cap is global across trees and death bursts, and freed slots refill',()=>{
 const g=new GameSimulation(['jopa','jopa']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';});
 g.state.fighters.forEach((f,i)=>activateJopa(g.state,g.stage,f,i,characters.jopa.moves.tree));
 for(let i=0;i<12;i++){g.state.frame+=180;advanceJopa(g.state,g.stage);}
 const count=()=>g.state.clones.filter(c=>c.kind==='tentacle'&&c.fighter.health>0).length;assert.equal(count(),10);
 g.state.clones.find(c=>c.kind==='tentacle')!.fighter.health=0;g.state.frame+=180;advanceJopa(g.state,g.stage);assert.equal(count(),10);
 g.state.clones.filter(c=>c.kind==='tree').forEach(c=>c.fighter.health=0);cleanupJopa(g.state,g.stage);assert.equal(count(),10);
});
test('tentacles jump to elevated opponents and land on one-way platforms',()=>{
 const g=game();g.state.fighters[0].x=400;activate(g,'tree');g.state.frame=180;advanceJopa(g.state,g.stage);
 const t=g.state.clones.find(c=>c.kind==='tentacle')!.fighter,d=g.state.fighters[1];t.x=500;t.y=0;d.x=650;d.y=340;d.vy=0;
 let airborne=false,landed=false;for(let i=0;i<100;i++){g.state.frame++;advanceJopa(g.state,g.stage);airborne ||=t.vy>0;landed ||=t.y===340&&t.vy===0;}
 assert.ok(airborne);assert.ok(landed);
});
test('knight hit emits impact and rebounds without an immediate second landing hit',()=>{
 const g=game();activate(g,'knight');const k=g.state.clones[0],d=g.state.fighters[1];k.fighter.x=d.x;k.fighter.y=2;k.fighter.vy=-10;
 g.step([0,0]);assert.ok(k.fighter.vy>0);assert.ok(k.fighter.vx*k.fighter.facing<0);assert.ok(g.events.some(e=>e.type==='impact'));const hp=d.health;
 k.fighter.x=d.x;k.fighter.y=2;k.fighter.vy=-10;g.step([0,0]);assert.equal(d.health,hp);
});

test('football ricochets from its owner and teammates without damage or stun',()=>{
 const g=new GameSimulation(['jopa','gut','astolfo','tocha'],false,undefined,[0,0,1,1]);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');
 const f=g.state.fighters[0],ally=g.state.fighters[1];f.x=300;ally.x=800;g.state.fighters[2].x=1800;activate(g,'football');const p=g.state.projectiles.find(p=>p.active)!;
 const health=g.state.fighters.map(f=>f.health);p.x=ally.x-70;p.vx=16;run(g,3,[0,0,0,0]);assert.ok(p.vx<0);assert.equal(ally.stun,0);
 g.state.frame+=12;p.x=f.x+70;p.vx=-16;run(g,3,[0,0,0,0]);assert.ok(p.vx>0);assert.equal(f.stun,0);assert.deepEqual(g.state.fighters.map(f=>f.health),health);
});

test('empty knight waits in place then travels only during its jump',()=>{
 const g=game();activate(g,'knight');g.step([Button.Medium,0]);const c=g.state.clones[0];c.nextAction=g.state.frame+15;const x=c.fighter.x;
 run(g,14);assert.equal(c.fighter.x,x);assert.equal(c.fighter.y,g.stage.floorHeight);
 g.step([0,0]);assert.ok(c.fighter.y>g.stage.floorHeight);assert.ok(c.fighter.x>x);
});
test('knight stays planted after landing even with direction held or remaining rebound time',()=>{
 const g=game();activate(g,'knight');const c=g.state.clones[0];c.fighter.y=2;c.fighter.vy=-10;c.reboundUntil=g.state.frame+30;c.fighter.vx=-5;
 g.step([Button.Right,0]);const x=c.fighter.x;assert.equal(c.fighter.y,g.stage.floorHeight);run(g,8,[Button.Right,0]);assert.equal(c.fighter.x,x);assert.notEqual(c.fighter.state,'WalkForward');
});

test('live-input knight summoning followed by sustained left/right never walks on floor or platform',()=>{
 for(const y of [0,340]){
  const g=game(),f=g.state.fighters[0];f.x=600;f.y=y;g.step([Button.Super2,0]);run(g,characters.jopa.moves.knight.startupFrames);
  const knight=g.state.clones.find(c=>c.kind==='knight')!.fighter,x=knight.x;
  run(g,120,[Button.Right,0]);assert.equal(knight.x,x);assert.equal(knight.y,y);
  run(g,120,[Button.Left,0]);assert.equal(knight.x,x);assert.equal(knight.y,y);
  g.step([Button.Right|Button.Up,0]);assert.ok(knight.x>x);assert.ok(knight.y>y);
 }
});

test('mount hint eligibility matches range, team, seat availability and grounded readiness',()=>{
 const g=new GameSimulation(['jopa','gut','astolfo','tocha'],false,undefined,[0,0,1,1]);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');activate(g,'knight');const c=g.state.clones[0];g.step([Button.Medium,0,0,0]);c.fighter.x=600;c.fighter.y=0;c.fighter.facing=1;
 const f=g.state.fighters[1];f.x=770;f.y=0;f.vy=0;assert.equal(mountableKnight(g.state,g.stage,1)?.id,c.id);
 f.x=771;assert.equal(mountableKnight(g.state,g.stage,1),undefined);f.x=599;assert.equal(mountableKnight(g.state,g.stage,1),undefined);
 f.x=700;f.vy=2;assert.equal(mountableKnight(g.state,g.stage,1),undefined);f.vy=0;f.move='palm';assert.equal(mountableKnight(g.state,g.stage,1),undefined);f.move=null;
 c.rider=0;assert.equal(mountableKnight(g.state,g.stage,1),undefined);delete c.rider;
 g.state.fighters[2].x=700;assert.equal(mountableKnight(g.state,g.stage,2),undefined);
 c.fighter.health=0;assert.equal(mountableKnight(g.state,g.stage,1),undefined);
});

test('knight landing recovery leaves escape time after stun and blocks rider and autonomous jumps',()=>{
 for(const autonomous of [false,true]){
  const g=game();activate(g,'knight');const c=g.state.clones[0],d=g.state.fighters[1];
  if(autonomous){delete c.rider;delete g.state.fighters[0].jopaRide;}
  c.fighter.x=d.x;c.fighter.y=2;c.fighter.vy=-10;c.nextAction=999;
  g.step([0,0]);const hitFrame=g.state.frame;assert.equal(c.recoveryUntil,hitFrame+90);assert.equal(c.recoveryUntil!-d.jopaStunUntil!,30);
  c.nextAction=0;
  for(let i=0;i<89;i++){g.step([i%2?0:Button.Up,0]);if(g.state.frame>=hitFrame+60){assert.equal(d.stun,0);assert.equal(c.fighter.y,0);assert.equal(c.fighter.vy,0);}}
  g.step([0,0]);g.step([Button.Up,0]);assert.ok(c.fighter.vy>0);
 }
});
test('knight recovery halves air steering and survives snapshot replay',()=>{
 const g=game();activate(g,'knight');const c=g.state.clones[0];c.fighter.y=100;c.fighter.vy=-1;c.recoveryUntil=90;
 const x=c.fighter.x;g.step([Button.Right,0]);assert.ok(Math.abs(c.fighter.x-x-2.7)<1e-9);
 const snap=g.snapshot();run(g,120,[Button.Right,0]);const hash=hashState(g.state);g.restore(snap);run(g,120,[Button.Right,0]);assert.equal(hashState(g.state),hash);
});

// A close rebound can return before the former twelve-frame target cooldown.
test('football damages a separated return hit within twelve frames',()=>{
 const g=game(),d=g.state.fighters[1];d.x=450;activate(g,'football');
 const p=g.state.projectiles.find(p=>p.active)!;p.x=390;
 advanceJopa(g.state,g.stage);assert.equal(d.health,1448);
 const hp=d.health;g.state.frame++;p.x=380;p.vx=16;
 for(let i=0;i<3;i++){g.state.frame++;advanceJopa(g.state,g.stage);}
 assert.equal(d.health,hp-42);assert.ok(p.vx<0);
});
test('football cannot repeatedly damage an overlapping target before separating',()=>{
 const g=game(),d=g.state.fighters[1];d.x=450;activate(g,'football');
 const p=g.state.projectiles.find(p=>p.active)!;p.x=d.x;p.vx=1;
 advanceJopa(g.state,g.stage);const hp=d.health;
 for(let i=0;i<20;i++){g.state.frame++;p.x=d.x;p.vx=1;advanceJopa(g.state,g.stage);}
 assert.equal(d.health,hp);
});
test('chess keeps its launch direction with enemies behind or moving past it',()=>{
 for(const facing of [-1,1] as const){
  const g=game(),f=g.state.fighters[0],d=g.state.fighters[1];f.x=1000;f.facing=facing;activate(g,'chess');
  const p=g.state.projectiles.find(p=>p.active)!;
  for(let i=0;i<60;i++){d.x=p.x-facing*150;g.state.frame++;advanceJopa(g.state,g.stage);assert.equal(p.vx,facing*5);}
 }
});
test('football wall ricochets register every separated impact, including rapid returns',()=>{
 const g=game(),d=g.state.fighters[1];d.x=g.stage.width-120;activate(g,'football');
 const p=g.state.projectiles.find(p=>p.active)!;p.x=d.x+60;p.vx=-16;
 const hp=d.health;
 for(let i=0;i<12;i++){g.state.frame++;advanceJopa(g.state,g.stage);}
 assert.ok(d.health<=hp-94);assert.ok(p.active);
 const snapshot=g.snapshot();
 for(let i=0;i<30;i++){g.state.frame++;advanceJopa(g.state,g.stage);}
 const expected=hashState(g.state);g.restore(snapshot);
 for(let i=0;i<30;i++){g.state.frame++;advanceJopa(g.state,g.stage);}
 assert.equal(hashState(g.state),expected);
});

test('football damage decays per ball across opponents and restores with snapshots; new balls reset',()=>{
 const g=new GameSimulation(['jopa','gut','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.x=2000;});
 g.state.fighters[0].x=100;activate(g,'football');const p=g.state.projectiles.find(p=>p.active)!;
 const hit=(seat:number)=>{
  g.state.frame++;const d=g.state.fighters[seat];g.state.fighters.slice(1).forEach(f=>f.x=2000);
  d.x=600;d.y=0;d.state='Idle';d.stun=0;d.combo=0;
  p.x=540;p.y=24;p.vx=16;p.nextHits={};const hp=d.health;
  advanceJopa(g.state,g.stage);return hp-d.health;
 };
 assert.deepEqual([hit(1),hit(2),hit(1),hit(2)],[52,42,34,27]);
 const saved=g.snapshot(),damage=p.footballDamage;
 hit(1);g.restore(saved);assert.equal(g.state.projectiles.find(p=>p.active)!.footballDamage,damage);
 activate(g,'football');assert.ok(g.state.projectiles.some(p=>p.active&&p.footballDamage===52));
});
