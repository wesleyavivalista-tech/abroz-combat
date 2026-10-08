import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLogger,errorFields} from '../apps/server/src/observability.js';
import {DiagnosticBuffer} from '../apps/client/src/diagnostics.js';
import {RoomService} from '../apps/server/src/rooms.js';
import type {WebSocket} from 'ws';
const socket=()=>({readyState:1,bufferedAmount:0,send(){},close(){}} as unknown as WebSocket);
test('server logs are bounded, resume and preserve health visibility',()=>{
 const lines:string[]=[];let now=1000;const log=createLogger(s=>lines.push(s),()=>now,'release-123');
 for(let i=0;i<1000;i++)log('message-failed',{operation:'join'});
 assert.equal(lines.length,120);log('server-health',{connections:0});assert.equal(lines.length,121);
 now+=60000;log('connection-open');assert.equal(lines.length,123);
 const summary=JSON.parse(lines[121]);assert.equal(summary.count,880);assert.equal(summary.build,'release-123');assert.ok(summary.timestamp);
 assert.doesNotThrow(()=>createLogger(()=>{throw Error('disk');})('match-started'));
});
test('exception details exclude messages, credentials, room codes and private paths',()=>{
 const error=new TypeError('token=secret-room-ABCDE');error.stack='TypeError: token=secret-room-ABCDE\n at method (/Users/private-person/app/rooms.ts:20:3)\n at https://example.com/file.js?token=secret:1:2';
 const result=errorFields(error);assert.equal(result.kind,'exception');assert.equal(result.stack,'rooms.ts:20:3');
 assert.doesNotMatch(JSON.stringify(result),/secret|ABCDE|private-person|example/);
 assert.equal(errorFields(new Error('Room not found')).kind,'validation');
 const buffer=new DiagnosticBuffer();buffer.record('startup-failed',error);
 assert.doesNotMatch(JSON.stringify(buffer.entries),/secret|ABCDE|private-person|example/);
});
test('client reports deduplicate repeated errors and bound history',()=>{
 const buffer=new DiagnosticBuffer();for(let i=0;i<1000;i++)buffer.record('connection-error');
 assert.equal(buffer.entries.length,1);assert.equal(buffer.entries[0].count,1000);
 for(let i=0;i<100;i++)buffer.record('connection-close',undefined,i);
 assert.equal(buffer.entries.length,40);assert.equal(buffer.entries.at(-1)?.code,99);
});
test('room lifecycle diagnostics use unrelated IDs and distinguish abandonment',()=>{
 const events:{event:string;fields?:Record<string,unknown>}[]=[];
 const rooms=new RoomService((event,fields)=>events.push({event,fields}));const a=socket(),b=socket();
 rooms.create(a,'nikalz');const code=[...rooms.rooms.keys()][0];rooms.join(b,code,'jopa');rooms.ready(a);rooms.ready(b);
 const id=rooms.diagnosticRoomId(a);assert.ok(id);assert.notEqual(id,code);
 rooms.leave(a);rooms.leave(b);
 assert.deepEqual(events.map(e=>e.event),['room-created','room-joined','match-started','room-left','room-left','room-closed']);
 assert.equal(events.at(-1)?.fields?.reason,'abandoned');assert.doesNotMatch(JSON.stringify(events),new RegExp(code));assert.equal(rooms.rooms.size,0);
});
test('authoritative result logs once, ignoring client completion claims',()=>{
 const events:string[]=[];const rooms=new RoomService(e=>events.push(e));const a=socket(),b=socket();
 rooms.create(a,'nikalz');const room=[...rooms.rooms.values()][0];rooms.join(b,room.code,'jopa');rooms.ready(a);rooms.ready(b);
 rooms.finished(a,1);rooms.finished(b,1);assert.equal(events.filter(e=>e==='match-completed').length,0);
 room.verification!.simulation.state.phase='result';rooms.input(a,2,0);rooms.input(b,2,0);rooms.leave(a);rooms.leave(b);
 assert.equal(events.filter(e=>e==='match-completed').length,1);
});
test('broken diagnostic sink cannot prevent room creation or cleanup',()=>{
 const rooms=new RoomService(()=>{throw Error('sink unavailable');});const a=socket();rooms.create(a,'nikalz');rooms.leave(a);assert.equal(rooms.rooms.size,0);
});
test('copy diagnostics has a selectable fallback when clipboard is unavailable',async()=>{
 const {bindDiagnosticButton}=await import('../apps/client/src/diagnostics.js');
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Macintosh Chrome/140',clipboard:{writeText:async()=>{throw Error('denied');}}},configurable:true});
 try{
 let selected=false;const button={onclick:undefined} as unknown as HTMLButtonElement;
 const output={hidden:true,value:'',focus(){},select(){selected=true;}} as unknown as HTMLTextAreaElement;
 const status={textContent:''} as HTMLElement;bindDiagnosticButton(button,output,status);
 await button.onclick!.call(button,{} as PointerEvent);assert.equal(output.hidden,false);assert.equal(selected,true);assert.match(output.value,/contentVersion/);assert.match(status.textContent!,/copy|copie/i);
 }finally{if(old)Object.defineProperty(globalThis,'navigator',old);else Reflect.deleteProperty(globalThis,'navigator');}
});
