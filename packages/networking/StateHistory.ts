import type { SimulationSnapshot } from "../game-core/types.js";
/** Frame-tagged ring: constant-time storage, including rollback overwrites and gaps. */
export class StateHistory {
  private states: ({frame:number;snapshot:SimulationSnapshot}|undefined)[];
  private newest=-1;
  constructor(private capacity = 180) {
    if(!Number.isInteger(capacity)||capacity<0)throw new Error('Invalid history capacity');
    this.states=new Array(capacity+1);
  }
  set(frame: number, snapshot: SimulationSnapshot): void {
    if(frame<this.newest-this.capacity)return;
    this.newest=Math.max(this.newest,frame);
    this.states[frame%(this.capacity+1)]={frame,snapshot};
  }
  get(frame: number): SimulationSnapshot | undefined {
    if(frame<this.newest-this.capacity)return;
    const entry=this.states[frame%(this.capacity+1)];
    return entry?.frame===frame?entry.snapshot:undefined;
  }
}
