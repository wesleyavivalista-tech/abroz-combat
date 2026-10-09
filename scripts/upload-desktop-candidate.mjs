import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,readdir,rename,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

// GitHub normalizes spaces in release-asset names. Normalize before hashing
// so downloaded files can be verified directly with the published checksum.
export const candidateAssetName=name=>name.replaceAll(' ','.');

export function validateCandidate(release,metadata,env){
 if(!/^desktop-candidate-\d+-\d+$/.test(env.ABROZ_CANDIDATE_TAG??''))throw Error('Invalid candidate tag');
 if(!['windows-x64','macos-arm64','macos-x64'].includes(env.ABROZ_CANDIDATE_PLATFORM))throw Error('Invalid platform');
 if(!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))throw Error('Invalid commit');
 if(!release.isDraft||release.targetCommitish!==env.GITHUB_SHA)throw Error('Release must be a draft for this exact commit');
 if(metadata.offline||metadata.buildVersion!==env.GITHUB_SHA||!metadata.wsURL?.startsWith('wss://')||!Number.isInteger(metadata.protocolVersion)||!metadata.contentVersion?.startsWith(`${metadata.protocolVersion}-`))throw Error('Invalid online build metadata');
}
export async function uploadCandidate(env=process.env){
 const metadata=JSON.parse(await readFile('dist-desktop/desktop-config.json','utf8'));
 const release=JSON.parse(execFileSync('gh',['release','view',env.ABROZ_CANDIDATE_TAG,'--json','isDraft,targetCommitish'],{encoding:'utf8'}));
 validateCandidate(release,metadata,env);
 const platform=env.ABROZ_CANDIDATE_PLATFORM;
 const suffix=platform==='windows-x64'?'win-x64.exe':platform==='macos-arm64'?'mac-arm64.dmg':'mac-x64.dmg';
 const files=(await readdir('release')).filter(name=>name.endsWith(`-${metadata.version}-${suffix}`));
 if(files.length!==1)throw Error('Expected exactly one matching installer');
 const assetName=candidateAssetName(files[0]),installer=path.join('release',assetName),hash=createHash('sha256');
 if(assetName!==files[0])await rename(path.join('release',files[0]),installer);
 for await(const chunk of createReadStream(installer))hash.update(chunk);
 const checksum=path.join('release',`SHA256SUMS-${platform}.txt`),manifest=path.join('release',`metadata-${platform}.json`);
 await writeFile(checksum,`${hash.digest('hex')}  ${assetName}\n`);
 await writeFile(manifest,JSON.stringify({...metadata,platform,commit:env.GITHUB_SHA},null,2)+'\n');
 // No --clobber: concurrent jobs cannot overwrite each other's output.
 execFileSync('gh',['release','upload',env.ABROZ_CANDIDATE_TAG,installer,checksum,manifest],{stdio:'inherit'});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await uploadCandidate();
