import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {resolveHit} from '../packages/game-core/combat/CombatSystem.js';
import {periodicHit} from '../packages/game-core/combat/PeriodicHit.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {trainingRoom} from '../packages/game-core/stages/registry.js';
import {Button} from '../packages/game-core/types.js';
function game(){const g=new GameSimulation(['dodo','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');return g;}
function hit(g:GameSimulation){resolveHit(g.state,trainingRoom,()=>{},0,{...characters.dodo.moves.jab,hitstun:30},0,false);}
test('consecutive direct hits diminish stun and fifth grants exactly 45 frames of escape',()=>{
 const g=game(),f=g.state.fighters[1];
 for(const expected of [30,24,18,12]){g.state.frame+=10;hit(g);assert.equal(f.stun,expected);}
 const x=f.x;g.state.frame+=10;hit(g);assert.equal(f.stun,0);assert.equal(f.state,'Idle');assert.equal(f.x,x+40);assert.equal(f.hitstunImmuneUntil,g.state.frame+45);
 f.move='cross';f.state='LightAttack';const hp=f.health;
 g.state.frame+=44;hit(g);assert.ok(f.health<hp);assert.equal(f.move,'cross');assert.equal(f.state,'LightAttack');assert.equal(f.stun,0);
 g.state.frame++;hit(g);assert.equal(f.stun,30);assert.equal(f.consecutiveHits,1);
});
test('periodic and direct hits share the sequence; immunity preserves movement and attacks',()=>{
 const g=game(),f=g.state.fighters[1];g.state.fighters[0].x=100;
 for(let i=0;i<4;i++){g.state.frame+=10;hit(g);}
 periodicHit(g.state,f,20,1,12,2);assert.equal(f.stun,0);g.state.hitstop=0;
 const x=f.x;g.step([0,Button.Right]);assert.ok(f.x>x);
 g.step([0,Button.Light]);const move=f.move;assert.ok(move);
 const hp=f.health;periodicHit(g.state,f,20,1,120,20);assert.equal(f.move,move);assert.equal(f.stun,0);assert.ok(f.health<hp);
 const snap=g.snapshot();for(let i=0;i<50;i++)g.step([0,0]);const hash=hashState(g.state);g.restore(snap);for(let i=0;i<50;i++)g.step([0,0]);assert.equal(hashState(g.state),hash);
});
test('one second without hits resets scaling and blocks do not count',()=>{
 const g=game(),f=g.state.fighters[1];hit(g);g.state.frame+=60;hit(g);assert.equal(f.stun,30);assert.equal(f.consecutiveHits,1);
 f.stun=0;f.move=null;f.state='Idle';resolveHit(g.state,trainingRoom,()=>{},0,characters.dodo.moves.jab,Button.Right,false);assert.equal(f.consecutiveHits,1);
});
test('escape clears airborne hit reaction and prevents launches or traps while immune',()=>{
 const g=game(),f=g.state.fighters[1];f.y=80;
 for(let i=0;i<5;i++){g.state.frame++;hit(g);}
 assert.equal(f.state,'Fall');const y=f.y;
 resolveHit(g.state,trainingRoom,()=>{},0,{...characters.dodo.moves.jab,launch:20,trapFrames:120,grappleFrames:120},0,false);
 assert.equal(f.state,'Fall');assert.equal(f.y,y);assert.equal(f.trappedUntil,0);assert.equal(f.grappleUntil,0);
});
test('roster health matches configured values and respawns restore maximum and reset escape',()=>{
 const expected={dodo:1400,luizinho:1400,caio:1400,tocha:1400,drupa:1500,gut:1600,bozo:1450,roms:1450};
 for(const [id,hp] of Object.entries(expected))assert.equal(characters[id].stats.maxHealth,hp);
 const g=game(),f=g.state.fighters[1];f.health=0;f.hitstunImmuneUntil=999;f.consecutiveHits=4;g.step([0,0]);for(let i=0;i<120;i++)g.step([0,0]);assert.equal(f.health,1600);assert.equal(f.consecutiveHits,0);assert.equal(f.hitstunImmuneUntil,0);
});
