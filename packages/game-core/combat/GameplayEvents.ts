import {characters} from '../characters/registry.js';
import type {Fighter,SimulationSnapshot} from '../types.js';
export type GameplayEventType='ObjectImpact'|'MoveActive'|'GroundImpact'|'AttackStarted'|'AttackEnded'|'StateChanged'|'DamageApplied'|'ProjectileSpawned'|'ProjectileDestroyed'|'MatchPhaseChanged';
export interface DamageSource {source?:number;move?:string;blocked?:boolean;x?:number;}
export interface GameplayEvent extends DamageSource {id:string;frame:number;type:GameplayEventType;actor:number;detail:string;amount?:number;}
// Observation only: the journal is never read by simulation rules or included in snapshots.
const journals=new WeakMap<SimulationSnapshot,GameplayEvent[]>();
export function clearGameplayEvents(s:SimulationSnapshot):void{journals.set(s,[]);}
export function gameplayEvents(s:SimulationSnapshot):readonly GameplayEvent[]{return journals.get(s)??[];}
export function recordGameplayEvent(s:SimulationSnapshot,type:GameplayEventType,actor:number,detail:string,amount?:number,source:DamageSource={}):void{
 const events=journals.get(s);if(!events)return;
 events.push({...source,id:`${s.frame}:${actor}:${events.length}`,frame:s.frame,type,actor,detail,...(amount===undefined?{}:{amount})});
}
export function recordDamage(s:SimulationSnapshot,f:Fighter,amount:number,source:DamageSource={}):void{
 const actor=s.fighters.indexOf(f),clone=actor<0?s.clones.find(c=>c.fighter===f):undefined;
 recordGameplayEvent(s,'DamageApplied',clone?.owner??actor,clone?`summon ${clone.id}`:f.move??f.state,amount,source);
}
export function observeFrame(s:SimulationSnapshot){
 const fighters=s.fighters.map(f=>({state:f.state,move:f.move,serial:f.attackSerial,moveFrame:f.moveFrame})),phase=s.phase;
 const companions=new Map(s.clones.map(c=>[c.id,{move:c.fighter.move,serial:c.fighter.attackSerial,moveFrame:c.fighter.moveFrame}]));
 const projectiles=s.projectiles.map(p=>p.active?`${p.owner}:${p.serial}:${p.move}`:null);
 return ()=>{
  s.fighters.forEach((f,i)=>{
   const before=fighters[i];
   if(f.move){const m=characters[f.characterId].moves[f.move];if(f.moveFrame>=m.startupFrames&&(before.move!==f.move||before.moveFrame<m.startupFrames))recordGameplayEvent(s,'MoveActive',i,f.move,undefined,{x:f.x});}
   if(before.state!==f.state)recordGameplayEvent(s,'StateChanged',i,`${before.state} → ${f.state}`);
   if(before.move!==f.move||before.serial!==f.attackSerial){
    if(before.move)recordGameplayEvent(s,'AttackEnded',i,before.move);
    if(f.move)recordGameplayEvent(s,'AttackStarted',i,f.move);
   }
  });
  for(const c of s.clones){const before=companions.get(c.id),f=c.fighter;if(f.move){const m=characters[f.characterId].moves[f.move];if(f.moveFrame>=m.startupFrames&&(!before||before.move!==f.move||before.moveFrame<m.startupFrames))recordGameplayEvent(s,'MoveActive',c.owner,f.move,undefined,{x:f.x});}if(f.move&&(before?.move!==f.move||before?.serial!==f.attackSerial))recordGameplayEvent(s,'AttackStarted',c.owner,f.move);}
  s.projectiles.forEach((p,i)=>{
   const after=p.active?`${p.owner}:${p.serial}:${p.move}`:null;
   if(after!==projectiles[i]){
    if(projectiles[i])recordGameplayEvent(s,'ProjectileDestroyed',Number(projectiles[i]!.split(':')[0]),projectiles[i]!);
    if(after)recordGameplayEvent(s,'ProjectileSpawned',p.owner,after);
   }
  });
  if(phase!==s.phase)recordGameplayEvent(s,'MatchPhaseChanged',-1,`${phase} → ${s.phase}`);
 };
}
