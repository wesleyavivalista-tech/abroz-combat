import process from 'node:process';
import console from 'node:console';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,chmodSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const [source,target]=process.argv.slice(2);
if(!source||!target||!existsSync(source)||existsSync(target)||resolve(source)===resolve(target))throw Error('Usage: backup-championships.mjs EXISTING_DATABASE NEW_BACKUP_PATH');
mkdirSync(dirname(resolve(target)),{recursive:true,mode:0o700});
const db=new DatabaseSync(source,{readOnly:true});
try{db.prepare('VACUUM INTO ?').run(resolve(target));}finally{db.close();}
chmodSync(target,0o600);
const backup=new DatabaseSync(target,{readOnly:true});
try{if(backup.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity check failed');}finally{backup.close();}
console.log('Championship backup created and integrity verified.');
