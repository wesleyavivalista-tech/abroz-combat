import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GamepadManager,type PadSample} from '../apps/client/src/input/GamepadManager.js';
import {LocalPlayers} from '../apps/client/src/input/LocalPlayers.js';
import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../packages/game-core/types.js';
import {playerManagement,refreshPlayerManagement} from '../apps/client/src/ui/PlayerManagement.js';
function fixture(count=8){const pads=new GamepadManager(),lobby=new LocalPlayers(pads),devices:PadSample[]=Array.from({length:count},(_,i)=>({index:i*3,id:i%2?'DualSense':'Xbox Wireless Controller',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));pads.managementEvents=true;let tick=0;
 const poll=()=>{pads.update(devices.filter(d=>d.connected),tick+=16,false);const results=pads.drain().map(e=>lobby.handle(e));lobby.sync();return results;};
 const press=(i:number,b:number)=>{(devices[i].buttons as {pressed:boolean;value:number}[])[b]={pressed:true,value:1};const results=poll();(devices[i].buttons as {pressed:boolean;value:number}[])[b]={pressed:false,value:0};poll();return results;};
 poll();return {pads,lobby,devices,poll,press};}
test('detected devices stay inactive until confirm; join and readiness require separate presses',()=>{
 const {pads,lobby,press}=fixture(2);assert.equal(lobby.count,0);press(0,15);assert.equal(lobby.count,0);press(0,0);assert.equal(lobby.count,1);assert.equal(lobby.isReady(0),false);assert.equal(pads.consume(0),0);press(0,0);assert.equal(lobby.isReady(0),true);press(1,0);assert.equal(lobby.isReady(0),false,'roster change invalidates readiness');press(0,0);press(1,0);assert.equal(lobby.canContinue,true);assert.ok(press(0,9).includes('continue'));
});
test('leave keeps device connected and inactive despite movement; B cannot affect another player',()=>{
 const {pads,lobby,press,devices,poll}=fixture(2);press(0,0);press(1,0);press(0,0);press(1,0);press(1,1);assert.equal(lobby.isReady(1),false);assert.equal(lobby.isReady(0),true);press(1,1);assert.equal(lobby.count,1);assert.equal(pads.devices.get(2)?.connected,true);press(1,15);press(1,2);poll();assert.equal(pads.device(1),undefined);assert.equal(devices[1].connected,true);press(1,0);assert.equal(lobby.count,2);
});
test('slot changes never steal occupied seats or duplicate ownership, and holes block Continue',()=>{
 const {pads,lobby,press}=fixture(3);press(0,0);press(1,0);const a=pads.slots[0]!,b=pads.slots[1]!;assert.equal(lobby.move(a,1),false);assert.equal(lobby.move(b,2),true);lobby.toggleReady(0);lobby.toggleReady(2);assert.equal(lobby.canContinue,false);assert.equal(lobby.move(b,1),true);lobby.toggleReady(0);lobby.toggleReady(1);assert.equal(lobby.canContinue,true);assert.equal(new Set(pads.slots.filter(Boolean)).size,2);
});
for(const count of [2,4,6,8])test(`${count} players join, ready, and retain control of their own fighters`,()=>{
 const {pads,lobby,press,devices,poll}=fixture(count+1);lobby.configure(count,count,count);for(let i=0;i<count;i++)press(i,0);press(count,0);assert.equal(lobby.count,count);assert.equal(pads.devices.get(count+1)?.player,null);for(let i=0;i<count;i++)press(i,0);assert.equal(lobby.canContinue,true);
 const slots=[...pads.slots];pads.managementEvents=false;pads.clear();poll();const game=new GameSimulation(Array(count).fill('nikalz'));game.state.phase='fight';
 for(let i=0;i<count;i++){(devices[i].buttons as {pressed:boolean;value:number}[])[2]={pressed:true,value:1};pads.update(devices,200+i*16,false);const masks=Array.from({length:count},(_,seat)=>pads.consume(seat));masks.forEach((mask,seat)=>assert.equal(mask,seat===i?Button.Light:0));game.step(masks);(devices[i].buttons as {pressed:boolean;value:number}[])[2]={pressed:false,value:0};pads.update(devices,208+i*16,false);}
 assert.deepEqual(pads.slots,slots);assert.ok(game.state.fighters.every(f=>f.health>0));
});
test('disconnect invalidates ready, reconnect at a new index reserves the seat until explicit join',()=>{
 const {pads,lobby,press,devices,poll}=fixture(2);press(0,0);press(1,0);press(0,0);press(1,0);const old=pads.slots[1];devices[1].connected=false;poll();assert.equal(lobby.canContinue,false);assert.equal(lobby.isReady(1),false);devices[1].connected=true;devices[1].index=21;poll();assert.equal(pads.slots[1],old);assert.equal(pads.device(1)?.connected,false);press(1,0);assert.notEqual(pads.slots[1],old);assert.equal(pads.device(1)?.index,21);assert.equal(lobby.isReady(1),false);
});
test('keyboard seats are explicit and cannot collide with controller ownership',()=>{
 const {pads,lobby,press,poll}=fixture(2);assert.equal(lobby.keyboard(0),true);poll();press(0,0);assert.equal(pads.device(1)?.key,1);assert.equal(lobby.move(1,0),false);assert.equal(lobby.keyboard(1),false);lobby.toggleReady(0);lobby.toggleReady(1);assert.equal(lobby.canContinue,true);lobby.keyboard(0);assert.equal(lobby.canContinue,false);
});
test('fixed mode limits, disconnected occupants and not-ready players prevent starting',()=>{
 const {lobby,press}=fixture(8);lobby.configure(6,6,6);for(let i=0;i<4;i++)press(i,0);for(let i=0;i<4;i++)press(i,0);assert.equal(lobby.canContinue,false);for(let i=4;i<6;i++)press(i,0);for(let i=0;i<6;i++)press(i,0);assert.equal(lobby.canContinue,true);lobby.configure(2,2,2);assert.equal(lobby.count,2);assert.equal(lobby.canContinue,false);lobby.toggleReady(0);lobby.toggleReady(1);assert.equal(lobby.canContinue,true);
});
test('management events for inactive pads are opt-in; ordinary menus and online input keep old behavior',()=>{
 const pads=new GamepadManager(),d:PadSample={index:0,id:'Xbox',mapping:'standard',connected:true,axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};pads.update([d],0,false);(d.buttons as {pressed:boolean;value:number}[])[0]={pressed:true,value:1};pads.update([d],16,false);assert.equal(pads.drain().filter(e=>e.kind==='menu').length,0);assert.equal(pads.slots[0],null);
});
test('management screen escapes controller names and exposes readiness, inactive devices and mode limits',()=>{
 const {lobby,pads,press}=fixture(2);pads.devices.get(2)!.name='<script>unsafe</script>';press(0,0);let html=playerManagement(lobby,true);assert.ok(html.includes('ACTIVE PLAYERS'));assert.ok(html.includes('NOT JOINING'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('players-continue" disabled'));
 lobby.configure(2,2,2);press(1,0);press(0,0);press(1,0);html=playerManagement(lobby,true);assert.ok(!html.includes('players-continue" disabled'));
});

test('local keyboard participation is exclusive; default online/training input remains unchanged',async()=>{
 const {InputManager}=await import('../apps/client/src/input/InputManager.js');const old=Object.getOwnPropertyDescriptor(globalThis,'window'),handlers=new Map<string,(e:KeyboardEvent)=>void>();
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(name:string,fn:(e:KeyboardEvent)=>void)=>handlers.set(name,fn)}});
 try{const input=new InputManager();input.localKeyboardSeats=new Set([1]);const key=(code:string)=>handlers.get('keydown')!({code,target:{matches:()=>false},preventDefault(){},repeat:false} as unknown as KeyboardEvent);
 key(input.bindings[0][0]);assert.equal(input.poll(0),0);key(input.bindings[1][0]);assert.equal(input.poll(1),Button.Left);
 input.clear();input.localKeyboardSeats=null;key(input.bindings[0][0]);assert.equal(input.poll(0),Button.Left);input.dispose();
 }finally{if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window');}
});


test('idle board refresh ignores browser markup normalization but renders roster changes and replacement hosts',()=>{
 const {lobby}=fixture(0),old=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{activeElement:null}});
 let writes=0;
 const makeHost=()=>{let html='';return {contains:()=>false,get innerHTML(){return html;},set innerHTML(value:string){writes++;html=value.replaceAll('disabled','disabled=""').replaceAll('/>','></svg>');}};};
 let host=makeHost();const root={querySelector:(selector:string)=>selector==='#player-management'?host:null} as unknown as ParentNode;
 try{
  refreshPlayerManagement(root,lobby,true);assert.equal(writes,1);
  for(let i=0;i<10;i++)refreshPlayerManagement(root,lobby,true);assert.equal(writes,1,'idle polls must preserve nodes and animations');
  lobby.keyboard(0);refreshPlayerManagement(root,lobby,true);assert.equal(writes,2);
  lobby.toggleReady(0);refreshPlayerManagement(root,lobby,true);assert.equal(writes,3);
  refreshPlayerManagement(root,lobby,true);assert.equal(writes,3);
  host=makeHost();refreshPlayerManagement(root,lobby,true);assert.equal(writes,4,'reopened screens must render');
 }finally{if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document');}
});
