import type {SimulationSnapshot} from '../types.js';
/** Shared terminal cleanup for ordinary rounds, competition breaks and forfeits. */
export function clearCombatEntities(s:SimulationSnapshot):void{
 s.projectiles.forEach(p=>p.active=false);
 s.hazards=[];s.clones=[];
 if(s.structures)s.structures=[];
 if(s.bees)s.bees=[];
 if(s.foreheadWaves)s.foreheadWaves=[];
}
