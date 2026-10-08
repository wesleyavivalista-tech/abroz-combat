import {GameSimulation,hashState} from '../../packages/game-core/simulation/GameSimulation.js';
import {characters} from '../../packages/game-core/characters/registry.js';
import {stages} from '../../packages/game-core/stages/registry.js';
import {FINAL_DEATH_FRAMES,ZOMBIE_RISE_FRAMES} from '../../packages/game-core/simulation/UndeadSystem.js';
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
  const g=new GameSimulation(['jomp','roms','dodo','luizinho','gut','drupa','caio','bozo'],false);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});
  const activated=new Set<string>();
  const trace:string[]=[];for(let i=0;i<1200;i++){
   if(['result'].includes(g.state.phase)){g.resetPositions();g.state.phase='fight';}
   g.step([i===0?button:0,i%200===0?Button.Special:0,0,0,0,0,0,0]);
   for(const e of g.gameplayEvents)if(e.type==='AttackStarted')activated.add(`${e.actor}:${e.detail}`);
   if(i%30===0)trace.push(hashState(g.state));
  }
  const expected=characters.jomp.superButtons[button===Button.Super1?0:1];
  if(!activated.has(`0:${expected}`)||!activated.has(`1:${characters.roms.specialButtons[0]}`))throw new Error('Eight-player replay did not exercise both authored attacks');
  result['eight-player:'+button]=trace;
 }
 for(const button of [Button.Special,Button.Special2,Button.Super1,Button.Super2]){
  const g=new GameSimulation(['fausto','napa','dodo','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});const trace:string[]=[];
  for(let i=0;i<1300;i++){g.step([i===0?button:button===Button.Super1&&i>50&&i<200?Button.Medium:0,i===0?Button.Super1:0,i%90===0?Button.Special:0,i%120<60?Button.Left:Button.Right]);if(i%30===0)trace.push(hashState(g.state));}result['fausto-interaction:'+button]=trace;
 }
 for(const button of [Button.Special,Button.Special2,Button.Super1,Button.Super2]){
  const g=new GameSimulation(['astolfo','fausto','napa','gut']);g.state.phase='fight';g.state.fighters.forEach(f=>{f.state='Idle';f.meter=100;});const trace:string[]=[];
  for(let i=0;i<1400;i++){g.step([i===0?button:button===Button.Special&&i<180?Button.Special|Button.Right:i%100===0?Button.Light:0,i===0?Button.Super2:0,i===0?Button.Super1:0,i%120<60?Button.Left:Button.Right]);if(i%30===0)trace.push(hashState(g.state));}result['astolfo-interaction:'+button]=trace;
 }
 // Explicit undead locomotion/contact coverage on static and moving platforms.
 for(const stage of Object.values(stages)){
  const g=new GameSimulation(['nikalz','gut','drupa'],false,stage);g.state.phase='fight';
  g.state.fighters.forEach(f=>f.state='Idle');g.state.fighters[0].lives=1;g.state.fighters[0].health=0;
  for(let i=0;i<=FINAL_DEATH_FRAMES;i++)g.step([0,0,0]);
  g.state.clones[0].fighter.health=0;
  for(let i=0;i<=ZOMBIE_RISE_FRAMES;i++)g.step([0,0,0]);
  const snapshot=g.snapshot(),trace:string[]=[];
  for(let i=0;i<900;i++){
   if(i===450)g.restore(snapshot);
   const z=g.state.clones.find(c=>c.undead)!;
   if(i%90===0)z.fighter.movementSlowUntil=g.state.frame+45;
   g.step([0,i%160<80?Button.Right:Button.Left,i%100<50?Button.Up:0]);
   if(i%30===0)trace.push(hashState(g.state));
  }
  result['undead:'+stage.id]=trace;
 }
 return result;
}
console.log(JSON.stringify(replay()));
