import {test} from 'node:test';
import assert from 'node:assert/strict';
import {multiplayerEndpoint} from '../apps/client/src/platform/runtime.js';
import {storage} from '../apps/client/src/platform/storage.js';
test('web endpoint fallback remains unchanged; desktop never infers an app host',()=>{
 assert.equal(multiplayerEndpoint(undefined,false,'https:','example.com'),'wss://example.com:8080');
 assert.equal(multiplayerEndpoint(undefined,false,'http:','localhost'),'ws://localhost:8080');
 assert.throws(()=>multiplayerEndpoint(undefined,true,'abroz:','game'),/not configured/);
 assert.equal(multiplayerEndpoint('wss://relay.example',true,'abroz:','game'),'wss://relay.example/');
 assert.throws(()=>multiplayerEndpoint('ws://relay.example',true,'abroz:','game'),/secure/);
 assert.equal(multiplayerEndpoint('ws://localhost:8080',true,'http:','localhost'),'ws://localhost:8080/');
 for(const url of ['https://relay.example','wss://secret:pass@relay.example'])assert.throws(()=>multiplayerEndpoint(url,true,'abroz:','game'));
});
test('storage adapter keeps exact values and tolerates blocked storage',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>();
 try{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
 storage.setItem('afterglow-controls','{"bindings":[]}');assert.equal(storage.getItem('afterglow-controls'),'{"bindings":[]}');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('denied');}});assert.equal(storage.getItem('x'),null);assert.doesNotThrow(()=>storage.setItem('x','y'));
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');}
});
