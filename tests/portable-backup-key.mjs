import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {protectPortableKey,unlockPortableKey} from '../clinical-server/portable-backup-key.js';
import {sealRecoveryStream} from '../clinical-server/backup-stream.js';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const key=randomBytes(32),password='Frase longa fictícia para QA 123!',payload=Buffer.from('Somente informação sintética'),chunks=[];
for await(const part of sealRecoveryStream([{name:'database/postgres.dump',bytes:payload}],key))chunks.push(part);const archive=Buffer.concat(chunks),hash=createHash('sha256').update(archive).digest('hex');
const base=await mkdtemp(path.join(tmpdir(),'pellum-portable-qa-'));
try{
 const serialized=await protectPortableKey(key,password,hash),unlocked=await unlockPortableKey(serialized,password,hash);eq(unlocked.equals(key),true);unlocked.fill(0);eq(serialized.includes(password),false);eq(serialized.includes(key.toString('hex')),false);
 const other=await protectPortableKey(key,password,hash);eq(JSON.parse(other).kdf.salt===JSON.parse(serialized).kdf.salt,false);
 const denied=async fn=>{await assert.rejects(fn,e=>e.code==='PORTABLE_KEY_INVALID');checks++};
 await denied(()=>unlockPortableKey(serialized,'Outra frase fictícia incorreta!',hash));await denied(()=>unlockPortableKey(serialized,password,'f'.repeat(64)));
 for(const mutate of [item=>item.kdf.N=2**30,item=>item.cipher.tag=Buffer.alloc(16).toString('base64'),item=>item.cipher.iv='bad',item=>item.archiveSha256='e'.repeat(64)]){const item=JSON.parse(serialized);mutate(item);await denied(()=>unlockPortableKey(JSON.stringify(item),password,hash))}
 await denied(()=>unlockPortableKey(serialized+'x'.repeat(5000),password,hash));await denied(()=>protectPortableKey(key,'curta',hash));
 const usb=path.join(base,'portable'),local=path.join(base,'other-user');await mkdir(path.join(usb,'lib'),{recursive:true});await mkdir(local);
 await writeFile(path.join(usb,'package.json'),'{"type":"module"}');await copyFile('scripts/usb-recover.mjs',path.join(usb,'usb-recover.mjs'));
 for(const name of ['portable-backup-key.js','backup.js','backup-stream.js','backup-filesystem.js'])await copyFile('clinical-server/'+name,path.join(usb,'lib',name));
 await writeFile(path.join(usb,'database-backup.pellum'),archive);await writeFile(path.join(usb,'portable-key.json'),serialized);await writeFile(path.join(usb,'bundle.json'),JSON.stringify({format:'PELLUM-USB-BUNDLE-V1',archive:{file:'database-backup.pellum',sha256:hash}}));
 const env={...process.env,LOCALAPPDATA:local,PELLUM_PORTABLE_PASSPHRASE:password};delete env.PELLUM_BACKUP_KEY;
 const child=spawn(process.execPath,[path.join(usb,'usb-recover.mjs')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.resume();const code=await new Promise(resolve=>{child.once('error',()=>resolve(-1));child.once('close',resolve)});eq(code,0);eq(output.includes(password),false);eq(output.includes(payload.toString()),false);
 const root=path.join(local,'Pellum/recovered-from-usb'),directories=await readdir(root);eq(directories.length,1);eq(await readFile(path.join(root,directories[0],'database/postgres.dump')),payload);
 console.log(`PASS: ${checks} portable backup checks; password key roundtrip, wrong password, tampering/archive binding, bounded KDF/input, random salt, no plaintext key and standalone recovery with another local profile and no DPAPI.`);
}finally{key.fill(0);await rm(base,{recursive:true,force:true})}
