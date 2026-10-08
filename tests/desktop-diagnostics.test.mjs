import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createDesktopLogger} from '../apps/desktop/diagnostics.mjs';
test('desktop log renews budget, records suppression and rotates safely',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'abroz-log-'));let now=1000;
 try{
 const log=createDesktopLogger(dir,()=>({build:'test',platform:'test'}),()=>now);
 for(let i=0;i<205;i++)log('renderer-unresponsive');
 now+=60000;log('renderer-process-gone',{reason:'crashed',exitCode:1,url:'secret',error:'token=secret'});
 let lines=readFileSync(path.join(dir,'desktop.log'),'utf8').trim().split('\n');assert.equal(lines.length,31);
 const last=JSON.parse(lines.at(-1));assert.equal(last.reason,'crashed');assert.equal(last.exitCode,1);assert.equal(last.suppressed,175);assert.equal(last.build,'test');assert.doesNotMatch(lines.at(-1),/secret/);
 writeFileSync(path.join(dir,'desktop.log'),'x'.repeat(256*1024+1));log('start');assert.ok(readFileSync(path.join(dir,'desktop.log.previous')).length>256*1024);
 assert.equal(JSON.parse(readFileSync(path.join(dir,'desktop.log'),'utf8')).event,'start');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('desktop diagnostics failure does not throw',()=>{assert.doesNotThrow(()=>createDesktopLogger('/dev/null/unwritable',()=>({}))('start'));});
