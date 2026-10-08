import {mkdir,open,rename,readFile} from 'node:fs/promises';
import {dirname,isAbsolute} from 'node:path';
import {serialize,deserialize} from 'node:v8';
import {contentVersion} from '../../../packages/shared/contentVersion.js';
import type {RoomService} from './rooms.js';
export const MAX_CHECKPOINT_AGE_MS=5000;
const MAX_BYTES=32*1024*1024;
/** Atomic single-writer checkpoints. Never log payloads or credentials. */
export class RecoveryStore {
 private writing=false;
 constructor(private path:string){if(!isAbsolute(path))throw Error('Recovery checkpoint path must be absolute');}
 async save(data:ReturnType<RoomService['checkpoint']>,now=Date.now()):Promise<boolean>{
  if(this.writing)return false;this.writing=true;
  try{
   const bytes=serialize({schema:1,version:contentVersion(),savedAt:now,data});
   if(bytes.length>MAX_BYTES)throw Error('Recovery checkpoint exceeds storage budget');
   await mkdir(dirname(this.path),{recursive:true,mode:0o700});
   const temp=this.path+'.tmp',file=await open(temp,'w',0o600);
   try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
   await rename(temp,this.path);
   // Persist the rename itself as well as the file contents on the Linux host.
   if(process.platform!=='win32'){
    const directory=await open(dirname(this.path),'r');
    try{await directory.sync();}finally{await directory.close();}
   }
   return true;
  }finally{this.writing=false;}
 }
 async load(now=Date.now()):Promise<{savedAt:number;data:ReturnType<RoomService['checkpoint']>}|undefined>{
  let file;try{file=await open(this.path,'r');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  let bytes:Buffer;
  try{if((await file.stat()).size>MAX_BYTES)throw Error('Recovery checkpoint exceeds storage budget');bytes=await readFile(file);}finally{await file.close();}
  const value=deserialize(bytes);
  if(value.schema!==1||value.version!==contentVersion()||!Number.isSafeInteger(value.savedAt)||value.savedAt>now||now-value.savedAt>MAX_CHECKPOINT_AGE_MS)return;
  if(!value.data||!Array.isArray(value.data.rooms)||!Array.isArray(value.data.seats))throw Error('Invalid recovery checkpoint');
  return value;
 }
}
