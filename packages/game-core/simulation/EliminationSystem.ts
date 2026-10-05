import {clearCombatEntities} from './CombatLifecycle.js';
import type {SimulationSnapshot} from '../types.js';
export type EliminationMode='elimination'|'elimination-party';
export type EliminationStage='save'|'teams'|'first-out'|'final';
export interface EliminationState {
 mode:EliminationMode;remaining:number[];active:number[];saved:number[];eliminated:number[];withdrawn:number[];
 round:number;fight:number;stage:EliminationStage;seed:number;complete:boolean;champion:number;message:string;scored:boolean;
 next?:{active:number[];stage:EliminationStage;newRound:boolean};
}
export const ELIMINATION_BREAK_FRAMES=360;
export function eliminationFormat(t:EliminationState):string{return t.stage==='teams'?`${t.active.length/2}v${t.active.length/2}`:t.stage==='first-out'?'FIRST OUT':t.stage==='final'?'FINAL 1v1':t.active.length===2?'1v1 · LOSER OUT':'FREE-FOR-ALL · WINNER SAFE';}
function stageFor(t:EliminationState):EliminationStage {
 const n=t.remaining.length;return n===2?'final':t.mode==='elimination-party'&&[6,4].includes(n)?'teams':t.mode==='elimination-party'&&n===5?'first-out':'save';
}
function finish(s:SimulationSnapshot,champion:number,message:string){clearCombatEntities(s);const t=s.elimination!;t.complete=true;t.champion=champion;t.message=message;s.winner=champion;s.teamMatch=false;s.teams=s.fighters.map((_,i)=>i);s.phase='result';s.phaseFrame=0;s.endedAt=s.frame;}
function configure(s:SimulationSnapshot,reset:()=>void){
 const t=s.elimination!;s.teams=s.fighters.map((_,i)=>i+2);s.teamMatch=t.stage==='teams';
 if(s.teamMatch){
  const shuffled=[...t.active];
  for(let i=shuffled.length-1;i>0;i--){t.seed=(Math.imul(t.seed,1664525)+1013904223)>>>0;const j=t.seed%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  shuffled.forEach((seat,i)=>s.teams[seat]=i<shuffled.length/2?0:1);
 }
 reset();
 s.fighters.forEach((f,i)=>{if(!t.active.includes(i)){f.lives=0;f.health=0;f.state='KO';f.respawnAt=0;}});
 s.phase='intro';s.phaseFrame=0;s.winner=-1;s.endedAt=0;t.scored=false;
}
export function initializeElimination(s:SimulationSnapshot,mode:EliminationMode,seed:number,reset:()=>void){
 if(s.training||s.teamMatch||mode==='elimination-party'&&s.fighters.length!==6)throw new Error('Elimination Party requires exactly 6 players; elimination requires free-for-all');
 const seats=s.fighters.map((_,i)=>i);
 s.elimination={mode,remaining:[...seats],active:[...seats],saved:[],eliminated:[],withdrawn:[],round:1,fight:1,stage:'save',seed:seed>>>0,complete:false,champion:-1,message:'',scored:false};
 s.elimination.stage=stageFor(s.elimination);configure(s,reset);
}
function queueRound(s:SimulationSnapshot){const t=s.elimination!;t.next={active:[...t.remaining],stage:stageFor(t),newRound:true};}
function remove(s:SimulationSnapshot,seat:number){const t=s.elimination!;t.remaining=t.remaining.filter(i=>i!==seat);t.saved=t.saved.filter(i=>i!==seat);if(!t.eliminated.includes(seat))t.eliminated.push(seat);}
export function advanceElimination(s:SimulationSnapshot,forfeits:number[],reset:()=>void){
 const t=s.elimination;if(!t||t.complete)return;
 const left=forfeits.filter(i=>t.remaining.includes(i));
 if(left.length){
  for(const seat of left){remove(s,seat);t.withdrawn.push(seat);}
  if(t.remaining.length<=1){finish(s,t.remaining[0]??-1,'Competition ended by forfeit');return;}
  clearCombatEntities(s);
  t.message=left.map(i=>`P${i+1}`).join(', ')+' withdrew · remaining players advance';t.scored=true;queueRound(s);s.phase='result';s.phaseFrame=0;s.endedAt=s.frame;
 }
 if(s.phase==='result'&&s.phaseFrame>=ELIMINATION_BREAK_FRAMES&&t.next){
  const next=t.next;delete t.next;t.active=next.active;t.stage=next.stage;t.fight++;
  if(next.newRound){t.round++;t.saved=[];}
  configure(s,reset);
 }
}
export function scoreElimination(s:SimulationSnapshot){
 const t=s.elimination;if(!t||t.complete||t.scored)return;
 const out=t.active.filter(i=>s.fighters[i].lives===0);
 if(t.stage==='first-out'&&out.length){
  if(out.length===1){remove(s,out[0]);t.message=`P${out[0]+1} is first out and eliminated`;queueRound(s);}
  else{t.saved=t.remaining.filter(i=>!out.includes(i));t.next={active:out,stage:'save',newRound:false};t.message='Simultaneous elimination · tied players fight to decide who leaves';}
  s.phase='result';s.phaseFrame=0;s.endedAt=s.frame;s.winner=-1;
 }else if(s.phase==='result'){
  if(s.winner<0){t.message='Draw · replay this fight';t.next={active:[...t.active],stage:t.stage,newRound:false};}
  else if(t.stage==='final'){remove(s,t.active.find(i=>i!==s.winner)!);finish(s,s.winner,`P${s.winner+1} wins the competition`);return;}
  else if(t.stage==='teams'){
   const winners=t.active.filter(i=>s.teams[i]===s.teams[s.winner]);t.saved.push(...winners);
   t.next={active:t.active.filter(i=>!winners.includes(i)),stage:'save',newRound:false};t.message=winners.map(i=>`P${i+1}`).join(', ')+' are safe · losing team fights for survival';
  }else{
   t.saved.push(s.winner);const rest=t.active.filter(i=>i!==s.winner);
   if(rest.length===1){remove(s,rest[0]);t.message=`P${s.winner+1} is safe · P${rest[0]+1} is eliminated`;queueRound(s);}
   else{t.message=`P${s.winner+1} is safe and sits out the next fight`;t.next={active:rest,stage:'save',newRound:false};}
  }
 }else return;
 t.scored=true;
 // End a first-out fight immediately, including projectiles and persistent effects.
 clearCombatEntities(s);
 s.fighters.forEach(f=>{f.move=null;f.respawnAt=0;f.vx=f.vy=0;});
}
