import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {spawnInvader,INVASION_VARIANTS} from '../packages/game-core/simulation/InvasionSystem.js';
import {presentCombatEvents} from '../apps/client/src/rendering/CombatEventPresentation.js';
test('hitting any neutral invasion zombie renders its impact without reading a missing player',()=>{
 for(const variant of INVASION_VARIANTS){
  const g=new GameSimulation(['nikalz','jopa']);g.state.phase='fight';
  const c=spawnInvader(g.state,g.stage,variant);c.fighter.undead='zombie';
  g.hit(0,characters.nikalz.moves[characters.nikalz.basicAttacks!.chain[0]],0,false,c.owner,1,g.state.fighters[0],c.fighter);
  assert.ok(g.events.length>0);assert.equal(g.events[0].player,-1);
  assert.deepEqual(presentCombatEvents(g.state,g.events),g.events);
  g.step([0,0]);assert.ok(g.state.frame>0);
 }
});
test('player effects retain their fighter-specific mapping and event data',()=>{
 const g=new GameSimulation(['nikalz','jopa']);
 for(let player=0;player<2;player++)for(const [type,mapped] of Object.entries(characters[g.state.fighters[player].characterId].effects)){
  const event={id:'test',type,player,x:10,y:20,power:1};
  assert.deepEqual(presentCombatEvents(g.state,[event]),[{...event,type:mapped}]);assert.equal(event.type,type);
 }
});
