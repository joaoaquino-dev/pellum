import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {PGlite} from './clinical/node_modules/@electric-sql/pglite/dist/index.js';
import {sealRecoveryStream,restoreRecoveryStream} from '../clinical-server/backup-stream.js';
import {createFilesystemRestoreSink} from '../clinical-server/backup-filesystem.js';
import {validName} from '../clinical-server/backup.js';
const base=path.resolve('.codex/recovery-qa'),key=randomBytes(32),source=new PGlite();let checks=0;
try{
 await source.exec("create table qa_records(id integer primary key,note text);insert into qa_records values(1,'Somente registro fictício')");
 const dump=await source.dumpDataDir(),bytes=Buffer.from(await dump.arrayBuffer());
 const sink=await createFilesystemRestoreSink({baseDirectory:base,restoreName:'synthetic-'+randomUUID()});
 await restoreRecoveryStream(sealRecoveryStream([{name:'database/qa.dump',bytes},{name:'objects/qa/image',bytes:Buffer.from('synthetic object bytes')}],key),key,sink);
 assert.ok(sink.completedDirectory);assert.equal((await readFile(path.join(sink.completedDirectory,'objects/qa/image'),'utf8')),'synthetic object bytes');checks+=2;
 const recovered=new PGlite({loadDataDir:new Blob([await readFile(path.join(sink.completedDirectory,'database/qa.dump'))])});
 try{assert.equal((await recovered.query('select note from qa_records where id=1')).rows[0].note,'Somente registro fictício');checks++}finally{await recovered.close()}
 const manifest=JSON.parse(await readFile(path.join(sink.completedDirectory,'COMMITTED.json'),'utf8'));assert.equal(manifest.state,'complete');checks++;
 await assert.rejects(()=>createFilesystemRestoreSink({baseDirectory:base,restoreName:path.basename(sink.completedDirectory)}));checks++;
 const parts=[];for await(const part of sealRecoveryStream([{name:'objects/qa/file',bytes:Buffer.from('QA')}],key))parts.push(part);
 const broken=Buffer.concat(parts).subarray(0,-1),failed=await createFilesystemRestoreSink({baseDirectory:base,restoreName:'rejected-'+randomUUID()});
 await assert.rejects(()=>restoreRecoveryStream([broken],key,failed));assert.equal(failed.completedDirectory,null);await access(path.join(failed.stagingDirectory,'ABORTED.json'));checks+=3;
 for(const name of ['objects/CON','config/nul.txt','objects/trailing.','objects/../escape']){assert.equal(validName(name),false);checks++}
 const duplicates=[];await assert.rejects(async()=>{for await(const frame of sealRecoveryStream([{name:'objects/qa/A',bytes:Buffer.from('A')},{name:'objects/qa/a',bytes:Buffer.from('B')}],key))duplicates.push(frame)});checks++;
 console.log(`PASS: ${checks} filesystem recovery checks; real staged writes, fsync, checked directory move, no overwrite, aborted isolation and PostgreSQL reload from recovered bytes. Synthetic local files only; incomplete folders deliberately retained for review.`);
}finally{key.fill(0);await source.close()}
