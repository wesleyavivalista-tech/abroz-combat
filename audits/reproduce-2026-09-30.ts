// Read-only audit: creates disposable simulations; observations describe unfixed bugs.
import assert from 'node:assert/strict';
import {summonClones} from '../packages/game-core/simulation/HairSystem.js';
import {activateStructure,advanceStructures} from '../packages/game-core/simulation/StructureSystem.js';
import {advanceFireTrails} from '../packages/game-core/simulation/FireTrailSystem.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {validateCharacter} from '../packages/game-core/characters/registry.js';
import {validateAtlasFrames} from '../apps/client/src/rendering/AnimationContract.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {activateJopa,advanceJopa,controlJopa} from '../packages/game-core/simulation/JopaSystem.js';
import {gymTarget,startJomp,advanceJomp} from '../packages/game-core/simulation/JompSystem.js';
import {resolveKnockouts} from '../packages/game-core/simulation/LifeSystem.js';
import {Button} from '../packages/game-core/types.js';
function game(ids=['jopa','jomp']){const g=new GameSimulation(ids);g.state.phase='fight';g.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=500+i*100;f.meter=100;});return g;}
{
const g=game();const j=g.state.fighters[0];activateJopa(g.state,g.stage,j,0,characters.jopa.moves.tree);console.log('gymTargetsProtectedTreeOwner',gymTarget(g.state,g.state.fighters[1]));
}
{
const g=game(['jopa','jomp','gut']);const j=g.state.fighters[0];j.jopaStunUntil=2;j.health=0;j.lives=1;resolveKnockouts(g.state);console.log('deadBefore',j.state,j.lives);g.state.frame=2;advanceJopa(g.state,g.stage);console.log('deadAfter',j.state,j.lives);
}
{
const g=game();const d=g.state.fighters[1];d.hitstunImmuneUntil=1000;activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.chess);const p=g.state.projectiles.find(p=>p.active)!;p.x=d.x;p.y=d.y+25;g.step([0,0]);console.log('immuneChessHit',d.stun,d.jopaStunUntil,d.hitstunImmuneUntil);
}
{
const g=game();activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.knight);const d=g.state.fighters[1];d.move='gymBro';d.moveFrame=18;startJomp(g.state,d);for(let i=0;i<8;i++){g.state.frame++;advanceJomp(g.state,g.stage);}console.log('mountedGrappled',g.state.fighters[0].jopaRide,g.state.fighters[0].grappleUntil,g.state.fighters[0].state);
}
let seed=9330;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};let frames=0;
for(let trial=0;trial<20;trial++){
const ids=Object.keys(characters);const g=game(Array.from({length:8},()=>ids[rand()%ids.length]));g.state.fighters.forEach(f=>{f.lives=20;f.x=300+rand()%1800;});
const masks=g.state.fighters.map(()=>0);
for(let frame=0;frame<1500;frame++){
if(frame%5===0)masks.forEach((_,i)=>masks[i]=rand()%2048);
g.step(masks);frames++;
for(const f of [...g.state.fighters,...g.state.clones.map(c=>c.fighter)])for(const key of ['x','y','vx','vy','health','stun','moveFrame'] as const)if(!Number.isFinite(f[key]))throw Error(`nonfinite ${trial} ${frame} ${key}`);
if(frame===700){const snap=g.snapshot();for(let n=0;n<10;n++)g.step(masks);const hash=hashState(g.state);g.restore(snap);for(let n=0;n<10;n++)g.step(masks);if(hashState(g.state)!==hash)throw Error('Replay mismatch');}
}
}
console.log('stressFrames',frames);

