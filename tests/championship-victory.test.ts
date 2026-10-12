import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {championshipArtwork,championshipSummary,championshipVictory} from '../apps/client/src/ui/ChampionshipVictory.js';
import {createChampionship,currentMatches,startBracketMatch,finishBracketMatch,withdrawEntrant} from '../packages/game-core/tournament/Championship.js';
import {characters} from '../packages/game-core/characters/registry.js';
function make(n:number){return createChampionship(Array.from({length:n},(_,id)=>({id,name:id===0?'<Winner>':`Player ${id+1}`,character:Object.keys(characters)[id%16],skin:'original'})));}
function complete(b:ReturnType<typeof make>){while(!b.complete)for(const m of currentMatches(b).filter(m=>m.status==='ready')){startBracketMatch(b,m.id);finishBracketMatch(b,m.id,m.slots[0]);}return b;}
test('all sixteen fighters have shipped championship artwork',()=>{for(const id of Object.keys(characters)){assert.ok(championshipArtwork[id]);assert.ok(existsSync(new URL('../apps/client/public'+championshipArtwork[id],import.meta.url)));}});
test('victory appears only after the whole championship and preserves bracket results',()=>{for(let n=2;n<=16;n++){const b=make(n);assert.equal(championshipVictory(b,false),'');complete(b);const before=JSON.stringify(b),summary=championshipSummary(b),html=championshipVictory(b,true);assert.equal(summary.participants,n);assert.equal(summary.winner?.id,b.champion);assert.ok(html.includes(championshipArtwork[summary.winner!.character]));assert.ok(html.includes('data-action="champion-bracket"'));assert.ok(html.includes('&lt;Winner&gt;'));assert.equal(JSON.stringify(b),before);}});
test('byes and forfeits are distinct from played wins; no champion has no fabricated celebration',()=>{const b=make(3);withdrawEntrant(b,1);complete(b);const info=championshipSummary(b);assert.equal(info.wins+info.byes+info.forfeits,b.rounds.flat().filter(m=>m.winner===b.champion).length);assert.ok(info.byes>0||info.forfeits>0);const empty=make(2);empty.entrants.forEach(e=>e.withdrawn=true);withdrawEntrant(empty,0);assert.equal(empty.champion,null);assert.equal(championshipVictory(empty,false),'');});
