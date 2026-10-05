import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {romsPose,romsLowStrike} from '../apps/client/src/rendering/RomsPose.js';
import {romsSheets} from '../apps/client/src/rendering/RomsAtlas.js';
test('armor retains unique action frames instead of a generic chop',()=>{
 const f=createFighter('roms',300,1);f.armorUntil=300;
 const seen=new Set<number>();
 for(const [move,frame] of [['chop',12],['backhand',2],['heavy',25],['toss',16],['low',12],['air',12]] as const){f.move=move;f.moveFrame=frame;const p=romsPose(f,0);assert.equal(p.sheet,9);seen.add(p.pose);}
 assert.equal(seen.size,6);
});
test('spin rotates through four authored poses; dashes use their own frames in all outfits',()=>{
 const f=createFighter('roms',300,1);
 for(const [skin,armor,sheet] of [[0,0,6],[1,0,7],[0,300,8]]){
  f.armorUntil=armor;f.move='spin';
  for(let i=0;i<4;i++){f.moveFrame=15+i*3;assert.deepEqual(romsPose(f,skin),{sheet,pose:i});}
  f.move=null;f.state='DashForward';for(let i=0;i<4;i++){f.stateFrame=i*3;assert.deepEqual(romsPose(f,skin),{sheet,pose:4+i});}
 }
});
test('juggling hand cycles survive armor and ball attacks; every selected cell exists',()=>{
 const f=createFighter('roms',300,1);f.weaponUntil=1260;f.move='straight';f.armorUntil=300;
 for(let i=0;i<4;i++){f.stateFrame=i*10;const p=romsPose(f,0);assert.deepEqual(p,{sheet:8,pose:8+i});assert.equal(romsSheets[p.sheet].frames[p.pose].length,4);}
 f.stun=10;assert.deepEqual(romsPose(f,0),{sheet:9,pose:12});
});

 test('ground strikes stay visible through impact and early recoil, including return swing',()=>{
  for(const skin of [0,1])for(const armor of [0,300]){
   const f=createFighter('roms',300,1);f.armorUntil=armor;
   for(const [move,frame,pose] of [['chop',10,1],['chop',17,1],['backhand',10,2],['heavy',22,5]] as const){
    f.move=move;f.moveFrame=frame;assert.deepEqual(romsPose(f,skin),{sheet:armor?9:skin+1,pose});
   }
   f.weaponUntil=1260;f.move='straight';f.moveFrame=9;
   assert.deepEqual(romsPose(f,skin),{sheet:armor?9:skin+1,pose:7});
   f.move='up';assert.deepEqual(romsPose(f,skin),{sheet:armor?9:skin+1,pose:6});
  }
 });

test('low attack shows a dedicated sweep at contact, while crouch guard and windup remain separate',()=>{
 const f=createFighter('roms',300,1);f.state='Crouch';assert.equal(romsLowStrike(f),false);
 f.state='CrouchingAttack';f.move='low';f.moveFrame=9;assert.equal(romsLowStrike(f),false);
 for(const armor of [0,300]){f.armorUntil=armor;for(const frame of [10,15,18]){f.moveFrame=frame;assert.equal(romsLowStrike(f),true);}}
 f.moveFrame=19;assert.equal(romsLowStrike(f),false);f.moveFrame=10;f.stun=5;assert.equal(romsLowStrike(f),false);
});
