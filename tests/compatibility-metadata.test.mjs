import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCompatibility} from '../scripts/compatibility-metadata.mjs';
test('release target rejects a different compatibility identifier',()=>{
 const metadata={protocolVersion:46,contentVersion:'46-abc'};
 assert.deepEqual(validateCompatibility(metadata,'46-abc'),metadata);
 assert.throws(()=>validateCompatibility(metadata,'46-old'),/mismatch/);
 assert.throws(()=>validateCompatibility({...metadata,protocolVersion:45}),/Invalid/);
});
import {isUpdateLink} from '../apps/desktop/policy.mjs';
test('desktop update link permits only the exact official download page',()=>{
 assert.equal(isUpdateLink('https://abrozcombat.com/download'),true);
 for(const url of ['https://abrozcombat.com.evil/download','http://abrozcombat.com/download','file:///tmp/app','https://abrozcombat.com/download?redirect=evil'])assert.equal(isUpdateLink(url),false);
});
