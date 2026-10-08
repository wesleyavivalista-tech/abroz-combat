import console from 'node:console';
import {spawnSync,execFileSync} from 'node:child_process';
import {writeFileSync,readdirSync,statSync,readFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {releaseSettings,webHeaders} from './release-config.mjs';
const settings=releaseSettings(process.env);
if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit or preserve reviewed changes before producing a release candidate');
for(const args of [['scripts/simulation-revision.mjs'],['node_modules/typescript/bin/tsc','--noEmit'],['node_modules/vite/bin/vite.js','build','--config','apps/client/vite.config.ts']]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,VITE_WS_URL:settings.wsURL}});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
}
const files=[];const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else files.push(file);}};walk('dist');
if(files.length+2>20000||files.some(f=>statSync(f).size>25*1024*1024))throw Error('Browser output exceeds Cloudflare Pages file limits');
writeFileSync('dist/_headers',webHeaders(settings));
writeFileSync('dist/release.json',JSON.stringify({version:JSON.parse(readFileSync('package.json','utf8')).version,build:settings.buildVersion,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},null,2)+'\n');
console.log('Release web build validated; ready for Pages upload.');
