// Local authenticated extraction and archive inventory only; no remote client.
// Dump contents, SQL, roles and keys must never reach stdout or the repository.
import {createReadStream} from 'node:fs';
import {mkdir,mkdtemp,writeFile,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {restoreRecoveryStream} from '../clinical-server/backup-stream.js';
import {createFilesystemRestoreSink} from '../clinical-server/backup-filesystem.js';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let key;
try{
 if(!/^[a-f0-9]{64}$/.test(process.env.PELLUM_BACKUP_KEY||''))throw Error('KEY_REQUIRED');
 key=Buffer.from(process.env.PELLUM_BACKUP_KEY,'hex');delete process.env.PELLUM_BACKUP_KEY;
 const archive=await realpath(process.env.PELLUM_BACKUP_ARCHIVE),root=path.join(process.env.LOCALAPPDATA,'Pellum/recovery-checks');
 const allowed=await realpath(path.join(process.env.LOCALAPPDATA,'Pellum/backups'));
 if(path.dirname(archive)!==allowed||!archive.endsWith('.pellum'))throw Error('INVALID_ARCHIVE');
 await mkdir(root,{recursive:true});const base=await mkdtemp(path.join(root,'check-'));
 const sink=await createFilesystemRestoreSink({baseDirectory:base,restoreName:'authenticated'});
 const summary=await restoreRecoveryStream(createReadStream(archive),key,sink);
 const dump=path.join(sink.completedDirectory,'database/postgres.dump');
 const list=spawnSync(path.join(repository,'.codex/tooling/postgres17/runtime/pgsql/bin/pg_restore.exe'),['--list',dump],{windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});
 if(list.status!==0)throw Error('INVALID_DATABASE_DUMP');
 // Keep TOC private. It contains schema/role metadata, not an export for Git.
 await writeFile(path.join(base,'archive-toc.private.txt'),list.stdout,{flag:'wx',mode:0o600});
 const rows=list.stdout.split(/\r?\n/).filter(line=>/^\d+;/.test(line));
 const report={verifiedAt:new Date().toISOString(),authenticated:true,archiveFiles:summary.files,archiveBytes:summary.totalBytes,tocEntries:rows.length,extensions:rows.filter(line=>/ EXTENSION - /.test(line)).map(line=>line.split(' EXTENSION - ')[1].trim()),restorationValidated:false,scope:'Real encrypted backup authenticated/extracted locally outside repository. TOC read only; no production writes, data printed or database restore yet.'};
 await writeFile(path.join(base,'verification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({directory:base,...report}));
}catch{console.error('LOCAL_BACKUP_VERIFICATION_FAILED');process.exitCode=1}
finally{key?.fill(0)}
