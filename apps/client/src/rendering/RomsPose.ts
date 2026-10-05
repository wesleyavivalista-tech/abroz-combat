import type {Fighter} from '../../../../packages/game-core/types.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
/** Resolve an action before choosing its outfit, so armor cannot erase an animation. */
export function romsPose(f:Fighter,skin:number){
 const m=f.move?characters.roms.moves[f.move]:undefined;
 const active=!!m&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames;
 const strike=!!m&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames+3;
 const armor=!!f.armorUntil,walk=f.state.startsWith('Walk'),dash=f.state.startsWith('Dash');
 const step=Math.floor(f.stateFrame/7)%4,phase=f.state==='WalkBackward'?(4-step)%4:step;
 const motion=armor?8:6+skin,combat=armor?9:1+skin;
 const result=(sheet:number,pose:number)=>({sheet,pose});
 if(['KO','Knockdown','Respawning'].includes(f.state))return result(combat,13);
 if(f.stun)return result(combat,12);
 if(f.state==='MatchWin')return result(combat,15);
 if(f.move==='water')return result(3,10);
 if(f.move==='spin'&&active)return result(motion,Math.floor((f.moveFrame-m!.startupFrames)/3)%4);
 if(f.weaponUntil&&f.move&&['straight','straight2','straight3','up','bounce'].includes(f.move)&&strike)return result(combat,f.move==='up'?6:7);
 if(f.weaponUntil||f.modeFinaleUntil||f.move==='juggle')return result(motion,8+Math.floor(f.stateFrame/10)%4);
 if(dash)return result(motion,4+Math.min(3,Math.floor(f.stateFrame/3)));
 if(f.move==='toss')return result(combat,f.moveFrame<(m?.startupFrames??0)?4:6);
 if(f.move==='heavy'||f.move==='cleave')return result(combat,strike?5:4);
 if(f.move==='backhand')return result(combat,strike?2:0);
 if(f.move==='chop')return result(combat,strike?1:0);
 if(f.move==='low'||f.state==='Crouch')return result(combat,10);
 if(f.move==='air'||['Jump','Fall','JumpStartup'].includes(f.state))return result(combat,11);
 if(f.returningWeaponOut)return armor?result(combat,7):result(5,skin*5+(walk?phase+1:0));
 if(armor)return walk?result(3,phase):result(combat,0);
 return result(0,skin*5+(walk?phase+1:0));
}

/** Keep crouch guard during windup, show the sweep through contact and early recoil. */
export function romsLowStrike(f:Fighter):boolean{
 const m=characters.roms.moves.low;
 return f.move==='low'&&!f.stun&&f.state==='CrouchingAttack'&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames+3;
}
