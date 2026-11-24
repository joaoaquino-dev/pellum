// Optional operational rehearsal using portable PostgreSQL. Synthetic loopback
// cluster only; never accepts a remote host, connection URL or production data.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {postgresBackupEntries,writeDatabaseBackup} from '../clinical-server/database-backup.js';
import {restoreRecoveryStream} from '../clinical-server/backup-stream.js';
import {createFilesystemRestoreSink} from '../clinical-server/backup-filesystem.js';
const repository=process.cwd(),bin=path.join(repository,'.codex/tooling/postgres17/runtime/pgsql/bin');
await mkdir('.codex/qa-postgres',{recursive:true});const base=await mkdtemp(path.join(repository,'.codex/qa-postgres/native-')),data=path.join(base,'cluster');
// Probe an available loopback port; do not connect to any existing server.
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'postgres',PGDATABASE:'postgres',PGSSLMODE:'disable',PGOPTIONS:'',PGCONNECT_TIMEOUT:'5'};delete env.PGPASSWORD;delete env.PGSERVICE;delete env.PGHOSTADDR;
const run=(tool,args,input)=>{const r=spawnSync(path.join(bin,tool+'.exe'),args,{env,windowsHide:true,input,encoding:'utf8',...(tool==='pg_ctl'?{stdio:'ignore'}:{}),timeout:60000,maxBuffer:1024*1024});if(r.error||r.status!==0)throw Error('Native synthetic QA failed: '+tool);return r.stdout||''};
let started=false;const key=randomBytes(32);
try{
 run('initdb',['-D',data,'--auth=trust','--no-locale','--encoding=UTF8','-U','postgres']);
 run('pg_ctl',['-D',data,'-l',path.join(base,'server.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true;
 run('psql',['-X','-v','ON_ERROR_STOP=1','--quiet'],"create table public.qa_patient(id integer primary key,summary text);insert into public.qa_patient values(1,'Paciente fictícia preservada'),(2,'Sem dado real');");
 const backupDirectory=path.join(base,'encrypted');
 // The temporary test root also acts as repository guard; backup is outside it.
 const guard=path.join(base,'guard');await mkdir(guard);
 const archive=await writeDatabaseBackup({directory:backupDirectory,repository:guard,key,name:'native-synthetic',entries:postgresBackupEntries({binDirectory:bin,env:{...env,PGOPTIONS:'-c default_transaction_read_only=on'}})});
 const sink=await createFilesystemRestoreSink({baseDirectory:path.join(base,'restored-files'),restoreName:'synthetic'});await restoreRecoveryStream([await readFile(archive)],key,sink);
 run('createdb',['qa_recovered']);run('pg_restore',['--exit-on-error','--no-owner','--no-privileges','--dbname=qa_recovered',path.join(sink.completedDirectory,'database/postgres.dump')]);
 assert.equal(run('psql',['-X','-A','-t','-d','qa_recovered','-c','select count(*) from public.qa_patient']).trim(),'2');
 assert.equal(run('psql',['-X','-A','-t','-d','qa_recovered','-c',"select summary from public.qa_patient where id=1"]).trim(),'Paciente fictícia preservada');
 const report={completedAt:new Date().toISOString(),postgres:run('pg_dump',['--version']).trim(),passed:true,scope:'Portable PostgreSQL loopback only; native roles dump/custom dump, encrypted stream, authenticated extraction, pg_restore into a second synthetic database, row count and Unicode content preserved. Roles archive was extracted but not replayed into the already initialized cluster. No real Auth, remote backup or production credentials.',remoteBackupCreated:false};
 await mkdir('outputs',{recursive:true});await writeFile('outputs/native-backup-verification.json',JSON.stringify(report,null,2)+'\n');console.log('PASS: native PostgreSQL dump → encryption → extraction → pg_restore in a second synthetic database. No production connection.');
}finally{key.fill(0);if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop'])}
