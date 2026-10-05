import type {Fighter} from '../../../../packages/game-core/types.js';
/** Presentation only: stealth still activates immediately and never blocks input. */
export function lowProfileOpacity(f:Fighter,frame:number):number {
 const remaining=(f.invisibleUntil??0)-frame;
 if(remaining<=0)return 1;
 const elapsed=300-remaining;
 const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
 return elapsed<24?1-smooth(elapsed/24):remaining<18?1-smooth(remaining/18):0;
}
