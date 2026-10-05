import {GameSimulation,hashState} from '../../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../../packages/game-core/characters/registry.js';
import {Button} from '../../packages/game-core/types.js';
// Use the same snapshot transport on both engines; all simulation snapshot data is JSON.
Object.assign(globalThis,{structuredClone:<T>(value:T):T=>JSON.parse(JSON.stringify(value))});
export function replay():Record<string,string[]>{
 const result:Record<string,string[]>={};
 for(const c of Object.values(characters))for(const move of Object.values(c.moves)){
  const g=new GameSimulation([c.id,'gut'],true);g.state.phase='fight';const [f,d]=g.state.fighters;
  Object.assign(f,{x:700,state:move.state,move:move.id,moveFrame:0,meter:100});Object.assign(d,{x:820,state:'Idle'});
  const trace:string[]=[];
  for(let i=0;i<720;i++){g.step([Button.Special|Button.Up,0]);if(i%30===0)trace.push(hashState(g.state));}
  result[c.id+':'+move.id]=trace;
 }
 // Exercise actual activation/target acquisition as well as raw move states.
 for(const button of [Button.Super1,Button.Super2]){
  const g=new GameSimulation(['jomp','roms','dodo','luizinho','gut','drupa','caio','bozo'],true);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});
  const trace:string[]=[];for(let i=0;i<1200;i++){g.step([i===0?button:0,i%200===0?Button.Special:0,0,0,0,0,0,0]);if(i%30===0)trace.push(hashState(g.state));}result['eight-player:'+button]=trace;
 }
 for(const button of [Button.Special,Button.Special2,Button.Super1,Button.Super2]){
  const g=new GameSimulation(['fausto','napa','dodo','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});const trace:string[]=[];
  for(let i=0;i<1300;i++){g.step([i===0?button:button===Button.Super1&&i>50&&i<200?Button.Medium:0,i===0?Button.Super1:0,i%90===0?Button.Special:0,i%120<60?Button.Left:Button.Right]);if(i%30===0)trace.push(hashState(g.state));}result['fausto-interaction:'+button]=trace;
 }
 for(const button of [Button.Special,Button.Special2,Button.Super1,Button.Super2]){
  const g=new GameSimulation(['astolfo','fausto','napa','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});const trace:string[]=[];
  for(let i=0;i<1400;i++){g.step([i===0?button:button===Button.Special&&i<180?Button.Special|Button.Right:i%100===0?Button.Light:0,i===0?Button.Super2:0,i===0?Button.Super1:0,i%120<60?Button.Left:Button.Right]);if(i%30===0)trace.push(hashState(g.state));}result['astolfo-interaction:'+button]=trace;
 }
 return result;
}
console.log(JSON.stringify(replay()));
