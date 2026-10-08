import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,URL} from 'node:url';
import console from 'node:console';
import path from 'node:path';
import process from 'node:process';
import {releaseEndpoint} from '../apps/desktop/policy.mjs';
export function releaseSettings(env){
 const slug=(value,name)=>{if(typeof value!=='string'||!/^[a-z][a-z0-9-]{2,62}$/.test(value))throw Error(`Set ${name} to the actual provisioned project name`);return value;};
 const flyApp=slug(env.FLY_APP_NAME,'FLY_APP_NAME'),pagesProject=slug(env.CLOUDFLARE_PAGES_PROJECT,'CLOUDFLARE_PAGES_PROJECT');
 let web;try{web=new URL(env.PUBLIC_WEB_ORIGIN);}catch{throw Error('Set PUBLIC_WEB_ORIGIN to the actual HTTPS game origin');}
 if(web.protocol!=='https:'||web.origin!==env.PUBLIC_WEB_ORIGIN||web.username||web.password||web.hostname.endsWith('.example')||web.hostname==='example.com'||['localhost','127.0.0.1','[::1]'].includes(web.hostname))throw Error('PUBLIC_WEB_ORIGIN must be an exact public HTTPS origin');
 const wsURL=releaseEndpoint(env.VITE_WS_URL);
 if(new URL(wsURL).host!==`${flyApp}.fly.dev`||new URL(wsURL).pathname!=='/'||new URL(wsURL).search||new URL(wsURL).hash)throw Error('First deployment requires the provisioned Fly app WSS root');
 const buildVersion=env.ABROZ_BUILD_VERSION;
 if(typeof buildVersion!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/.test(buildVersion))throw Error('Set a unique ABROZ_BUILD_VERSION');
 return {flyApp,pagesProject,webOrigin:web.origin,wsURL,buildVersion};
}
export function flyConfig(settings,template){
 return `app = ${JSON.stringify(settings.flyApp)}\n`+template.replace('dockerfile = "Dockerfile"','dockerfile = "../../Dockerfile"').replace('[env]',`[env]\n  ALLOWED_ORIGINS = ${JSON.stringify([...new Set([settings.webOrigin,`https://${settings.pagesProject}.pages.dev`,'abroz://game'])].join(','))}`);
}
export function webHeaders(settings){return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' ${new URL(settings.wsURL).origin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/release.json
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/art/*
  Cache-Control: public, max-age=0, must-revalidate
/audio/*
  Cache-Control: public, max-age=0, must-revalidate
`;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const settings=releaseSettings(process.env);mkdirSync('deploy/local',{recursive:true});
 writeFileSync('deploy/local/fly.toml',flyConfig(settings,readFileSync('deploy/fly.toml','utf8')));
 writeFileSync('deploy/local/release.json',JSON.stringify(settings,null,2)+'\n');
 console.log('Validated release configuration prepared. No services deployed.');
}
