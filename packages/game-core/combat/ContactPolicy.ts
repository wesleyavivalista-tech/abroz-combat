import type {Fighter} from '../types.js';
import {isActive,isInvulnerable} from '../simulation/LifeSystem.js';
/** Direct hits share recovery protection. Ongoing statuses retain their own rules. */
export function canReceiveDirectHit(f:Fighter,frame:number):boolean{
 return isActive(f)&&!isInvulnerable(f,frame)&&!['Knockdown','GetUp','KO'].includes(f.state);
}
