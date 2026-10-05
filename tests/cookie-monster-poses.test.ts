import test from 'node:test';
import assert from 'node:assert/strict';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {cookieMonsterPose} from '../apps/client/src/rendering/NapaRenderer.js';
test('Cookie Monster uses distinct rise/apex/descent/landing art and preserves attacks',()=>{
 const f=createFighter('napa',1000,1);f.cookieBoss=true;
 f.state='JumpStartup';assert.deepEqual(cookieMonsterPose(f),[1,1]);
 f.state='Jump';f.vy=14;f.stateFrame=5;assert.deepEqual(cookieMonsterPose(f),[1,2]);
 f.vy=2;assert.deepEqual(cookieMonsterPose(f),[1,3]);
 f.state='Fall';assert.deepEqual(cookieMonsterPose(f),[1,4]);
 f.state='Land';assert.deepEqual(cookieMonsterPose(f),[1,5]);
 f.state='Idle';assert.deepEqual(cookieMonsterPose(f),[0,0]);
 f.state='Fall';f.move='bossSlam';f.moveFrame=49;assert.deepEqual(cookieMonsterPose(f),[0,5]);
 f.move='bossChomp';assert.deepEqual(cookieMonsterPose(f),[0,6]);
 f.move='bossBarrage';assert.deepEqual(cookieMonsterPose(f),[0,4]);
});
