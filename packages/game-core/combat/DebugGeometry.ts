import {FINANCE} from '../simulation/FinanceSystem.js';
import {isLowProfile} from '../simulation/DodoSystem.js';
import {structureSurfaces} from '../simulation/StructureSystem.js';
import type {Box,SimulationSnapshot,StageDefinition} from '../types.js';
import {characters} from '../characters/registry.js';
import {targetBoxes,hitboxes,sweptBox} from './CollisionSystem.js';
import {actors} from '../simulation/Actors.js';
import {isActive} from '../simulation/LifeSystem.js';
import {lightBeam} from '../simulation/LightBeamSystem.js';
import {floodHeight} from '../simulation/BloodSystem.js';
export interface DebugShape extends Box{kind:'hurt'|'hit'|'push'|'beam'|'projectile'|'area'|'grab';angle?:number;}
/** Uses the same specs and geometry helpers as simulation; no character-specific guesses. */
export function debugGeometry(s:SimulationSnapshot,stage:StageDefinition):DebugShape[]{
 const shapes:DebugShape[]=[];
 const all=actors(s),rays=all.map(a=>lightBeam(a.fighter,stage.width,stage.floorHeight)).filter(r=>r!==null);
 for(const {fighter:f} of all){
  if(!isActive(f)||isLowProfile(f,s.frame))continue;
  for(const b of targetBoxes(f,'move'))shapes.push({...b,kind:'hurt'});
  if(rays.some(r=>r.water))for(const b of targetBoxes(f,'lower-stance').slice(1))shapes.push({...b,kind:'hurt'});
  shapes.push({x:f.x-32,y:f.y,w:64,h:125,kind:'push'});
  const m=f.move?characters[f.characterId].moves[f.move]:undefined;
  for(const b of hitboxes(f,m))shapes.push({...b,kind:m?.grappleFrames?'grab':'hit'});
  if(m?.periodicMelee&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames){
   const b=m.periodicMelee;shapes.push({x:f.x-b.rangeX,y:f.y-b.rangeY,w:b.rangeX*2,h:b.rangeY*2,kind:'area'});
  }
 }
 for(const r of rays)shapes.push({x:r.x+r.dx*r.length/2-r.length/2,y:r.y+r.dy*r.length/2-r.width/2,w:r.length,h:r.width,angle:Math.atan2(r.dy,r.dx),kind:'beam'});
 for(const p of s.projectiles){
  if(!p.active||isLowProfile(s.fighters[p.owner],s.frame))continue;
  const def=characters[s.fighters[p.owner].characterId],spec=p.trajectory?def.returningPaths?.[p.trajectory]:undefined;
  const r=spec?.radius??def.moves[p.move].projectile?.radius??22;
  shapes.push({...sweptBox(p.trajectory?p.x-p.vx:p.x,p.trajectory?p.y-(p.vy??0):p.y,p.x,p.y,r),kind:'projectile'});
 }
 for(const h of s.hazards){
  if(h.kind==='coin-rain'){shapes.push({x:h.x-FINANCE.rainWidth/2,y:h.y,w:FINANCE.rainWidth,h:600,kind:'area'});continue;}
  if(h.kind==='money-bill'){shapes.push({x:h.x-40,y:h.y-170,w:80,h:185,kind:'area'});continue;}
  const m=characters[s.fighters[h.owner].characterId].moves[h.move];
  const w=h.width??(h.kind?.endsWith('trail')?48:(m?.hazard?.radius??24)*2);
  const flood=h.kind==='blood-flood',radiusY=h.kind?18:55,contactWidth=flood?w:w+50;
  shapes.push({x:h.x-contactWidth/2,y:flood?h.y:h.y-radiusY,w:contactWidth,h:flood?floodHeight(h,s.frame):radiusY*2,kind:'area'});
 }
 shapes.push({x:0,y:stage.floorHeight-2,w:stage.width,h:4,kind:'push'});
 for(const p of stage.platforms??[])shapes.push({x:p.x,y:p.y-2,w:p.width,h:4,kind:'push'});
 for(const b of s.structures??[])if(b.phase==='built')for(const surface of structureSurfaces(b))shapes.push({...surface,kind:'push'});
 return shapes;
}
