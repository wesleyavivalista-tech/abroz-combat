import { test } from "node:test";
import assert from "node:assert/strict";
import { InputManager } from "../apps/client/src/input/InputManager.js";
import { Button } from "../packages/game-core/types.js";
test("short Super key taps survive keyup before the next tick, exactly once", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const handlers = new Map<string, (event: KeyboardEvent) => void>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: (
        name: string,
        handler: (event: KeyboardEvent) => void,
      ) => handlers.set(name, handler),
    },
  });
  try {
    const input = new InputManager();
    const event = (code: string) =>
      ({
        code,
        target: { matches: () => false },
        preventDefault() {},
      }) as unknown as KeyboardEvent;
    handlers.get("keydown")!(event("KeyO"));
    handlers.get("keyup")!(event("KeyO"));
    assert.equal(input.poll(0), Button.Super1);
    assert.equal(input.poll(0), 0);
    handlers.get("keydown")!(event("Digit8"));
    handlers.get("keyup")!(event("Digit8"));
    assert.equal(input.poll(0), 0);
    assert.equal(input.poll(1), Button.Super2);
    assert.equal(input.poll(1), 0);
    handlers.get("keydown")!(event("KeyP"));
    input.clear();
    assert.equal(input.poll(0), 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test('explicit pad assignments preserve keyboard seats and support sparse browser indices',()=>{
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){}}});
 const pads=[{index:4,id:'Xbox',mapping:'standard',connected:true,axes:[0,0],buttons:[]},{index:7,id:'DualSense',mapping:'standard',connected:true,axes:[0,0],buttons:[]}];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[null,...pads]}});
 try{const input=new InputManager();input.refresh(false);const devices=[...input.controllers.devices.values()];input.controllers.assign(devices[0].key,2);input.controllers.assign(devices[1].key,3);input.refresh(false);pads[0].axes=[1,0];pads[1].axes=[0,-1];input.refresh(false);input.keys.add('KeyJ');assert.equal(input.poll(0),Button.Light);assert.equal(input.poll(1),0);assert.equal(input.poll(2),Button.Right);assert.equal(input.poll(3),0);assert.equal(input.poll(5),0);input.dispose();}finally{if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else Reflect.deleteProperty(globalThis,'navigator');}
});
test('every existing keyboard action retains held and short-tap semantics for both layouts',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'window');const handlers=new Map<string,(e:KeyboardEvent)=>void>();
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(n:string,h:(e:KeyboardEvent)=>void)=>handlers.set(n,h)}});
 try{const input=new InputManager();const bits=[Button.Left,Button.Right,Button.Up,Button.Down,Button.Light,Button.Medium,Button.Heavy,Button.Special,Button.Special2,Button.Super1,Button.Super2];const event=(code:string)=>({code,target:{matches:()=>false},preventDefault(){}} as unknown as KeyboardEvent);
 for(let player=0;player<2;player++)for(let i=0;i<bits.length;i++){const e=event(input.bindings[player][i]);handlers.get('keydown')!(e);assert.equal(input.poll(player),bits[i]);assert.equal(input.poll(player),bits[i]);assert.equal(input.poll(1-player),0);handlers.get('keyup')!(e);assert.equal(input.poll(player),0);handlers.get('keydown')!(e);handlers.get('keyup')!(e);assert.equal(input.poll(player),bits[i]);assert.equal(input.poll(player),0);}
 input.dispose();}finally{if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window');}
});
test('held Escape suppresses native dialog cancellation without repeatedly pausing',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'window');let handler:((e:KeyboardEvent)=>void)|undefined;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(n:string,h:(e:KeyboardEvent)=>void)=>{if(n==='keydown')handler=h;}}});
 try{const input=new InputManager();let prevented=0;for(const repeat of [false,true,true])handler!({code:'Escape',repeat,target:{matches:()=>false},preventDefault(){prevented++;}} as unknown as KeyboardEvent);assert.equal(prevented,3);assert.deepEqual(input.systemActions,['pause']);input.dispose();}finally{if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window');}
});

