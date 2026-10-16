import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {advanceContinuousAttacks} from '../packages/game-core/simulation/ContinuousAttackSystem.js';
import {protectedDamage} from '../packages/game-core/simulation/HairSystem.js';
import {spawnReturningProjectile,canSpawnReturningProjectile,advanceReturningProjectiles,finishProjectileMode} from '../packages/game-core/simulation/ReturningProjectileSystem.js';
const match=()=>{const g=new GameSimulation(['roms','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');g.state.fighters[0].x=300;g.state.fighters[1].x=1800;return g;};
const run=(g:GameSimulation,n:number,input=0)=>{for(let i=0;i<n;i++)g.step([input,0]);};
test('Roms basic opener hits at frame seven, deals damage once and recovers normally',()=>{
 const g=match(),[f,d]=g.state.fighters;d.x=f.x+100;
 const hp=d.health;
 run(g,1,Button.Light);
 assert.equal(f.move,'chop');
 while(f.moveFrame<6)run(g,1);
 assert.equal(d.health,hp,'startup must not deal damage');
 run(g,1);
 assert.equal(f.moveFrame,7);
 assert.equal(d.health,hp-58,'opener hits at its new activation frame');
 run(g,60);
 assert.equal(d.health,hp-58,'active overlap must not duplicate damage');
 assert.equal(f.move,null);
 assert.equal(f.state,'Idle');
 run(g,1,Button.Light);
 assert.equal(f.move,'chop','next opener remains available after recovery');
});
test('Roms gear protects 40% for exactly five seconds including hitstop',()=>{const g=match(),f=g.state.fighters[0];f.meter=100;run(g,1,Button.Special);run(g,15);assert.equal(f.armorUntil-g.state.frame,300);assert.equal(protectedDamage(f,g.state.frame,100),60);g.state.frame=f.armorUntil-1;g.state.hitstop=10;run(g,1);assert.equal(protectedDamage(f,g.state.frame,100),100);});
test('axe spin moves, repeatedly hits both sides and expires in two seconds',()=>{const g=match(),[f,d]=g.state.fighters;f.meter=100;d.x=f.x+130;run(g,1,Button.Special2);run(g,15);const deadline=f.actionUntil!;assert.equal(deadline-g.state.frame,120);const x=f.x;run(g,10,Button.Left);assert.ok(f.x<x);d.x=f.x-80;const hp=d.health;run(g,30);assert.ok(d.health<hp-14);g.state.frame=deadline-1;g.state.hitstop=10;run(g,1);assert.equal(f.moveFrame,135);});
test('vertical axe hits on ascent and descent and returns to its moving owner',()=>{const g=match(),[f,d]=g.state.fighters;d.x=f.x+40;d.y=200;spawnReturningProjectile(g.state,0,'toss','axe');assert.equal(f.returningWeaponOut,true);const hp=d.health;let apex=0;for(let i=0;i<90;i++){g.state.frame++;advanceReturningProjectiles(g.state,g.stage);apex=Math.max(apex,g.state.projectiles[0].y);}assert.ok(apex>400);assert.ok(d.health<=hp-150);assert.equal(f.returningWeaponOut,false);assert.equal(g.state.projectiles[0].active,false);});
test('straight ball traverses arena and returns; bounce reaches above platforms and is exclusive',()=>{const g=match(),f=g.state.fighters[0];spawnReturningProjectile(g.state,0,'straight','straight');let edge=0;for(let i=0;i<300;i++){g.state.frame++;advanceReturningProjectiles(g.state,g.stage);edge=Math.max(edge,g.state.projectiles[0].x);}assert.ok(edge>=g.stage.width-20);assert.equal(g.state.projectiles[0].active,false);spawnReturningProjectile(g.state,0,'bounce','bounce');assert.equal(canSpawnReturningProjectile(g.state,0,'bounce'),false);let high=0;for(let i=0;i<80;i++){g.state.frame++;advanceReturningProjectiles(g.state,g.stage);high=Math.max(high,g.state.projectiles[0].y);}assert.ok(high>340);f.x+=100;for(let i=0;i<800;i++){g.state.frame++;advanceReturningProjectiles(g.state,g.stage);}assert.equal(canSpawnReturningProjectile(g.state,0,'bounce'),true);});
test('juggling lasts 26 seconds then emits exactly five balls for five seconds',()=>{const g=match(),f=g.state.fighters[0];f.meter=100;run(g,1,Button.Super1);run(g,20);assert.equal(f.weaponUntil-g.state.frame,1560);const x=f.x;run(g,40,Button.Right);assert.ok(f.x>x);run(g,1);run(g,1,Button.Heavy);run(g,10);assert.ok(g.state.projectiles.some(p=>p.active&&p.trajectory==='bounce'));g.state.frame=f.weaponUntil-1;g.state.hitstop=5;run(g,1);assert.equal(g.state.projectiles.filter(p=>p.active&&p.trajectory==='finale').length,5);assert.equal(f.modeFinaleUntil!-g.state.frame,300);run(g,300);assert.equal(g.state.projectiles.filter(p=>p.active).length,0);assert.equal(f.modeFinaleUntil,0);});
test('water aims, continuously pushes and damages; damage respects defense',()=>{const g=match(),[f,d]=g.state.fighters;d.x=f.x+300;f.meter=100;run(g,1,Button.Super2);run(g,30);assert.equal(f.actionUntil!-g.state.frame,600);const x=d.x,hp=d.health;run(g,20);assert.ok(d.x>x);assert.ok(d.health<hp);run(g,10,Button.Up);assert.equal(f.beamAim,10);g.state.frame=f.actionUntil!-1;run(g,1);assert.ok(f.moveFrame>=630);});
test('mode projectiles ignore allies and invulnerability, survive life loss and replay identically',()=>{const g=match(),[f,d]=g.state.fighters;finishProjectileMode(g.state,0);d.x=f.x;d.invulnerableUntil=500;const hp=d.health;run(g,20);assert.equal(d.health,hp);const snap=g.snapshot();run(g,120,Button.Right);const h=hashState(g.state);g.restore(snap);run(g,120,Button.Right);assert.equal(hashState(g.state),h);g.state.fighters[0].health=0;run(g,1);assert.ok(g.state.projectiles.some(p=>p.active));assert.equal(g.state.fighters[0].modeFinaleUntil,0);});
test('Roms combo contains three distinct axe attacks and both skins are selectable',()=>{assert.deepEqual(characters.roms.basicAttacks?.chain,['chop','backhand','cleave']);const g=new GameSimulation(['roms','roms'],false,undefined,undefined,['original','hoodie']);assert.deepEqual(g.state.skins,['original','hoodie']);});

test('training spin damage persists between ticks and produces a hit reaction',()=>{
 const g=new GameSimulation(['roms','gut'],true),[f,d]=g.state.fighters;
 f.x=300;d.x=420;f.meter=100;
 run(g,1,Button.Special2);run(g,35);
 assert.ok(d.health<characters.gut.stats.maxHealth-14);
 assert.ok(d.stun>0);assert.equal(d.state,'HitStunStanding');assert.ok(d.comboDamage>=28);
});
test('training juggling ball damages a standing dummy and reacts in both directions',()=>{
 for(const facing of [1,-1] as const){
  const g=new GameSimulation(['roms','gut'],true),[f,d]=g.state.fighters;
  f.x=800;f.facing=facing;d.x=800+facing*180;
  spawnReturningProjectile(g.state,0,'straight','straight');run(g,8);
  assert.equal(d.health,characters.gut.stats.maxHealth-36);assert.ok(d.stun>0);assert.ok(d.comboDamage>=36);
 }
});

test('downward hose hits outstretched legs on either side, including in training',()=>{
 for(const facing of [1,-1] as const){
  const g=new GameSimulation(['roms','gut'],true),[f,d]=g.state.fighters;
  f.x=1000;f.facing=facing;d.x=1000+facing*170;f.move='water';f.moveFrame=31;f.state='SpecialMove';f.beamAim=-60;g.state.frame=5;
  const hp=d.health,x=d.x;run(g,1);
  assert.ok(d.health<hp,'leg contact must deal damage without training immediately healing it');
  assert.ok((d.x-x)*facing>0,'leg contact must push the opponent');
 }
});

test('axe spin deals 22 damage on each periodic hit only',()=>{
 const g=match(),[f,d]=g.state.fighters,m=characters.roms.moves.spin;
 assert.equal(m.damage,22);
 assert.equal(m.periodicMelee!.interval,10);
 assert.deepEqual([m.startupFrames,m.activeFrames,m.recoveryFrames,m.meterCost],[15,120,20,25]);
 f.move='spin';f.state='SpecialMove';f.moveFrame=m.startupFrames;d.x=f.x+80;
 const hp=d.health;
 for(let frame=1;frame<=30;frame++){
  g.state.frame=frame;
  advanceContinuousAttacks(g.state);
  assert.equal(d.health,hp-Math.floor(frame/10)*22,'only scheduled ticks deal damage');
 }
 f.moveFrame=m.startupFrames+m.activeFrames;g.state.frame=40;
 advanceContinuousAttacks(g.state);
 assert.equal(d.health,hp-66,'finished spin cannot keep dealing damage');
});
