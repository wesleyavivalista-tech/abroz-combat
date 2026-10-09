import {execFileSync} from 'node:child_process';
import process from 'node:process';
/** Read the same fingerprint compiled into clients; optionally enforce the release target. */
export function validateCompatibility(metadata,expected){
 if(!Number.isInteger(metadata.protocolVersion)||typeof metadata.contentVersion!=='string'||!metadata.contentVersion.startsWith(`${metadata.protocolVersion}-`))throw Error('Invalid compatibility metadata');
 if(expected&&metadata.contentVersion!==expected)throw Error(`Release compatibility mismatch: expected ${expected}, built ${metadata.contentVersion}`);
 return metadata;
}
export function compatibilityMetadata(expected=process.env.ABROZ_EXPECTED_CONTENT_VERSION){
 const script=`Promise.all([import('./packages/shared/contentVersion.ts'),import('./packages/shared/protocol.ts')]).then(([c,p])=>console.log(JSON.stringify({contentVersion:c.contentVersion(),protocolVersion:p.PROTOCOL_VERSION})))`;
 return validateCompatibility(JSON.parse(execFileSync(process.execPath,['--import','tsx','-e',script],{encoding:'utf8'})),expected);
}
