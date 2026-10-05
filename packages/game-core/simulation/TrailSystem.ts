import type {Hazard,SimulationSnapshot} from '../types.js';
/** Shared surface-cell lifetime only; contact effects remain fire/blood-specific. */
export function refreshTrail(s:SimulationSnapshot,trail:Hazard,capacity:number):void{
 const existing=s.hazards.find(h=>h.kind===trail.kind&&h.owner===trail.owner&&h.x===trail.x&&h.y===trail.y);
 if(existing)existing.expiresAt=trail.expiresAt;
 else if(s.hazards.filter(h=>h.kind===trail.kind).length<capacity)s.hazards.push(trail);
}
