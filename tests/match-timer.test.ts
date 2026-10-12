import test from 'node:test';
import assert from 'node:assert/strict';
import {matchTimer} from '../apps/client/src/ui/MatchTimer.js';
test('elapsed match clock warns exactly at the invasion threshold and resets with rounds',()=>{
 const s={phase:'fight' as const,phaseFrame:10799,training:false};
 assert.deepEqual(matchTimer(s),{text:'2:59',danger:false,hidden:false});
 assert.deepEqual(matchTimer({...s,phaseFrame:10800}),{text:'3:00',danger:true,hidden:false});
 assert.equal(matchTimer({...s,phaseFrame:360000}).text,'100:00');
 assert.deepEqual(matchTimer({...s,phase:'intro'}),{text:'0:00',danger:false,hidden:false});
 assert.equal(matchTimer({...s,phase:'result'}).hidden,true);
 assert.equal(matchTimer({...s,phaseFrame:12000,training:true}).danger,false);
});
