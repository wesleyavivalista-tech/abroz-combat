import {characters} from '../packages/game-core/characters/registry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {usesDedicatedAirAttack,usesDedicatedCrouchAttack} from '../apps/client/src/rendering/AirAttackVisual.js';
import {faustoPose} from '../apps/client/src/rendering/FaustoRenderer.js';
import {romsPose} from '../apps/client/src/rendering/RomsPose.js';
test('dedicated air artwork excludes grounded attacks and interruptions',()=>{
 for(const [id,move] of [['nikalz','air'],['drupa','air'],['caio','air'],['gut','spearAir'],['biel','stamp']]){
  const f=createFighter(id,500,1);f.state='AirAttack';f.move=move;f.y=100;
  if(id==='gut')f.weaponUntil=1000;
  if(id==='drupa')f.moveFrame=characters.drupa.moves.air.startupFrames;
  assert.equal(usesDedicatedAirAttack(id,f),true,id);
  f.stun=5;assert.equal(usesDedicatedAirAttack(id,f),false,id+' hit reaction');f.stun=0;
  f.jopaRide=0;assert.equal(usesDedicatedAirAttack(id,f),false,id+' mounted');delete f.jopaRide;
  f.move='jab';assert.equal(usesDedicatedAirAttack(id,f),false,id+' grounded basic');
 }
});
test('loan stamp uses airborne art above the floor but retains ground stamp',()=>{
 const f=createFighter('biel',500,1);f.move='stamp';f.state='LightAttack';f.stampAttempts=4;
 f.y=0;assert.equal(usesDedicatedAirAttack('biel',f),false);
 f.y=100;assert.equal(usesDedicatedAirAttack('biel',f),true);
});
test('armored Roms and both samurai variants retain their authored airborne cells',()=>{
 const r=createFighter('roms',500,1);r.armorUntil=1000;r.move='air';r.moveFrame=9;r.state='AirAttack';
 assert.deepEqual(romsPose(r,0),{sheet:9,pose:11});
 const f=createFighter('fausto',500,1);f.weaponUntil=1000;f.move='swordAir';f.moveFrame=20;f.state='AirAttack';
 assert.equal(faustoPose(f),13);f.angerUntil=1000;assert.equal(faustoPose(f),13);
});

 test('Roms airborne impact differs from jump and windup in both skins and armor',()=>{
  const f=createFighter('roms',500,1);f.state='Jump';
  assert.equal(usesDedicatedAirAttack('roms',f),false);
  f.move='air';f.moveFrame=characters.roms.moves.air.startupFrames-1;assert.equal(usesDedicatedAirAttack('roms',f),false);
  for(const armor of [0,300]){f.armorUntil=armor;f.moveFrame=9;assert.equal(usesDedicatedAirAttack('roms',f),true);}
  f.moveFrame=22;assert.equal(usesDedicatedAirAttack('roms',f),false);
 });

test('Drupa and Caio low strikes replace guard only during contact and early recovery',()=>{
 for(const [id,name] of [['drupa','low'],['caio','crouch']]){
  const f=createFighter(id,500,1);f.state='Crouch';assert.equal(usesDedicatedCrouchAttack(id,f),false);
  f.state='CrouchingAttack';f.move=name;
  const m=characters[id].moves[name];f.moveFrame=m.startupFrames-1;assert.equal(usesDedicatedCrouchAttack(id,f),false);
  f.moveFrame=m.startupFrames;assert.equal(usesDedicatedCrouchAttack(id,f),true);
  f.stun=3;assert.equal(usesDedicatedCrouchAttack(id,f),false);f.stun=0;
  f.moveFrame=m.startupFrames+m.activeFrames+3;assert.equal(usesDedicatedCrouchAttack(id,f),false);
 }
 const f=createFighter('drupa',500,1);f.state='CrouchingAttack';f.move='low';f.moveFrame=10;f.weaponUntil=1000;
 assert.equal(usesDedicatedCrouchAttack('drupa',f),false,'Buda keeps its own artwork');
});

test('Drupa air kick has jump windup and recovery and never replaces belly dive or Buda',()=>{
 const f=createFighter('drupa',500,1);f.state='AirAttack';f.move='air';
 const m=characters.drupa.moves.air;
 for(const [tick,expected] of [[0,false],[m.startupFrames,true],[m.startupFrames+m.activeFrames+3,false]] as const){f.moveFrame=tick;assert.equal(usesDedicatedAirAttack('drupa',f),expected);}
 f.moveFrame=m.startupFrames;f.move='bellyDive';assert.equal(usesDedicatedAirAttack('drupa',f),false);
 f.move='air';f.weaponUntil=1000;assert.equal(usesDedicatedAirAttack('drupa',f),false);
});
