const reasons=new Set(['Server full','Too many connections from this network. Try again later.','Too many connection attempts. Wait a minute and try again.','Server maintenance: new rooms are temporarily unavailable.']);
/** The browser hides rejected WebSocket handshakes. Query only after failure. */
export async function connectionFailureReason(endpoint:string):Promise<string|undefined>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1000);
 try{
  const url=new URL(endpoint);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/connection-status';url.search='';url.hash='';
  const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'});
  if(!response.ok)return;
  const data=await response.json();return reasons.has(data?.reason)?data.reason:undefined;
 }catch{return undefined;}finally{clearTimeout(timer);}
}
