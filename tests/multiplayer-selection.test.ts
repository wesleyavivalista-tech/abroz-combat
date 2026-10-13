import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerSelection,multiplayerSelection} from '../apps/client/src/ui/MultiplayerSelection.js';
import {characters} from '../packages/game-core/characters/registry.js';
import {resolveSkin} from '../packages/game-core/characters/skins.js';
function setup(count:number){const ids=Array.from({length:count},()=> 'nikalz');return new MultiplayerSelection(ids,ids.map(id=>resolveSkin(characters[id])));}
test('eight independent cursors can occupy one tile and select simultaneously',()=>{
 const m=setup(8);assert.equal((multiplayerSelection(m,'FFA').match(/<i style=/g)??[]).length,8);
 for(let i=0;i<8;i++){m.handle(i,'right');m.handle(i,'confirm');m.handle(i,'next');m.handle(i,'confirm');}
 assert.ok(m.ready);assert.equal(new Set(m.ids).size,1);
 m.handle(4,'back');assert.equal(m.phases[4],'skin');assert.equal(m.phases[3],'ready');assert.equal(m.ready,false);
 m.handle(4,'back');m.handle(4,'left');assert.notEqual(m.ids[4],m.ids[3]);
});
test('fighter → skin → ready requires separate confirms and locked inputs cannot change selection',()=>{
 const m=setup(2);m.handle(0,'confirm');assert.equal(m.phases[0],'skin');assert.equal(m.ready,false);
 const first=m.skins[0];m.handle(0,'right');assert.notEqual(m.skins[0],first);m.handle(0,'confirm');
 const selected=m.skins[0];m.handle(0,'left');m.pick(0,'jopa');assert.equal(m.ids[0],'nikalz');assert.equal(m.skins[0],selected);
 assert.equal(m.handle(7,'confirm'),false);assert.equal(m.phases.length,2);
});
test('responsive roster movement wraps and different fighters reset skin safely',()=>{
 const m=setup(2);m.handle(0,'left');assert.equal(m.cursors[0],'random');m.handle(0,'confirm');assert.ok(characters[m.ids[0]]);m.handle(0,'back');m.pick(0,'random');
 m.handle(0,'right');assert.equal(m.ids[0],m.roster[0]);m.handle(1,'down',4);assert.equal(m.ids[1],m.roster[4]);
 m.handle(1,'up',4);assert.equal(m.ids[1],m.roster[0]);assert.equal(m.skins[1],resolveSkin(characters[m.ids[1]]));
});
test('all supported player counts render previews, readiness gate and retained teams',()=>{
 for(const count of [2,3,4,5,6,7,8]){
  const m=setup(count),teams=Array.from({length:count},(_,i)=>i<count/2?0:1);
  const html=multiplayerSelection(m,'Teams',teams);
  assert.equal((html.match(/data-player-slot=/g)??[]).length,count);assert.match(html,/START|WAITING/);assert.match(html,/disabled/);
  assert.match(html,/TEAM BLUE/);assert.match(html,/TEAM RED/);
  m.phases.fill('ready');assert.doesNotMatch(multiplayerSelection(m,'Teams',teams),/disabled/);
 }
 assert.match(multiplayerSelection(setup(6),'Party',undefined,true),/data-action="elimination-start"/);
});

test('eight assigned gamepads deliver simultaneous independent selections through existing menu events',async()=>{
 const {GamepadManager}=await import('../apps/client/src/input/GamepadManager.js');
 const pads=new GamepadManager(),m=setup(8);
 const devices=Array.from({length:8},(_,index)=>({index,id:'Xbox Wireless Controller',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
 pads.update(devices,0,false);
 for(const [index,device] of [...pads.devices.values()].entries())pads.assign(device.key,index);
 pads.drain();let now=0;
 const poll=()=>{pads.update(devices,now+=30,false,8);for(const event of pads.drain())if(event.kind==='menu'&&event.player!==null&&event.action&&event.action!=='pause')m.handle(event.player,event.action);};
 const press=(button:number,seats=devices.map((_,i)=>i))=>{for(const seat of seats)devices[seat].buttons[button]={pressed:true,value:1};poll();for(const seat of seats)devices[seat].buttons[button]={pressed:false,value:0};poll();};
 poll();press(15);assert.ok(m.ids.every(id=>id===m.roster[1]));
 press(0);assert.ok(m.phases.every(p=>p==='skin'));
 press(15,[1,3,5,7]);assert.notEqual(m.skins[0],m.skins[1]);
 press(0);assert.ok(m.ready);press(1,[6]);assert.equal(m.phases[6],'skin');assert.equal(m.phases[5],'ready');
});
