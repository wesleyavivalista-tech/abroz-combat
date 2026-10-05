import {characters} from '../characters/registry.js';
import {BASIC_MELEE,basicMeleeTier} from './BasicMelee.js';
import type { Box, Fighter, MoveDefinition } from "../types.js";
export function intersects(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export function worldBox(f: Fighter, b: Box): Box {
  return {
    x: f.x + (f.facing === 1 ? b.x : -b.x - b.w),
    y: f.y + b.y,
    w: b.w,
    h: b.h,
  };
}
export function hurtbox(f: Fighter): Box {
  if(f.jopaSummon){const w=f.jopaSummon==='tree'?160:f.jopaSummon==='knight'?140:55;return {x:f.x-w/2,y:f.y,w,h:f.jopaSummon==='tree'?340:f.jopaSummon==='knight'?300:140};}
  const scale=f.cookieBoss?1.8:f.weaponUntil?characters[f.characterId].weaponModifiers?.bodyScale??1:1;
  return {
    x: f.x - 31*scale,
    y: f.y,
    w: 62*scale,
    h: (f.state === "Crouch" || f.state.includes("Crouching") ? 84 : 154)*scale,
  };
}
export function hitboxes(f: Fighter, m: MoveDefinition | undefined): Box[] {
  return m &&
    f.moveFrame >= m.startupFrames &&
    f.moveFrame < m.startupFrames + m.activeFrames
    ? m.hitboxes.map((b) => {
      const tier=basicMeleeTier(f,m);
      if(tier===null)return worldBox(f,b);
      const x=Math.max(0,b.x),end=Math.max(x,(b.x+b.w)*BASIC_MELEE.reach[Math.min(tier,2)]);
      return worldBox(f,{x,y:b.y-BASIC_MELEE.verticalTolerance,w:end-x,h:b.h+2*BASIC_MELEE.verticalTolerance});
    })
    : [];
}
export function pushApart(a: Fighter, b: Fighter, width: number): void {
  if([a,b].some(f=>f.loveNpc||f.jopaSummon||f.jopaRide!==undefined||f.jopaTree!==undefined))return;
  if([a,b].some(f=>f.move&&characters[f.characterId].moves[f.move].arenaRoll))return;
  if ([a.state,b.state].some(s=>s==="Grappled"||s==="Grappling"))return;
  if (Math.abs(a.y - b.y) > 125) return;
  const distance = Math.abs(a.x - b.x);
  const separation=32.5*((a.cookieBoss?1.8:1)+(b.cookieBoss?1.8:1));
  if (distance >= separation) return;
  const sign = a.x <= b.x ? 1 : -1;
  const overlap = separation - distance;
  if (a.state === "HairTrapped" && b.state === "HairTrapped") return;
  if (a.state === "HairTrapped") b.x += sign * overlap;
  else if (b.state === "HairTrapped") a.x -= sign * overlap;
  else { a.x -= sign * Math.ceil(overlap / 2); b.x += sign * Math.floor(overlap / 2); }
  if (a.x < 40) {
    b.x += 40 - a.x;
    a.x = 40;
  }
  if (b.x < 40) {
    a.x += 40 - b.x;
    b.x = 40;
  }
  if (a.x > width - 40) {
    b.x -= a.x - (width - 40);
    a.x = width - 40;
  }
  if (b.x > width - 40) {
    a.x -= b.x - (width - 40);
    b.x = width - 40;
  }
}
export function scaledDamage(
  base: number,
  combo: number,
  counter: boolean,
): number {
  if (base <= 0) return 0;
  return Math.max(
    1,
    Math.floor(
      (base * Math.max(30, 100 - combo * 12) * (counter ? 120 : 100)) / 10000,
    ),
  );
}

export function targetBoxes(f:Fighter,profile:'body'|'move'|'lower-stance'='body'):Box[]{
 const body=hurtbox(f);
 if(profile==='move'){
  const m=f.move?characters[f.characterId].moves[f.move]:undefined;
  return m?.hurtboxes?.map(b=>worldBox(f,b))??[body];
 }
 if(profile==='lower-stance'){const targets=targetBoxes(f,'move');return targets.length?[...targets,{x:f.x-body.w*1.1,y:f.y,w:body.w*2.2,h:body.h*.38}]:[];}
 return [body];
}
export function sweptBox(x:number,y:number,nextX:number,nextY:number,r:number):Box{
 return {x:Math.min(x,nextX)-r,y:Math.min(y,nextY)-r,w:Math.abs(nextX-x)+r*2,h:Math.abs(nextY-y)+r*2};
}

/** Swept square projectile versus a target rectangle; excludes corner-only broad-phase hits. */
export function sweptIntersects(box:Box,x:number,y:number,nextX:number,nextY:number,r:number):boolean{
 return sweepEntry(box,x,y,nextX,nextY,r)<Infinity;
}

/** Earliest swept contact, for ordering structures and fighters along one trajectory. */
export function sweepEntry(box:Box,x:number,y:number,nextX:number,nextY:number,r:number):number{
 let near=0,far=1;
 for(const [origin,delta,lo,hi] of [[x,nextX-x,box.x-r,box.x+box.w+r],[y,nextY-y,box.y-r,box.y+box.h+r]]){
  if(delta===0){if(origin<=lo||origin>=hi)return Infinity;continue;}
  const a=(lo-origin)/delta,b=(hi-origin)/delta;
  near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>=far)return Infinity;
 }
 return near<far?near:Infinity;
}
