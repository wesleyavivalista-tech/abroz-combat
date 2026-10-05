import type { SimulationSnapshot } from "../game-core/types.js";
export class StateHistory {
  private states = new Map<number, SimulationSnapshot>();
  constructor(private capacity = 180) {}
  set(frame: number, snapshot: SimulationSnapshot): void {
    this.states.set(frame, snapshot);
    for (const key of this.states.keys())
      if (key < frame - this.capacity) this.states.delete(key);
  }
  get(frame: number): SimulationSnapshot | undefined {
    return this.states.get(frame);
  }
}
