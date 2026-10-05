import test from 'node:test';
import assert from 'node:assert/strict';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {astolfoPose} from '../apps/client/src/rendering/AstolfoRenderer.js';
import {faustoPose} from '../apps/client/src/rendering/FaustoRenderer.js';
import {napaPose} from '../apps/client/src/rendering/NapaRenderer.js';
import {dodoPose} from '../apps/client/src/rendering/DodoRenderer.js';

for(const [id,pose] of Object.entries({astolfo:astolfoPose,fausto:faustoPose,napa:napaPose,dodo:dodoPose})){
 test(`${id}: neutral crouch/jump never reuse active low/air attack art`,()=>{
  const f=createFighter(id,1000,1);
  f.state='Crouch';const crouch=pose(f);f.state='Jump';const jump=pose(f);
  f.state='Fall';assert.deepEqual(pose(f),jump);
  for(const [move,state,neutral] of [['low','CrouchingAttack',crouch],['air','AirAttack',jump]] as const){
   f.move=move;f.state=state;f.moveFrame=characters[id].moves[move].startupFrames;
   assert.notDeepEqual(pose(f),neutral);
  }
 });
}
