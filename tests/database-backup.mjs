import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {postgresOutput,writeDatabaseBackup} from '../clinical-server/database-backup.js';
import {restoreRecoveryStream} from '../clinical-server/backup-stream.js';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const base=await mkdtemp(path.join(tmpdir(),'pellum-backup-qa-')),repository=path.join(base,'repo'),directory=path.join(base,'private');const key=randomBytes(32);await mkdir(repository);
const source=(script)=>[{name:'database/postgres.dump',chunks:postgresOutput(process.execPath,['-e',script],{...process.env})}];
const options={directory,repository,key,name:'synthetic-qa',entries:source("process.stdout.write('synthetic-source-data')")};
const decrypt=async bytes=>{let current;const entries=[];await restoreRecoveryStream([bytes],key,{async beginArchive(){},async beginEntry(entry){current={...entry,chunks:[]}},async writeChunk(chunk){current.chunks.push(chunk)},async endEntry(){entries.push({name:current.name,bytes:Buffer.concat(current.chunks)})},async commitArchive(){},async abortArchive(){}});return entries};
try{
 const complete=await writeDatabaseBackup(options),encrypted=await readFile(complete);eq(encrypted.includes(Buffer.from('synthetic-source-data')),false);eq((await decrypt(encrypted))[0].bytes.toString(),'synthetic-source-data');eq(await readdir(directory),['synthetic-qa.pellum']);
 await assert.rejects(()=>writeDatabaseBackup(options),e=>e.code==='DATABASE_BACKUP_EXISTS');checks++;eq(await readFile(complete),encrypted);
 for(const [name,script] of [['failed',"process.stdout.write('partial');process.exitCode=1"],['warning',"process.stdout.write('partial');process.stderr.write('private diagnostic')"]]){
  await assert.rejects(()=>writeDatabaseBackup({...options,name,entries:source(script)}),e=>e.code==='DATABASE_BACKUP_SOURCE_FAILED');checks++;
  eq((await readdir(directory)).includes(name+'.pellum'),false);const incomplete=await readFile(path.join(directory,name+'.incomplete'));await assert.rejects(()=>decrypt(incomplete));checks++;
 }
 await assert.rejects(()=>writeDatabaseBackup({...options,name:'missing',entries:[{name:'database/postgres.dump',chunks:postgresOutput(path.join(base,'missing-executable'),[],process.env)}]}),e=>e.code==='DATABASE_BACKUP_SOURCE_FAILED');checks++;
 await assert.rejects(()=>writeDatabaseBackup({...options,directory:repository,name:'inside'}),e=>e.code==='DATABASE_BACKUP_DESTINATION_INVALID');checks++;
 await assert.rejects(()=>writeDatabaseBackup({...options,name:'../escape'}),e=>e.code==='DATABASE_BACKUP_NAME_INVALID');checks++;
 await assert.rejects(()=>writeDatabaseBackup({...options,forbiddenDirectories:[directory],name:'sync'}),e=>e.code==='DATABASE_BACKUP_DESTINATION_INVALID');checks++;
 await writeFile(path.join(directory,'partial.incomplete'),'retained');await assert.rejects(()=>writeDatabaseBackup({...options,name:'partial'}),e=>e.code==='EEXIST');checks++;
 console.log(`PASS: ${checks} database-backup checks; encrypted streaming, checked process completion, warnings/failure/missing executable, incomplete archive rejection, no overwrite, repository/sync destination rejection. Synthetic child sources only; no real database backup.`);
}finally{key.fill(0);await rm(base,{recursive:true,force:true})}
