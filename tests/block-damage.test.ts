import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {Button} from '../packages/game-core/types.js';
function match(training=false){const g=new GameSimulation(['tocha','roms'],training);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.y=g.stage.floorHeight;});return g;}
test('guard absorbs 60% for high, mid and low attacks without adding hits or burn',()=>{
 for(const level of ['high','mid','low'] as const){
  const g=match(),d=g.state.fighters[1];
  const m={...characters.tocha.moves.double,damage:100,level};
  g.hit(0,m,Button.Right|(level==='low'?Button.Down:0),false,1);
  assert.equal(d.health,1410);assert.equal(d.lastDamage,40);assert.equal(d.combo,0);assert.equal(d.burnUntil,0);
  assert.ok(d.state.startsWith('Block'));
 }
});
test('armor applies to blocked damage and training still prevents chip knockouts',()=>{
 const g=match(),d=g.state.fighters[1];d.armorUntil=300;
 g.hit(0,{...characters.tocha.moves.jab,damage:100},Button.Right,false,1);
 assert.equal(d.health,1426);
 for(const training of [false,true]){
  const s=match(training),f=s.state.fighters[1];f.health=10;
  s.hit(0,{...characters.tocha.moves.jab,damage:100},Button.Right,false,1);
  assert.equal(f.health,training?1:0);
 }
});
