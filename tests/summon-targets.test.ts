import {advanceSpiders} from '../packages/game-core/simulation/AstolfoSystem.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {summonClones} from '../packages/game-core/simulation/HairSystem.js';
import {activateNapa} from '../packages/game-core/simulation/NapaSystem.js';
import {activateJopa,advanceJopa,JOPA} from '../packages/game-core/simulation/JopaSystem.js';
import {activateStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {advanceNikalz,NIKALZ} from '../packages/game-core/simulation/NikalzSystem.js';
import {nearestSummonTarget} from '../packages/game-core/simulation/SummonTargets.js';
function game(id:string){const g=new GameSimulation([id,'luizinho']);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=i?2100:200;f.y=g.stage.floorHeight;});return g;}
function wall(g:GameSimulation,owner=1){activateStructure(g.state,g.stage,g.state.fighters[owner],owner,characters.luizinho.moves.wall);const b=g.state.structures!.at(-1)!;b.x=650;return b;}
function spawn(g:GameSimulation){const f=g.state.fighters[0];if(f.characterId==='napa')activateNapa(g.state,g.stage,f,0,characters.napa.moves.cookieMonster);else summonClones(g.state,0,g.stage);}
const run=(g:GameSimulation,n:number)=>{for(let i=0;i<n;i++)g.step([0,0]);};
for(const id of ['bozo','dodo','napa'])test(`${id} summons approach and damage an enemy wall and replay identically`,()=>{
 const g=game(id),b=wall(g);spawn(g);const saved=g.snapshot();run(g,420);assert.ok(b.health<b.maxHealth,`${id} must damage wall`);const hash=hashState(g.state);g.restore(saved);run(g,420);assert.equal(hashState(g.state),hash);
});
for(const undead of [false,true])test(`summon hits ${undead?'neutral zombie with same former owner':'opponent summon'} without hitting allies`,()=>{
 const g=game('bozo');spawn(g);const f=createFighter('gut',500,-1);f.lives=1;f.y=g.stage.floorHeight;f.state='Idle';if(undead)f.undead='zombie';
 g.state.clones.push({id:g.state.nextCloneId++,owner:undead?0:1,fighter:f,kind:undead?'undead':'blonde',...(undead?{undead:{phaseAt:0,target:-1,nextAttack:9999,attackAt:0,attackFrame:0,hit:false,stuck:0,lastX:500,spawnX:500,spawnY:f.y}}:{})});
 const hp=f.health;run(g,180);assert.ok(f.health<hp);assert.equal(g.state.fighters[0].health,characters.bozo.stats.maxHealth);
});
test('target selection ignores allies and inactive structures; chooses wall surface',()=>{
 const g=game('bozo'),b=wall(g);const f=g.state.fighters[0];assert.equal(nearestSummonTarget(g.state,0,f)?.structure,b);assert.equal(nearestSummonTarget(g.state,0,f)?.x,625);
 g.state.teams[1]=g.state.teams[0];assert.equal(nearestSummonTarget(g.state,0,f),undefined);
 g.state.teams[1]=1;b.phase='collapsed';assert.equal(nearestSummonTarget(g.state,0,f)?.fighter,g.state.fighters[1]);
});
test('turret acquires and destroys an enemy wall without a fighter in front',()=>{
 const g=game('luizinho'),b=wall(g);activateStructure(g.state,g.stage,g.state.fighters[0],0,characters.luizinho.moves.turret);run(g,400);assert.ok(b.health<b.maxHealth);
});
test('Jopa tentacle attacks a structure on its normal cadence',()=>{
 const g=game('jopa'),b=wall(g);activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.tree);g.state.frame=180;advanceJopa(g.state,g.stage);const c=g.state.clones.find(c=>c.kind==='tentacle')!;c.fighter.x=540;c.nextAction=0;
 advanceJopa(g.state,g.stage);assert.equal(b.health,b.maxHealth-35);advanceJopa(g.state,g.stage);assert.equal(b.health,b.maxHealth-35);
});
test('Jopa knight landing damages enemy structures and observes recovery',()=>{
 const g=game('jopa'),b=wall(g);activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.knight);const c=g.state.clones[0];c.fighter.x=540;c.fighter.y=2;c.fighter.vy=-10;c.nextAction=1000;
 advanceJopa(g.state,g.stage);assert.equal(b.health,b.maxHealth-JOPA.knightDamage);assert.ok(c.recoveryUntil!>g.state.frame);
});

