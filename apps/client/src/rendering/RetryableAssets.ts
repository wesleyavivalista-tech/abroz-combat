/** Own derived resources per attempt, including work completing after a rejection. */
export class RetryableAssets<T> {
 private current?:{promise:Promise<T>;dispose:()=>void};
 get(build:(own:<R extends {dispose():void}>(resource:R)=>R)=>Promise<T>):Promise<T>{
  if(this.current)return this.current.promise;
  const resources=new Set<{dispose():void}>();let disposed=false;
  const dispose=()=>{disposed=true;for(const r of resources)r.dispose();resources.clear();};
  const own=<R extends {dispose():void}>(r:R):R=>{if(disposed)r.dispose();else resources.add(r);return r;};
  const attempt={dispose,promise:Promise.resolve().then(()=>build(own)).then(value=>{
   if(disposed)throw new Error('Asset load cancelled');return value;
  }).catch(error=>{dispose();if(this.current===attempt)this.current=undefined;throw error;})};
  this.current=attempt;return attempt.promise;
 }
 dispose():void{this.current?.dispose();this.current=undefined;}
}
