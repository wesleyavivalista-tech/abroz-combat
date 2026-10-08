import type {SimulationSnapshot} from '../game-core/types.js';
/** Preserve non-finite sentinels in snapshots; ordinary JSON silently makes them null. */
export function encodeSnapshot(snapshot:SimulationSnapshot):string{
 return JSON.stringify(snapshot,(_key,value)=>typeof value==='number'&&!Number.isFinite(value)?{$abrozNumber:String(value)}:value);
}
export function decodeSnapshot(value:string):SimulationSnapshot{
 if(typeof value!=='string'||value.length>8*1024*1024)throw Error('Invalid recovery snapshot');
 const state=JSON.parse(value,(_key,value)=>value&&typeof value==='object'&&Object.keys(value).length===1&&'$abrozNumber'in value?value.$abrozNumber==='Infinity'?Infinity:value.$abrozNumber==='-Infinity'?-Infinity:value.$abrozNumber==='NaN'?NaN:value:value);
 if(!state||!Number.isSafeInteger(state.frame)||state.frame<0||!Array.isArray(state.fighters)||state.fighters.length<2||state.fighters.length>16)throw Error('Invalid recovery snapshot');
 return state;
}
export interface RecoveryState {
 snapshot:string;
 inputs:[number,number][][];
 departures:[number,number][];
 nextInput:number;
}
