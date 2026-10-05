import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {lightBeam,beamHitsFighter,beamIntersects} from '../packages/game-core/simulation/LightBeamSystem.js';
import {hurtbox} from '../packages/game-core/combat/CollisionSystem.js';
test('water covers the low stance without expanding upper-body or other beam hitboxes',()=>{
 const f=createFighter('gut',100,1);
 const ray={x:0,y:10,dx:1,dy:0,length:45,width:10,water:true};
 assert.equal(beamIntersects(ray,hurtbox(f)),false);
 assert.equal(beamHitsFighter(ray,f),true);
 assert.equal(beamHitsFighter({...ray,y:100},f),false);
 assert.equal(beamHitsFighter({...ray,water:false},f),false);
 assert.equal(beamHitsFighter({...ray,dy:0,y:-30},f),false);
});
test('downward water stops at the floor and cannot hit a target beyond its visible end',()=>{
 const f=createFighter('roms',300,1);f.move='water';f.moveFrame=31;f.beamAim=-60;
 const ray=lightBeam(f,2400)!;
 assert.ok(Math.abs(ray.y+ray.dy*ray.length)<0.001);
 const far=createFighter('gut',700,1);assert.equal(beamHitsFighter(ray,far),false);
});
