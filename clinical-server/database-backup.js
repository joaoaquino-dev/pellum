import {spawn} from 'node:child_process';
import {open,mkdir,realpath,link,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {sealRecoveryStream} from './backup-stream.js';
const failure=code=>Object.assign(Error(code),{code});
// Never forward database output/errors to logs. A failed/warning dump is incomplete.
export async function* postgresOutput(executable,args,env){
 const child=spawn(executable,args,{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 let warning=false;child.stderr.on('data',()=>{warning=true});
 const done=new Promise(resolve=>{child.once('error',()=>resolve(false));child.once('close',code=>resolve(code===0&&!warning))});
 try{for await(const bytes of child.stdout)yield bytes;if(!await done)throw failure('DATABASE_BACKUP_SOURCE_FAILED')}
 finally{if(child.exitCode===null)child.kill();await done}
}
export function postgresBackupEntries({binDirectory,env}){
 const suffix=process.platform==='win32'?'.exe':'';
 return [
  {name:'database/roles.sql',chunks:postgresOutput(path.join(binDirectory,'pg_dumpall'+suffix),['--roles-only','--no-role-passwords','--no-password'],env)},
  {name:'database/postgres.dump',chunks:postgresOutput(path.join(binDirectory,'pg_dump'+suffix),['--format=custom','--no-password','--lock-wait-timeout=15000'],env)}
 ];
}
const inside=(base,target)=>target===base||target.startsWith(base+path.sep);
export async function writeDatabaseBackup({directory,repository,key,entries,name,forbiddenDirectories=[]}){
 if(!/^[A-Za-z0-9_-]{1,90}$/.test(name))throw failure('DATABASE_BACKUP_NAME_INVALID');
 const resolved=path.resolve(directory),repo=await realpath(repository);
 if(inside(repo,resolved)||forbiddenDirectories.some(base=>base&&inside(path.resolve(base),resolved)))throw failure('DATABASE_BACKUP_DESTINATION_INVALID');
 await mkdir(resolved,{recursive:true,mode:0o700});const actual=await realpath(resolved);
 if(inside(repo,actual)||forbiddenDirectories.some(base=>base&&inside(path.resolve(base),actual)))throw failure('DATABASE_BACKUP_DESTINATION_INVALID');
 const partial=path.join(actual,name+'.incomplete'),complete=path.join(actual,name+'.pellum');
 try{await stat(complete);throw failure('DATABASE_BACKUP_EXISTS')}catch(error){if(error.code!=='ENOENT')throw error}
 const handle=await open(partial,'wx',0o600);let finished=false;
 try{
  for await(const chunk of sealRecoveryStream(entries,key)){let offset=0;while(offset<chunk.length){const written=await handle.write(chunk,offset,chunk.length-offset);if(!written.bytesWritten)throw failure('DATABASE_BACKUP_WRITE_FAILED');offset+=written.bytesWritten}}
  await handle.sync();finished=true;
 }finally{await handle.close()}
 // Hard link is atomic and refuses to replace an existing destination. Partial is
 // deliberately retained on failure. This unlink removes only our completed alias.
 if(finished){await link(partial,complete);await unlink(partial)}
 return complete;
}
