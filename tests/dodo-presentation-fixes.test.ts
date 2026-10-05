import test from 'node:test';
import assert from 'node:assert/strict';
import {lowProfileOpacity} from '../apps/client/src/rendering/LowProfileVisual.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {characters} from '../packages/game-core/characters/registry.js';
test('Low-profile visibly fades both ways on simulation time',()=>{
 const f=createFighter('dodo',500,1);f.invisibleUntil=400;
 assert.equal(lowProfileOpacity(f,100),1);
 assert.equal(lowProfileOpacity(f,112),.5);
 assert.equal(lowProfileOpacity(f,124),0);
 assert.equal(lowProfileOpacity(f,382),0);
 assert.equal(lowProfileOpacity(f,391),.5);
 assert.equal(lowProfileOpacity(f,400),1);
});
test('Power Chord travels thirty percent farther at the same speed',()=>{
 const p=characters.dodo.moves.chord.projectile!;
 assert.equal(p.speed,13);assert.equal(p.speed*p.lifetime,13*30*1.3);
});
