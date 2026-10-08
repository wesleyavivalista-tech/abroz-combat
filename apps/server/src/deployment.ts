import {isIP} from 'node:net';
import type {IncomingMessage} from 'node:http';
const developmentOrigins='http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://127.0.0.1:5175,abroz://game';
export function allowedOrigins(value:string|undefined,production:boolean):string[]{
 if(production&&!value)throw new Error('Production requires ALLOWED_ORIGINS');
 const origins=(value??developmentOrigins).split(',').map(v=>v.trim()).filter(Boolean);
 if(!origins.length)throw new Error('At least one allowed origin is required');
 for(const origin of origins){
  if(origin==='abroz://game')continue;
  let valid=false;
  try{const u=new URL(origin);valid=u.origin===origin&&!u.username&&!u.password&&
   (u.protocol==='https:'||(!production&&u.protocol==='http:'))&&
   (!production||!['localhost','127.0.0.1','[::1]'].includes(u.hostname));}catch{/* Reject malformed origins without echoing configuration. */}
  if(!valid)throw new Error('Allowed origins must be exact HTTPS origins in production');
 }
 return [...new Set(origins)];
}
/** Enable only when ingress is exclusively Fly Proxy; never trust X-Forwarded-For. */
export function clientAddress(request:Pick<IncomingMessage,'headers'|'socket'>,trustFly:boolean):string|undefined{
 if(!trustFly)return request.socket.remoteAddress??'unknown';
 const value=request.headers['fly-client-ip'];
 return typeof value==='string'&&isIP(value)?value:undefined;
}
