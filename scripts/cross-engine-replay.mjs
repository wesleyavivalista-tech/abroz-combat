import {build} from 'vite';
import process from 'node:process';
import console from 'node:console';
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const jsc=process.env.JSC_PATH??'/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc';
if(!existsSync(jsc))throw Error('Set JSC_PATH to a JavaScriptCore shell to run the second engine.');
const dir=mkdtempSync(join(tmpdir(),'afterglow-replay-'));
try{
 const bundle=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:'tests/fixtures/cross-engine-replay.ts',name:'Replay',formats:['iife']}}});
 const file=join(dir,'replay.js');writeFileSync(file,'if(typeof console==="undefined")globalThis.console={log:print};\n'+(Array.isArray(bundle)?bundle[0]:bundle).output.find(o=>o.type==='chunk').code);
 const v8=JSON.parse(execFileSync(process.execPath,[file],{maxBuffer:16*1024*1024}).toString());
 const webkit=JSON.parse(execFileSync(jsc,[file],{maxBuffer:16*1024*1024}).toString());
 assert.deepEqual(webkit,v8);console.log(`V8 / JavaScriptCore: ${Object.keys(v8).length} move/scenario traces match exactly.`);
}finally{rmSync(dir,{recursive:true,force:true});}