test('bees damage enemy structures once and never consume themselves on allied structures',()=>{
 for(const allied of [false,true]){
  const g=game('nikalz'),b=wall(g);if(allied)g.state.teams[1]=0;
  g.state.bees=[{id:0,owner:0,x:b.x,y:50,originX:b.x,originY:50,born:0,range:0,period:400,direction:1,vertical:0}];
  advanceNikalz(g.state,g.stage);assert.equal(b.health,b.maxHealth-(allied?0:NIKALZ.swarmDamage));assert.equal(g.state.bees.length,allied?1:0);
  advanceNikalz(g.state,g.stage);assert.equal(b.health,b.maxHealth-(allied?0:NIKALZ.swarmDamage));
 }
});
for(const id of ['bozo','dodo','napa'])test(`${id} summons do not attack an allied house`,()=>{
 const g=game(id);g.state.teams[1]=0;activateStructure(g.state,g.stage,g.state.fighters[1],1,characters.luizinho.moves.home);const b=g.state.structures![0];b.x=650;b.phase='built';spawn(g);run(g,360);assert.equal(b.health,b.maxHealth);
});

test('spiders hit an enemy wall before a fighter behind it; allied walls are ignored',()=>{
 for(const allied of [false,true]){
  const g=game('astolfo'),b=wall(g);if(allied)g.state.teams[1]=0;
  const m=Object.values(characters.astolfo.moves).find(m=>m.spider)!;
  g.state.hazards.push({kind:'spider',owner:0,x:620,y:0,variant:1,createdAt:0,expiresAt:100,move:m.id,nextTicks:[]});
  advanceSpiders(g.state,g.stage,new Map());assert.equal(b.health,b.maxHealth-(allied?0:m.damage));assert.equal(g.state.hazards[0].kind,allied?'spider':'spider-bite');
 }
});

test('a summon inside an enemy house aims at a wall instead of the empty center',()=>{
 const g=game('bozo');activateStructure(g.state,g.stage,g.state.fighters[1],1,characters.luizinho.moves.home);const b=g.state.structures![0];b.x=650;b.phase='built';
 const target=nearestSummonTarget(g.state,0,{x:650,y:0})!;assert.equal(target.structure,b);assert.equal(target.x,390);
});

for(const id of ['bozo','dodo','napa','astolfo'])test(`${id} mobile summons use exactly two air jumps chasing a high target`,()=>{
 const g=game(id);g.stage={...g.stage,platforms:[{x:100,y:700,width:900}]};g.state.fighters[1].x=450;g.state.fighters[1].y=700;spawn(g);
 const saved=g.snapshot();let max=0;
 for(let i=0;i<160;i++){g.step([0,0]);for(const c of g.state.clones){max=Math.max(max,c.fighter.airJumpsUsed);assert.ok(c.fighter.airJumpsUsed<=2);}}
 assert.equal(max,2);const hash=hashState(g.state);g.restore(saved);run(g,160);assert.equal(hashState(g.state),hash);
});
test('Jopa tentacles use two air jumps to pursue elevated enemies',()=>{
 const g=game('jopa');g.stage={...g.stage,platforms:[{x:100,y:900,width:900}]};g.state.fighters[1].x=450;g.state.fighters[1].y=900;
 activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.tree);g.state.frame=180;advanceJopa(g.state,g.stage);let max=0;
 for(let i=0;i<100;i++){g.step([0,0]);for(const c of g.state.clones.filter(c=>c.kind==='tentacle')){max=Math.max(max,c.fighter.airJumpsUsed);assert.ok(c.fighter.airJumpsUsed<=2);}}
 assert.equal(max,2);
});
test('unmounted Jopa knight uses its triple jump autonomously',()=>{
 const g=game('jopa');g.stage={...g.stage,platforms:[{x:100,y:700,width:900}]};g.state.fighters[1].x=450;g.state.fighters[1].y=700;
 activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.knight);const c=g.state.clones[0];delete c.rider;delete g.state.fighters[0].jopaRide;let max=0;
 for(let i=0;i<160;i++){g.step([0,0]);max=Math.max(max,c.fighter.airJumpsUsed);assert.ok(c.fighter.airJumpsUsed<=2);}
 assert.equal(max,2);
});
