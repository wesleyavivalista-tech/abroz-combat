import test from 'node:test';
import assert from 'node:assert/strict';
import {randomArena} from '../packages/game-core/stages/random.js';
import {stages} from '../packages/game-core/stages/registry.js';
test('random arenas cover every other arena without an immediate repeat',()=>{
 for(const previous of Object.keys(stages)){
  const choices=Object.keys(stages).filter(id=>id!==previous);
  assert.deepEqual(choices.map((_,i)=>randomArena(previous,()=>i/choices.length)),choices);
 }
});
