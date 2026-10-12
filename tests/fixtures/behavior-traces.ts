import {GameSimulation} from '../../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../../packages/game-core/characters/registry.js';
import {Button} from '../../packages/game-core/types.js';
/** Normalize planned field renames and observational statistics provenance, never gameplay values or ordering. */
export function behaviorHash(value:unknown):string{
 const text=JSON.stringify(value,(key,item)=>['statistics','burnOwned','burnNeutral','poisonOwned','poisonNeutral','owned'].includes(key)?undefined:item).replaceAll('romsAxeOut','returningWeaponOut').replaceAll('romsFinaleUntil','modeFinaleUntil').replaceAll('romsActionUntil','actionUntil').replaceAll('romsKind','trajectory');
 let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);
}
export function behaviorTraces():Record<string,string[]>{
 const traces:Record<string,string[]>={};
 for(const c of Object.values(characters))for(const m of Object.values(c.moves)){
  const g=new GameSimulation([c.id,'gut'],true),[f,d]=g.state.fighters;
  f.x=700;d.x=820;f.move=m.id;f.moveFrame=0;f.state=m.state;f.meter=100;
  const checks:string[]=[];
  for(let i=0;i<1801;i++){
   if(i===91)g.state.hitstop=8;
   const input=i%120<20?Button.Right:i%120>100?Button.Left:0;
   g.step([input,0]);if([0,29,179,599,1800].includes(i))checks.push(behaviorHash(g.snapshot()));
  }
  traces[c.id+':'+m.id]=checks;
 }
 return traces;
}
