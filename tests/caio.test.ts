import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {advanceBlood,activateBlood,attackSlow,movementSlow,floodHeight} from '../packages/game-core/simulation/BloodSystem.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
function match(){const g=new GameSimulation(['caio','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');g.state.fighters[0].x=100;g.state.fighters[1].x=1200;return g;}
const run=(g:GameSimulation,n:number,input=0)=>{for(let i=0;i<n;i++)g.step([input,0]);};
test('Caio has three jumps, release edges are required, landing resets the allowance',()=>{
 const g=match(),f=g.state.fighters[0];run(g,8,Button.Up);assert.equal(f.airJumpsUsed,0);
 run(g,1);run(g,1,Button.Up);assert.equal(f.airJumpsUsed,1);run(g,4,Button.Up);assert.equal(f.airJumpsUsed,1);
 run(g,1);run(g,1,Button.Up);assert.equal(f.airJumpsUsed,2);assert.ok(g.events.some(e=>e.type==='blood-jump'));
 run(g,1);const before=f.vy;run(g,1,Button.Up);assert.equal(f.vy,before-1);run(g,110);assert.equal(f.airJumpsUsed,0);
});
test('shadow dash travels farther and held invisibility releases or interrupts cleanly',()=>{
 const g=match(),f=g.state.fighters[0];run(g,1,Button.Right);run(g,1);run(g,1,Button.Right);const x=f.x;run(g,10,Button.Right);assert.ok(f.x-x>=260);
 run(g,20);run(g,300,Button.Medium);assert.equal(f.move,'vanish');run(g,1);assert.equal(f.move,null);
 run(g,10,Button.Medium);g.hit(1,characters.gut.moves.palm,0,false,0);assert.equal(f.move,null);
});
test('pool and flood slow movement AND animation, with precise expiry and platform escape',()=>{
 const g=match(),[a,b]=g.state.fighters;
 activateBlood(g.state,g.stage,a,0,characters.caio.moves.pool);b.x=a.x;advanceBlood(g.state,g.stage);assert.equal(attackSlow(b,0),.5);assert.equal(movementSlow(b,0),.5);
 b.move='palm';b.moveFrame=0;g.updateFighter(b,0,1);assert.equal(b.moveFrame,0);g.updateFighter(b,0,1);assert.equal(b.moveFrame,1);
 g.state.frame=600;advanceBlood(g.state,g.stage);assert.equal(attackSlow(b,600),1);assert.equal(g.state.hazards.length,0);
 activateBlood(g.state,g.stage,a,0,characters.caio.moves.flood);g.state.frame+=90;advanceBlood(g.state,g.stage);assert.equal(attackSlow(b,g.state.frame),.2);assert.equal(floodHeight(g.state.hazards[0],g.state.frame),322);
 b.y=340;advanceBlood(g.state,g.stage);assert.equal(attackSlow(b,g.state.frame),1);
 b.y=0;g.state.frame=2400;advanceBlood(g.state,g.stage);assert.equal(g.state.hazards.length,0);assert.equal(attackSlow(b,g.state.frame),1);
});
test('blood master lasts 38 seconds, contact lasts 2 and trails expire after 2',()=>{
 const g=match(),[a,b]=g.state.fighters;activateBlood(g.state,g.stage,a,0,characters.caio.moves.master);assert.equal(a.bloodMasterUntil,2280);
 b.x=a.x+60;advanceBlood(g.state,g.stage);assert.equal(b.bloodSlowUntil,120);assert.ok(g.state.hazards.length);
 a.x=2000;b.x=1200;a.bloodMasterUntil=0;g.state.frame=119;advanceBlood(g.state,g.stage);assert.equal(attackSlow(b,119),.5);
 g.state.frame=120;advanceBlood(g.state,g.stage);assert.equal(attackSlow(b,120),1);assert.equal(g.state.hazards.length,0);
});
test('poison lasts 4 seconds, slows only movement and clean hits cannot poison allies or protected targets',()=>{
 for(const mode of ['hit','block','ally','immune']){
  const g=match(),b=g.state.fighters[1];b.facing=-1;if(mode==='ally')g.state.teams[1]=0;if(mode==='immune')b.invulnerableUntil=500;
  g.hit(0,characters.caio.moves.dart,mode==='block'?Button.Right:0,false,1);
  assert.equal(b.poisonUntil,mode==='hit'?240:0);
  if(mode==='hit'){assert.equal(movementSlow(b,1),.8);assert.equal(attackSlow(b,1),1);g.state.frame=240;advanceBlood(g.state,g.stage);assert.equal(movementSlow(b,240),1);}
 }
});
test('specials spend energy, blood ignores allies and invulnerability, final death clears effects',()=>{
 const g=match(),[a,b]=g.state.fighters;a.meter=24;run(g,1,Button.Special);assert.equal(a.move,null);run(g,10);a.meter=25;run(g,1,Button.Special);assert.equal(a.meter,0);run(g,20);assert.equal(g.state.hazards[0].expiresAt-g.state.frame,600);
 b.x=a.x;g.state.teams[1]=0;advanceBlood(g.state,g.stage);assert.equal(b.areaSlow,1);g.state.teams[1]=1;b.invulnerableUntil=100;advanceBlood(g.state,g.stage);assert.equal(b.areaSlow,1);
 a.bloodMasterUntil=2000;a.poisonUntil=200;a.lives=1;a.health=0;run(g,1);assert.equal(g.state.hazards.length,0);assert.equal(a.bloodMasterUntil,0);assert.equal(a.poisonUntil,0);
});
test('blood clocks continue through hitstop and complete snapshots replay deterministically',()=>{
 const g=match();g.state.fighters[0].meter=100;run(g,1,Button.Super1);run(g,36);const h=g.state.hazards[0];assert.equal(h.expiresAt-g.state.frame,1800);
 g.state.hitstop=20;const save=g.snapshot();const inputs=[0,Button.Right,Button.Up,0,Button.Medium,Button.Medium,0];for(let i=0;i<130;i++)run(g,1,inputs[i%inputs.length]);const hash=hashState(g.state);g.restore(save);for(let i=0;i<130;i++)run(g,1,inputs[i%inputs.length]);assert.equal(hashState(g.state),hash);
 g.state.frame=h.expiresAt-1;g.state.hitstop=2;run(g,1);assert.equal(g.state.hazards.length,0);
});

test('delayed remote inputs converge while flood, contact slow and poison coexist',async()=>{
 const {RollbackManager}=await import('../packages/networking/RollbackManager.js');
 const a=match(),b=match();for(const g of [a,b]){g.state.fighters[0].bloodMasterUntil=2280;g.state.fighters[1].poisonUntil=180;activateBlood(g.state,g.stage,g.state.fighters[0],0,characters.caio.moves.flood);}
 const rb=new RollbackManager(b,0,0,8);
 for(let frame=0;frame<300;frame++){const local=frame<100?Button.Right:frame===160?Button.Up:0,remote=frame>70&&frame<220?Button.Left:0;a.step([local,remote]);rb.local.set(frame,local);rb.tick();rb.receive(frame,remote,1);}
 assert.equal(hashState(a.state),hashState(b.state));assert.ok(rb.rollbackCount>0);
});

test('invisibility allows movement and triple jumping; repeated pools keep their own duration',()=>{
 const g=match(),f=g.state.fighters[0];run(g,10,Button.Medium);const x=f.x;run(g,4,Button.Medium|Button.Right);assert.ok(f.x>x);assert.equal(f.move,'vanish');
 run(g,1,Button.Medium|Button.Up);assert.ok(f.y>0);run(g,1,Button.Medium);run(g,1,Button.Medium|Button.Up);run(g,1,Button.Medium);run(g,1,Button.Medium|Button.Up);assert.equal(f.airJumpsUsed,2);
 activateBlood(g.state,g.stage,f,0,characters.caio.moves.pool);const expiry=g.state.hazards[0].expiresAt;g.state.frame+=60;activateBlood(g.state,g.stage,f,0,characters.caio.moves.pool);assert.equal(g.state.hazards.length,2);assert.equal(g.state.hazards[0].expiresAt,expiry);
});

 test('Blood Master reduces incoming damage 10% and expires cleanly',async()=>{
 const {protectedDamage}=await import('../packages/game-core/simulation/HairSystem.js');
 const f=match().state.fighters[0];f.bloodMasterUntil=100;
 assert.equal(protectedDamage(f,99,100),90);assert.equal(protectedDamage(f,100,100),100);
});
test('Caio dart spawns at the blowgun and the flood rises while he remains squatting',()=>{
 const g=match(),f=g.state.fighters[0];f.meter=100;f.move='dart';f.moveFrame=14;f.state='SpecialMove';g.updateFighter(f,0,0);
 const dart=g.state.projectiles.find(p=>p.active)!;assert.ok(dart);assert.equal(dart.x,f.x+125);assert.equal(dart.y,f.y+145);
 const h={height:300,createdAt:0};assert.equal(floodHeight(h,0),0);assert.equal(floodHeight(h,45),150);assert.equal(floodHeight(h,90),300);
 assert.ok(characters.caio.moves.flood.recoveryFrames>=90);assert.equal(characters.caio.moves.flood.bloodFloodFrames,1800);assert.equal(characters.caio.dashMultiplier,2.5);
});

test('four-second poison deals eight damage ticks without hitstop or resetting its tick on refresh',()=>{
 const g=match(),b=g.state.fighters[1];g.hit(0,characters.caio.moves.dart,0,false,1);const hp=b.health;
 run(g,239);assert.equal(b.health,hp-70);assert.equal(b.poisonUntil>g.state.frame,true);
 run(g,1);assert.equal(b.health,hp-80);assert.equal(b.poisonUntil,0);run(g,30);assert.equal(b.health,hp-80);
 g.hit(0,characters.caio.moves.dart,0,false,1);const tick=b.poisonNextTick;run(g,10);g.hit(0,characters.caio.moves.dart,0,false,1);assert.equal(b.poisonNextTick,tick);
});
test('flood gives its caster 20 percent movement speed, slows opponents 80 percent, ends after 30 seconds',()=>{
 const g=match(),[a,b]=g.state.fighters;activateBlood(g.state,g.stage,a,0,characters.caio.moves.flood);
 const h=g.state.hazards[0];assert.equal(h.expiresAt,1800);g.state.frame=90;advanceBlood(g.state,g.stage);
 assert.equal(movementSlow(a,90),1.2);assert.equal(attackSlow(a,90),1);assert.equal(movementSlow(b,90),.2);assert.equal(attackSlow(b,90),.2);
 a.y=b.y=340;advanceBlood(g.state,g.stage);assert.equal(movementSlow(a,90),1);assert.equal(movementSlow(b,90),1);
 a.y=b.y=0;g.state.frame=1800;advanceBlood(g.state,g.stage);assert.equal(movementSlow(a,1800),1);assert.equal(movementSlow(b,1800),1);
});

test('Blood Master boosts hits and movement 5 percent, stacks with flood and ends at expiry',()=>{
 const plain=match(),boosted=match(),f=boosted.state.fighters[0];
 activateBlood(boosted.state,boosted.stage,f,0,characters.caio.moves.master);
 const hp=plain.state.fighters[1].health;
 plain.hit(0,characters.caio.moves.heavy,0,false,1);
 boosted.hit(0,characters.caio.moves.heavy,0,false,1);
 assert.equal(hp-boosted.state.fighters[1].health,Math.ceil((hp-plain.state.fighters[1].health)*1.05));
 assert.equal(movementSlow(f,0),1.05);assert.equal(attackSlow(f,0),1);
 f.floodSpeed=1.2;assert.equal(movementSlow(f,0),1.26);f.floodSpeed=1;
 boosted.state.frame=2280;assert.equal(movementSlow(f,2280),1);
 const d=boosted.state.fighters[1];d.combo=0;d.stun=0;d.state='Idle';d.y=0;
 const before=d.health;boosted.hit(0,characters.caio.moves.heavy,0,false,1);
 assert.equal(before-d.health,hp-plain.state.fighters[1].health);
});

test('Blood Master boosts poison ticks only while the caster mode is active',()=>{
 const g=match(),[f,d]=g.state.fighters;
 f.bloodMasterUntil=60;g.hit(0,characters.caio.moves.dart,0,false,1);const hp=d.health;
 g.state.frame=30;advanceBlood(g.state,g.stage);assert.equal(hp-d.health,11);
 g.state.frame=60;advanceBlood(g.state,g.stage);assert.equal(hp-d.health,21);
});
