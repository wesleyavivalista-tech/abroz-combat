import test from 'node:test';
import assert from 'node:assert/strict';
import {updateMarkup} from '../apps/client/src/ui/UI.js';
test('unchanged HUD markup avoids replacement while state changes still render',()=>{
 let html='',writes=0;
 const element={get innerHTML(){return html;},set innerHTML(value:string){html=value;writes++;}} as Element;
 const states=['<span>3 LIVES</span>','<span>2 LIVES</span>','<span>∞ LIVES</span>','<em>LOAN</em>','<em>BUILD</em>','<em>READY</em>','<em>USED</em>'];
 for(const state of states){for(let i=0;i<60;i++)updateMarkup(element,state);assert.equal(html,state);}
 assert.equal(writes,states.length);
 // Read actual DOM content rather than stale per-ID cache after replacement/other writes.
 html='external change';updateMarkup(element,states.at(-1)!);assert.equal(writes,states.length+1);
});
