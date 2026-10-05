import {Button,type Fighter} from '../types.js';
import {characters} from '../characters/registry.js';
import {locked} from './StateMachine.js';
/** Direction comes from deliberate input, never opponent position or knockback. */
export function updateMovementFacing(f:Fighter,input:number,frame:number):void{
 if(locked(f)||f.state==='AirHitStun'||f.state==='Grappling'||f.state==='Grappled'||f.trappedUntil>frame||f.grappleUntil>0||f.lives<=0||f.respawnAt>0)return;
 if((f.state==='DashForward'||f.state==='DashBackward')&&f.stateFrame<12)return;
 const move=f.move?characters[f.characterId].moves[f.move]:undefined;
 if(move&&!move.mobile&&!move.holdInvisible)return;
 const horizontal=(input&Button.Right?1:0)-(input&Button.Left?1:0);
 if(horizontal)f.facing=horizontal as 1|-1;
}
