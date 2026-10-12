import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
import {applyDamage} from '../packages/game-core/combat/DamageSystem.js';
import {resolveKnockouts,advanceRespawns} from '../packages/game-core/simulation/LifeSystem.js';
import {gainEnergy} from '../packages/game-core/simulation/EnergySystem.js';
import {newMatchStatistics,spendEnergy,healTo,finishStatistics,statisticsAwards,statisticsPlacements} from '../packages/game-core/simulation/MatchStatistics.js';
import {Button} from '../packages/game-core/types.js';
import {spawnInvader} from '../packages/game-core/simulation/InvasionSystem.js';
import {matchStatisticsScreen} from '../apps/client/src/ui/MatchStatistics.js';
function game(n=2){const g=new GameSimulation(Array(n).fill('nikalz'));g.state.phase='fight';return g;}
test('actual damage, overkill, chip, DOT, owned entities and neutral NPCs are distinguished',()=>{
 const g=game(4),s=g.state,[a,b,c]=s.fighters;b.health=80;
 applyDamage(s,b,20,{source:0,move:'jab',combo:'hit'});applyDamage(s,b,10,{source:0,move:'jab',blocked:true});applyDamage(s,b,100,{source:0,move:'@poison',owned:true});
 const p=s.statistics!.players;assert.equal(p[0].damageDealt,80);assert.equal(p[0].hits,1);assert.equal(p[0].summonDamage,50);assert.equal(p[1].damageTaken,80);
 applyDamage(s,b,100,{source:2,move:'jab'});resolveKnockouts(s,false);assert.equal(p[0].kos,1);assert.equal(p[2].kos,0);assert.equal(p[0].eliminations,0);assert.equal(p[1].deaths,1);
 applyDamage(s,c,25,{source:0,neutral:true,move:'zombie'});assert.equal(p[0].damageDealt,80);assert.equal(p[2].damageTaken,25);
 const npc=spawnInvader(s,g.stage,'pt-normal');applyDamage(s,npc.fighter,100,{source:0});assert.equal(p[0].damageDealt,80);
 s.teams[2]=s.teams[0];applyDamage(s,c,25,{source:0});assert.equal(p[0].damageDealt,80);assert.equal(p[2].damageTaken,25);assert.ok(a.health>0);
});
test('multi-life attribution persists across respawn; final blow counts once, then freezes',()=>{
 const g=game(),s=g.state,d=s.fighters[1];d.lives=2;
 applyDamage(s,d,99999,{source:0,move:'bees',owned:true});resolveKnockouts(s,false);s.frame=d.respawnAt;advanceRespawns(s);assert.equal(s.statistics!.players[1].healing,0);
 applyDamage(s,d,99999,{source:0,move:'jab'});resolveKnockouts(s,false);finishStatistics(s);
 assert.equal(s.statistics!.players[0].kos,2);assert.equal(s.statistics!.players[0].eliminations,1);assert.equal(s.statistics!.players[1].deaths,2);
 const before=structuredClone(s.statistics);g.step([0,0]);assert.deepEqual(s.statistics,before);
});
test('energy measures actual spending/gains even within one tick; healing excludes overheal',()=>{
 const g=game(),s=g.state,f=s.fighters[0];f.meter=95;gainEnergy(f,20,0,s);spendEnergy(s,f,30);gainEnergy(f,20,0,s);assert.equal(s.statistics!.players[0].energyGenerated,25);assert.equal(s.statistics!.players[0].energySpent,30);
 f.loanUntil=10;gainEnergy(f,20,1,s);assert.equal(s.statistics!.players[0].energyGenerated,25);f.health=1390;healTo(s,f,1400);healTo(s,f,1400);assert.equal(s.statistics!.players[0].healing,10);
});
test('successful ability activation only, no button-hold duplicates; rollback restores counters',()=>{
 const g=game(),s=g.state;s.fighters[0].meter=100;const before=g.snapshot();
 for(let i=0;i<20;i++)g.step([Button.Special,0]);assert.equal(g.state.statistics!.players[0].specials,1);
 const after=g.snapshot();g.restore(before);for(let i=0;i<20;i++)g.step([Button.Special,0]);assert.equal(hashState(g.state),hashState(after));
 const fresh=new GameSimulation(['nikalz','nikalz']);assert.equal(fresh.state.statistics!.players[0].specials,0);
});
test('combo credit is same-attacker, survival excludes respawn/intro, forfeit gives no free KO',()=>{
 const g=game(3),s=g.state,f=s.fighters[1];
 applyDamage(s,f,1,{source:0,combo:'hit'});applyDamage(s,f,1,{source:0,combo:'hit'});applyDamage(s,f,1,{source:2,combo:'hit'});assert.equal(s.statistics!.players[0].highestCombo,2);assert.equal(s.statistics!.players[2].highestCombo,1);applyDamage(s,f,1,{source:0,neutral:true,combo:'hit'});applyDamage(s,f,1,{source:2,combo:'hit'});assert.equal(s.statistics!.players[2].highestCombo,1);
 f.respawnAt=100;g.step([0,0,0]);assert.equal(s.statistics!.players[1].aliveFrames,0);assert.equal(s.statistics!.players[0].aliveFrames,1);
 g.step([0,0,0],[1]);assert.equal(s.statistics!.players[1].disconnected,true);assert.equal(s.statistics!.players[2].kos,0);
});
test('award ties and zero denominators are deterministic; all eight fighters remain visible',()=>{
 const g=game(8),stats=newMatchStatistics(8);stats.finalized=true;stats.winner=0;stats.players.forEach((p,i)=>{p.eliminatedAt=i===0?null:120;p.aliveFrames=120;});stats.players[0].damageDealt=stats.players[1].damageDealt=100;
 const awards=statisticsAwards(stats);assert.ok(awards[0].includes('damage')&&awards[1].includes('damage'));assert.ok(awards.every(a=>a.includes('survivor')));assert.deepEqual(statisticsPlacements(stats),[1,2,2,2,2,2,2,2]);
 for(const tab of ['overview','combat','abilities','awards'] as const){const html=matchStatisticsScreen(g.state,stats,false,tab,0);assert.equal((html.match(/data-action="statistics-player"/g)??[]).length,8);assert.ok(!html.includes('NaN'));if(tab==='combat')assert.ok(html.includes('∞'));}
});
