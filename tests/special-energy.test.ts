import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
import {homeCastPair,homeCastTick} from '../apps/client/src/ui/HomeCast.js';
import {selectionScreen} from '../apps/client/src/ui/MenuScreens.js';
test('every special requires and spends 25 energy, without spending energy on a rejected activation',()=>{
 for(const id of ['bozo','tocha','gut','drupa'])for(const [i,move] of characters[id].specialButtons.entries())for(const meter of [24,25,100]){
  const s=new GameSimulation([id,'gut']);s.state.phase='fight';const f=s.state.fighters[0];f.state='Idle';f.meter=meter;f.x=200;s.state.fighters[1].x=2000;
  s.step([i===0?Button.Special:Button.Special2,0]);
  assert.equal(f.move,meter<25?null:move,`${id}/${move}`);
  assert.equal(f.meter,meter<25?meter:meter-25);
 }
});
test('held meditation charges once, and a new activation needs new energy',()=>{
 const s=new GameSimulation(['gut','bozo']);s.state.phase='fight';const f=s.state.fighters[0];f.state='Idle';f.meter=25;f.health=500;
 for(let i=0;i<240;i++)s.step([Button.Special2,0]);
 assert.equal(f.meter,0);assert.equal(f.health,670);assert.equal(f.move,'meditation');
 s.step([0,0]);s.step([Button.Special2,0]);assert.equal(f.move,null);assert.equal(f.meter,0);
});
test('menu rotation covers every fighter and selection retains skin choice without a move list',()=>{
 assert.deepEqual(homeCastPair(0),['bozo','drupa']);assert.deepEqual(homeCastPair(1),['tocha','gut']);const cycleLength=Math.ceil(Object.keys(characters).length/2);
 assert.deepEqual(homeCastPair(cycleLength),homeCastPair(0));
 const seen=new Set<string>();
 for(let step=0;step<cycleLength;step++){
  const pair=homeCastPair(step);assert.notEqual(pair[0],pair[1]);pair.forEach(id=>seen.add(id));
 }
 assert.deepEqual([...seen].sort(),Object.keys(characters).sort());
 const html=selectionScreen('local',['bozo','gut'],0,false,'bozo');
 assert.ok(!html.includes('MOVE LIST'));assert.ok(!html.includes('<dl>'));assert.ok(html.includes('fighter-skin'));
});

test('menu rotation tolerates a queued frame timestamp before navigation and advances every 15 seconds',()=>{
 assert.equal(homeCastTick(99,100),0);assert.equal(homeCastTick(15099,100),0);assert.equal(homeCastTick(15100,100),1);assert.equal(homeCastTick(30100,100),2);
});
