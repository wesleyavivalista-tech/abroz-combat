import type {Fighter,SimulationSnapshot,HairClone} from "../types.js";
export function actors(s: SimulationSnapshot): {fighter: Fighter; owner: number; clone?: HairClone}[] {
  return [...s.fighters.map((fighter, owner) => ({fighter, owner})), ...s.clones.map(clone => ({fighter:clone.fighter, owner:clone.owner, clone}))];
}

/** Neutral undead keep their original asset owner, never their former team allegiance. */
export function hostile(s:SimulationSnapshot,sourceOwner:number,target:Fighter,targetOwner:number):boolean {
 return !!target.undead || s.teams[sourceOwner]!==s.teams[targetOwner];
}
