import {
  GameSimulation,
  hashState,
} from "../game-core/simulation/GameSimulation.js";
import { StateHistory } from "./StateHistory.js";
export class RollbackManager {
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
  desync = "OK";
  constructor(
    public simulation: GameSimulation,
    public seat: number,
    public inputDelay = 2,
    public maxRollbackFrames = 8,
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
  schedule(mask: number, send: (frame: number, mask: number) => void): void {
    if (this.desync !== "OK") return;
    const frame = this.simulation.state.frame + this.inputDelay;
    if (!this.local.has(frame)) {
      this.local.set(frame, mask);
      send(frame, mask);
      this.updateConfirmed();
    }
  }
  receive(frame: number, mask: number, seat = 1 - this.seat): void {
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
      const snapshot = this.history.get(frame);
      if (!snapshot) {
        this.desync = "Missing rollback snapshot";
        return;
      }
      this.simulation.restore(snapshot);
      this.rollbackCount++;
      this.rollbackFrames = current - frame;
      while (this.simulation.state.frame < current) this.advance();
      this.simulation.clearPresentationEvents();
    }
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
    for (const map of [this.local, ...this.remotes, ...this.usedBySeat])
      for (const f of map.keys()) if (f < frame - 180) map.delete(f);
  }
  isHashFrameRetained(frame:number):boolean{return Number.isInteger(frame)&&frame>=Math.max(0,this.simulation.state.frame-180)&&frame<=this.simulation.state.frame+this.inputDelay+this.maxRollbackFrames;}
  confirmedHash(frame: number): string | undefined {
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