function inputFixture(run:(input:InputManager,emit:(name:string,code?:string,repeat?:boolean)=>void)=>void){
 const old=Object.getOwnPropertyDescriptor(globalThis,'window');const handlers=new Map<string,(e:KeyboardEvent)=>void>();
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(n:string,h:(e:KeyboardEvent)=>void)=>handlers.set(n,h)}});
 const input=new InputManager();
 try{run(input,(name,code='',repeat=false)=>handlers.get(name)?.({code,repeat,target:{matches:()=>false},preventDefault(){}} as unknown as KeyboardEvent));}
 finally{input.dispose();if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window');}
}
test('screen cleanup rejects held-key auto-repeat until a fresh press',()=>inputFixture((input,emit)=>{
 emit('keydown','KeyJ');assert.equal(input.poll(0),Button.Light);input.clear();emit('keydown','KeyJ',true);assert.equal(input.poll(0),0);
 emit('keyup','KeyJ');emit('keydown','KeyJ');assert.equal(input.poll(0),Button.Light);
}));
test('blur clears queued system actions and ignores gameplay until focus returns',()=>inputFixture((input,emit)=>{
 emit('keydown','Escape');emit('keydown','KeyR');emit('blur');assert.deepEqual(input.systemActions,[]);
 emit('keydown','KeyJ');assert.equal(input.poll(0),0);emit('focus');emit('keydown','KeyJ');assert.equal(input.poll(0),Button.Light);
}));
test('held training reset emits once rather than every keyboard repeat',()=>inputFixture((input,emit)=>{
 emit('keydown','KeyR');emit('keydown','KeyR',true);emit('keydown','KeyR',true);assert.deepEqual(input.systemActions,['reset']);
}));
test('background polling cannot reactivate controllers and refocus waits for neutral',()=>inputFixture((input,emit)=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');const p={index:7,id:'Xbox',mapping:'standard',connected:true,axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[p]}});
 try{
  input.refresh(false);input.controllers.assign([...input.controllers.devices.keys()][0],0);input.refresh(false);input.controllers.drain();
  emit('blur');input.refresh(false);p.buttons[0]={pressed:true,value:1};input.refresh(false);assert.equal(input.poll(0),0);assert.equal(input.controllers.drain().filter(e=>e.kind==='menu').length,0);
  emit('focus');input.refresh(false);assert.equal(input.poll(0),0);
  p.buttons[0]={pressed:false,value:0};input.refresh(false);p.buttons[0]={pressed:true,value:1};input.refresh(false);assert.equal(input.poll(0),Button.Up);
 }finally{if(old)Object.defineProperty(globalThis,'navigator',old);else Reflect.deleteProperty(globalThis,'navigator');}
}));

test('background disconnect notifications do not discard ownership before focused polling',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'window');const handlers=new Map<string,(e:unknown)=>void>();
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(n:string,h:(e:unknown)=>void)=>handlers.set(n,h)}});
 try{const input=new InputManager();const p={index:3,id:'Xbox',mapping:'standard',connected:true,axes:[0,0],buttons:[]};const d=input.controllers.discover(p);input.controllers.assign(d.key,0);
 handlers.get('blur')!({});handlers.get('gamepaddisconnected')!({gamepad:p});assert.equal(input.controllers.device(0)?.connected,true);
 handlers.get('focus')!({});input.controllers.update([],100,false);assert.equal(input.controllers.device(0)?.connected,false);input.dispose();
 }finally{if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window');}
});

test('saved old defaults migrate, custom attack bindings remain intact',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{for(const [saved,expected] of [[[0,2,1,3,5,6,7],[2,3,1,5,7,4,6]],[[3,2,1,0,5,6,7],[3,2,1,0,5,6,7]]]){
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify({gamepadButtons:saved})}});
 inputFixture(input=>assert.deepEqual(input.gamepadButtons,expected));
 }}finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');}
});
