import type {Fighter} from '../types.js';
export function energyLocked(f:Fighter,frame:number):boolean{return (f.loanUntil??0)>frame;}
export function gainEnergy(f:Fighter,amount:number,frame:number):void{if(!energyLocked(f,frame))f.meter=Math.min(100,f.meter+Math.max(0,amount));}
