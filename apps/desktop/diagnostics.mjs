import {mkdirSync,statSync,renameSync,appendFileSync,rmSync} from 'node:fs';
import path from 'node:path';
/** Rotating local logs; a renewed minute budget replaces the old lifetime cutoff. */
export function createDesktopLogger(directory,context,now=Date.now){
 let since=now(),count=0,dropped=0;
 return (event,details={})=>{try{
  if(now()-since>=60000){since=now();count=0;}
  if(++count>30){dropped++;return;}
  mkdirSync(directory,{recursive:true});const file=path.join(directory,'desktop.log');
  try{if(statSync(file).size>256*1024){rmSync(file+'.previous',{force:true});renameSync(file,file+'.previous');}}catch{/* First log. */}
  const safe={};for(const key of ['reason','exitCode','code','error'])if(typeof details[key]==='number'||typeof details[key]==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(details[key]))safe[key]=details[key];
  appendFileSync(file,JSON.stringify({timestamp:new Date(now()).toISOString(),...context(),event,...safe,suppressed:dropped||undefined})+'\n');dropped=0;
 }catch{/* Diagnostics must never prevent play. */}};
}
