import {createHash,randomBytes} from 'node:crypto';
export const RECONNECT_GRACE_MS=30_000;
interface Reservation {room:string;seat:number;expiresAt:number|null}
/** Server-owned bearer credentials. Raw tokens are never retained or logged. */
export class ReconnectSeats {
 private reservations=new Map<string,Reservation>();
 private digest(token:unknown):string|undefined{
  return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?createHash('sha256').update(token).digest('hex'):undefined;
 }
 checkpoint(){return [...this.reservations].map(([key,value])=>[key,{...value}] as const);}
 restore(records:ReturnType<ReconnectSeats['checkpoint']>,savedAt:number):void{
  this.reservations=new Map(records.map(([key,value])=>[key,{...value,expiresAt:value.expiresAt??savedAt+RECONNECT_GRACE_MS}]));
 }
 issue(room:string,seat:number):string{
  this.revoke(room,seat);
  const token=randomBytes(32).toString('hex');
  this.reservations.set(this.digest(token)!,{room,seat,expiresAt:null});return token;
 }
 reserve(room:string,seat:number,now=Date.now()):void{
  for(const value of this.reservations.values())if(value.room===room&&value.seat===seat&&value.expiresAt===null)value.expiresAt=now+RECONNECT_GRACE_MS;
 }
 identify(token:unknown):{room:string;seat:number}|undefined{const key=this.digest(token),value=key?this.reservations.get(key):undefined;return value?{room:value.room,seat:value.seat}:undefined;}
 claim(token:unknown,now=Date.now()):{room:string;seat:number;token:string}|undefined{
  const digest=this.digest(token);if(!digest)return;
  const value=this.reservations.get(digest);
  if(!value||value.expiresAt===null)return; // Never steal a still-connected seat.
  // Keep expired reservations until expire() reports them to room cleanup.
  if(now>=value.expiresAt)return;
  value.expiresAt=null;return {room:value.room,seat:value.seat,token:token as string};
 }
 revoke(room:string,seat?:number):void{
  for(const [key,value] of this.reservations)if(value.room===room&&(seat===undefined||value.seat===seat))this.reservations.delete(key);
 }
 expire(now=Date.now()):{room:string;seat:number}[]{
  const expired:{room:string;seat:number}[]=[];
  for(const [key,value] of this.reservations)if(value.expiresAt!==null&&now>=value.expiresAt){expired.push({room:value.room,seat:value.seat});this.reservations.delete(key);}
  return expired;
 }
}
