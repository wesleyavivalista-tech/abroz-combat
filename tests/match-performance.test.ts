import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MatchPerformanceTracker} from '../apps/client/src/matchPerformance.js';
import {readMatchPerformance} from '../packages/shared/matchPerformance.js';
test('match performance separates frame delays, focus, stalls and ping without touching simulation',()=>{
 const t=new MatchPerformanceTracker();assert.equal(t.snapshot(),undefined);t.begin();
 t.observe(0,false,false,false,0,0,0);t.observe(20,true,false,false,1,5,3);
 t.visibility(30,true,true);t.visibility(130,false,false);
 t.observe(140,false,false,false,2,8,1);t.observe(160,false,false,false,2,8,0);
 t.ping(10);t.ping(30);t.ping(NaN);
 const s=t.snapshot()!;assert.equal(s.samples,3);assert.equal(s.elapsedMs,160);assert.equal(s.longFrames,1);assert.equal(s.longestFrameMs,120);assert.equal(s.hiddenMs,100);assert.equal(s.unfocusedMs,100);assert.equal(s.stalledMs,120);assert.equal(s.stallCount,1);assert.equal(s.pingMeanMs,20);assert.equal(s.pingJitterMs,20);assert.equal(s.pingMaxMs,30);assert.equal(s.rollbackMaxFrames,8);
 s.samples=999;assert.equal(t.snapshot()!.samples,3);
 for(let i=0;i<10;i++)t.begin();assert.equal(t.recent.length,3);assert.equal(t.snapshot()!.samples,0);
});
test('network diagnostic payload accepts only bounded numbers and cannot carry private text',()=>{
 const t=new MatchPerformanceTracker();t.begin();const valid=t.snapshot()!;
 assert.deepEqual(readMatchPerformance({...valid,password:'secret',roomCode:'ABCDE'}),valid);
 for(const value of [null,[],{}, {...valid,fps:Infinity},{...valid,fps:-1},{...valid,pingMaxMs:60001},{...valid,elapsedMs:'secret'}])assert.equal(readMatchPerformance(value),undefined);
});
