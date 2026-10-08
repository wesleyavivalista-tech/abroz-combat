/** Separate lobby abuse budgets from gameplay input. Reconnects share the address budget. */
interface Bucket { tokens:number; at:number }
export const LOBBY_RATE_ERROR='Too many lobby attempts. Wait a moment and try again.';
export class LobbyBudget {
 private sockets=new WeakMap<object,Bucket>();
 private addresses=new Map<string,Bucket>();
 allow(socket:object,address:string,now=Date.now()):boolean{
  // Bound address history even when many different clients reconnect.
  for(const [key,value] of this.addresses)if(now-value.at>=600_000)this.addresses.delete(key);
  let own=this.sockets.get(socket);
  if(!own){own={tokens:30_000,at:now};this.sockets.set(socket,own);}
  let shared=this.addresses.get(address);
  if(!shared){if(this.addresses.size>=4096)return false;shared={tokens:64_000,at:now};this.addresses.set(address,shared);}
  this.refill(own,30_000,now);this.refill(shared,64_000,now);
  if(own.tokens<3000||shared.tokens<500)return false;
  own.tokens-=3000;shared.tokens-=500;return true;
 }
 private refill(bucket:Bucket,burst:number,now:number):void{
  bucket.tokens=Math.min(burst,bucket.tokens+Math.max(0,now-bucket.at));bucket.at=now;
 }
}
/** Pongs prove transport liveness, not useful room membership. */
export class RoomlessDeadline {
 private since:number|undefined;
 constructor(now=Date.now()){this.since=now;}
 expired(hasRoom:boolean,now=Date.now()):boolean{
  if(hasRoom){this.since=undefined;return false;}
  this.since??=now;
  return now-this.since>=120_000;
 }
}
