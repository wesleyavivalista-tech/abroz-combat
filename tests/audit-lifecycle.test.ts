import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InputManager} from '../apps/client/src/input/InputManager.js';
test('input teardown removes listeners and remount handles each event once',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'window');
 const surface=new EventTarget();Object.defineProperty(globalThis,'window',{configurable:true,value:surface});
 const key=()=>{const event=new Event('keydown');Object.defineProperties(event,{code:{value:'KeyJ'},target:{value:{matches:()=>false}}});surface.dispatchEvent(event);};
 const first=new InputManager();
 try{
  key();assert.ok(first.keys.has('KeyJ'));first.dispose();
  const second=new InputManager();try{key();assert.equal(first.keys.size,0);assert.ok(second.keys.has('KeyJ'));second.dispose();key();assert.equal(second.keys.size,0);}finally{second.dispose();}
 }finally{first.dispose();if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window');}
});
