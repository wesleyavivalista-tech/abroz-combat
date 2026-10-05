import type { Fighter, MoveDefinition } from "../../../../packages/game-core/types.js";

/** Pose selection uses simulation ticks, so hit-stop and replays stay synchronized. */
export function pixelPose(f: Fighter, move?: MoveDefinition): number {
  if (["KO", "Knockdown", "MatchLose"].includes(f.state)) return 14;
  if (f.state === "MatchWin") return 15;
  if (f.state.includes("HitStun")) return 13;
  if (f.state === "BlockStanding") return 5;
  if (f.state === "BlockCrouching") return 4;
  if (move?.animation === "crouch") {
    if (f.moveFrame < move.startupFrames) return 24;
    if (f.moveFrame < move.startupFrames + move.activeFrames) return 25;
    return f.moveFrame < move.startupFrames + move.activeFrames + Math.ceil(move.recoveryFrames * .6) ? 26 : 24;
  }
  if (move) {
    const rest = move.animation === "air" ? 9 : move.animation === "crouch" ? 4 : 1;
    if (f.moveFrame < move.startupFrames) return rest;
    if (f.moveFrame >= move.startupFrames + move.activeFrames + Math.ceil(move.recoveryFrames * .45)) return rest;
    const poses: Record<string, number> = { light: 6, medium: 7, heavy: 8, kick: 8, air: 10, special: f.characterId === "prototype-b" ? 7 : 12, rising: 11, breaker: 7 };
    return poses[move.animation] ?? 12;
  }
  if (["Crouch", "JumpStartup", "Land", "GetUp"].includes(f.state)) return 4;
  if (["Jump", "Fall"].includes(f.state)) return 9;
  // Dedicated contact / passing frames. Backward walking reverses the step cycle.
  if (f.state === "WalkForward") return 16 + Math.floor(f.stateFrame / 6) % 4;
  if (f.state === "WalkBackward") return [18, 17, 16, 19][Math.floor(f.stateFrame / 8) % 4];
  // A dash lasts 12 simulation ticks: drive forward or hop back and absorb the landing.
  if (f.state === "DashForward") return f.stateFrame < 6 ? 20 : 21;
  if (f.state === "DashBackward") return f.stateFrame < 7 ? 22 : 23;
  return Math.floor(f.stateFrame / 24) % 2;
}
