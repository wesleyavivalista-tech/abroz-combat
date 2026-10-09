import {test} from 'node:test';
import assert from 'node:assert/strict';
import {errorMessage} from '../apps/client/src/i18n/errors.js';
import {setLocale,getLocale} from '../apps/client/src/i18n/index.js';
test('desktop mismatch explains installation in both languages; browser retains reload guidance',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'window'),locale=getLocale();
 const message='Game versions differ. Refresh the game before joining a room.';
 try{
  Object.defineProperty(globalThis,'window',{value:{abrozDesktop:{}},configurable:true});
  setLocale('en');assert.match(errorMessage(message),/Download and install/);assert.match(errorMessage(message),/https:\/\/abrozcombat.com\/download/);
  setLocale('pt-BR');assert.match(errorMessage(message),/Baixe e instale/);
  Object.defineProperty(globalThis,'window',{value:{},configurable:true});setLocale('en');assert.match(errorMessage(message),/Refresh/);
 }finally{setLocale(locale);if(old)Object.defineProperty(globalThis,'window',old);else Reflect.deleteProperty(globalThis,'window');}
});
