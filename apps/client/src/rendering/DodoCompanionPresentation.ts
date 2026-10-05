import type {Fighter} from '../../../../packages/game-core/types.js';
/** Variant order matches the summon system and the numbers on the approved uniforms. */
export const dodoCompanions=[
 {number:77,atlas:'companion-gut-v3-0',walk:'companion-walk-v6-0'},
 {number:23,atlas:'companion-gut-v3-1',walk:'companion-walk-v6-1'},
 {number:11,atlas:'companion-gut-v5-2',walk:'companion-walk-v6-2'},
] as const;

/** Authored takeoff, rise, apex, descent and landing; attacks retain priority. */
export function companionJumpPose(f:Fighter):number|null{
 if(f.move)return null;
 if(f.state==='JumpStartup')return 1;
 if(f.state==='Jump')return f.vy>4||f.stateFrame<3?2:3;
 if(f.state==='Fall')return 4;
 if(f.state==='Land')return f.stateFrame<5?5:0;
 return null;
}
