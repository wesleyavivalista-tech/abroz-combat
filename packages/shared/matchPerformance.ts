/** Client-reported diagnostics only: never used to decide gameplay or results. */
export interface MatchPerformance {
 samples:number; elapsedMs:number; fps:number; longFrames:number; longestFrameMs:number;
 pingSamples:number; pingMeanMs:number; pingMaxMs:number; pingJitterMs:number;
 stallCount:number; stalledMs:number; hiddenMs:number; unfocusedMs:number;
 rollbackCount:number; rollbackMaxFrames:number; inputBacklogFrames:number;
}
const bounds:Record<keyof MatchPerformance,number>={samples:10_000_000,elapsedMs:86_400_000,fps:1000,longFrames:10_000_000,longestFrameMs:86_400_000,pingSamples:100000,pingMeanMs:60000,pingMaxMs:60000,pingJitterMs:60000,stallCount:1000000,stalledMs:86_400_000,hiddenMs:86_400_000,unfocusedMs:86_400_000,rollbackCount:10_000_000,rollbackMaxFrames:180,inputBacklogFrames:180};
/** Pick numeric fields only. Ignore extra fields and malformed samples without affecting input. */
export function readMatchPerformance(value:unknown):MatchPerformance|undefined {
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const result={} as MatchPerformance;
 for(const key of Object.keys(bounds) as (keyof MatchPerformance)[]){const n=(value as Record<string,unknown>)[key];if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>bounds[key])return;result[key]=Math.round(n*100)/100;}
 return result;
}
