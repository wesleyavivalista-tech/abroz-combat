import {animationTick} from './AnimationPlayback.js';
import type { Fighter, MoveDefinition } from '../../../../packages/game-core/types.js';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** Authored wind-up → strike → recoil → guard, without changing combat timing. */
export function attackPhase(frame: number, move: MoveDefinition): 'windup' | 'strike' | 'recoil' | 'guard' {
  if (frame < Math.max(1, move.startupFrames - 2)) return 'windup';
  const recovery = frame - move.startupFrames - move.activeFrames;
  if (recovery < Math.min(3, move.recoveryFrames * .2)) return 'strike';
  if (recovery < move.recoveryFrames * .78) return 'recoil';
  return 'guard';
}

/** Small rigid weight shifts, never scale changes. Driven solely by simulation ticks. */
export function actionMotion(f: Fighter, move?: MoveDefinition): {x: number; angle: number} {
  if (move && !move.channelHeal && !move.extraLife && !move.auraFrames && !move.armorFrames && !move.weaponFrames && !move.summonClones) {
    const frame = animationTick(f, 'moveFrame'), impact = move.startupFrames;
    const force = Math.min(1, move.startupFrames / 22);
    let weight: number;
    if (frame < impact - 2) weight = -.35 * Math.sin(clamp(frame / Math.max(1, impact - 2)) * Math.PI);
    else if (frame < impact) weight = ease((frame - impact + 2) / 2);
    else if (frame < impact + move.activeFrames) weight = 1;
    else weight = 1 - ease((frame - impact - move.activeFrames) / Math.max(1, move.recoveryFrames));
    return {x: weight * (.025 + force * .035), angle: -weight * .012};
  }
  if (f.state.startsWith('Dash')) {
    const weight = Math.sin(clamp(animationTick(f) / 12) * Math.PI);
    return {x: 0, angle: (f.state === 'DashBackward' ? 1 : -1) * weight * .035};
  }
  if (f.state.startsWith('Walk')) {
    const period = f.characterId === 'tocha' ? (f.state === 'WalkBackward' ? 36 : 30)
      : f.characterId === 'bozo' ? (f.state === 'WalkBackward' ? 36 : 30)
      : (f.state === 'WalkBackward' ? 42 : 36);
    // Transfer weight between planted feet without bobbing or resizing the figure.
    return {x: Math.sin(animationTick(f) / period * Math.PI * 2) * .012, angle: 0};
  }
  if (f.state.includes('HitStun')) {
    const recoil = Math.exp(-animationTick(f) / 5) * Math.sin(animationTick(f) * .65);
    return {x: -.025 * recoil, angle: .025 * recoil};
  }
  return {x: 0, angle: 0};
}
