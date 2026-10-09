import {hasExecutionArmor} from '../packages/game-core/combat/ExecutionArmor.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {hitboxes} from '../packages/game-core/combat/CollisionSystem.js';
import {activateStructure,damageStructure} from '../packages/game-core/simulation/StructureSystem.js';
import {RESPAWN_FRAMES,INVULNERABLE_FRAMES,isInvulnerable} from '../packages/game-core/simulation/LifeSystem.js';
import {audioPresence} from '../apps/client/src/audio/AbilityAudio.js';

function game(ids=['gut','gut']){
 const g=new GameSimulation(ids);g.state.phase='fight';
 g.state.fighters.forEach((f,i)=>Object.assign(f,{state:'Idle',x:400+i*1500,y:g.stage.floorHeight,meter:100}));
 return g;
}
function run(g:GameSimulation,frames:number){for(let i=0;i<frames;i++)g.step(g.state.fighters.map(()=>0));}
function controllable(g:GameSimulation,seat=0){
 const f=g.state.fighters[seat],inputs=g.state.fighters.map(()=>0),x=f.x;
 inputs[seat]=f.x<g.stage.width/2?Button.Right:Button.Left;g.step(inputs);assert.notEqual(f.x,x);
 inputs[seat]=0;g.step(inputs);inputs[seat]=Button.Light;g.step(inputs);assert.ok(f.move);
}

// Inject an authored action phase to isolate interruption cleanup from input routing.
// Special/Ultimate execution protection has exhaustive coverage in execution-armor.test.ts.
for(const [id,c] of Object.entries(characters))test(`${id}: every authored interruptible action exits startup, active and recovery on hit`,()=>{
 for(const m of Object.values(c.moves)){
  if(c.muscleFighter&&['coolMuscles','gymBro'].includes(m.id))continue;
  for(const age of [0,m.startupFrames,m.startupFrames+m.activeFrames]){
   const g=game([id,'gut']),f=g.state.fighters[0],label=`${id}/${m.id}/${age}`;
   Object.assign(f,{move:m.id,state:m.state,moveFrame:age,attackSerial:1});
   if(m.state==='AirAttack'){f.y+=140;f.vy=-2;}
   if(hasExecutionArmor(f))continue;
   g.hit(1,characters.gut.moves.palm,0,true,0,-1);
   assert.equal(f.move,null,label);assert.ok(f.stun>0,label);assert.equal(hitboxes(f,f.move?c.moves[f.move]:undefined).length,0,label);
   assert.ok(!audioPresence(g.state).some(p=>p.id.startsWith('fighter:0:channel:')||p.id.startsWith('fighter:0:charge:')),label);
   run(g,240);assert.equal(f.stun,0,label);assert.equal(f.move,null,label);controllable(g);
  }
 }
});

for(const [id,c] of Object.entries(characters))for(const mode of Object.values(c.moves).filter(m=>m.weaponFrames))test(`${id}/${mode.id}: actual transformation expires during hitstun without unlocking input`,()=>{
 const g=game([id,'gut']),f=g.state.fighters[0];
 const index=c.superButtons.indexOf(mode.id);assert.ok(index>=0);
 g.step([index===0?Button.Super1:Button.Super2,0]);run(g,mode.startupFrames+mode.activeFrames+mode.recoveryFrames+5);
 assert.ok(f.weaponUntil>g.state.frame);
 g.hit(1,characters.gut.moves.palm,0,false,0,-1);assert.ok(f.stun>0);
 f.weaponUntil=g.state.frame+1;
 const snapshot=g.snapshot();g.step([Button.Right|Button.Light,0]);
 assert.equal(f.weaponUntil,0);assert.equal(f.move,null);assert.ok(f.stun>0);
 const hash=hashState(g.state);g.restore(snapshot);g.step([Button.Right|Button.Light,0]);assert.equal(hashState(g.state),hash);
 run(g,Math.max(240,(c.modeFinale?.duration??0)+60));controllable(g);
});

test('Jomp stance and Gym Bro retain intentional reaction armor and release control normally',()=>{
 for(const button of [Button.Special,Button.Super1]){
  const g=game(['jomp','gut']),f=g.state.fighters[0];g.state.fighters[1].x=f.x+200;
  g.step([button,0]);const action=f.move;assert.ok(action);
  const hp=f.health;g.hit(1,characters.gut.moves.palm,0,false,0,-1);
  assert.equal(f.move,action);assert.equal(f.stun,0);assert.ok(f.health<hp);
  run(g,500);assert.equal(f.move,null);assert.equal(g.state.fighters[1].grappleUntil,0);controllable(g);
 }
});

