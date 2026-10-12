import type {Fighter} from '../types.js';
/** Independent snapshot-owned mode: bonuses are additive per hit, never compounded. */
export function angerMultiplier(f:Fighter,frame:number):number {
 return (f.angerUntil??0)>frame ? (120+5*(f.angerStacks??0))/100 : 1;
}
export function receiveAngerHit(f:Fighter,frame:number):void {
 if((f.angerUntil??0)>frame)f.angerStacks=(f.angerStacks??0)+1;
}

/** Damage gains ten percentage points per hit; movement/animation retain their existing scaling. */
export function angerDamageMultiplier(f:Fighter,frame:number):number {
 return (f.angerUntil??0)>frame ? (120+10*(f.angerStacks??0))/100 : 1;
}
