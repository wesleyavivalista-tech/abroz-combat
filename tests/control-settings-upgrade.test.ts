import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readControlSettings,validKeyboardCode} from '../apps/client/src/input/ControlSettings.js';
const defaults={bindings:[['KeyA','ArrowUp'],['Digit1','Numpad2']],gamepadButtons:[2,3,1,5,7,4,6],deadzone:.2};
test('legacy and versioned custom settings survive skipped releases and repeated load',()=>{
 const custom={bindings:[['IntlYen','Space'],['NumpadEnter','ShiftRight']],gamepadButtons:[1,2,3,4,5,6,7],deadzone:.3};
 const first=readControlSettings(JSON.stringify(custom),defaults);assert.equal(first.writable,true);assert.deepEqual(first.settings,{...custom,schemaVersion:1});
 assert.deepEqual(readControlSettings(JSON.stringify(first.settings),defaults),first);
});
test('corruption restores only invalid fields without changing defaults or valid preferences',()=>{
 for(const raw of ['{','null','[]'])assert.deepEqual(readControlSettings(raw,defaults).settings,{...defaults,schemaVersion:1});
 const result=readControlSettings(JSON.stringify({bindings:[['bad-code','Space']],gamepadButtons:[-1,4,999],deadzone:8}),defaults);
 assert.deepEqual(result.settings.bindings,[['KeyA','Space'],defaults.bindings[1]]);assert.deepEqual(result.settings.gamepadButtons,[2,4,1,5,7,4,6]);assert.equal(result.settings.deadzone,.2);
 assert.equal(validKeyboardCode('MediaPlayPause'),true);assert.equal(validKeyboardCode('IntlBackslash'),true);assert.equal(validKeyboardCode(''),false);assert.equal(validKeyboardCode('KeyAA'),false);
});
test('future settings are not overwritten on downgrade; legacy default migration remains isolated',()=>{
 assert.equal(readControlSettings('{"schemaVersion":9}',defaults).writable,false);
 const old=[0,2,1,3,5,6,7];assert.deepEqual(readControlSettings(JSON.stringify({gamepadButtons:old}),defaults).settings.gamepadButtons,defaults.gamepadButtons);
 assert.deepEqual(readControlSettings(JSON.stringify({schemaVersion:1,gamepadButtons:old}),defaults).settings.gamepadButtons,old);
});