test('holder death releases bear hug; victim can move and attack again',()=>{
 const g=game(['gut','nikalz','tocha']),[holder,victim]=g.state.fighters;
 victim.x=holder.x+70;
 g.hit(0,characters.gut.moves.hug,0,false,1,1);
 assert.equal(holder.state,'Grappling');assert.equal(victim.state,'Grappled');
 holder.health=1;
 g.hit(2,characters.tocha.moves[characters.tocha.basicAttacks!.chain[0]],0,false,0,-1);
 run(g,180);assert.equal(victim.grappleUntil,0);assert.equal(victim.grappleOwner,-1);
 controllable(g,1);
});

test('airborne house-collapse recovery clears daze and allows a later forehead stun',()=>{
 const g=game(['luizinho','gut','nikalz']),[builder,target]=g.state.fighters;
 builder.x=500;
 activateStructure(g.state,g.stage,builder,0,characters.luizinho.moves.home);
 const house=g.state.structures![0];target.x=house.x;target.y=g.stage.floorHeight+120;target.state='Fall';
 activateStructure(g.state,g.stage,builder,0,characters.luizinho.moves.build);
 damageStructure(g.state,house,house.health,'collapse-test',0,g.stage);
 assert.equal(target.state,'AirHitStun');assert.ok(target.dazed);assert.ok(target.stun>0);
 run(g,180);assert.equal(target.state,'Idle');assert.equal(target.stun,0);assert.equal(target.dazed,false);
 g.hit(2,characters.nikalz.moves.foreheadDive,0,false,1,-1);
 assert.ok(target.stun>0);assert.ok(target.nikalzStunUntil!>g.state.frame);
});

test('escaping hitstun after Gym Bro throw cannot carry its pending landing stun into a later hit',()=>{
 const g=game(['jomp','gut','nikalz']),[holder,target]=g.state.fighters;
 target.x=holder.x+90;g.step([Button.Super1,0,0]);
 for(let i=0;i<500&&!target.gymLandingStun;i++)g.step([0,0,0]);
 assert.equal(target.gymLandingStun,true);assert.equal(target.state,'AirHitStun');
 // Five real follow-up contacts invoke the shared combo escape before landing.
 for(let i=0;i<5;i++)g.hit(2,characters.nikalz.moves[characters.nikalz.basicAttacks!.chain[0]],0,false,1,1);
 assert.equal(target.state,'Fall');assert.equal(target.stun,0);
 run(g,180);assert.equal(target.state,'Idle');assert.ok(!target.gymLandingStun);
 g.hit(2,characters.nikalz.moves[characters.nikalz.basicAttacks!.heavy],0,false,1,-1);
 for(let i=0;i<180;i++){g.step([0,0,0]);assert.ok(!target.gymStunnedUntil);}
 assert.equal(target.state,'Idle');
});

for(const [id,c] of Object.entries(characters))for(const mode of Object.values(c.moves).filter(m=>m.weaponFrames))test(`${id}/${mode.id}: transformed KO, respawn and victory remove combat state`,()=>{
 const g=game([id,'gut']),f=g.state.fighters[0],index=c.superButtons.indexOf(mode.id);
 g.step([index===0?Button.Super1:Button.Super2,0]);run(g,mode.startupFrames+mode.activeFrames+mode.recoveryFrames+5);
 assert.ok(f.weaponUntil>g.state.frame);const transformed=g.snapshot();
 f.health=0;g.step([0,0]);assert.equal(f.weaponUntil,0);assert.equal(f.move,null);
 run(g,RESPAWN_FRAMES+INVULNERABLE_FRAMES+180);assert.equal(f.respawnAt,0);assert.equal(isInvulnerable(f,g.state.frame),false);controllable(g);
 g.restore(transformed);const opponent=g.state.fighters[1];opponent.lives=1;opponent.health=0;g.step([0,0]);
 assert.equal(g.state.phase,'result');assert.equal(g.state.fighters[0].state,'MatchWin');
 assert.equal(g.state.fighters[0].weaponUntil,0);assert.equal(g.state.fighters[0].move,null);assert.deepEqual(audioPresence(g.state),[]);
 const health=g.state.fighters.map(a=>a.health);for(let i=0;i<120;i++)g.step([2047,2047]);
 assert.deepEqual(g.state.fighters.map(a=>a.health),health);assert.ok(g.state.projectiles.every(p=>!p.active));
});
