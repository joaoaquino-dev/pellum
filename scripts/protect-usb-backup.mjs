import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {protectPortableKey,unlockPortableKey} from '../clinical-server/portable-backup-key.js';
import {restoreRecoveryStream} from '../clinical-server/backup-stream.js';
let key,unlocked;let password=process.env.PELLUM_PORTABLE_PASSPHRASE;delete process.env.PELLUM_PORTABLE_PASSPHRASE;
try{
 const folder=process.env.PELLUM_USB_FOLDER;if(!folder||!path.isAbsolute(folder))throw Error('DESTINATION_REQUIRED');
 if(!/^[a-f0-9]{64}$/.test(process.env.PELLUM_BACKUP_KEY||''))throw Error('KEY_REQUIRED');key=Buffer.from(process.env.PELLUM_BACKUP_KEY,'hex');delete process.env.PELLUM_BACKUP_KEY;
 const manifest=JSON.parse(await readFile(path.join(folder,'bundle.json'),'utf8'));if(manifest.format!=='PELLUM-USB-BUNDLE-V1')throw Error('INVALID_BUNDLE');
 for(const file of [manifest.archive,...manifest.tools]){if(!/^[A-Za-z0-9_./-]+$/.test(file.file)||file.file.split('/').includes('..'))throw Error('INVALID_PATH');const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(folder,file.file)))hash.update(chunk);if(hash.digest('hex')!==file.sha256)throw Error('COPY_MISMATCH')}
 const archive=path.join(folder,manifest.archive.file),keyFile=path.join(folder,'portable-key.json');
 const serialized=await protectPortableKey(key,password,manifest.archive.sha256);await writeFile(keyFile,serialized+'\n',{flag:'wx',mode:0o600});
 unlocked=await unlockPortableKey(await readFile(keyFile,'utf8'),password,manifest.archive.sha256);if(!unlocked.equals(key))throw Error('KEY_MISMATCH');
 // Authenticate the real USB archive using only its password-protected key.
 // The verification sink discards plaintext; no extracted SQL/data is written.
 const discard={async beginArchive(){},async beginEntry(){},async writeChunk(){},async endEntry(){},async commitArchive(){},async abortArchive(){}};
 await restoreRecoveryStream(createReadStream(archive),unlocked,discard);
 const result={completedAt:new Date().toISOString(),portableKeyVerified:true,usbArchiveAuthenticated:true,dpapiRequiredForRecovery:false,scope:'Real USB archive and portable password key verified in memory; no plaintext backup written, remote connection or production changes.'};
 await writeFile(path.join(folder,'COMPLETE.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log('Pendrive protegido e conferido. Guarde a senha separadamente; sem ela esta chave não poderá ser recuperada.');
}catch{console.error('Proteção do pendrive não confirmada. Mantenha o pendrive conectado e informe apenas que falhou; não envie a senha.');process.exitCode=1}
finally{key?.fill(0);unlocked?.fill(0);password=null;delete process.env.PELLUM_BACKUP_KEY}
