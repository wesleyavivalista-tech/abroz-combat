import {hostile} from './Actors.js';
import {cookieMonsterInput} from './NapaSystem.js';
import {basketballInput,isLowProfile} from './DodoSystem.js';
import { Button, type SimulationSnapshot, type HairClone } from "../types.js";
import { characters } from "../characters/registry.js";
import { createFighter } from "./Fighter.js";
import { isActive } from "./LifeSystem.js";
import { grounded } from "./StageCollision.js";
import type { StageDefinition } from "../types.js";
import {actors} from "./Actors.js";
export {actors} from "./Actors.js";
export {protectedDamage} from "../combat/DamageSystem.js";
export function summonClones(s: SimulationSnapshot, owner: number, stage: StageDefinition): void {
  const source = s.fighters[owner];
  // A single use summons exactly three companions. They never occupy network seats.
  if (s.clones.some(c => c.owner === owner)) return;
  for (let i=0;i<3;i++) {
    const f = createFighter(source.characterId, Math.max(40, Math.min(stage.width-40, source.x+(i-1)*75)), source.facing);
    f.y=source.y; f.health=Math.floor(characters[source.characterId].stats.maxHealth*(characters[source.characterId].companionHealth?.ratio??1/3))+(characters[source.characterId].companionHealth?.offset??0);
    if(characters[source.characterId].companionStyle==='basketball')f.companionVariant=i;
    f.lives=1;f.meter=0;f.state="Idle";
    s.clones.push({id:s.nextCloneId++,owner,fighter:f,maxHealth:f.health,...(characters[source.characterId].companionStyle==='basketball'?{kind:'basketball' as const,variant:i,maxHealth:f.health}:{})});
  }
}
/** Tick-derived choices are replayable: no random numbers or wall-clock timers. */
export function cloneInput(s: SimulationSnapshot, clone: HairClone, stage: StageDefinition): number {
  if(clone.kind==='cookie-monster')return cookieMonsterInput(s,clone,stage);
  if(clone.kind==='basketball')return basketballInput(s,clone,stage);
  const f=clone.fighter;
  const target=actors(s).filter(a=>hostile(s,clone.owner,a.fighter,a.owner)&&isActive(a.fighter)&&!isLowProfile(a.fighter,s.frame)).sort((a,b)=>Math.abs(a.fighter.x-f.x)+Math.abs(a.fighter.y-f.y)-Math.abs(b.fighter.x-f.x)-Math.abs(b.fighter.y-f.y))[0]?.fighter;
  if (!target) return 0;
  const dx=target.x-f.x,dy=target.y-f.y;
  let input=Math.abs(dx)>85 ? dx>0?Button.Right:Button.Left : 0;
  if (dy>70 && (grounded(f,stage) || !f.airJumpUsed && f.vy<8) && !(f.previousInput&Button.Up)) input|=Button.Up;
  if (dy < -70 && grounded(f,stage)) {
    const platform=stage.platforms?.find(p=>p.y===f.y&&f.x>=p.x&&f.x<=p.x+p.width);
    if(platform) input=f.x<platform.x+platform.width/2?Button.Left:Button.Right;
  }
  // Alternate presses/release; chain using the same input path as a human fighter.
  if (Math.abs(dx)<150 && Math.abs(dy)<100 && s.frame%12===clone.id%12) {
    const choice=Math.floor(s.frame/96+clone.id)%3;
    input|=dx>=0?Button.Right:Button.Left;
    input|=f.move || choice===0 ? Button.Light : choice===1?Button.Medium:Button.Heavy;
  }
  return input;
}
