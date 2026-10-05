/** Fixed arithmetic paths for authoritative math. Do not use native transcendental
 * functions here: their last bits can differ between JavaScript engines. */
export function deterministicHypot(x:number,y:number):number{
 const scale=Math.max(Math.abs(x),Math.abs(y));if(scale===0)return 0;
 const a=x/scale,b=y/scale,n=a*a+b*b;
 let root=1.5;
 for(let i=0;i<8;i++)root=(root+n/root)*.5;
 return root*scale;
}
export function deterministicSin(angle:number):number{
 const tau=2*Math.PI;
 let x=angle%tau;if(x>Math.PI)x-=tau;if(x< -Math.PI)x+=tau;
 if(x===Math.PI/2)return 1;if(x===-Math.PI/2)return -1;if(x===0)return x;
 // Fixed iteration count and operation order, with error below 1e-14 on [-pi,pi].
 let term=x,sum=x;
 for(let n=1;n<=13;n++){term*=-(x*x)/((2*n)*(2*n+1));sum+=term;}
 return sum;
}
export function deterministicCos(angle:number):number{return deterministicSin(angle+Math.PI/2);}
