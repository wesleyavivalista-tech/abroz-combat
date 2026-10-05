import type {Fighter,SimulationSnapshot,HairClone} from "../types.js";
export function actors(s: SimulationSnapshot): {fighter: Fighter; owner: number; clone?: HairClone}[] {
  return [...s.fighters.map((fighter, owner) => ({fighter, owner})), ...s.clones.map(clone => ({fighter:clone.fighter, owner:clone.owner, clone}))];
}
