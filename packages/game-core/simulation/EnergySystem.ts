import {trackEnergy} from './MatchStatistics.js';
import type {Fighter,SimulationSnapshot} from '../types.js';
export function energyLocked(f:Fighter,frame:number):boolean{return (f.loanUntil??0)>frame;}
export function gainEnergy(f:Fighter,amount:number,frame:number,s?:SimulationSnapshot):void{const before=f.meter;if(!energyLocked(f,frame))f.meter=Math.min(100,f.meter+Math.max(0,amount));trackEnergy(s,f,f.meter-before,'energyGenerated');}
