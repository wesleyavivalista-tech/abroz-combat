import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import type {FighterVisual} from './FighterRenderer.js';

/** Keep low attacks low through anticipation and recovery, without changing combat data. */
export function crouchAttackPresentation(f:Fighter):Fighter {
 if(f.state!=='CrouchingAttack'||!f.move||f.stun||f.jopaRide!==undefined)return f;
 const move=characters[f.characterId]?.moves[f.move];
 if(!move||f.moveFrame>=move.startupFrames&&f.moveFrame<move.startupFrames+move.activeFrames+3)return f;
 return {...f,state:'Crouch',stateFrame:0,move:null};
}

/** Outermost adapter so dedicated strike art and normal bodies share the same phases. */
export class CrouchAttackVisual implements FighterVisual {
 constructor(private readonly base:FighterVisual){}
 get root(){return this.base.root;}
 get shadow(){return this.base.shadow;}
 get fallBodies(){return this.base.fallBodies;}
 update(f:Fighter,time:number,simulationFrame?:number):void{this.base.update(crouchAttackPresentation(f),time,simulationFrame);}
 dispose():void{this.base.dispose();}
}
