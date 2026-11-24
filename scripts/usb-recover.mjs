// This file is also copied to USB with its libraries and Node Windows runtime.
// It only extracts locally. It never executes SQL, connects or restores remotely.
import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unlockPortableKey} from './lib/portable-backup-key.js';
import {restoreRecoveryStream} from './lib/backup-stream.js';
import {createFilesystemRestoreSink} from './lib/backup-filesystem.js';
const folder=path.dirname(fileURLToPath(import.meta.url));let key,password=process.env.PELLUM_PORTABLE_PASSPHRASE;delete process.env.PELLUM_PORTABLE_PASSPHRASE;
try{
 const manifest=JSON.parse(await readFile(path.join(folder,'bundle.json'),'utf8'));if(manifest.format!=='PELLUM-USB-BUNDLE-V1'||manifest.archive.file!=='database-backup.pellum')throw Error('INVALID_BUNDLE');
 const archive=path.join(folder,manifest.archive.file),hash=createHash('sha256');for await(const chunk of createReadStream(archive))hash.update(chunk);if(hash.digest('hex')!==manifest.archive.sha256)throw Error('ARCHIVE_CHANGED');
 key=await unlockPortableKey(await readFile(path.join(folder,'portable-key.json'),'utf8'),password,manifest.archive.sha256);
 if(!process.env.LOCALAPPDATA)throw Error('PRIVATE_LOCAL_DIRECTORY_REQUIRED');
 const sink=await createFilesystemRestoreSink({baseDirectory:path.join(process.env.LOCALAPPDATA,'Pellum/recovered-from-usb'),restoreName:'recovered-'+Date.now()});
 await restoreRecoveryStream(createReadStream(archive),key,sink);
 console.log('Cópia autenticada e extraída em: '+sink.completedDirectory);console.log('Nenhum banco foi alterado. A importação exige um destino compatível e revisão própria.');
}catch{console.error('Recuperação não confirmada. Confira a senha, os arquivos e o destino. Nenhum banco foi alterado.');process.exitCode=1}
finally{key?.fill(0);password=null}
