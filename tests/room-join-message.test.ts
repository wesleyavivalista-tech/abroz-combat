import test from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {RoomService} from '../apps/server/src/rooms.js';
import {errorMessage} from '../apps/client/src/i18n/errors.js';
import {setLocale} from '../apps/client/src/i18n/index.js';
const started='This match has already started. Reconnecting isn’t supported yet. Return to the menu to join or create another room.';
const peer=()=>({readyState:1,bufferedAmount:0,send(){}} as unknown as WebSocket);
for(const mode of ['ffa','championship'] as const)test(`${mode}: full lobby and started match have distinct errors without changing membership`,()=>{
 const service=new RoomService(),a=peer(),b=peer(),outsider=peer();
 service.create(a,'nikalz',2,mode);const room=[...service.rooms.values()][0];service.join(b,room.code,'jopa');
 assert.throws(()=>service.join(outsider,room.code,'gut'),{message:'Room is full'});
 assert.equal(service.membership.has(outsider),false);
 service.ready(a);service.ready(b);
 assert.throws(()=>service.join(outsider,room.code,'gut'),{message:started});
 service.leave(a);
 assert.throws(()=>service.join(outsider,room.code,'gut'),{message:started});
 assert.equal(service.membership.has(outsider),false);assert.equal(room.peers.length,2);
});
test('join guidance is localized; unrelated errors retain their existing behavior',()=>{
 try{
 setLocale('en');assert.equal(errorMessage(started),started);assert.equal(errorMessage('Room is full'),'Room is full');
 setLocale('pt-BR');assert.equal(errorMessage(started),'Esta partida já começou. Ainda não é possível se reconectar. Volte ao menu para entrar em outra sala ou criar uma nova.');
 assert.notEqual(errorMessage('Room is full'),errorMessage(started));
 assert.equal(errorMessage('Unexpected diagnostic'),'Unexpected diagnostic');
 }finally{setLocale('en');}
});
