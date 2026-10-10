import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters,validateCharacter} from '../packages/game-core/characters/registry.js';
import {activateJopa,advanceJopa,controlJopa} from '../packages/game-core/simulation/JopaSystem.js';
import {gymTarget,startJomp,advanceJomp} from '../packages/game-core/simulation/JompSystem.js';
import {resolveKnockouts} from '../packages/game-core/simulation/LifeSystem.js';
import {activateStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {summonClones} from '../packages/game-core/simulation/HairSystem.js';
import {Button} from '../packages/game-core/types.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {validateAtlasFrames} from '../apps/client/src/rendering/AnimationContract.js';
function game(ids=['jopa','gut']){const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=500+i*100;f.meter=100;});return g;}
function chessHit(g:GameSimulation){activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.chess);const p=g.state.projectiles.find(p=>p.active)!;p.x=g.state.fighters[1].x;p.y=25;advanceJopa(g.state,g.stage);}
test('Jopa respects escape immunity and stance armor without removing damage',()=>{
 for(const armor of [false,true]){const g=game(['jopa','jomp']),d=g.state.fighters[1];if(armor)d.move='coolMuscles';else d.hitstunImmuneUntil=1000;const hp=d.health;chessHit(g);assert.equal(d.health<hp,true);assert.equal(d.stun,0);assert.equal(d.jopaStunUntil,undefined);if(armor)assert.equal(d.move,'coolMuscles');}
});
test('eligible chess contact keeps full duration and does not shorten longer stun',()=>{const g=game(),d=g.state.fighters[1];chessHit(g);assert.equal(d.jopaStunUntil,60);const other=game(),v=other.state.fighters[1];v.state='HitStunStanding';v.stun=200;chessHit(other);assert.equal(v.jopaStunUntil,200);});
test('chess reaction cannot resurrect KO state or overwrite a subsequent grapple',()=>{const g=game(['jopa','gut','jomp']),d=g.state.fighters[1];chessHit(g);d.health=0;d.lives=1;resolveKnockouts(g.state);g.state.frame=121;advanceJopa(g.state,g.stage);assert.equal(d.state,'KO');assert.equal(d.jopaStunUntil,undefined);const h=game(),v=h.state.fighters[1];chessHit(h);v.state='Grappled';v.grappleUntil=200;advanceJopa(h.state,h.stage);assert.equal(v.state,'Grappled');assert.equal(v.jopaStunUntil,undefined);});
test('Gym Bro excludes tree and mount protection and rechecks during homing',()=>{
 for(const kind of ['tree','knight'] as const){const g=game(['jopa','jomp']),[j,a]=g.state.fighters;activateJopa(g.state,g.stage,j,0,characters.jopa.moves[kind]);assert.equal(gymTarget(g.state,a),-1);}
 const g=game(['jopa','jomp']),[j,a]=g.state.fighters;a.move='gymBro';startJomp(g.state,a);a.moveFrame=18;activateJopa(g.state,g.stage,j,0,characters.jopa.moves.tree);advanceJomp(g.state,g.stage);assert.equal(a.gymTarget,-1);assert.equal(j.grappleUntil,0);
});
test('companion inputs cannot mount their owner but owner inputs still can',()=>{
 const g=new GameSimulation(['jopa','bozo','gut','tocha'],false,undefined,[0,0,1,1]);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');const [j,b]=g.state.fighters;j.x=500;j.facing=1;b.x=600;activateJopa(g.state,g.stage,j,0,characters.jopa.moves.knight);
 const press=[{frame:0,mask:Button.Medium,pressed:Button.Medium,direction:5}];j.buffer=press;controlJopa(g.state,g.stage,j,0);summonClones(g.state,1,g.stage);const clone=g.state.clones.find(c=>c.owner===1)!.fighter;clone.x=1800;clone.buffer=press;controlJopa(g.state,g.stage,clone,1);assert.equal(b.jopaRide,undefined);b.buffer=press;controlJopa(g.state,g.stage,b,1);assert.notEqual(b.jopaRide,undefined);
});
test('football travels inside house and uses shared collapse effects at the wall',()=>{
 const g=game(['jopa','luizinho','gut']),[j,l,v]=g.state.fighters;l.x=500;l.facing=1;activateStructure(g.state,g.stage,l,1,characters.luizinho.moves.home);activateStructure(g.state,g.stage,l,1,characters.luizinho.moves.build);const house=g.state.structures![0];house.health=characters.jopa.moves.football.damage;v.x=house.x;v.y=0;const hp=v.health;activateJopa(g.state,g.stage,j,0,characters.jopa.moves.football);const p=g.state.projectiles.find(p=>p.active)!;p.x=house.x;p.y=250;p.vx=16;advanceJopa(g.state,g.stage);assert.equal(house.health,characters.jopa.moves.football.damage);assert.equal(p.vx,16);p.x=house.x+house.width/2-45;advanceJopa(g.state,g.stage);assert.equal(house.phase,'collapsed');assert.equal(hp-v.health,characters.luizinho.moves.home.structure!.collapseDamage);
});
test('tentacle gravity continues without a vulnerable target',()=>{const g=game();activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.tree);g.state.frame=180;advanceJopa(g.state,g.stage);const t=g.state.clones.find(c=>c.kind==='tentacle')!.fighter;t.y=100;t.vy=-5;g.state.fighters[1].invulnerableUntil=999;for(let i=0;i<20;i++){g.state.frame++;advanceJopa(g.state,g.stage);}assert.equal(t.y,0);assert.equal(t.vy,0);});
test('fire trails recognize built structure roofs through the actual game step',()=>{const g=game(['tocha','luizinho']),[f,l]=g.state.fighters;activateStructure(g.state,g.stage,l,1,characters.luizinho.moves.wall);const b=g.state.structures![0];f.x=b.x;f.y=b.y+b.height;f.onFireUntil=100;g.step([0,0]);assert.ok(g.state.hazards.some(h=>h.kind==='fire-trail'&&h.y===b.y+b.height));});
test('hash acceptance is bounded but retains expected future peer hashes',()=>{const p=new RollbackManager(game(),0);p.simulation.state.frame=300;assert.equal(p.isHashFrameRetained(60),false);assert.equal(p.isHashFrameRetained(120),true);assert.equal(p.isHashFrameRetained(305),true);assert.equal(p.isHashFrameRetained(600),false);});
test('turrets reject existing moves lacking projectiles',()=>{const c=characters.luizinho;const bad={...c,moves:{...c.moves,turret:{...c.moves.turret,structure:{...c.moves.turret.structure!,shotMove:'wall'}}}};assert.throws(()=>validateCharacter(bad),/turret/);});
test('atlas rectangles must be contained by the image',()=>{for(const b of [[-1,0,10,10],[0,-1,10,10],[0,0,101,10],[0,0,10,101]])assert.throws(()=>validateAtlasFrames([b],100,100),/outside/);assert.doesNotThrow(()=>validateAtlasFrames([[0,0,100,100]],100,100));});
test('fifth Jopa contact grants shared escape and clears its private stun clock',()=>{const g=game(),d=g.state.fighters[1];for(let i=0;i<5;i++)chessHit(g);assert.equal(d.stun,0);assert.equal(d.jopaStunUntil,undefined);assert.ok(d.hitstunImmuneUntil>g.state.frame);advanceJopa(g.state,g.stage);assert.equal(d.stun,0);});
