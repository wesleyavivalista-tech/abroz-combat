import path from 'node:path';
import {URL} from 'node:url';
export const APP_ORIGIN='abroz://game';
export function assetPath(root,address){
 const url=new URL(address);
 if(url.protocol!=='abroz:'||url.host!=='game'||url.username||url.password)throw Error('Invalid app origin');
 const decoded=decodeURIComponent(url.pathname);
 if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').includes('..'))throw Error('Invalid asset path');
 const file=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
 const relative=path.relative(root,file);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Asset outside application');
 return file;
}
export function trustedDocument(address,devURL){
 try {const u=new URL(address),base=new URL(devURL||APP_ORIGIN);return u.protocol===base.protocol&&u.host===base.host&&(u.pathname==='/'||u.pathname==='/index.html')&&!u.username&&!u.password;}catch{return false;}
}
export function safeDevURL(value){
 if(!value)return undefined;
 const url=new URL(value);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Desktop development requires a loopback HTTP origin');
 return url.href;
}
export function contentPolicy(wsURL){
 const connect=wsURL?`${new URL(wsURL).origin} ${new URL(wsURL).origin.replace(/^wss:/,'https:').replace(/^ws:/,'http:')}`:'';
 return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' ${connect}; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'`;
}
/** Packaged online editions must never silently ship a local development relay. */
export function releaseEndpoint(value,offline=false){
 if(offline)return '';
 try{
  const url=new URL(value);
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='wss:'||url.username||url.password||host==='localhost'||host.endsWith('.localhost')||host==='[::1]'||host==='0.0.0.0'||host.startsWith('127.'))throw Error();
  return url.href;
 }catch{throw Error('Set VITE_WS_URL to a non-loopback production WSS server, or pass --offline.');}
}
export function desktopTitle(name,version,buildVersion){
 const clean=value=>String(value??'').replace(/[\r\n\t]/g,' ').slice(0,100);
 return `${name} — v${clean(version)}${buildVersion&&buildVersion!==version?` · ${clean(buildVersion)}`:''}`;
}
