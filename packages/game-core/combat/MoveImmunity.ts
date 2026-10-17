import {characters} from '../characters/registry.js';
import type {Fighter} from '../types.js';
/** Active-channel immunity ends at its simulation deadline, including during hitstop. */
export function hasMoveImmunity(f:Fighter,frame:number):boolean {
 const move=f.move?characters[f.characterId].moves[f.move]:undefined;
 return !!move?.invulnerableWhileActive&&f.moveFrame>=move.startupFrames&&f.moveFrame<move.startupFrames+move.activeFrames&&(!f.actionUntil||frame<f.actionUntil);
}
