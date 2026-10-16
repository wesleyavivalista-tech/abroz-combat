import {matchPerformance} from './matchPerformance.js';
import {contentVersion} from '../../../packages/shared/contentVersion.js';
import {desktopBridge} from './platform/runtime.js';
import {t} from './i18n/index.js';
interface Entry {timestamp:string;event:string;code?:number;error?:string;locations?:string[];count:number}
export class DiagnosticBuffer {
 readonly entries:Entry[]=[];
 record(event:string,error?:unknown,code?:number):void{
  try{
   const kind=error instanceof TypeError?'TypeError':error instanceof SyntaxError?'SyntaxError':error instanceof RangeError?'RangeError':error===undefined?undefined:'Error';
   // Never copy exception messages, server text, room codes, full URLs or local paths.
   const locations=error instanceof Error?(error.stack??'').split('\n').slice(1,7).flatMap(line=>{const m=line.match(/([\w.-]+\.[cm]?[jt]s):\d+:\d+(?=[)\s]*$)/);return m?[m[0]]:[];}):undefined;
   const safeCode=typeof code==='number'&&Number.isFinite(code)?code:undefined;
   const last=this.entries.at(-1);
   if(last&&last.event===event&&last.error===kind&&last.code===safeCode&&JSON.stringify(last.locations)===JSON.stringify(locations)){last.count++;last.timestamp=new Date().toISOString();return;}
   this.entries.push({timestamp:new Date().toISOString(),event,error:kind,locations,code:safeCode,count:1});
   if(this.entries.length>40)this.entries.shift();
  }catch{/* Reporting cannot interrupt play. */}
 }
}
export const diagnostics=new DiagnosticBuffer();
let installed=false;
export function installDiagnostics():void{
 if(installed)return;installed=true;
 window.addEventListener('error',e=>diagnostics.record('browser-error',e.error));
 window.addEventListener('unhandledrejection',e=>diagnostics.record('unhandled-rejection',e.reason));
 diagnostics.record('application-start');
}
export function diagnosticReport():string{
 const ua=navigator.userAgent;
 const platform=/Windows/.test(ua)?'Windows':/Macintosh|Mac OS/.test(ua)?'macOS':/Android/.test(ua)?'Android':/Linux/.test(ua)?'Linux':'Other';
 const browser=/Edg\//.test(ua)?'Edge':/OPR\//.test(ua)?'Opera':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chromium':/Safari\//.test(ua)?'Safari':'Other';
 const build=(import.meta as ImportMeta & {env?:Record<string,string>}).env?.VITE_BUILD_VERSION??'development';
 return JSON.stringify({generatedAt:new Date().toISOString(),build,contentVersion:contentVersion(),platform,runtime:desktopBridge()?'desktop':browser,events:diagnostics.entries,matchPerformance:{current:matchPerformance.snapshot(),recent:matchPerformance.recent}},null,2);
}
/** User-initiated only. A selectable fallback also works when clipboard permission is denied. */
export function bindDiagnosticButton(button:HTMLButtonElement,output:HTMLTextAreaElement,status:HTMLElement):void{
 button.onclick=async()=>{
  const report=diagnosticReport();output.value=report;output.hidden=false;
  try{await navigator.clipboard.writeText(report);status.textContent=t('diagnostics.copied');}
  catch{status.textContent=t('diagnostics.select');output.focus();output.select();}
 };
}
