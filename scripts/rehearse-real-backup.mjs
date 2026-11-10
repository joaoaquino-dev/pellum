// Local recovery of application/Auth/Storage SQL from an authenticated backup.
// Never connects to production or starts Supabase Auth. No row data in reports.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,realpath,unlink,mkdir} from 'node:fs/promises';
import {createServer} from 'node:net';
import {randomBytes,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),bin=path.join(repository,'.codex/tooling/postgres17/runtime/pgsql/bin');
const root=await realpath(process.env.PELLUM_RECOVERY_DIRECTORY),allowed=await realpath(path.join(process.env.LOCALAPPDATA,'Pellum/recovery-checks'));
if(path.dirname(root)!==allowed)throw Error('PRIVATE_RECOVERY_DIRECTORY_REQUIRED');
const authenticated=path.join(root,'authenticated'),proof=JSON.parse(await readFile(path.join(root,'verification.json'),'utf8'));
assert.equal(proof.authenticated,true);
const cluster=path.join(root,'cluster'),passwordPath=path.join(root,'local-password.private');
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'local_backup_operator',PGDATABASE:'postgres',PGSSLMODE:'disable',PGCLIENTENCODING:'UTF8',PGPASSWORD:randomBytes(32).toString('hex'),PGOPTIONS:'',PGCONNECT_TIMEOUT:'5'};
delete env.PGSERVICE;delete env.PGSERVICEFILE;delete env.PGHOSTADDR;delete env.PELLUM_BACKUP_KEY;
const run=(tool,args,input)=>{const r=spawnSync(path.join(bin,tool+'.exe'),args,{env,windowsHide:true,input,encoding:'utf8',...(tool==='pg_ctl'?{stdio:'ignore'}:{}),timeout:120000,maxBuffer:16*1024*1024});if(r.error||r.status!==0)throw Error('LOCAL_RECOVERY_'+tool.toUpperCase()+'_FAILED');return r.stdout||''};
const sql=query=>run('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],query).trim();
const report={verifiedAt:new Date().toISOString(),backupAuthenticated:true,coreRestorePassed:false,incrementalUpgradePassed:false,serverStopped:false,releaseReady:false,scope:'Actual encrypted backup, private local PostgreSQL recovery only. No production writes or row data in report. Managed Vault/service configuration not recovered; Auth rows are not a running Auth service.'};
let started=false;
try{
 await mkdir(cluster);await writeFile(passwordPath,env.PGPASSWORD+'\n',{flag:'wx',mode:0o600});
 try{run('initdb',['-D',cluster,'--auth=scram-sha-256','--pwfile='+passwordPath,'--no-locale','--encoding=UTF8','-U','local_backup_operator'])}finally{await unlink(passwordPath)}
 run('pg_ctl',['-D',cluster,'-l',path.join(root,'server.private.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true;
 // Recreate names for policy/function dependencies, never replay cloud role
 // passwords, SUPERUSER/LOGIN grants or external connection settings locally.
 const roles=await readFile(path.join(authenticated,'database/roles.sql'),'utf8');const names=[...roles.matchAll(/^CREATE ROLE ([a-z_][a-z0-9_]*);$/gm)].map(match=>match[1]);
 assert.ok(names.includes('authenticated')&&names.includes('anon'));
 sql(names.map(name=>'CREATE ROLE "'+name+'" NOLOGIN NOSUPERUSER;').join('\n'));
 sql('create schema extensions;create extension pgcrypto with schema extensions;create extension "uuid-ossp" with schema extensions;');
 run('createdb',['pellum_recovered']);env.PGDATABASE='pellum_recovered';
 sql('create schema extensions;create extension pgcrypto with schema extensions;create extension "uuid-ossp" with schema extensions;create schema aura_private;create schema auth;create schema storage;create schema supabase_migrations;');
 const schemas=['public','aura_private','auth','storage','supabase_migrations'];
 run('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-privileges','--no-security-labels','--no-comments','--no-tablespaces',...schemas.flatMap(schema=>['--schema',schema]),'--dbname=pellum_recovered',path.join(authenticated,'database/postgres.dump')]);
 // Only a boolean comparison leaves this process, not counts or row hashes.
 const fingerprint=()=>sql("select coalesce(jsonb_agg(x order by x.name),'[]')::text from(select n.nspname||'.'||c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and(n.nspname='aura_private' or(n.nspname='public' and c.relname like 'aura_%')) order by 1)x");
 const tables=JSON.parse(fingerprint()).map(row=>row.name);assert.equal(tables.length,8);
 const digests=()=>tables.map(name=>{assert.match(name,/^[a-z_]+\.[a-z_]+$/);return sql(`select md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),'')) from ${name} t`)});
 const before=digests();report.coreRestorePassed=true;report.originalApplicationTables=tables.length;
 const preparation=JSON.parse(await readFile(path.join(repository,'security/release-preparation-evidence-2026-11-10.json'),'utf8'));
 report.appliedLocalMigrations=[];
 for(const migration of preparation.pending){const contents=await readFile(path.join(repository,'supabase/migrations',migration.file),'utf8');assert.equal(createHash('sha256').update(contents).digest('hex'),migration.sha256);sql(contents);report.appliedLocalMigrations.push(migration.file)}
 assert.deepEqual(digests(),before);report.incrementalUpgradePassed=true;report.originalApplicationRowsUnchanged=true;
 report.authTablesRecovered=Number(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname='auth'"));
 report.allApplicationTablesHaveRLS=sql("select bool_and(c.relrowsecurity)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and(n.nspname='aura_private' or(n.nspname='public' and c.relname like 'aura_%'))")==='true';
}catch(error){report.failureCode=/^[A-Z_]+$/.test(error.message)?error.message:'LOCAL_RECOVERY_VALIDATION_FAILED';process.exitCode=1}
finally{
 if(started){try{run('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);report.serverStopped=true}catch{report.failureCode='LOCAL_RECOVERY_STOP_FAILED';process.exitCode=1}}
 delete env.PGPASSWORD;await writeFile(path.join(root,'recovery-result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify(report));
}
