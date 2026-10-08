import {encodeSnapshot,decodeSnapshot,type RecoveryState} from '../../../packages/shared/recovery.js';
import {stepMetrics} from './capacityMetrics.js';
import {GameSimulation,hashState} from '../../../packages/game-core/simulation/GameSimulation.js';
/** Settled input-only verification. Never predicts or accepts client state/hash claims. */
export class VerifiedMatch {
 private inputs:Map<number,number>[];
 private departures=new Map<number,number>();
 constructor(readonly simulation:GameSimulation,private checksum:(frame:number,hash:string)=>void){
  this.inputs=simulation.state.fighters.map(()=>new Map());
  simulation.step(simulation.state.fighters.map(()=>0));
  simulation.step(simulation.state.fighters.map(()=>0));
 }
 recovery(nextInput:number){return {snapshot:encodeSnapshot(this.simulation.snapshot()),inputs:this.inputs.map(q=>[...q]),departures:[...this.departures],nextInput};}
 restoreRecovery(state:RecoveryState):void{this.simulation.restore(decodeSnapshot(state.snapshot));this.inputs=state.inputs.map(q=>new Map(q));this.departures=new Map(state.departures);}
 receive(seat:number,frame:number,mask:number):void{this.inputs[seat].set(frame,mask);this.advance();}
 leave(seat:number,frame:number):void{this.departures.set(seat,frame);this.advance();}
 private advance():void{
  const s=this.simulation;
  while(this.inputs.every((q,i)=>q.has(s.state.frame)||s.state.frame>=(this.departures.get(i)??Infinity))){
   // With no connected participants there is no stream to pace this simulation.
   if(this.departures.size===this.inputs.length)return;
   const frame=s.state.frame;
   const stepStart=performance.now();
   s.step(this.inputs.map((q,i)=>frame>=(this.departures.get(i)??Infinity)?0:q.get(frame)!),
    [...this.departures].filter(([,due])=>due===frame).map(([seat])=>seat));
   stepMetrics.observe(performance.now()-stepStart);
   this.inputs.forEach(q=>q.delete(frame));
   if(s.state.frame%60===0)this.checksum(s.state.frame,hashState(s.state));
  }
 }
}
