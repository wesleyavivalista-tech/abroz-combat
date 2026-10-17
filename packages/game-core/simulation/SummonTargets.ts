import type {Fighter,SimulationSnapshot,Structure} from '../types.js';
import {actors,hostile} from './Actors.js';
import {isActive,isInvulnerable} from './LifeSystem.js';

export type SummonTarget = {x:number;y:number;fighter:Fighter;structure?:never}|{x:number;y:number;structure:Structure;fighter?:never};
/** Stable actor/structure order breaks equal-distance ties identically during rollback.
 * Aim at the nearest part of a structure, not its inaccessible center behind a wall.
 */
export function summonTargets(s:SimulationSnapshot,owner:number,source:{x:number;y:number}):SummonTarget[]{
 const targets:SummonTarget[]=actors(s).filter(a=>hostile(s,owner,a.fighter,a.owner)&&isActive(a.fighter)&&!isInvulnerable(a.fighter,s.frame)&&(a.fighter.invisibleUntil??0)<=s.frame).map(a=>({x:a.fighter.x,y:a.fighter.y,fighter:a.fighter}));
 for(const b of s.structures??[]){
  if(b.phase!=='built'||b.health<=0||s.teams[b.owner]===s.teams[owner])continue;
  const left=b.x-b.width/2,right=b.x+b.width/2;
  const x=b.kind==='house'&&source.x>left&&source.x<right&&source.y<b.y+b.height?(source.x-b.x<=0?left:right):Math.max(left,Math.min(right,source.x));
  targets.push({structure:b,x,y:Math.max(b.y,Math.min(b.y+b.height-1,source.y))});
 }
 return targets;
}
export function nearestSummonTarget(s:SimulationSnapshot,owner:number,source:{x:number;y:number}):SummonTarget|undefined{
 return summonTargets(s,owner,source).sort((a,b)=>Math.abs(a.x-source.x)+Math.abs(a.y-source.y)-Math.abs(b.x-source.x)-Math.abs(b.y-source.y))[0];
}
