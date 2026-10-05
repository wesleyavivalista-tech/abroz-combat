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
 try{const input=new InputManager();input.refresh(false);const devices=[...input.controllers.devices.values()];input.controllers.assign(devices[0].key,2);input.controllers.assign(devices[1].key,3);input.refresh(false);pads[0].axes=[1,0];pads[1].axes=[0,-1];input.refresh(false);input.keys.add('KeyJ');assert.equal(input.poll(0),Button.Light);assert.equal(input.poll(1),0);assert.equal(input.poll(2),Button.Right);assert.equal(input.poll(3),Button.Up);assert.equal(input.poll(5),0);input.dispose();}finally{if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else Reflect.deleteProperty(globalThis,'navigator');}
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
