import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {damageMultiplier} from '../packages/game-core/combat/DamageSystem.js';
import {jompPose} from '../apps/client/src/rendering/JompRenderer.js';
function game(ids=['jomp','gut']){const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});return g;}
function run(g:GameSimulation,n:number,input=0){for(let i=0;i<n;i++)g.step([input,...g.state.fighters.slice(1).map(()=>0)]);}
test('Jomp held stance drains on simulation time, survives repeated hits and releases immediately',()=>{
 const g=game(),[f,d]=g.state.fighters;g.step([Button.Special,0]);assert.equal(f.move,'coolMuscles');const x=f.x;
 assert.equal(damageMultiplier(f,g.state.frame),.2);
 for(let i=0;i<6;i++)g.hit(1,characters.gut.moves.palm,0,false,0,-1,d,f);
 assert.equal(f.move,'coolMuscles');run(g,30,Button.Special|Button.Right);
 assert.equal(f.x,x);assert.ok(f.meter<100);g.step([0,0]);assert.equal(f.move,null);assert.equal(damageMultiplier(f,g.state.frame),1);
 f.meter=2;g.state.hitstop=0;g.step([Button.Special,0]);run(g,20,Button.Special);assert.equal(f.meter,0);assert.equal(f.move,null);
});
test('Perfect Mode starts after four pushups, lasts 1200 ticks including hitstop, and boosts damage',()=>{
 const g=game(),[f,d]=g.state.fighters;g.step([Button.Super2,0]);run(g,239);assert.equal(f.weaponUntil,0);run(g,1);assert.equal(f.weaponUntil,g.state.frame+1200);
 assert.equal(damageMultiplier(f,g.state.frame),.6);
 d.combo=0;const hp=d.health;g.hit(0,characters.jomp.moves.jab,0,false);assert.equal(hp-d.health,72);
 const end=f.weaponUntil;g.state.hitstop=2000;while(g.state.frame<end)g.step([0,0]);assert.equal(f.weaponUntil,0);
});
test('Perfect Mode adds triple jump, faster movement and exactly 4x dash distance',()=>{
 function distance(mode:boolean){const g=game(),f=g.state.fighters[0];f.x=500;g.state.fighters[1].x=2200;if(mode)f.weaponUntil=2000;f.state='DashForward';f.stateFrame=0;run(g,10);return f.x-500;}
 assert.ok(Math.abs(distance(true)/distance(false)-4)<.001);
 const g=game(),f=g.state.fighters[0];f.weaponUntil=2000;f.y=250;f.state='Jump';
 g.step([Button.Up,0]);g.step([0,0]);g.step([Button.Up,0]);assert.equal(f.airJumpsUsed,2);
 g.step([0,0]);g.step([Button.Up,0]);assert.equal(f.airJumpsUsed,2);
});
test('Investida crosses arena, hits each enemy once, knocks down and leaves teammates untouched',()=>{
 const g=new GameSimulation(['jomp','gut','gut','gut'],false,undefined,[0,1,0,1]);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=200+i*400;f.meter=100;});
 const f=g.state.fighters[0];g.step([Button.Special2,0,0,0]);for(let n=0;n<180;n++)g.step([0,0,0,0]);
 assert.equal(f.x,g.stage.width-40);assert.equal(g.state.fighters[2].health,1500);
 for(const i of [1,3])assert.equal(g.state.fighters[i].health,1390);
});
test('Gym Bro locks facing target, follows jumps, deals nine reps and a throw then landing stun',()=>{
 const g=game(['jomp','gut','gut']),[f,d,other]=g.state.fighters;f.x=500;d.x=950;other.x=300;f.facing=1;
 const hp=d.health;g.step([Button.Super1,0,0]);assert.equal(f.gymTarget,1);d.x=1700;d.y=300;d.vy=15;d.state='Jump';
 for(let i=0;i<500&&!d.gymLandingStun;i++)g.step([0,Button.Right|Button.Up,0]);
 assert.equal(d.health,hp-381);assert.ok(d.gymLandingStun);assert.equal(other.health,1500);
 for(let i=0;i<150&&d.gymLandingStun;i++)g.step([0,0,0]);
 assert.equal(d.stun,120);assert.equal(d.state,'HitStunStanding');
 const until=d.gymStunnedUntil!;g.hit(0,characters.jomp.moves.jab,0,false,1);
 while(g.state.frame<until-1)g.step([0,Button.Right|Button.Light,0]);
 assert.equal(d.move,null);assert.ok(d.stun>0);
 g.step([0,0,0]);assert.equal(d.stun,0);
});
test('Gym Bro releases on owner defeat and is deterministic after rollback',()=>{
 const g=game();g.step([Button.Super1,0]);run(g,60);const snap=g.snapshot();run(g,380);const hash=hashState(g.state);g.restore(snap);run(g,380);assert.equal(hashState(g.state),hash);
 const h=game();h.step([Button.Super1,0]);run(h,60);h.state.fighters[0].health=0;run(h,2);assert.equal(h.state.fighters[1].grappleUntil,0);
});
test('Jomp walking alternates eight authored poses and pushups repeat four complete cycles',()=>{
 const f=game().state.fighters[0];f.state='WalkForward';assert.deepEqual([0,5,10,15,20,25,30,35].map(n=>{f.stateFrame=n;return jompPose(f);}),[[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7]]);
 f.move='perfection';assert.deepEqual([0,30,60,90,120,150,180,210].map(n=>{f.moveFrame=n;return jompPose(f)[1];}),[4,5,4,5,4,5,4,5]);
});
test('Perfect Mode movement and attack speed use independent tunable 60% bonuses',()=>{
 function trace(boost:boolean){const g=game(),f=g.state.fighters[0];g.state.fighters[1].x=2300;if(boost)f.weaponUntil=1000;const x=f.x;run(g,10,Button.Right);const walk=f.x-x;g.step([Button.Light,0]);run(g,5);return {walk,moveFrame:f.moveFrame};}
 const a=trace(false),b=trace(true);assert.equal(b.walk/a.walk,1.6);assert.ok(b.moveFrame>a.moveFrame);
});

