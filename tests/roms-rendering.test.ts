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
   for(const [move,frame,pose] of [['chop',10,1],['chop',15,1],['backhand',10,2],['heavy',22,5]] as const){
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


test('hose has sixteen distinct aiming frames and wraps seamlessly in either direction',async()=>{
 const {hosePose,hoseFrame,hoseOrigin,hoseVisualOrigin,HOSE_CELL}=await import('../packages/game-core/simulation/HoseAim.js');
 const seen=new Set<string>();
 for(let i=0;i<16;i++){
  const angle=i*22.5,frame=hoseFrame(angle);seen.add(`${frame.sheet}:${frame.cell}`);
  assert.equal(hosePose(angle),i);assert.equal(hosePose(angle-360),i);assert.equal(hosePose(angle+360),i);
  assert.equal(frame.sheet,i%2);assert.equal(frame.cell,Math.floor(i/2));
  const origin=hoseVisualOrigin(angle);assert.ok(Number.isFinite(origin.x)&&Number.isFinite(origin.y));
  assert.ok(frame.baseline>Math.floor(frame.cell/4)*HOSE_CELL);
 }
 // Intermediate artwork must not move the existing collision ray.
 assert.deepEqual(hoseOrigin(-60),hoseOrigin(-45));
 assert.notDeepEqual(hoseVisualOrigin(-60),hoseVisualOrigin(-45));
 assert.equal(seen.size,16);assert.equal(hosePose(359),0);assert.equal(hosePose(-1),0);
});
