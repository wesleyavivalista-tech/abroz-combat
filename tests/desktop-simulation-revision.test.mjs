import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {updateSimulationRevision} from '../scripts/simulation-revision.mjs';

test('Windows CRLF and LF checkouts retain the existing LF multiplayer revision',t=>{
 const temporaryRoot=path.resolve(tmpdir());
 const root=mkdtempSync(path.join(temporaryRoot,'abroz-revision-'));
 t.after(()=>{
  const relative=path.relative(temporaryRoot,root);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  rmSync(root,{recursive:true,force:true});
 });
 const sources=[
  ['packages/game-core/fighter.ts','export const damage = 10;\n// same gameplay\n'],
  ['packages/networking/rollback.ts','export const delay = 2;\n'],
  ['packages/shared/protocol.ts','export const version = 1;\n'],
 ];
 for(const [file,text] of sources){
  mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
  writeFileSync(path.join(root,file),text);
 }
 const revision=()=>{
  updateSimulationRevision(root);
  return readFileSync(path.join(root,'packages/shared/simulationRevision.ts'),'utf8');
 };
 const legacy=createHash('sha256');
 for(const [file,text] of sources)legacy.update(file+'\0').update(text).update('\0');
 const lf=revision();
 assert.ok(lf.includes(legacy.digest('hex')),'keep compatibility with existing LF releases');
 for(const [file,text] of sources)writeFileSync(path.join(root,file),text.replaceAll('\n','\r\n'));
 assert.equal(revision(),lf,'CRLF conversion must not change compatibility');
 writeFileSync(path.join(root,sources[0][0]),sources[0][1]);
 assert.equal(revision(),lf,'mixed line endings must not change compatibility');
 writeFileSync(path.join(root,sources[0][0]),sources[0][1].replace('10','11'));
 assert.notEqual(revision(),lf,'real gameplay changes must still invalidate compatibility');
});
