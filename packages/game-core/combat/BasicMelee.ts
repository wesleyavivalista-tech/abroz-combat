import {basicAttacks} from '../characters/common.js';
import {characters} from '../characters/registry.js';
import type {Fighter,MoveDefinition,SimulationSnapshot,StageDefinition} from '../types.js';
import {actors,hostile} from '../simulation/Actors.js';
import {isActive} from '../simulation/LifeSystem.js';
import {grounded} from '../simulation/StageCollision.js';

/** World units; movement totals are spread over startup, independent of attack speed. */
export const BASIC_MELEE = {
  reach: [1.20,1.22,1.24],
  lungeDistance: [8,10,12],
  verticalTolerance: 4,
  assistanceDistance: 4,
  assistanceRange: 110,
  assistanceVerticalTolerance: 28,
  bodySeparation: 65,
} as const;

export function basicMeleeTier(f:Fighter,m:MoveDefinition):number|null {
  const basics=basicAttacks(characters[f.characterId],f);
  // A basic input may instead launch a projectile or activate a special mode.
  if(m.flashDash||!m.hitboxes.length||m.projectile||m.returningProjectile||m.beam||m.dive||m.holdInvisible||m.grappleFrames)return null;
  const index=basics.chain.indexOf(m.id);
  return index>=0?index:[basics.heavy,basics.kick,basics.crouch,basics.air].includes(m.id)?0:null;
}

/** Called by the shared move update. No velocity, facing, timing or snapshot state changes. */
export function advanceBasicMelee(s:SimulationSnapshot,f:Fighter,m:MoveDefinition,previousFrame:number,stage:StageDefinition):void {
  const tier=basicMeleeTier(f,m);
  if(tier===null||!grounded(f,stage)||m.advance||m.startupFrames<=0)return;
  const progress=(frame:number)=>Math.max(0,Math.min(1,(frame+1)/m.startupFrames));
  const fraction=progress(f.moveFrame)-progress(previousFrame);
  if(fraction<=0)return;
  const all=actors(s),owner=all.find(a=>a.fighter===f)?.owner;
  let clearance=Infinity,assist=false;
  for(const a of all){
    const other=a.fighter,forward=(other.x-f.x)*f.facing;
    if(other===f||!isActive(other)||forward<0)continue;
    const vertical=Math.abs(other.y-f.y);
    // Same body separation as pushApart: stop the step before overlap, including allies.
    if(vertical<=125)clearance=Math.min(clearance,Math.max(0,forward-BASIC_MELEE.bodySeparation));
    if(owner!==undefined&&hostile(s,owner,a.fighter,a.owner)&&forward<=BASIC_MELEE.assistanceRange&&vertical<=BASIC_MELEE.assistanceVerticalTolerance)assist=true;
  }
  const distance=(BASIC_MELEE.lungeDistance[Math.min(tier,2)]+(assist?BASIC_MELEE.assistanceDistance:0))*fraction;
  f.x=Math.max(40,Math.min(stage.width-40,f.x+f.facing*Math.min(distance,clearance)));
}
