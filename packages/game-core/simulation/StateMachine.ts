import type { Fighter, FighterState } from "../types.js";
export function enter(f: Fighter, state: FighterState): void {
  if (f.state !== state) {
    f.state = state;
    f.stateFrame = 0;
  }
}
export function locked(f: Fighter): boolean {
  return (
    f.stun > 0 ||
    [
      "Knockdown",
      "GetUp",
      "JumpStartup",
      "Land",
      "KO",
      "MatchWin",
      "MatchLose",
    ].includes(f.state)
  );
}
export function isCounterState(f: Fighter): boolean {
  return f.move !== null;
}

/** Additional entry restrictions are opt-in; existing shared movement locks still apply. */
export function allowsMove(f:Fighter,m:import('../types.js').MoveDefinition):boolean{
 return !m.allowedStates||m.allowedStates.includes(f.state);
}
