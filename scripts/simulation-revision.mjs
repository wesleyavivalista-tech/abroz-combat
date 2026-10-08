import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,URL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export function updateSimulationRevision(sourceRoot=root){
 const walk=dir=>readdirSync(path.join(sourceRoot,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
 const files=[...walk('packages/game-core'),...walk('packages/networking'),'packages/shared/protocol.ts','packages/shared/recovery.ts'].filter(p=>p.endsWith('.ts')).sort();
 // Git may check out identical sources as CRLF on Windows. Preserve the LF release
 // hash so line-ending conversion alone never rejects cross-platform peers.
 const hash=createHash('sha256');for(const p of files)hash.update(p+'\0').update(readFileSync(path.join(sourceRoot,p),'utf8').replace(/\r\n/g,'\n')).update('\0');
 const text=`// Generated from deterministic source files. Do not edit by hand.\nexport const SIMULATION_REVISION = '${hash.digest('hex')}';\n`;
 const output=path.join(sourceRoot,'packages/shared/simulationRevision.ts');let old='';try{old=readFileSync(output,'utf8');}catch{/* First generation. */}
 if(old!==text)writeFileSync(output,text);
}
updateSimulationRevision();
