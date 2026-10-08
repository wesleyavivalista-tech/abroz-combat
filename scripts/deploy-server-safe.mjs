import {execFileSync} from 'node:child_process';
import process from 'node:process';
import {setTimeout} from 'node:timers';
import console from 'node:console';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function onlyMachine(machines){
 if(!Array.isArray(machines)||machines.length!==1)throw Error('Expected exactly one machine; inspect topology manually.');
 const m=machines[0];
 if(m.state!=='started'||!m.id||!m.version)throw Error('Machine must be started with a known version.');
 return `${m.id}:${m.version}`;
}
export function assertDrained(health){
 if(health?.status!=='draining')throw Error('Server is not draining. Enter maintenance first; no deployment performed.');
 for(const key of ['rooms','connections','waitingRooms','activeRooms','activeMatches','resultRooms']){
  if(health[key]!==0)throw Error(`Deployment blocked: ${key} must be zero.`);
 }
 if(typeof health.contentVersion!=='string'||!health.contentVersion)throw Error('Missing server content version.');
}
export async function guardedDeploy({inventory,health,wait,deploy}){
 const identity=onlyMachine(await inventory());
 const first=await health();assertDrained(first);
 await wait();
 const second=await health();assertDrained(second);
 if(first.contentVersion!==second.contentVersion||onlyMachine(await inventory())!==identity)throw Error('Server changed during preflight; retry after inspection.');
 return deploy();
}
export function deploymentArgs(app,image,config){
 if(!/^[a-z][a-z0-9-]{2,62}$/.test(app??''))throw Error('Set FLY_APP_NAME.');
 if(!new RegExp(`^registry\\.fly\\.io/${app}@sha256:[a-f0-9]{64}$`).test(image??''))throw Error('Set ABROZ_SERVER_IMAGE to a reviewed immutable image digest for this app.');
 if(!config)throw Error('Set ABROZ_FLY_CONFIG to the reviewed generated configuration.');
 return ['deploy','--app',app,'--config',config,'--image',image,'--ha=false','--strategy','rolling'];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const app=process.env.FLY_APP_NAME;
  const args=deploymentArgs(app,process.env.ABROZ_SERVER_IMAGE,process.env.ABROZ_FLY_CONFIG);
  const fly=process.env.FLYCTL_PATH||'flyctl';
  await guardedDeploy({
   inventory:()=>JSON.parse(execFileSync(fly,['machine','list','--app',app,'--json'],{encoding:'utf8',timeout:15000})),
   health:async()=>{const r=await globalThis.fetch(`https://${app}.fly.dev/healthz`,{cache:'no-store',redirect:'error',signal:globalThis.AbortSignal.timeout(5000)});if(!r.ok)throw Error('Health request failed.');return r.json();},
   wait:()=>new Promise(r=>setTimeout(r,2000)),
   deploy:()=>execFileSync(fly,args,{stdio:'inherit'}),
  });
 }catch(error){console.error(`Safe deployment stopped: ${error.message}`);process.exitCode=1;}
}
