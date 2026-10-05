import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {activateAstolfo,advanceAstolfo,advanceSpiders,burstPersonalities,isTalking} from '../packages/game-core/simulation/AstolfoSystem.js';
import {movementSlow,attackSlow} from '../packages/game-core/simulation/BloodSystem.js';
const moves=characters.astolfo.moves;
function game(ids=['astolfo','gut']){const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.meter=100;f.x=300+i*800;});return g;}
function run(g:GameSimulation,n:number,input=0){for(let i=0;i<n;i++)g.step([input,0,0]);}
test('Talking drains energy, follows free movement and stops on release even in hitstop',()=>{
 const g=game(),s=g.state,[f,d]=s.fighters;d.x=530;g.step([Button.Special,0]);run(g,12,Button.Special);assert.ok(isTalking(f));assert.ok(d.health<1500);assert.equal(movementSlow(d,s.frame),.4);assert.equal(attackSlow(d,s.frame),1);
 const x=f.x,meter=f.meter;run(g,12,Button.Special|Button.Right);assert.ok(f.x>x);assert.ok(f.meter<meter);
 const hp=d.health;s.hitstop=5;g.step([0,0]);assert.equal(f.move,null);assert.equal(d.health,hp);assert.equal(movementSlow(d,s.frame),1);
});
test('Talking direction, range and teams are respected; exhaustion and interruption cancel it',()=>{
 const g=game(['astolfo','gut','napa']),s=g.state,[f,d,ally]=s.fighters;d.x=140;ally.x=490;s.teams[2]=s.teams[0];g.step([Button.Special,0,0]);run(g,18,Button.Special);assert.equal(d.health,1500);assert.equal(ally.health,1400);
 d.x=500;f.meter=1;f.talkNextDrain=s.frame+1;const hp=d.health;g.step([Button.Special,0,0]);assert.equal(f.move,null);assert.equal(f.meter,0);assert.equal(d.health,hp);
 f.meter=100;g.step([0,0,0]);g.step([Button.Special,0,0]);run(g,12,Button.Special);g.hit(1,characters.gut.moves.palm,0,false,0,-1,d,f);assert.equal(f.move,null);const after=d.health;run(g,3,Button.Special);assert.equal(d.health,after);
});
test('Talking permits a jump and follows airborne movement',()=>{const g=game(),f=g.state.fighters[0];g.step([Button.Special,0]);run(g,12,Button.Special);g.step([Button.Special|Button.Up|Button.Right,0]);assert.ok(f.y>0);assert.equal(f.move,'talking');const x=f.x;run(g,4,Button.Special|Button.Right);assert.ok(f.x>x);});
test('A great idea lasts exactly 18 seconds, slows on both sides, permits basic attacks and expires cleanly',()=>{
 const g=game(['astolfo','gut','napa']),s=g.state,[f,a,b]=s.fighters;a.x=100;b.x=500;
 activateAstolfo(s,g.stage,f,0,moves.idea);assert.equal(f.talkUntil,1080);advanceAstolfo(s,g.stage);assert.equal(movementSlow(a,0),.3);assert.equal(movementSlow(b,0),.3);assert.equal(attackSlow(a,0),1);
 g.step([Button.Light,0,0]);assert.equal(f.move,'punch');assert.equal(f.talkUntil,1080);s.frame=1079;advanceAstolfo(s,g.stage);assert.equal(f.talkUntil,1080);s.frame=1080;advanceAstolfo(s,g.stage);assert.equal(f.talkUntil,0);assert.equal(movementSlow(a,1080),1);
});
test('Spider sweeps across a target once and applies 3 seconds of poison, not to allies or high jumpers',()=>{
 const g=game(),s=g.state,[f,d]=s.fighters;activateAstolfo(s,g.stage,f,0,moves.spider);const h=s.hazards[0];d.x=h.x+90;d.y=120;
 advanceSpiders(s,g.stage,new Map([[d,{x:h.x-90,y:120}]]));assert.equal(d.poisonUntil,0);d.y=0;s.teams[1]=s.teams[0];advanceSpiders(s,g.stage,new Map([[d,{x:h.x-90,y:0}]]));assert.equal(d.poisonUntil,0);
 s.teams[1]=1;advanceSpiders(s,g.stage,new Map([[d,{x:h.x-90,y:0}]]));assert.equal(d.poisonUntil,180);assert.equal(d.health,1445);assert.equal(s.hazards.filter(h=>h.kind==='spider').length,0);const hp=d.health;advanceSpiders(s,g.stage,new Map());assert.equal(d.health,hp);
 d.x=1800;run(g,180);assert.equal(d.health,hp-60);
});
test('Spider travels in cast direction and is removed at arena edge',()=>{const g=game(),s=g.state,f=s.fighters[0];f.x=50;f.facing=-1;activateAstolfo(s,g.stage,f,0,moves.spider);for(let i=0;i<10;i++)advanceSpiders(s,g.stage,new Map());assert.equal(s.hazards.length,0);});
test('Split creates exactly two distinct companions with requested HP and damage ratios',()=>{
 const g=game(),s=g.state,[f,d]=s.fighters;activateAstolfo(s,g.stage,f,0,moves.bipolar);activateAstolfo(s,g.stage,f,0,moves.bipolar);assert.equal(s.clones.length,2);
 const [sad,angry]=s.clones;assert.equal(sad.fighter.health,1400);assert.equal(angry.fighter.health,440);
 g.hit(0,moves.punch,0,false,1,1,sad.fighter,d);assert.equal(d.health,1500-24);d.combo=0;d.stun=0;d.state='Idle';g.hit(0,moves.punch,0,false,1,1,angry.fighter,d);assert.equal(d.health,1500-24-Math.round(48*1.4));
 const a=angry.fighter,b=sad.fighter;a.x=100;b.x=100;g.updateFighter(a,Button.Right,0);g.updateFighter(b,Button.Right,0);assert.equal(a.x-100,7.5);assert.ok(Math.abs(b.x-100-3.2)<1e-9);
});
test('Personality death bursts once, with 5 second sadness or burn, ignoring allies',()=>{
 const g=game(['astolfo','gut','napa']),s=g.state,[f,d,ally]=s.fighters;s.teams[2]=0;activateAstolfo(s,g.stage,f,0,moves.bipolar);
 const [sad,angry]=s.clones;d.x=sad.fighter.x;ally.x=d.x;sad.fighter.health=0;burstPersonalities(s);burstPersonalities(s);assert.equal(d.sadnessUntil,300);assert.equal(movementSlow(d,0),.4);assert.equal(ally.sadnessUntil,undefined);assert.equal(s.hazards.length,1);
 d.x=angry.fighter.x;angry.fighter.health=0;burstPersonalities(s);assert.equal(d.burnUntil,300);assert.equal(ally.burnUntil,0);assert.equal(s.hazards.length,2);s.frame=300;advanceAstolfo(s,g.stage);assert.equal(movementSlow(d,300),1);
});
test('Owner defeat and match reset remove aura, spiders and personalities without bursts',()=>{
 const g=game(),s=g.state,f=s.fighters[0];for(const m of [moves.idea,moves.bipolar,moves.spider])activateAstolfo(s,g.stage,f,0,m);f.health=0;run(g,1);assert.equal(s.clones.length,0);assert.equal(s.hazards.length,0);assert.equal(f.talkUntil,0);g.resetPositions();assert.equal(g.state.fighters[0].talkUntil,undefined);
});
test('All Astolfo effects reproduce after rollback, including clone AI and death bursts',()=>{
 const g=game(),s=g.state,f=s.fighters[0];for(const m of [moves.idea,moves.bipolar,moves.spider])activateAstolfo(s,g.stage,f,0,m);const snap=g.snapshot();const play=()=>{run(g,80,Button.Right);g.state.clones[0].fighter.health=0;run(g,100);};play();const hash=hashState(g.state);g.restore(snap);play();assert.equal(hashState(g.state),hash);
});
test('Sad clone attacks run at 90 percent speed while Angry stays at 150 percent',()=>{
 const g=game(),s=g.state;activateAstolfo(s,g.stage,s.fighters[0],0,moves.bipolar);const [sad,angry]=s.clones;
 for(const c of [sad,angry]){c.fighter.move='heavyPunch';c.fighter.moveFrame=0;c.fighter.state='HeavyAttack';}
 for(let i=0;i<10;i++)for(const c of [sad,angry])g.updateFighter(c.fighter,0,0);
 assert.equal(sad.fighter.moveFrame,9);assert.equal(angry.fighter.moveFrame,15);
});
test('Talking and great idea overlap without duplicating damage or slowing attacks',()=>{
 const g=game(),s=g.state,[f,d]=s.fighters;d.x=450;activateAstolfo(s,g.stage,f,0,moves.idea);f.move='talking';f.moveFrame=12;f.previousInput=Button.Special;f.talkNextDrain=6;const hp=d.health;
 advanceAstolfo(s,g.stage);assert.equal(d.health,hp-moves.idea.damage);assert.equal(movementSlow(d,0),.3);assert.equal(attackSlow(d,0),1);
});
test('Releasing a buffered Talking press before startup prevents a stuck channel',()=>{
 const g=game(),f=g.state.fighters[0];g.step([Button.Special,0]);assert.equal(f.move,'talking');g.step([0,0]);assert.equal(f.move,null);run(g,20);assert.equal(f.move,null);
});
test('Death effects target enemy companions and never friendly clones',()=>{
 const g=game(['astolfo','astolfo']),s=g.state;activateAstolfo(s,g.stage,s.fighters[0],0,moves.bipolar);activateAstolfo(s,g.stage,s.fighters[1],1,moves.bipolar);
 for(const c of s.clones)c.fighter.x=700;s.clones[0].fighter.health=0;burstPersonalities(s);assert.equal(s.clones[1].fighter.sadnessUntil,undefined);assert.equal(s.clones[2].fighter.sadnessUntil,300);
});