{
 const g=game(['jopa','luizinho','gut']);const [j,l,v]=g.state.fighters;l.x=500;l.facing=1;
 activateStructure(g.state,g.stage,l,1,characters.luizinho.moves.home);activateStructure(g.state,g.stage,l,1,characters.luizinho.moves.build);
 const house=g.state.structures![0];house.health=65;v.x=house.x;v.y=0;const hp=v.health;
 activateJopa(g.state,g.stage,j,0,characters.jopa.moves.football);const ball=g.state.projectiles.find(p=>p.active)!;ball.x=house.x;ball.y=50;ball.vx=16;
 advanceJopa(g.state,g.stage);assert.equal(house.phase,'collapsed');assert.equal(v.health,hp);console.log('footballHouseCollapse',house.phase,'victimDamage',hp-v.health);
}
{
 const g=game(['jopa','gut']);activateJopa(g.state,g.stage,g.state.fighters[0],0,characters.jopa.moves.tree);g.state.frame=180;advanceJopa(g.state,g.stage);
 const t=g.state.clones.find(c=>c.kind==='tentacle')!.fighter;t.y=100;t.vy=-5;g.state.fighters[1].invulnerableUntil=999;
 for(let i=0;i<20;i++){g.state.frame++;advanceJopa(g.state,g.stage);}assert.equal(t.y,100);console.log('tentacleWithoutTarget',t.y,t.vy);
}
{
 const g=game(['tocha','luizinho']);const [f,l]=g.state.fighters;activateStructure(g.state,g.stage,l,1,characters.luizinho.moves.wall);const wall=g.state.structures![0];f.x=wall.x;f.y=wall.y+wall.height;f.onFireUntil=100;advanceFireTrails(g.state,g.stage);assert.equal(g.state.hazards.filter(h=>h.kind==='fire-trail').length,0);console.log('fireTrailOnWallRoof',0);
}
{
 const ids=['jopa','jomp','luizinho','roms','astolfo','napa'];const peers=ids.map((_,i)=>new RollbackManager(game(ids),i));
 const packets:{target:number;seat:number;frame:number;mask:number;due:number}[]=[];
 const mask=(seat:number,frame:number)=>frame===2?Button.Super1:frame===90?Button.Super2:((frame+seat*13)%80<20?Button.Right:0)|((frame+seat*7)%19===0?Button.Light:0);
 for(let clock=0;clock<1600&&peers.some(p=>p.simulation.state.frame<900);clock++){
  peers.forEach((p,seat)=>{if(p.simulation.state.frame<900)p.schedule(mask(seat,p.simulation.state.frame+2),(frame,input)=>peers.forEach((_,target)=>{if(target!==seat)packets.push({target,seat,frame,mask:input,due:clock+seat+(frame%3)});}));});
  for(let i=packets.length-1;i>=0;i--)if(packets[i].due<=clock){const p=packets.splice(i,1)[0];peers[p.target].receive(p.frame,p.mask,p.seat);}
  peers.forEach(p=>{if(p.simulation.state.frame<900)p.tick();});
 }
 packets.forEach(p=>peers[p.target].receive(p.frame,p.mask,p.seat));
 const hashes=peers.map(p=>hashState(p.simulation.state));assert.ok(peers.every(p=>p.desync==='OK'&&p.simulation.state.frame===900));assert.equal(new Set(hashes).size,1);console.log('sixPeerDelayedReplay',hashes[0]);
}

{
 const g=new GameSimulation(['jopa','bozo','gut','tocha'],false,undefined,[0,0,1,1]);g.state.phase='fight';g.state.fighters.forEach(f=>f.state='Idle');
 const [j,b]=g.state.fighters;j.x=500;j.facing=1;b.x=600;activateJopa(g.state,g.stage,j,0,characters.jopa.moves.knight);
 j.buffer=[{frame:0,mask:Button.Medium,pressed:Button.Medium,direction:5}];controlJopa(g.state,g.stage,j,0);summonClones(g.state,1,g.stage);
 const clone=g.state.clones.find(c=>c.owner===1)!.fighter;clone.x=1800;clone.buffer=[{frame:0,mask:Button.Medium,pressed:Button.Medium,direction:5}];
 controlJopa(g.state,g.stage,clone,1);assert.notEqual(b.jopaRide,undefined);console.log('companionInputMountsOwner',b.jopaRide);
}

{
 const c=characters.luizinho;
 const bad={...c,moves:{...c.moves,turret:{...c.moves.turret,structure:{...c.moves.turret.structure!,shotMove:Object.keys(c.moves).find(id=>c.moves[id].hitboxes.length&&!c.moves[id].projectile)!}}}};
 assert.doesNotThrow(()=>validateCharacter(bad));
 const g=game(['luizinho','gut']);
 // Register only this disposable variant while evaluating the first turret shot.
 characters.luizinho=bad;
 try{activateStructure(g.state,g.stage,g.state.fighters[0],0,bad.moves.turret);g.state.frame=60;assert.throws(()=>advanceStructures(g.state,g.stage),TypeError);console.log('invalidTurretDefinitionAcceptedThenThrows',true);}finally{characters.luizinho=c;}
 assert.doesNotThrow(()=>validateAtlasFrames([[0,0,120,100]],100,100));console.log('partialAtlasOverflowAccepted',true);
}
