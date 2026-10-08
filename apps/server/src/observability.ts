import {randomUUID} from 'node:crypto';
import {contentVersion} from '../../../packages/shared/contentVersion.js';
export type DiagnosticFields=Record<string,string|number|boolean|undefined>;
export type DiagnosticSink=(event:string,fields?:DiagnosticFields)=>void;
/** Diagnostic IDs never reveal invitation codes and never consume gameplay RNG. */
export const diagnosticId=()=>randomUUID();
export function safeStack(error:unknown):string{
 if(!(error instanceof Error))return '';
 // Keep source locations only: no exception message, URL query, user path or payload.
 return (error.stack??'').split('\n').slice(1,9).map(line=>line.match(/([\w.-]+\.[cm]?[jt]s):\d+:\d+(?=[)\s]*$)/)?.[0]??'').filter(Boolean).join(' ');
}
const expected=new Set([
 'Invalid message','Unknown message','Invalid room code','Invalid match mode','Invalid team','Invalid arena','Server full',
 'Room not found','Already in this room','Room is full','That team is full. Choose another team or Auto balance.',
 'This match has already started. Reconnecting isn’t supported yet. Return to the menu to join or create another room.',
 'Match has not started','Invalid input','Out-of-order input','Input too far ahead','Input rate exceeded','Unknown character',
 'Room size must be 2–8 fighters','Room size must be 2–16 fighters',
 'Game versions differ. Refresh the game before joining a room.',
 'Server maintenance: new rooms are temporarily unavailable.',
]);
export function errorFields(error:unknown):DiagnosticFields{
 const message=error instanceof Error?error.message:'';
 const validation=expected.has(message)||/^Unknown skin for [a-z0-9-]+$/.test(message);
 return {kind:validation?'validation':'exception',error:validation?(message.startsWith('Unknown skin for ')?'Unknown skin':message):error instanceof SyntaxError?'SyntaxError':error instanceof TypeError?'TypeError':error instanceof RangeError?'RangeError':'UnexpectedError',stack:validation?undefined:safeStack(error)};
}
/** Bound log volume; logging failures must not change network or game behavior. */
export function createLogger(write:(line:string)=>void=console.log,now=Date.now,build=process.env.ABROZ_BUILD_VERSION??process.env.FLY_IMAGE_REF??'development'):DiagnosticSink{
 let window=now(),count=0,dropped=0;
 const version=contentVersion();
 const emit=(event:string,fields:DiagnosticFields)=>write(JSON.stringify({timestamp:new Date(now()).toISOString(),service:'multiplayer',build:build.replace(/[^a-zA-Z0-9._:/+-]/g,'').slice(0,160),contentVersion:version,event,...fields}));
 return (event,fields={})=>{try{
  if(now()-window>=60000){if(dropped)emit('logs-suppressed',{count:dropped});window=now();count=0;dropped=0;}
  // Health and fatal events retain visibility even when validation errors exhaust the budget.
  if(event!=='server-health'&&event!=='fatal-error'&&++count>120){dropped++;return;}
  emit(event,fields);
 }catch{/* Diagnostics are best effort. */}};
}
