import {stages} from './registry.js';
/** Choose once at match creation; online clients receive the authority's choice. */
export function randomArena(previous?:string, random:()=>number=Math.random):string {
 const ids=Object.keys(stages).filter(id=>id!==previous);
 const pool=ids.length?ids:Object.keys(stages);
 return pool[Math.floor(random()*pool.length)];
}

/** Only formats containing multiple fights choose a new arena automatically. */
export const usesRandomArenas=(mode:string)=>["championship","ffa-tournament","elimination","elimination-party"].includes(mode);
