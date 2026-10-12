import type {CombatEvent,SimulationSnapshot} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
/** Arena-owned actors have no player slot; retain their generic impact effect. */
export function presentCombatEvents(s:SimulationSnapshot,events:readonly CombatEvent[]):CombatEvent[]{
 return events.map(event=>{
  const fighter=s.fighters[event.player];
  return {...event,type:(fighter?characters[fighter.characterId].effects[event.type]:undefined)??event.type};
 });
}
