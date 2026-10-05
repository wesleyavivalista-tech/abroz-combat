import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,URL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const walk=dir=>readdirSync(root+dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
export function updateSimulationRevision(){
 const files=[...walk('packages/game-core'),...walk('packages/networking'),'packages/shared/protocol.ts'].filter(p=>p.endsWith('.ts')).sort();
 const hash=createHash('sha256');for(const p of files)hash.update(p+'\0').update(readFileSync(root+p)).update('\0');
 const text=`// Generated from deterministic source files. Do not edit by hand.\nexport const SIMULATION_REVISION = '${hash.digest('hex')}';\n`;
 const output=root+'packages/shared/simulationRevision.ts';let old='';try{old=readFileSync(output,'utf8');}catch{/* First generation. */}
 if(old!==text)writeFileSync(output,text);
}
updateSimulationRevision();
