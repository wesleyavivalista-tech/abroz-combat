/* global fetch */
import {spawn} from 'node:child_process';
import {releaseEndpoint} from '../apps/desktop/policy.mjs';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,URL} from 'node:url';
import path from 'node:path';
import process from 'node:process';
import {setTimeout} from 'node:timers/promises';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const require=createRequire(import.meta.url),args=process.argv.slice(2),command=args.shift();
const children=new Set();
const env={...process.env,PATH:path.dirname(process.execPath)+path.delimiter+(process.env.PATH||'')};
const run=(file,parameters=[],extra={})=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[file,...parameters],{cwd:root,env:{...env,...extra},stdio:'inherit'});children.add(child);
 child.once('error',reject);child.once('exit',code=>{children.delete(child);if(code===0)resolve();else reject(Error(`${path.basename(file)} failed (${code})`));});
});
function stop(){for(const child of children)child.kill();}
process.on('SIGINT',()=>{stop();process.exit(130);});process.on('SIGTERM',()=>{stop();process.exit(143);});
async function launch(url){
 const binary=require('electron');
 const child=spawn(binary,['apps/desktop/main.mjs'],{env:{...env,...(url?{ABROZ_DESKTOP_URL:url}:{})},stdio:'inherit'});children.add(child);
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>{children.delete(child);if(code===0)resolve();else reject(Error(`Desktop exited (${code})`));});});
}
try{
 if(command==='dev'){
  const url='http://127.0.0.1:5175/play.html';
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/client/vite.config.ts','--host','127.0.0.1','--port','5175','--strictPort'],{env:{...env,VITE_WS_URL:env.VITE_WS_URL||'ws://localhost:8080'},stdio:'inherit'});children.add(server);
  let exited=false;server.once('exit',()=>{exited=true;});server.once('error',()=>{exited=true;});
  let ready=false;for(let i=0;i<100&&!exited;i++){try{const r=await fetch(url);if(r.ok){ready=true;break;}}catch{/* server booting */}await setTimeout(100);}
  if(!ready||exited)throw Error('Desktop development server could not start on port 5175.');
  await launch(url);server.kill();
 }else if(command==='run'){
  if(!existsSync('dist-desktop/desktop-config.json'))throw Error('Build desktop assets first (build:desktop -- --offline --dir for an offline preview).');
  await launch();
 }else if(command==='build'){
  const offline=args.includes('--offline'),wsURL=releaseEndpoint(env.VITE_WS_URL,offline);

  await run('node_modules/typescript/bin/tsc',['--noEmit']);
  await run('node_modules/vite/bin/vite.js',['build','--config','apps/client/vite.config.ts','--mode','desktop'],{VITE_WS_URL:wsURL});
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  writeFileSync('dist-desktop/desktop-config.json',JSON.stringify({version:pkg.version,buildVersion:env.ABROZ_BUILD_VERSION||pkg.version,wsURL,offline},null,2));
  await run('node_modules/electron-builder/cli.js',['--config','apps/desktop/builder.cjs','--publish','never',...args.filter(a=>a!=='--offline')]);
 }else throw Error('Usage: node scripts/desktop.mjs dev | run | build [--offline] [--dir | --win | --mac | --linux]');
}catch(error){stop();process.stderr.write(`${error.message}\n`);process.exitCode=1;}
