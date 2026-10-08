import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GamepadManager,controllerName,DEFAULT_ATTACK_BUTTONS,STANDARD,type PadSample} from '../apps/client/src/input/GamepadManager.js';
import {Button} from '../packages/game-core/types.js';
const pad=(index=0,id='Xbox Wireless Controller'):PadSample=>({index,id,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
const button=(p:PadSample,b:number,on=true)=>{(p.buttons as {pressed:boolean;value:number}[])[b]={pressed:on,value:on?1:0};};
function joined(index=0){const m=new GamepadManager(),p=pad(index);button(p,0);m.update([p],0);button(p,0,false);m.update([p],16);m.drain();return{m,p};}
test('preconnected and newly connected controllers join only on a fresh button; join is consumed',()=>{const m=new GamepadManager(),p=pad(4);m.update([null,p],0);assert.equal(m.device(0),undefined);button(p,0);m.update([null,p],16);assert.equal(m.device(0)?.index,4);assert.equal(m.consume(0),0);assert.equal(m.drain().filter(e=>e.kind==='menu').length,0);});
test('eight independent controllers with gaps and high browser indices',()=>{const m=new GamepadManager(),ps=Array.from({length:8},(_,i)=>pad(i*3+4));ps.forEach(p=>button(p,0));m.update([null,...ps,null],0);assert.equal(m.slots.filter(x=>x!==null).length,8);ps.forEach(p=>button(p,0,false));m.update(ps,16);ps.forEach((p,i)=>button(p,DEFAULT_ATTACK_BUTTONS[i%7]));m.update(ps,32);const bits=[Button.Light,Button.Medium,Button.Heavy,Button.Special,Button.Special2,Button.Super1,Button.Super2];ps.forEach((_,i)=>assert.equal(m.consume(i),bits[i%7]));});
test('a ninth device is detected but remains unassigned; cap is configurable',()=>{const m=new GamepadManager(3),ps=Array.from({length:9},(_,i)=>pad(i));ps.forEach(p=>button(p,0));m.update(ps,0);assert.equal(m.devices.size,9);assert.equal(m.slots.filter(x=>x!==null).length,3);});
test('keyboard claims reserve P1/P2 and first pad joins P3',()=>{const m=new GamepadManager(),p=pad();m.keyboardClaimed.add(0);m.keyboardClaimed.add(1);button(p,0);m.update([p],0);assert.equal(m.device(2)?.index,0);assert.equal(m.device(0),undefined);});
test('keyboard plus one controller and two-controller-only sessions',()=>{const m=new GamepadManager(),p=pad(5);m.keyboardClaimed.add(0);button(p,0);m.update([p],0);assert.equal(m.device(1)?.index,5);const n=new GamepadManager(),a=pad(3),b=pad(7);button(a,1);button(b,1);n.update([a,b],0);assert.equal(n.device(0)?.index,3);assert.equal(n.device(1)?.index,7);});
test('disconnect releases held actions, retains slot and does not shift identical devices',()=>{const {m,p}=joined(4),q=pad(8);button(q,0);m.update([p,q],32);button(p,2);m.update([p,q],48);const key=m.slots[0];m.update([null,q],64);assert.equal(m.consume(0),0);assert.equal(m.slots[0],key);assert.equal(m.device(1)?.index,8);assert.equal(m.ready(0),false);assert.match(m.label(0),/Disconnected/);assert.equal(m.drain().filter(e=>e.kind==='disconnect').length,1);});
test('replugging an identical model never silently steals an old slot',()=>{const {m,p}=joined();const old=m.slots[0];m.update([],32);const q=pad(p.index,p.id);m.update([q],48,false);assert.equal(m.slots[0],old);assert.equal([...m.devices.values()].filter(d=>d.connected)[0].player,null);m.capture={player:0};button(q,2);m.update([q],64,false);assert.notEqual(m.slots[0],old);assert.equal(m.consume(0),0);assert.equal(m.devices.get(old!)?.player,null);});
test('reassignment removes prior ownership and blocks held inputs until neutral',()=>{const {m,p}=joined();button(p,0);m.update([p],32);const key=m.slots[0]!;m.assign(key,5);assert.equal(m.device(0),undefined);assert.equal(m.consume(5),0);m.update([p],48);assert.equal(m.consume(5),0);button(p,0,false);m.update([p],64);button(p,0);m.update([p],80);assert.equal(m.consume(5),Button.Up);assert.equal(m.consume(0),0);});
test('reassigning occupied target releases only source and destination',()=>{const m=new GamepadManager(),ps=[pad(2),pad(4),pad(6)];ps.forEach(p=>button(p,0));m.update(ps,0);const [a,b,c]=m.slots;m.assign(a!,1);assert.equal(m.slots[0],null);assert.equal(m.slots[1],a);assert.equal(m.devices.get(b!)?.player,null);assert.equal(m.slots[2],c);});
test('all seven defaults preserve exact gameplay mask values',()=>{const bits=[Button.Light,Button.Medium,Button.Heavy,Button.Special,Button.Special2,Button.Super1,Button.Super2];DEFAULT_ATTACK_BUTTONS.forEach((b,i)=>{const {m,p}=joined();button(p,b);m.update([p],32);assert.equal(m.consume(0),bits[i]);});});
test('held, pressed, released and short taps are distinct',()=>{const {m,p}=joined();button(p,0);m.update([p],32);assert.equal(m.device(0)?.pressed,Button.Up);assert.equal(m.consume(0),Button.Up);m.update([p],48);assert.equal(m.device(0)?.pressed,0);assert.equal(m.consume(0),Button.Up);button(p,0,false);m.update([p],64);assert.equal(m.device(0)?.released,Button.Up);assert.equal(m.consume(0),0);button(p,6);m.update([p],80);button(p,6,false);m.update([p],96);assert.equal(m.consume(0),Button.Super2);assert.equal(m.consume(0),0);});
test('simultaneous inputs and simultaneous players never leak',()=>{const {m,p}=joined(),q=pad(7);button(q,0);m.update([p,q],32);button(q,0,false);m.update([p,q],48);button(p,0);button(p,5);button(q,2);m.update([p,q],64);assert.equal(m.consume(0),Button.Up|Button.Special);assert.equal(m.consume(1),Button.Light);assert.equal(m.consume(2),0);});
for(const [name,axis,value,bit] of [['left',0,-1,Button.Left],['right',0,1,Button.Right],['down',1,1,Button.Down]] as const){test(`D-pad and analog ${name} produce the same digital action`,()=>{const {m,p}=joined();button(p,STANDARD[name]);m.update([p],32);assert.equal(m.consume(0),bit);button(p,STANDARD[name],false);(p.axes as number[])[axis]=value;m.update([p],48);assert.equal(m.consume(0),bit);});}
test('deadzone rejects drift and magnitude never changes gameplay strength',()=>{const {m,p}=joined();(p.axes as number[])[0]=.19;m.update([p],32);assert.equal(m.consume(0),0);(p.axes as number[])[0]=.21;m.update([p],48);assert.equal(m.consume(0),Button.Right);(p.axes as number[])[0]=1;m.update([p],64);assert.equal(m.consume(0),Button.Right);});
test('menu repeats after delay, not every update',()=>{const {m,p}=joined();button(p,15);m.update([p],32);assert.equal(m.drain().filter(e=>e.action==='right').length,1);m.update([p],100);assert.equal(m.drain().length,0);m.update([p],383);assert.equal(m.drain().filter(e=>e.action==='right').length,1);m.update([p],400);assert.equal(m.drain().length,0);m.update([p],494);assert.equal(m.drain().length,1);});
test('confirm, back, pause and skin actions are edge-triggered',()=>{for(const action of ['confirm','back','pause','previous','next'] as const){const {m,p}=joined();button(p,STANDARD[action]);m.update([p],32);assert.equal(m.drain().filter(e=>e.action===action).length,1);m.update([p],48);assert.equal(m.drain().filter(e=>e.action===action).length,0);}});
test('identify consumes input, wrong controller cannot satisfy it',()=>{const {m,p}=joined(),q=pad(5);m.update([p,q],32,false);m.capture={identify:m.slots[0]!};button(q,0);m.update([p,q],48,false);assert.notEqual(m.capture,null);button(p,0);m.update([p,q],64,false);assert.equal(m.capture,null);assert.equal(m.consume(0),0);});
test('test mode exposes all axes/buttons without gameplay or menu actions',()=>{const {m,p}=joined();m.testing=m.slots[0];p.buttons.forEach((_,i)=>{if(i!==STANDARD.pause)button(p,i);});(p.axes as number[]).splice(0,4,.7,-.8,.9,-1);m.update([p],32);const d=m.device(0)!;assert.equal(d.buttons.length,17);assert.equal(d.axes[3],-1);assert.equal(m.consume(0),0);assert.equal(m.drain().filter(e=>e.kind==='menu').length,0);m.update([],48);assert.equal(d.connected,false);});
test('unsupported devices remain visible but cannot control fighters',()=>{const m=new GamepadManager(),p=pad();p.mapping='';button(p,0);m.update([p],0);const d=[...m.devices.values()][0];assert.equal(m.assign(d.key,0),false);assert.equal(m.consume(0),0);assert.equal(m.devices.size,1);});
test('Xbox / PlayStation branding only affects labels; generic names are normalized',()=>{assert.equal(controllerName('054c Sony').brand,'playstation');assert.equal(controllerName('XInput').brand,'xbox');assert.equal(controllerName('USB Pad (Vendor: ff)').name,'USB Pad');for(const id of ['DualSense','Xbox','USB Pad']){const m=new GamepadManager(),p=pad(0,id);button(p,0);m.update([p],0);button(p,0,false);m.update([p],16);button(p,2);m.update([p],32);assert.equal(m.consume(0),Button.Light);}});
test('fresh session never restores browser indices or prior assignments',()=>{const {m}=joined();assert.notEqual(m.slots[0],null);const next=new GamepadManager();assert.ok(next.slots.every(x=>x===null));});
test('explicit disconnect event clears inputs even before polling reflects removal',()=>{const {m,p}=joined();button(p,0);m.update([p],32);m.disconnect(p.index);assert.equal(m.consume(0),0);assert.equal(m.device(0)?.connected,false);});
test('join limits respect actual local player count without limiting discovery',()=>{const m=new GamepadManager(),ps=[pad(0),pad(1),pad(2)];ps.forEach(p=>button(p,0));m.update(ps,0,true,2);assert.equal(m.devices.size,3);assert.equal(m.device(2),undefined);});
test('release slot preserves keyboard fallback and readiness is explicit',()=>{const {m}=joined();m.release(0);assert.equal(m.label(0),'Keyboard 1');assert.equal(m.ready(0),true);assert.equal(m.ready(2),false);});
test('connection event discovery never consumes the first join press',()=>{const m=new GamepadManager(),p=pad(9);button(p,0);m.discover(p);assert.equal(m.device(0),undefined);m.update([p],0);assert.equal(m.device(0)?.index,9);assert.equal(m.consume(0),0);});
test('fresh button reclaims the reserved disconnected seat in menus',()=>{const {m,p}=joined(4);m.update([],32);const q=pad(11,p.id);button(q,0);m.update([q],48);assert.equal(m.device(0)?.index,11);assert.equal(m.device(1),undefined);});
test('analog triggers cross threshold and release without relying on pressed flag',()=>{const {m,p}=joined();(p.buttons as {pressed:boolean;value:number}[])[6]={pressed:false,value:.7};m.update([p],32);assert.equal(m.consume(0),Button.Super2);(p.buttons as {pressed:boolean;value:number}[])[6]={pressed:false,value:.3};m.update([p],48);assert.equal(m.consume(0),0);assert.equal(m.device(0)?.released,Button.Super2);});
test('deliberate stick movement joins, is consumed, and navigates after neutral',()=>{
 const m=new GamepadManager(),p=pad();(p.axes as number[])[1]=.9;m.update([p],0);
 assert.equal(m.device(0)?.index,0);assert.equal(m.drain().filter(e=>e.kind==='menu').length,0);
 (p.axes as number[])[1]=0;m.update([p],16);(p.axes as number[])[1]=.9;m.update([p],32);
 assert.equal(m.drain().find(e=>e.kind==='menu')?.action,'down');
});
test('upward stick navigates menus without jumping during gameplay',()=>{
 const {m,p}=joined();(p.axes as number[]).splice(0,2,.3,-.9);m.update([p],32);
 assert.equal(m.drain().find(e=>e.kind==='menu')?.action,'up');assert.equal(m.consume(0),Button.Right);
});
test('D-pad overrides stick drift in menus',()=>{
 const {m,p}=joined();(p.axes as number[])[0]=-.7;button(p,STANDARD.down);m.update([p],32);
 assert.equal(m.drain().find(e=>e.kind==='menu')?.action,'down');
});
test('menu stick hysteresis prevents repeated events from threshold jitter',()=>{
 const {m,p}=joined();for(const [i,value] of [.56,.53,.56,.52,.58].entries()){(p.axes as number[])[0]=value;m.update([p],32+i*16);}
 assert.deepEqual(m.drain().filter(e=>e.kind==='menu').map(e=>e.action),['right']);
});
test('unused right-stick drift does not lock all controls after a screen change',()=>{
 const {m,p}=joined();(p.axes as number[])[2]=.4;m.clear();m.update([p],32);button(p,0);m.update([p],48);
 assert.equal(m.drain().find(e=>e.kind==='menu')?.action,'confirm');
});
test('clear discards queued navigation while preserving assignment notifications',()=>{
 const {m,p}=joined();button(p,0);m.update([p],32);m.clear();assert.equal(m.drain().filter(e=>e.kind==='menu').length,0);
});
test('reassignment cancels queued menu actions from the old seat',()=>{
 const {m,p}=joined();button(p,0);m.update([p],32);m.assign(m.slots[0]!,4);
 assert.equal(m.drain().filter(e=>e.kind==='menu').length,0);assert.equal(m.consume(0),0);assert.equal(m.consume(4),0);
});
test('eight identical devices reconnect at new indices without duplicate owners',()=>{
 const m=new GamepadManager(),ps=Array.from({length:8},(_,i)=>pad(i*3,'Xbox Wireless Controller'));
 ps.forEach(p=>button(p,0));m.update(ps,0);ps.forEach(p=>button(p,0,false));m.update(ps,16);m.drain();
 for(let round=0;round<16;round++){
  const slot=round%8,keys=[...m.slots];const gone=ps[slot];m.update(ps.filter(p=>p!==gone),100+round*100);
  const replacement=pad(100+round,'Xbox Wireless Controller');button(replacement,0);ps[slot]=replacement;
  m.update([...ps].reverse(),120+round*100);assert.equal(m.device(slot)?.index,replacement.index);
  assert.equal(new Set(m.slots).size,8);keys.forEach((k,i)=>{if(i!==slot)assert.equal(m.slots[i],k);});
  assert.equal(m.devices.get(keys[slot]!)?.player,null);assert.equal(m.consume(slot),0);
  button(replacement,0,false);m.update(ps,140+round*100);m.drain();
 }
});

test('test mode allows Menu to exit even on an unassigned controller',()=>{
 const m=new GamepadManager(),p=pad();m.update([p],0,false);m.testing=[...m.devices.keys()][0];m.clear();m.update([p],16,false);
 button(p,STANDARD.pause);m.update([p],32,false);assert.equal(m.drain().find(e=>e.kind==='menu')?.action,'back');assert.equal(m.consume(0),0);
});
test('pairing can be cancelled with B without assigning the cancelling pad',()=>{
 const {m,p}=joined();m.capture={player:3};button(p,STANDARD.back);m.update([p],32,false);
 assert.equal(m.device(3),undefined);assert.equal(m.drain().find(e=>e.kind==='menu')?.action,'back');
});

test('slight downward stick movement does not crouch while walking',()=>{
 const {m,p}=joined();
 for(const x of [-1,0,1])for(const y of [.21,.35,.59]){
  (p.axes as number[]).splice(0,2,x,y);m.update([p],32);const mask=m.consume(0);
  assert.equal(mask&Button.Down,0);assert.equal(mask&(Button.Left|Button.Right),x<0?Button.Left:x>0?Button.Right:0);
 }
});
test('deliberate analog crouch releases immediately and D-pad down stays responsive',()=>{
 const {m,p}=joined();(p.axes as number[])[1]=.7;m.update([p],32);assert.equal(m.consume(0),Button.Down);
 (p.axes as number[])[1]=.35;m.update([p],48);assert.equal(m.consume(0),0);
 button(p,STANDARD.down);m.update([p],64);assert.equal(m.consume(0),Button.Down);
 button(p,STANDARD.down,false);m.update([p],80);assert.equal(m.consume(0),0);
});

test('Xbox default layout maps A jump, X/Y/B basics, RB/RT specials and LB/LT ultimates',()=>{
 for(const [buttonIndex,expected] of [[0,Button.Up],[2,Button.Light],[3,Button.Medium],[1,Button.Heavy],[5,Button.Special],[7,Button.Special2],[4,Button.Super1],[6,Button.Super2]]){
 const {m,p}=joined();button(p,buttonIndex);m.update([p],32);assert.equal(m.consume(0),expected);
 }
});

test('only A jumps; upward stick and D-pad still navigate menus',()=>{
 for(const source of ['stick','dpad']){
  const {m,p}=joined();if(source==='stick')(p.axes as number[])[1]=-1;else button(p,STANDARD.up);
  m.update([p],32);assert.equal(m.consume(0),0);assert.equal(m.drain().find(e=>e.kind==='menu')?.action,'up');
  button(p,0);m.update([p],48);assert.equal(m.consume(0),Button.Up);
  button(p,0,false);m.update([p],64);assert.equal(m.consume(0),0);
 }
});
