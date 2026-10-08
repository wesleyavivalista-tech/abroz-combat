import test from 'node:test';
import assert from 'node:assert/strict';
import {GamepadManager, type PadSample} from '../apps/client/src/input/GamepadManager.js';
import {Button} from '../packages/game-core/types.js';
function pad(index:number):PadSample{return {index,id:'Xbox Wireless Controller',mapping:'standard',connected:true,axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};}
function press(p:PadSample,index:number,on:boolean){(p.buttons[index] as {pressed:boolean;value:number}).pressed=on;(p.buttons[index] as {pressed:boolean;value:number}).value=on?1:0;}

test('chaos: repeated held-input disconnects with eight pads keep ownership and history bounded',()=>{
 const m=new GamepadManager(),pads=Array.from({length:8},(_,i)=>pad(i));
 pads.forEach(p=>press(p,0,true));m.update(pads,0);m.drain();
 pads.forEach(p=>press(p,0,false));m.update(pads,16);m.drain();
 for(let cycle=0;cycle<128;cycle++){
  const seat=cycle%8,old=pads[seat],now=cycle*100+100;
  (old.axes as number[])[0]=1;press(old,2,true);m.update(pads,now);m.drain();
  assert.equal(m.consume(seat),Button.Right|Button.Light);
  m.disconnect(old.index);assert.equal(m.consume(seat),0);m.drain();
  const replacement=pad(100+cycle);pads[seat]=replacement;press(replacement,0,true);
  m.update([...pads].reverse(),now+16);m.drain();
  assert.equal(m.device(seat)?.index,replacement.index);
  assert.equal(m.consume(seat),0,'join press leaked into combat');
  assert.equal(new Set(m.slots).size,8);
  press(replacement,0,false);m.update(pads,now+32);m.drain();
  m.clear();m.update(pads,now+48);m.drain();
 }
 assert.ok(m.devices.size<=16,`retained ${m.devices.size} devices after 128 reconnects`);
});

test('chaos: history pruning preserves reservations, open diagnostics and queued notices',()=>{
 const m=new GamepadManager(),reserved=m.discover(pad(0)),tested=m.discover(pad(1)),identified=m.discover(pad(2));
 m.assign(reserved.key,0);m.testing=tested.key;m.capture={identify:identified.key};
 for(const d of [reserved,tested,identified])m.disconnect(d.index);
 m.drain();
 for(let i=3;i<50;i++){
  m.discover(pad(i));m.disconnect(i);m.drain();m.update([],i,false);m.drain();
 }
 for(const d of [reserved,tested,identified])assert.equal(m.devices.get(d.key),d);
 assert.equal(m.slots[0],reserved.key);
 const pending=m.discover(pad(50));m.disconnect(50);
 m.update([],100,false);assert.ok(m.devices.has(pending.key));
 assert.ok(m.drain().some(e=>e.kind==='disconnect'&&e.device===pending.key));
 assert.ok(m.devices.size<=m.cap+4);
});
