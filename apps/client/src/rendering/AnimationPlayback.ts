import type { Fighter } from '../../../../packages/game-core/types.js';

type Tick = 'stateFrame' | 'moveFrame';
const displayTicks = new WeakMap<Fighter, Partial<Record<Tick, number>>>();

/** Fractional clocks belong only to disposable display copies, never snapshots. */
export function setDisplayTicks(f: Fighter, ticks: Partial<Record<Tick, number>>): void {
  displayTicks.set(f, ticks);
}

/** For continuous cosmetic motion only. Pose selection keeps the integer tick. */
export function animationTick(f: Fighter, tick: Tick = 'stateFrame'): number {
  return displayTicks.get(f)?.[tick] ?? f[tick];
}

export interface FrameTiming {
  frames: number;
  ticksPerFrame: number;
  loop: boolean;
  /** Optional authored holds, in simulation ticks, one duration per frame. */
  frameDurations?: readonly number[];
}

export function validateFrameTiming(clip: FrameTiming): void {
  if (!Number.isInteger(clip.frames) || clip.frames < 1 || !Number.isFinite(clip.ticksPerFrame) || clip.ticksPerFrame <= 0)
    throw new Error('Invalid animation frame timing');
  if (clip.frameDurations && (clip.frameDurations.length !== clip.frames || clip.frameDurations.some(n => !Number.isFinite(n) || n <= 0)))
    throw new Error('Animation holds must contain one positive duration per frame');
}

/** Exact boundaries, no duplicated frames, blending or changes to combat clocks. */
export function playbackFrame(tick: number, clip: FrameTiming): number {
  const elapsed = Math.max(0, Number.isFinite(tick) ? tick : 0);
  if (!clip.frameDurations) {
    const frame = Math.floor(elapsed / clip.ticksPerFrame);
    return clip.loop ? frame % clip.frames : Math.min(frame, clip.frames - 1);
  }
  const total = clip.frameDurations.reduce((sum, duration) => sum + duration, 0);
  let remaining = clip.loop ? elapsed % total : Math.min(elapsed, total);
  for (let i = 0; i < clip.frames - 1; i++) {
    if (remaining < clip.frameDurations[i]) return i;
    remaining -= clip.frameDurations[i];
  }
  return clip.frames - 1;
}
