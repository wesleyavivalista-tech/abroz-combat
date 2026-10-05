import {test} from 'node:test';
import assert from 'node:assert/strict';
import {characters} from '../packages/game-core/characters/registry.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../packages/game-core/types.js';
import {crouchAttackPresentation} from '../apps/client/src/rendering/CrouchAttackVisual.js';

for(const [id,def] of Object.entries(characters)){
 test(`${id}: low attack stays crouched through windup, strike, recovery and completion`,()=>{
  const g=new GameSimulation([id,'gut']);g.state.phase='fight';
  const [f,other]=g.state.fighters;f.state=other.state='Idle';f.x=300;other.x=1800;
  g.step([Button.Down,0]);g.step([Button.Down|Button.Light,0]);
  assert.equal(f.state,'CrouchingAttack');assert.ok(f.move);
  const name=f.move,move=def.moves[name];let ticks=0;
  while(f.move&&ticks++<100){
   const before=structuredClone(f),shown=crouchAttackPresentation(f);
   const strike=f.moveFrame>=move.startupFrames&&f.moveFrame<move.startupFrames+move.activeFrames+3;
   assert.equal(shown.state,strike?'CrouchingAttack':'Crouch');
   assert.equal(shown.move,strike?name:null);
   assert.deepEqual(f,before,'presentation must not mutate simulation');
   g.step([Button.Down,0]);
  }
  assert.ok(ticks<100);assert.equal(f.move,null);assert.equal(f.state,'Crouch');
  g.step([0,0]);assert.equal(f.state,'Idle');
 });
}

test('weapon low attacks use the same phases; interruptions and mounted attacks are untouched',()=>{
 for(const [id,name] of [['gut','spearLow'],['fausto','swordLow']]){
  const f=new GameSimulation([id,'gut']).state.fighters[0];
  f.weaponUntil=1000;f.move=name;f.state='CrouchingAttack';f.moveFrame=0;
  assert.equal(crouchAttackPresentation(f).state,'Crouch');
  f.moveFrame=characters[id].moves[name].startupFrames;
  assert.equal(crouchAttackPresentation(f),f);
  f.moveFrame=0;f.stun=5;assert.equal(crouchAttackPresentation(f),f);
  f.stun=0;f.jopaRide=0;assert.equal(crouchAttackPresentation(f),f);
  f.jopaRide=undefined;f.state='AirAttack';assert.equal(crouchAttackPresentation(f),f);
 }
});

test('releasing crouch during an attack finishes standing without affecting its duration',()=>{
 const g=new GameSimulation(['roms','gut']);g.state.phase='fight';
 const [f,d]=g.state.fighters;f.state=d.state='Idle';f.x=300;d.x=1800;
 g.step([Button.Down|Button.Light,0]);
 const m=characters.roms.moves.low;let ticks=0;
 while(f.move&&ticks++<100)g.step([0,0]);
 assert.equal(ticks,m.startupFrames+m.activeFrames+m.recoveryFrames);
 assert.equal(f.state,'Idle');
});
