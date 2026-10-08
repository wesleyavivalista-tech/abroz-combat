import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
test('install manifest starts the game, not the landing page, with a real 512px icon',()=>{
 const m=JSON.parse(readFileSync('apps/client/public/manifest.webmanifest','utf8'));
 assert.equal(m.start_url,'/play');assert.equal(m.scope,'/');assert.equal(m.display,'standalone');
 const png=readFileSync('apps/client/public'+m.icons[0].src);assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);
 const page=readFileSync('apps/client/index.html','utf8');assert.ok(page.includes('href="/play"'));assert.ok(page.includes('href="/download"'));assert.ok(!page.includes('bootstrap.ts'));
 assert.ok(readFileSync('apps/client/play.html','utf8').includes('bootstrap.ts'));
});
test('install prompt is single-use; rejection and blocked storage do not break the page',async()=>{
 const events:Record<string,(e?:unknown)=>void>={};let click:()=>Promise<void>=async()=>{};
 const button={hidden:true,disabled:false,addEventListener:(_name:string,fn:()=>Promise<void>)=>{click=fn;}};
 const status={textContent:''};const document={documentElement:{lang:''},querySelectorAll:()=>[],querySelector:(s:string)=>s==='#install'?button:status};
 runInNewContext(ts.transpile(readFileSync('apps/client/src/launch.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}),{exports:{},document,localStorage:{getItem:()=>{throw Error('blocked');}},navigator:{language:'en-US'},window:{addEventListener:(n:string,f:(e?:unknown)=>void)=>events[n]=f}});
 assert.equal(button.hidden,true);let calls=0;
 events.beforeinstallprompt({preventDefault(){},prompt:async()=>{calls++;},userChoice:Promise.resolve({outcome:'dismissed'})});
 assert.equal(button.hidden,false);await click();await click();assert.equal(calls,1);assert.equal(button.hidden,true);assert.equal(button.disabled,false);
 events.beforeinstallprompt({preventDefault(){},prompt:async()=>{throw Error('unsupported');}});await click();assert.equal(button.disabled,false);assert.ok(status.textContent.includes('browser'));
 events.appinstalled();assert.equal(status.textContent,'App installed.');
});
