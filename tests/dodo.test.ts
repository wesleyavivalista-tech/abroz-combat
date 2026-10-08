import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {isLowProfile,MUSIC_RADIUS} from '../packages/game-core/simulation/DodoSystem.js';
import {dodoPose} from '../apps/client/src/rendering/DodoRenderer.js';
import {debugGeometry} from '../packages/game-core/combat/DebugGeometry.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';
function game(){const g=new GameSimulation(['dodo','gut']);g.state.phase='fight';for(const f of g.state.fighters){f.state='Idle';f.meter=100;}return g;}
function run(g:GameSimulation,n:number,input=0){for(let i=0;i<n;i++)g.step([input,0]);}
test('Dodo uses approved skin order and three-stage guitar combo',()=>{
 const g=game(),f=g.state.fighters[0];assert.deepEqual(characters.dodo.skins?.map(s=>s.name),['Leaf-print shirt','Black T-shirt']);
 g.step([Button.Light,0]);assert.equal(f.move,'jab');run(g,3);g.step([Button.Light,0]);run(g,9);assert.equal(f.move,'comboKick');run(g,3);g.step([Button.Light,0]);run(g,12);assert.equal(f.move,'guitarSwing');
});
test('Low-profile is immediate, lasts 240 simulation frames and never reveals on attack or movement',()=>{
 const g=game(),f=g.state.fighters[0];g.step([Button.Special2,0]);const end=f.invisibleUntil!;
 assert.equal(end,g.state.frame+240);assert.ok(isLowProfile(f,g.state.frame));assert.equal(g.events.length,0);
 run(g,2);const x=f.x;run(g,5,Button.Right);assert.ok(f.x>x);g.step([Button.Light,0]);assert.equal(f.move,'jab');assert.ok(isLowProfile(f,g.state.frame));assert.equal(g.events.length,0);
 assert.equal(debugGeometry(g.state,trainingRoom).filter(b=>b.kind==='hurt').length,1);
 g.state.hitstop=150;while(g.state.frame<end)g.step([0,0]);assert.equal(f.invisibleUntil,0);assert.equal(f.lowProfileNoticeUntil,0);
});
test('Power Chord hits only ahead and pushes away at mid range',()=>{
 const g=game(),[f,t]=g.state.fighters;f.x=700;t.x=1000;g.step([Button.Special,0]);run(g,45);assert.ok(t.health<1600);assert.ok(t.x>1000);
 const h=game();h.state.fighters[0].x=1000;h.state.fighters[1].x=700;h.step([Button.Special,0]);run(h,45);assert.equal(h.state.fighters[1].health,1600);
});
test('Pain Killers creates distinct 440 health companions and removes them on owner death',()=>{
 const g=game();g.step([Button.Super1,0]);run(g,25);assert.equal(g.state.clones.length,3);assert.deepEqual(g.state.clones.map(c=>c.variant),[0,1,2]);
 for(const c of g.state.clones){assert.equal(c.maxHealth,440);assert.equal(c.kind,'basketball');assert.equal(c.fighter.characterId,'dodo');}
 run(g,150);assert.ok(g.state.fighters[1].health<1400,'companions deal damage');
 g.state.fighters[0].health=0;g.step([0,0]);assert.equal(g.state.clones.length,0);
});
test('Guitar Star pulses both sides, respects teams and ends after 20 seconds including hitstop',()=>{
 const g=new GameSimulation(['dodo','gut','gut','gut'],false,undefined,[0,1,0,1]);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});
 const [f,left,friend,right]=g.state.fighters;f.x=1000;left.x=1000-MUSIC_RADIUS+20;right.x=1000+MUSIC_RADIUS-20;friend.x=1100;
 g.step([Button.Super2,0,0,0]);for(let i=0;i<20;i++)g.step([0,0,0,0]);const end=f.weaponUntil;
 assert.ok(end>g.state.frame);assert.ok(left.health<1600&&right.health<1600);assert.equal(friend.health,1600);
 g.state.hitstop=1500;while(g.state.frame<end)g.step([0,0,0,0]);assert.equal(f.weaponUntil,0);
});
test('charged wave requires 60 held frames, rejects early release and replaces every basic',()=>{
 for(const button of [Button.Light,Button.Medium,Button.Heavy]){
  const g=game(),f=g.state.fighters[0];f.weaponUntil=2000;g.state.fighters[1].x=2200;
  g.step([button,0]);assert.equal(f.move,'starWave');run(g,58,button);assert.ok(!g.state.projectiles.some(p=>p.active));
  run(g,2,button);assert.ok(g.state.projectiles.some(p=>p.active&&p.move==='starWave'));
 }
 const g=game(),f=g.state.fighters[0];f.weaponUntil=2000;g.step([Button.Light,0]);run(g,30,Button.Light);run(g,80);assert.ok(!g.state.projectiles.some(p=>p.active));
 f.weaponUntil=0;run(g,40);g.step([Button.Light,0]);assert.equal(f.move,'jab');
});
test('Dodo abilities and summons replay identically after snapshot restoration',()=>{
 const g=game();g.step([Button.Super1,0]);run(g,30);g.state.fighters[0].meter=100;g.step([Button.Special2,0]);const checkpoint=g.snapshot();
 run(g,160,Button.Right);const expected=hashState(g.state);g.restore(checkpoint);run(g,160,Button.Right);assert.equal(hashState(g.state),expected);
});
test('authored walking alternates four distinct poses and reverses for backward movement',()=>{
 const f=game().state.fighters[0];f.state='WalkForward';const poses=[0,6,12,18].map(n=>{f.stateFrame=n;return dodoPose(f);});assert.deepEqual(poses,[1,2,3,4]);
 f.state='WalkBackward';assert.deepEqual([0,6,12,18].map(n=>{f.stateFrame=n;return dodoPose(f);}),[1,4,3,2]);
});

test('invisibility keeps the complete movement and attack controller active',()=>{
 const hidden=game();hidden.step([Button.Special2,0]);run(hidden,3);
 const visible=game();visible.restore(hidden.snapshot());visible.state.fighters[0].invisibleUntil=0;
 const sequence=[...Array(20).fill(Button.Right),0,Button.Right,0,Button.Right,...Array(12).fill(Button.Right),Button.Up,...Array(5).fill(Button.Right),0,Button.Up,...Array(6).fill(Button.Right),Button.Light,...Array(40).fill(0),Button.Medium,...Array(35).fill(0),Button.Heavy,...Array(50).fill(0)];
 const states=new Set<string>();let highest=0;
 for(const input of sequence){
  hidden.step([input,0]);visible.step([input,0]);
  const a=hidden.state.fighters[0],b=visible.state.fighters[0];
  for(const key of ['x','y','vx','vy','state','move','moveFrame','airJumpsUsed'] as const)assert.equal(a[key],b[key],`controller diverged at ${hidden.state.frame}: ${key}`);
  states.add(a.state);highest=Math.max(highest,a.y);assert.ok(isLowProfile(a,hidden.state.frame));
 }
 assert.ok(highest>100);assert.ok([...states].some(s=>s.startsWith('Dash')));assert.ok([...states].some(s=>s.includes('Attack')));
});
