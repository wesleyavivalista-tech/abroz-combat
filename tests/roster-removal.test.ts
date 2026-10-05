import {test} from 'node:test';
import assert from 'node:assert/strict';
import {characters} from '../packages/game-core/characters/registry.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {homeScreen,selectionScreen} from '../apps/client/src/ui/MenuScreens.js';
test('production roster and menus contain Eide, Biel, Jopa, Fausto, Napa, Jomp, Dodo, Drupa, Gut, Tocha, Bozo, Caio, Roms and Luizinho',()=>{
 assert.deepEqual(Object.keys(characters),['nikalz','jopa','biel','eide','astolfo','fausto','napa','jomp','dodo','drupa','gut','tocha','bozo','caio','roms','luizinho']);
 assert.deepEqual(new GameSimulation().state.fighters.map(f=>f.characterId),['gut','tocha']);
 for(const id of ['prototype-a','prototype-b'])assert.throws(()=>new GameSimulation([id,'gut']),/valid fighters/);
 for(const html of [homeScreen(),selectionScreen('local',['gut','tocha'],0,false,'gut')]){
  assert.doesNotMatch(html,/VECTOR|BRUT|prototype-a|prototype-b/);
 }
});
