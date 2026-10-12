import {refreshTrail} from './TrailSystem.js';
import {characters} from '../characters/registry.js';
import type {SimulationSnapshot,StageDefinition} from '../types.js';
import {actors} from './Actors.js';
import {isActive} from './LifeSystem.js';
import {grounded} from './StageCollision.js';
import {igniteTarget} from './StatusSystem.js';
export const FIRE_TRAIL_LIFETIME=180;
export const FIRE_TRAIL_WIDTH=48;
export const MAX_FIRE_TRAILS=384;
/** Surface cells keep the trail contiguous without creating a particle per simulation tick. */
export function advanceFireTrails(s:SimulationSnapshot,stage:StageDefinition):void{
 s.hazards=s.hazards.filter(h=>s.frame<h.expiresAt);
 s.fighters.forEach((f,owner)=>{
  if(!characters[f.characterId].auraTrailMove||f.onFireUntil<=s.frame||!isActive(f)||!grounded(f,stage))return;
  const x=Math.floor(f.x/FIRE_TRAIL_WIDTH)*FIRE_TRAIL_WIDTH+FIRE_TRAIL_WIDTH/2;
  refreshTrail(s,{kind:'fire-trail',owner,x,y:f.y,expiresAt:s.frame+FIRE_TRAIL_LIFETIME,move:characters[f.characterId].auraTrailMove!,nextTicks:[]},MAX_FIRE_TRAILS);
 });
 for(const h of s.hazards){
  if(h.kind!=='fire-trail')continue;
  for(const {fighter:f} of actors(s)){
   if(Math.abs(f.x-h.x)<=FIRE_TRAIL_WIDTH/2+25&&Math.abs(f.y-h.y)<=18)igniteTarget(s,f,h.owner,240,10,'normal',true);
  }
 }
}
