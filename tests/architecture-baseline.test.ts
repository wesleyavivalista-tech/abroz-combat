import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {behaviorTraces} from './fixtures/behavior-traces.js';
test('all moves preserve approved movement-facing gameplay across timing and hitstop',()=>{
 const expected=JSON.parse(readFileSync(new URL('./fixtures/movement-facing-baseline.json',import.meta.url),'utf8'));
 const actual=behaviorTraces();
 assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key=>[key,actual[key]])),expected);
});
