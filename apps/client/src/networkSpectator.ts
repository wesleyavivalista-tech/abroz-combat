import {decodeSnapshot,type RecoveryState} from '../../../packages/shared/recovery.js';
import type {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
/** Read-only playback: step only complete authoritative inputs, never predict or send. */
export class SpectatorPlayback {
 private inputs:Map<number,number>[];
 needsRefresh=false;
 constructor(readonly simulation:GameSimulation,state:RecoveryState){simulation.restore(decodeSnapshot(state.snapshot));this.inputs=state.inputs.map(q=>new Map(q));}
 receive(seat:number,frame:number,mask:number){
  if(frame<this.simulation.state.frame||!this.inputs[seat])return;
  if(frame>this.simulation.state.frame+720){this.needsRefresh=true;return;}
  this.inputs[seat].set(frame,mask);
 }
 tick():boolean{
  const frame=this.simulation.state.frame;if(!this.inputs.every(q=>q.has(frame)))return false;
  this.simulation.step(this.inputs.map(q=>q.get(frame)!));this.inputs.forEach(q=>q.delete(frame));return true;
 }
}
