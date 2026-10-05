export interface DesktopBridge {toggleFullscreen():Promise<void>;reportFailure(category:string):void;}
declare global {interface Window {abrozDesktop?:DesktopBridge;}}
export function desktopBridge():DesktopBridge|undefined{return typeof window==='undefined'?undefined:window.abrozDesktop;}
export async function toggleFullscreen():Promise<void>{
 const desktop=desktopBridge();
 if(desktop){await desktop.toggleFullscreen();return;}
 if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();
}
export function multiplayerEndpoint(configured:string|undefined,desktop:boolean,protocol:string,hostname:string):string{
 if(configured){
  const url=new URL(configured);
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid multiplayer server configuration.');
  if(desktop&&url.protocol!=='wss:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Desktop multiplayer requires a secure WSS server.');
  return url.href;
 }
 if(desktop)throw new Error('Online play is not configured in this desktop build. Local matches and training are available.');
 return `${protocol==='https:'?'wss':'ws'}://${hostname}:8080`;
}
