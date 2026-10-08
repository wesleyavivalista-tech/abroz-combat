/** Bounds live sockets and upgrade attempts without trusting forwarded IP headers. */
export class Admission {
 private active=new Map<string,number>();
 private attempts=new Map<string,{start:number;count:number}>();
 private total=0;
 constructor(readonly maximum=256,readonly perAddress=32,readonly attemptsPerMinute=120){}
 allow(address:string,now=Date.now()):boolean{
  for(const [key,value] of this.attempts)if(now-value.start>=60000)this.attempts.delete(key);
  let window=this.attempts.get(address);
  if(!window){if(this.attempts.size>=4096)return false;window={start:now,count:0};this.attempts.set(address,window);}
  return ++window.count<=this.attemptsPerMinute&&this.total<this.maximum&&(this.active.get(address)??0)<this.perAddress;
 }
 connect(address:string):()=>void{
  this.total++;this.active.set(address,(this.active.get(address)??0)+1);
  let released=false;
  return ()=>{if(released)return;released=true;this.total--;const n=this.active.get(address)!-1;if(n)this.active.set(address,n);else this.active.delete(address);};
 }
}
export function positiveLimit(value:string|undefined,fallback:number):number{
 if(value===undefined)return fallback;
 const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new Error('Connection limits must be positive integers');return n;
}
