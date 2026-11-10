// Copies only encrypted backup + public recovery tools. No plaintext key or dump.
import {readFile,mkdir,copyFile,writeFile,stat,open} from 'node:fs/promises';
import {createReadStream,constants} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hashFile=async file=>{const digest=createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);return digest.digest('hex')};
try{
 const root=process.env.PELLUM_USB_ROOT,name=process.env.PELLUM_BACKUP_NAME,volumeId=process.env.PELLUM_USB_VOLUME_ID;
 if(root!=='D:\\'||!volumeId||!/^pellum-\d{8}-\d{6}-[a-f0-9]{8}$/.test(name||''))throw Error('CONFIRMED_USB_REQUIRED');
 const taskPath=path.join(repository,'.codex/usb-copy.json');
 // Reserve task descriptor before copying; never silently replace an old task.
 const taskHandle=await open(taskPath,'wx',0o600);
 try{
  const archive=path.join(process.env.LOCALAPPDATA,'Pellum/backups',name+'.pellum');
  const version=(await readFile(path.join(repository,'.codex/tooling/node24/release.txt'),'utf8')).trim();if(!/^v24\.\d+\.\d+$/.test(version))throw Error('INVALID_RUNTIME');
  const folder=path.join(root,'Pellum-Backup-'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)+'-'+randomBytes(3).toString('hex'));await mkdir(folder);
  await mkdir(path.join(folder,'lib'));await mkdir(path.join(folder,'runtime'));
  const files=[['database-backup.pellum',archive],['usb-recover.mjs',path.join(repository,'scripts/usb-recover.mjs')],['RECUPERAR.ps1',path.join(repository,'scripts/usb-recover.ps1')],['runtime/node.exe',path.join(repository,'.codex/tooling/node24/runtime','node-'+version+'-win-x64/node.exe')],['runtime/LICENSE.txt',path.join(repository,'.codex/tooling/node24/runtime','node-'+version+'-win-x64/LICENSE')]];
  for(const library of ['portable-backup-key.js','backup.js','backup-stream.js','backup-filesystem.js'])files.push(['lib/'+library,path.join(repository,'clinical-server',library)]);
  const copied=[];for(const [file,source] of files){const target=path.join(folder,file);await copyFile(source,target,constants.COPYFILE_EXCL);const sourceHash=await hashFile(source);if(sourceHash!==await hashFile(target))throw Error('USB_COPY_MISMATCH');copied.push({file,sha256:sourceHash,bytes:(await stat(target)).size})}
  const generated={
   'package.json':'{"private":true,"type":"module"}\n',
   'RECUPERAR.cmd':'@echo off\r\npowershell.exe -NoProfile -File "%~dp0RECUPERAR.ps1"\r\necho.\r\npause\r\n',
   'LEIA-ME.txt':'PELLUM — CÓPIA DE SEGURANÇA\r\n\r\nEste pacote só estará protegido e confirmado quando existir COMPLETE.json.\r\nGuarde sua senha fora deste pendrive. Não salve senhas em arquivos aqui.\r\n\r\nPara recuperar em outro Windows de 64 bits: abra RECUPERAR.cmd e digite a senha criada para o pendrive. A extração é local, na pasta privada do usuário, e não altera nenhum banco. Não precisa da senha do banco ou da conta Windows antiga.\r\n\r\nA importação do SQL exige um destino compatível e revisão técnica. O pacote não inclui configuração externa de SMTP, chaves da plataforma ou arquivos futuros do Storage. O PostgreSQL/Supabase não será instalado nem restaurado automaticamente.\r\n\r\nNão envie este pacote, a senha ou os arquivos extraídos para chat, Git ou pastas públicas. A senha perdida não poderá ser recuperada desta cópia.\r\n'
  };
  for(const [file,contents] of Object.entries(generated)){await writeFile(path.join(folder,file),contents,{flag:'wx'});copied.push({file,sha256:await hashFile(path.join(folder,file)),bytes:Buffer.byteLength(contents)})}
  const manifest={format:'PELLUM-USB-BUNDLE-V1',preparedAt:new Date().toISOString(),archive:copied[0],tools:copied.slice(1),state:'awaiting-private-passphrase'};
  const text=JSON.stringify(manifest,null,2)+'\n';await writeFile(path.join(folder,'bundle.json'),text,{flag:'wx'});
  const task={folder,sourceBackupName:name,volumeId,manifestSha256:createHash('sha256').update(text).digest('hex')};await taskHandle.writeFile(JSON.stringify(task,null,2)+'\n');await taskHandle.sync();
  const report={preparedAt:manifest.preparedAt,drive:'D:',archiveBytes:manifest.archive.bytes,archiveSha256:manifest.archive.sha256,copiedFiles:copied.length,copiesHashVerified:true,portableKeyCreated:false,state:'awaiting-private-passphrase',scope:'Encrypted real backup and public Windows recovery tools copied to a new USB directory. No raw key, plaintext SQL, deletion, format or production changes.'};
  await mkdir(path.join(repository,'outputs'),{recursive:true});await writeFile(path.join(repository,'outputs/usb-backup-preparation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({folder,...report}));
 }finally{await taskHandle.close()}
}catch{console.error('USB_PREPARATION_NOT_CONFIRMED');process.exitCode=1}