test('Two simultaneous Gym Bro locks reserve separate victims and replay identically',()=>{
 const g=new GameSimulation(['jomp','jomp','gut','gut'],false,undefined,[0,0,1,1]);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});g.state.fighters.forEach((f,i)=>{f.x=[500,600,900,1400][i];f.facing=1;});
 g.step([Button.Super1,Button.Super1,0,0]);
 const [a,b]=g.state.fighters;assert.notEqual(a.gymTarget,b.gymTarget);
 const snap=g.snapshot();run(g,420);const hash=hashState(g.state);g.restore(snap);run(g,420);assert.equal(hashState(g.state),hash);
});
test('Gym Bro reservation excludes a second lock when no other enemy exists',()=>{
 const g=new GameSimulation(['jomp','jomp','gut','gut'],false,undefined,[0,0,1,1]);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});
 g.state.fighters[3].health=0;g.state.fighters[3].state="KO";g.step([Button.Super1,Button.Super1,0,0]);const [a,b]=g.state.fighters;
 assert.equal(a.gymTarget,2);assert.equal(b.gymTarget,-1);assert.equal(b.meter,100);
});
test('Investida cycles while attack frame is held and push-ups finish in a flex',()=>{
 const f=game().state.fighters[0];f.move='investida';f.moveFrame=14;
 f.stateFrame=10;const a=jompPose(f);f.stateFrame=15;assert.notDeepEqual(jompPose(f),a);
 f.move='perfection';f.moveFrame=240;assert.deepEqual(jompPose(f),[2,1]);
});

test('lethal Gym Bro releases both Jomps and the victim respawns without grab state',()=>{
 for(const hp of [24,300]){
  const g=game(['jomp','jomp']),[a,d]=g.state.fighters;a.x=500;d.x=600;d.health=hp;
  g.step([Button.Super1,0]);
  for(let tick=0;tick<500&&d.lives===3;tick++)g.step([0,0]);
  assert.equal(d.lives,2);assert.equal(d.state,'Respawning');
  run(g,2);assert.equal(a.move,null);assert.equal(a.gymTarget,-1);assert.equal(d.grappleOwner,-1);
  run(g,180);assert.ok(d.health>0);assert.equal(d.respawnAt,0);assert.equal(d.grappleUntil,0);assert.equal(d.gymLandingStun??false,false);
  const x=d.x;g.step([0,Button.Right]);assert.ok(d.x>x);
 }
});

test('Gym Bro increased damage retains Perfect Mode bonus and defender reduction',()=>{
 for(const [boost,defense,total] of [[false,false,381],[true,false,576],[false,true,234]] as const){
  const g=game(['jomp','jomp']),[a,d]=g.state.fighters;a.x=500;d.x=600;
  if(boost)a.weaponUntil=2000;if(defense)d.weaponUntil=2000;
  const hp=d.health;g.step([Button.Super1,0]);
  for(let i=0;i<450&&!d.gymLandingStun;i++)g.step([0,0]);
  assert.ok(d.gymLandingStun);assert.equal(hp-d.health,total);
 }
});
