import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ControllerMappings,mappingKey,mappedInput,validProfile,type MappingProfile,type Binding} from '../apps/client/src/input/ControllerMapping.js';
import {GamepadManager,type PadSample} from '../apps/client/src/input/GamepadManager.js';
import {Button} from '../packages/game-core/types.js';
const neutral=()=>({index:3,id:'Generic Bluetooth Pad',connected:true,mapping:'',buttons:Array.from({length:12},()=>({pressed:false,value:0})),axes:[0,0,-1,-1,1.2857]});
const press=(p:PadSample,i:number,on=true)=>{(p.buttons as {pressed:boolean;value:number}[])[i]={pressed:on,value:on?1:0};};
const axis=(p:PadSample,i:number,v:number)=>{(p.axes as number[])[i]=v;};
const b=(index:number):Binding=>({kind:'button',index});
const a=(index:number,peak:number,rest=0):Binding=>({kind:'axis',index,rest,peak});
// Swapped/inverted sticks and non-Xbox button order, with axis triggers.
const profile:MappingProfile={buttons:12,axes:5,bindings:[a(1,1),a(1,-1),a(0,1),a(0,-1),b(3),b(0),b(1),b(2),b(5),a(3,1,-1),b(4),a(2,1,-1),b(9)]};
function mapped(){const m=new GamepadManager(),p=neutral();m.mappings.profiles.set(mappingKey(p.id,12,5),structuredClone(profile));m.update([p],0,false);press(p,3);m.update([p],16);press(p,3,false);m.update([p],32);m.drain();return {m,p};}
test('custom mapping drives all attacks, jump and menu buttons without assuming raw button order',()=>{
 for(const [raw,expected,menu] of [[3,Button.Up,'confirm'],[0,Button.Light,undefined],[1,Button.Medium,undefined],[2,Button.Heavy,'back'],[5,Button.Special,'next'],[4,Button.Super1,'previous'],[9,0,'pause']] as const){
 const {m,p}=mapped();press(p,raw);m.update([p],48);assert.equal(m.consume(0),expected);assert.equal(m.drain().find(e=>e.kind==='menu')?.action,menu);
 }
 for(const [raw,expected] of [[3,Button.Special2],[2,Button.Super2]] as const){const {m,p}=mapped();axis(p,raw,1);m.update([p],48);assert.equal(m.consume(0),expected);axis(p,raw,-1);m.update([p],64);assert.equal(m.consume(0),0);}
});
test('inverted/reordered movement has deadzones and crouch threshold; upward stick never jumps',()=>{
 const {m,p}=mapped();axis(p,1,.19);m.update([p],48);assert.equal(m.consume(0),0);
 axis(p,1,.9);axis(p,0,-.3);m.update([p],64);assert.equal(m.consume(0),Button.Left);
 axis(p,0,-.9);m.update([p],80);assert.equal(m.consume(0),Button.Left|Button.Down);
 axis(p,1,0);axis(p,0,.9);m.update([p],96);assert.equal(m.consume(0),0);assert.equal(m.drain().filter(e=>e.kind==='menu').at(-1)?.action,'up');
});
test('wizard waits for release, rejects duplicate bindings and preserves optional D-pad',()=>{
 const m=new ControllerMappings(),buttons=Array(12).fill(0),axes=[0,0,-1,-1,1.2857];m.begin(7,'test');assert.equal(m.start(buttons,axes),true);
 const activate=(binding:Binding)=>{if(binding.kind==='button')buttons[binding.index]=1;else axes[binding.index]=binding.peak;m.sample(buttons,axes);};
 const release=(binding:Binding)=>{if(binding.kind==='button')buttons[binding.index]=0;else axes[binding.index]=binding.rest;m.sample(buttons,axes);};
 for(const [i,binding] of profile.bindings.entries()){
 activate(binding);assert.equal(m.wizard?.step,i+1);m.sample(buttons,axes);assert.equal(m.wizard?.step,i+1);release(binding);
 if(i===0){activate(binding);assert.equal(m.wizard?.step,1);assert.equal(m.wizard?.error,true);release(binding);}
 }
 assert.equal(m.wizard?.step,13);m.skipDpad();assert.equal(m.save(),true);assert.ok(validProfile(m.profiles.get('test')));
 const result=mappedInput(m.profiles.get('test')!,buttons,axes);assert.deepEqual(result.axes,[0,0]);assert.ok(result.buttons.every(v=>v===0));
});
test('optional hat D-pad supports values close to the out-of-range resting value',()=>{
 const m=new ControllerMappings(),buttons=Array(12).fill(0),axes=[0,0,-1,-1,1.2857];m.begin(7,'hat');m.start(buttons,axes);
 m.wizard!.bindings=structuredClone(profile.bindings);m.wizard!.step=13;
 for(const peak of [.7143,-.4286,-1,.1429]){axes[4]=peak;m.sample(buttons,axes);axes[4]=1.2857;m.sample(buttons,axes);}
 assert.equal(m.wizard?.phase,'complete');assert.equal(m.save(),true);axes[4]=.7143;
 const result=mappedInput(m.profiles.get('hat')!,buttons,axes);assert.equal(result.buttons[14],1);assert.equal(result.buttons[15],0);
});
test('setup captures only the chosen device and cannot generate gameplay or menu actions',()=>{
 const {m,p}=mapped(),other=neutral();other.index=8;other.id='Other';other.mapping='standard';m.update([p,other],48,false);m.beginMapping(m.slots[0]!);
 assert.equal(m.mappings.start(p.buttons.map(b=>b.value),p.axes),true);press(other,0);axis(p,1,1);m.update([p,other],64);
 assert.equal(m.mappings.wizard?.step,1);assert.equal(m.consume(0),0);assert.equal(m.device(1),undefined);assert.equal(m.drain().filter(e=>e.kind==='menu').length,0);
 m.cancelMapping();axis(p,1,0);press(other,0,false);m.update([p,other],80);press(p,3);m.update([p,other],96);assert.equal(m.consume(0),Button.Up);
});
test('disconnect cancels incomplete setup without replacing a valid mapping',()=>{
 const {m}=mapped();m.beginMapping(m.slots[0]!);m.update([],48);assert.equal(m.mappings.wizard,null);assert.equal(m.consume(0),0);assert.equal(m.mappings.profiles.size,1);
});
test('eight identical generic controllers retain independent seats across reconnect and reassignment',()=>{
 const m=new GamepadManager(),ps=Array.from({length:8},(_,i)=>({...neutral(),index:i*3}));m.mappings.profiles.set(mappingKey(ps[0].id,12,5),profile);
 ps.forEach(p=>press(p,3));m.update(ps,0);ps.forEach(p=>press(p,3,false));m.update(ps,16);assert.equal(new Set(m.slots).size,8);
 const keys=[...m.slots];m.update(ps.filter((_,i)=>i!==4),32);ps[4]={...neutral(),index:33};press(ps[4],0);m.update(ps,48);assert.equal(m.device(4)?.index,33);assert.equal(m.consume(4),0);assert.notEqual(m.slots[4],keys[4]);keys.forEach((key,i)=>{if(i!==4)assert.equal(m.slots[i],key);});
 m.assign(m.slots[4]!,6);assert.equal(m.device(4),undefined);assert.equal(m.consume(6),0);
});
test('stored profiles survive reload, never restore ownership, and ignore corrupt data',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let saved='[]';Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>saved,setItem:(_k:string,v:string)=>{saved=v;}}});
 try{
 const m=new ControllerMappings();m.begin(3,mappingKey('Generic Bluetooth Pad',12,5));m.start(Array(12).fill(0),[0,0,-1,-1,1.2857]);m.wizard!.bindings=structuredClone(profile.bindings);m.wizard!.phase='complete';assert.equal(m.save(),true);
 const next=new GamepadManager();assert.equal(next.mappings.profiles.size,1);assert.ok(next.slots.every(s=>s===null));next.update([neutral()],0,false);assert.equal(next.supported([...next.devices.values()][0]),true);
 saved='invalid';assert.equal(new ControllerMappings().profiles.size,0);
 saved=JSON.stringify([['bad',{...profile,bindings:[{kind:'button',index:999}]}]]);assert.equal(new ControllerMappings().profiles.size,0);
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('a changed layout requires setup again; standard controllers ignore custom profiles',()=>{
 const {m,p}=mapped();p.buttons=[...p.buttons,{pressed:false,value:0}];m.update([p],48);assert.equal(m.ready(0),false);assert.equal(m.consume(0),0);
 const standard=new GamepadManager(),q=neutral();q.mapping='standard';standard.mappings.profiles.set(mappingKey(q.id,12,5),profile);press(q,0);standard.update([q],0);press(q,0,false);standard.update([q],16);press(q,0);standard.update([q],32);assert.equal(standard.consume(0),Button.Up);
});
test('custom input test can exit with mapped pause and focus cleanup blocks held attacks',()=>{
 const {m,p}=mapped();m.testing=m.slots[0];press(p,9);m.update([p],48);assert.equal(m.drain().find(e=>e.kind==='menu')?.action,'back');
 m.testing=null;press(p,9,false);press(p,0);m.clear();m.update([p],64);assert.equal(m.consume(0),0);press(p,0,false);m.update([p],80);press(p,0);m.update([p],96);assert.equal(m.consume(0),Button.Light);
});

test('focus loss cancels setup without saving partial bindings',async()=>{
 const {InputManager}=await import('../apps/client/src/input/InputManager.js');
 const old=Object.getOwnPropertyDescriptor(globalThis,'window'),handlers=new Map<string,()=>void>();
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(event:string,handler:()=>void)=>handlers.set(event,handler)}});
 try{const input=new InputManager(),p=neutral();input.controllers.update([p],0,false);input.controllers.beginMapping([...input.controllers.devices.keys()][0]);assert.ok(input.controllers.mappings.wizard);handlers.get('blur')!();assert.equal(input.controllers.mappings.wizard,null);assert.equal(input.controllers.mappings.profiles.size,0);input.dispose();}
 finally{if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window');}
});
