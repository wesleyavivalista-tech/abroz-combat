import type {Fighter,SimulationSnapshot} from '../types.js';
import type {DamageSource} from '../combat/GameplayEvents.js';
export interface FighterStatistics {
 damageDealt:number;damageTaken:number;eliminations:number;kos:number;hits:number;highestCombo:number;
 energySpent:number;energyGenerated:number;specials:number;ultimates:number;aliveFrames:number;deaths:number;summonDamage:number;healing:number;
 eliminatedAt:number|null;disconnected:boolean;
}
export interface MatchStatistics {
 players:FighterStatistics[];elapsedFrames:number;finalized:boolean;winner:number;
 lethalOwners:(number|null)[];comboOwners:(number|null)[];comboCounts:number[];
}
export function newMatchStatistics(count:number):MatchStatistics{return {players:Array.from({length:count},()=>({damageDealt:0,damageTaken:0,eliminations:0,kos:0,hits:0,highestCombo:0,energySpent:0,energyGenerated:0,specials:0,ultimates:0,aliveFrames:0,deaths:0,summonDamage:0,healing:0,eliminatedAt:null,disconnected:false})),elapsedFrames:0,finalized:false,winner:-1,lethalOwners:Array(count).fill(null),comboOwners:Array(count).fill(null),comboCounts:Array(count).fill(0)};}
function row(s:SimulationSnapshot,f:Fighter){return !s.statistics?.finalized?s.statistics?.players[s.fighters.indexOf(f)]:undefined;}
/** Actual HP removed from player fighters only; overkill, scenery, neutral NPCs and friendly fire earn no credit. */
export function trackDamage(s:SimulationSnapshot,f:Fighter,actual:number,source:DamageSource,beforeCombo:number,comboHit:boolean):void{
 const stats=s.statistics,target=s.fighters.indexOf(f);if(!stats||stats.finalized||target<0||actual<=0)return;
 const owner=source.neutral?-1:source.source??-1,valid=owner>=0&&owner<s.fighters.length&&owner!==target&&s.teams[owner]!==s.teams[target];
 if(owner>=0&&!valid)return;
 stats.players[target].damageTaken+=actual;
 if(f.health===0)stats.lethalOwners[target]=valid?owner:null;
 if(!valid){if(comboHit){stats.comboOwners[target]=null;stats.comboCounts[target]=0;}return;}
 const a=stats.players[owner];a.damageDealt+=actual;if(source.owned)a.summonDamage+=actual;
 // Periodic status ticks and blocked chip are damage, not landed strikes.
 if(!source.blocked&&!source.move?.startsWith('@'))a.hits++;
 if(comboHit&&!source.blocked){const count=beforeCombo>0&&stats.comboOwners[target]===owner?stats.comboCounts[target]+1:1;stats.comboOwners[target]=owner;stats.comboCounts[target]=count;a.highestCombo=Math.max(a.highestCombo,count);}
}
export function trackKnockout(s:SimulationSnapshot,seat:number):void{
 const stats=s.statistics;if(!stats||stats.finalized)return;const r=stats.players[seat],f=s.fighters[seat];
 if(!r.disconnected)r.deaths++;
 if(!f.lives)r.eliminatedAt=stats.elapsedFrames;
 const owner=stats.lethalOwners[seat];if(!r.disconnected&&owner!==null){stats.players[owner].kos++;if(!f.lives)stats.players[owner].eliminations++;}
 stats.lethalOwners[seat]=null;stats.comboOwners[seat]=null;stats.comboCounts[seat]=0;
}
export function trackEnergy(s:SimulationSnapshot|undefined,f:Fighter,amount:number,kind:'energySpent'|'energyGenerated'):void{if(!s||amount<=0)return;const r=row(s,f);if(r)r[kind]=Math.round((r[kind]+amount)*1e6)/1e6;}
export function spendEnergy(s:SimulationSnapshot,f:Fighter,amount:number,round=false):void{const before=f.meter;f.meter=Math.max(0,round?Math.round((f.meter-amount)*100)/100:f.meter-amount);trackEnergy(s,f,before-f.meter,'energySpent');}
export function healTo(s:SimulationSnapshot,f:Fighter,health:number):void{const before=f.health;f.health=health;const r=row(s,f);if(r)r.healing+=Math.max(0,health-before);}
export function trackActivation(s:SimulationSnapshot,f:Fighter,kind:'specials'|'ultimates'):void{const r=row(s,f);if(r)r[kind]++;}
export function beginStatisticsFrame(s:SimulationSnapshot,forfeits:number[]):void{
 const stats=s.statistics;if(!stats||stats.finalized)return;
 for(const seat of forfeits){const r=stats.players[seat];if(r&&!r.disconnected){r.disconnected=true;r.eliminatedAt=stats.elapsedFrames;stats.lethalOwners[seat]=null;}}
 if(s.phase!=='fight')return;stats.elapsedFrames++;
 s.fighters.forEach((f,i)=>{if(f.lives>0&&f.health>0&&f.respawnAt===0)stats.players[i].aliveFrames++;});
}
export function finishStatistics(s:SimulationSnapshot):void{if(s.statistics&&!s.statistics.finalized&&s.phase==='result'&&(!s.tournament||s.tournament.complete)&&(!s.elimination||s.elimination.complete)){s.statistics.finalized=true;s.statistics.winner=s.winner;}}
export const STAT_AWARDS=['mvp','damage','executioner','energy','combo','shield','survivor','summoner','healing','aggression'] as const;
export type StatAward=typeof STAT_AWARDS[number];
export function performanceScore(p:FighterStatistics):number{return p.eliminations*300+p.kos*100+p.damageDealt*.1+Math.min(20,p.highestCombo)*5;}
export function awardMetric(p:FighterStatistics,award:StatAward):number{return ({mvp:performanceScore(p),damage:p.damageDealt,executioner:p.eliminations,energy:p.energySpent,combo:p.highestCombo,shield:p.damageTaken,survivor:p.aliveFrames,summoner:p.summonDamage,healing:p.healing,aggression:p.hits+p.specials+p.ultimates})[award];}
/** Equal leaders share awards; empty categories have no recipient. */
export function statisticsAwards(stats:MatchStatistics):StatAward[][]{const result:StatAward[][]=stats.players.map(()=>[]);for(const award of STAT_AWARDS){const best=Math.max(...stats.players.map(p=>awardMetric(p,award)));if(best>0)stats.players.forEach((p,i)=>{if(awardMetric(p,award)===best)result[i].push(award);});}return result;}
/** Simultaneous elimination is a tied placement; seat order only stabilizes display. */
export function statisticsPlacements(stats:MatchStatistics):number[]{return stats.players.map((p,i)=>i===stats.winner?1:1+stats.players.filter((q,j)=>j!==i&&(j===stats.winner||(q.eliminatedAt??Infinity)>(p.eliminatedAt??Infinity))).length);}
