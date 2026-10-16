import {ONLINE_INPUT_DELAY,ONLINE_ROLLBACK_FRAMES} from '../shared/networkTiming.js';
import {decodeSnapshot,type RecoveryState} from '../shared/recovery.js';
import {
  GameSimulation,
  hashState,
} from "../game-core/simulation/GameSimulation.js";
import { StateHistory } from "./StateHistory.js";
import type {GameplayEvent} from '../game-core/combat/GameplayEvents.js';
export class RollbackManager {
  // Presentation-only history is overwritten during replay, never hashed or sent.
  private impacts=new Map<number,GameplayEvent[]>();
  private deliveredImpactFrame=-1;
  drainConfirmedImpacts():GameplayEvent[]{
    this.flushPending();
    const settled=Math.min(this.confirmed,this.simulation.state.frame-1),events:GameplayEvent[]=[];
    for(const [frame,impacts] of this.impacts){
      if(frame<=settled){if(frame>this.deliveredImpactFrame)events.push(...impacts);this.impacts.delete(frame);}
    }
    this.deliveredImpactFrame=Math.max(this.deliveredImpactFrame,settled);
    return events;
  }
  history = new StateHistory();
  departures = new Map<number, number>();
  local = new Map<number, number>();
  remotes: Map<number, number>[];
  usedBySeat: Map<number, number>[];
  // Two-player accessors retained for existing callers and diagnostics.
  get remote(): Map<number, number> {
    return this.remotes[this.seat === 0 ? 1 : 0];
  }
  get used(): Map<number, number> {
    return this.usedBySeat[this.seat === 0 ? 1 : 0];
  }
  rollbackCount = 0;
  rollbackFrames = 0;
  remoteFrame = -1;
  confirmed = -1;
  stalled = false;
  /** The first non-bootstrap input is sent only after that client finishes loading.
   * Keep the countdown at frame zero until every remaining peer has reached it.
   * This is a client presentation gate; normal rollback prediction stays unchanged.
   */
  get waitingForPeers(): boolean {
    return this.simulation.state.frame === 0 && this.remotes.some((remote, seat) =>
      seat !== this.seat && !this.departures.has(seat) && !remote.has(this.inputDelay),
    );
  }
  desync = "OK";
  constructor(
    public simulation: GameSimulation,
    public seat: number,
    public inputDelay = ONLINE_INPUT_DELAY,
    // Absorb brief relay jitter up to 200 ms without adding local input delay.
    public maxRollbackFrames = ONLINE_ROLLBACK_FRAMES,
  ) {
    const count = simulation.state.fighters.length;
    if (!Number.isInteger(seat) || seat < 0 || seat >= count)
      throw new Error("Invalid player seat");
    this.remotes = Array.from({ length: count }, () => new Map());
    this.usedBySeat = Array.from({ length: count }, () => new Map());
    for (let f = 0; f < inputDelay; f++) {
      this.local.set(f, 0);
      this.remotes.forEach((remote) => remote.set(f, 0));
    }
    this.remoteFrame = this.confirmed = inputDelay - 1;
  }
  private pendingRollback?:number;
  /** Apply a burst of late inputs with one replay before the next render/tick. */
  flushPending():void {
    const frame=this.pendingRollback;this.pendingRollback=undefined;
    if(frame===undefined||this.desync!=="OK")return;
    const current=this.simulation.state.frame,snapshot=this.history.get(frame);
    if(!snapshot){this.desync="Missing rollback snapshot";return;}
    this.simulation.restore(snapshot);this.rollbackCount++;this.rollbackFrames=current-frame;
    while(this.simulation.state.frame<current)this.advance();
    this.simulation.clearPresentationEvents();
  }
  private resumeNextInput?:number;
  restoreRecovery(state:RecoveryState):void {
    this.pendingRollback=undefined;
    this.simulation.restore(decodeSnapshot(state.snapshot));
    this.history=new StateHistory();this.local.clear();this.remotes.forEach(q=>q.clear());this.usedBySeat.forEach(q=>q.clear());
    state.inputs.forEach((q,i)=>{for(const [frame,mask] of q)(i===this.seat?this.local:this.remotes[i]).set(frame,mask);});
    this.departures=new Map(state.departures);this.confirmed=this.simulation.state.frame-1;this.remoteFrame=this.confirmed;
    this.impacts.clear();this.deliveredImpactFrame=this.confirmed;this.desync='OK';this.stalled=false;this.resumeNextInput=state.nextInput;
    this.updateConfirmed();
  }
  schedule(mask: number, send: (frame: number, mask: number) => void): void {
    this.flushPending();
    if (this.desync !== "OK") return;
    const frame = this.simulation.state.frame + this.inputDelay;
    if(this.resumeNextInput!==undefined){
      while(this.resumeNextInput<=frame){const next=this.resumeNextInput++;if(!this.local.has(next)){this.local.set(next,mask);send(next,mask);}}
      this.updateConfirmed();return;
    }
    if (!this.local.has(frame)) {
      this.local.set(frame, mask);
      send(frame, mask);
      this.updateConfirmed();
    }
  }
  receive(frame: number, mask: number, seat = 1 - this.seat, deferReplay=false): void {
    if (this.desync !== "OK") return;
    if (
      seat === this.seat ||
      !this.remotes[seat] ||
      frame >= (this.departures.get(seat) ?? Infinity)
    )
      return;
    if (frame < this.simulation.state.frame - 180) {
      this.desync = "Input outside history";
      return;
    }
    this.remotes[seat].set(frame, mask);
    this.remoteFrame = Math.max(this.remoteFrame, frame);
    this.updateConfirmed();
    const current = this.simulation.state.frame;
    if (frame < current && this.usedBySeat[seat].get(frame) !== mask) {
      this.pendingRollback=Math.min(this.pendingRollback??frame,frame);
    }
    if(!deferReplay)this.flushPending();
  }
  private updateConfirmed(): void {
    while (
      this.confirmed < this.simulation.state.frame + this.inputDelay &&
      this.remotes.every(
        (remote, i) =>
          i === this.seat ||
          remote.has(this.confirmed + 1) ||
          this.confirmed + 1 >= (this.departures.get(i) ?? Infinity),
      )
    )
      this.confirmed++;
  }
  disconnect(seat: number, frame: number): void {
    this.flushPending();
    if (this.desync !== "OK") return;
    if (seat === this.seat || !this.remotes[seat] || this.departures.has(seat))
      return;
    this.departures.set(seat, frame);
    const current = this.simulation.state.frame;
    if (frame < current) {
      const snapshot = this.history.get(frame);
      if (!snapshot) {
        this.desync = "Missing disconnect snapshot";
        return;
      }
      this.simulation.restore(snapshot);
      this.rollbackCount++;
      this.rollbackFrames = current - frame;
      while (this.simulation.state.frame < current) this.advance();
      this.simulation.clearPresentationEvents();
    }
    this.updateConfirmed();
  }
  prediction(frame: number, seat = 1 - this.seat): number {
    if (frame >= (this.departures.get(seat) ?? Infinity)) return 0;
    for (let f = frame; f >= Math.max(0, frame - 180); f--)
      if (this.remotes[seat].has(f)) return this.remotes[seat].get(f)!;
    return 0;
  }
  tick(): boolean {
    this.flushPending();
    if (this.desync !== "OK") return false;
    this.stalled =
      this.simulation.state.frame > this.confirmed + this.maxRollbackFrames;
    if (this.stalled) return false;
    this.advance();
    return true;
  }
  private advance(): void {
    const frame = this.simulation.state.frame;
    this.history.set(frame, this.simulation.snapshot());
    const inputs = this.remotes.map((remote, seat) => {
      if (seat === this.seat) return this.local.get(frame) ?? 0;
      const mask =
        frame >= (this.departures.get(seat) ?? Infinity)
          ? 0
          : (remote.get(frame) ?? this.prediction(frame, seat));
      this.usedBySeat[seat].set(frame, mask);
      return mask;
    });
    this.simulation.step(
      inputs,
      [...this.departures]
        .filter(([, due]) => due === frame)
        .map(([seat]) => seat),
    );
    this.impacts.set(frame,this.simulation.gameplayEvents.filter(e=>e.type==='DamageApplied'));
    for(const key of this.impacts.keys())if(key<frame-180)this.impacts.delete(key);
    for (const map of [this.local, ...this.remotes, ...this.usedBySeat])
      for (const f of map.keys()) if (f < frame - 180) map.delete(f);
  }
  isHashFrameRetained(frame:number):boolean{return Number.isInteger(frame)&&frame>=Math.max(0,this.simulation.state.frame-180)&&frame<=this.simulation.state.frame+this.inputDelay+this.maxRollbackFrames;}
  confirmedHash(frame: number): string | undefined {
    this.flushPending();
    const state = this.history.get(frame);
    return frame <= this.confirmed + 1 && state ? hashState(state) : undefined;
  }
  /** Compare only settled history. An unrecoverable failure is terminal for this match. */
  verifyRemoteHash(frame: number, hash: string): boolean | undefined {
    if (this.desync !== "OK") return false;
    const local = this.confirmedHash(frame);
    if (local === undefined) return undefined;
    if (local !== hash) {
      this.desync = `MISMATCH @ ${frame}`;
      return false;
    }
    return true;
  }
}
