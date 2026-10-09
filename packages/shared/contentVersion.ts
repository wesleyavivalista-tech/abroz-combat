import {stages} from '../game-core/stages/registry.js';
import {SIMULATION_REVISION} from './simulationRevision.js';
import {characters} from '../game-core/characters/registry.js';
import {PROTOCOL_VERSION} from './protocol.js';
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined&&typeof v!=='function').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
export function contentVersion():string{
 // Definition data only; renderer assets do not affect simulation compatibility.
 const definitions=Object.values(characters).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(c=>Object.fromEntries(Object.entries(c).filter(([k])=>!['assets','animations','sounds','effects','states','description','color','displayName'].includes(k))));
 const stageData=Object.values(stages).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(({id,width,floorHeight,platforms,eideLovePlatforms,eideLoveOffsets})=>({id,width,floorHeight,platforms,eideLovePlatforms,eideLoveOffsets}));
 const text=canonical({definitions,stages:stageData,revision:SIMULATION_REVISION});let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return `${PROTOCOL_VERSION}-${(hash>>>0).toString(16)}`;
}
export class VersionMismatchError extends Error {
 readonly code='VERSION_MISMATCH';
 readonly expected=contentVersion();
 constructor(readonly received?:string){super('Game versions differ. Refresh the game before joining a room.');}
}
export function assertCompatibleContent(version:unknown):void{
 if(version!==contentVersion())throw new VersionMismatchError(typeof version==='string'?version.slice(0,80):undefined);
}
