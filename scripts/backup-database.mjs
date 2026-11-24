// Operator-run only. Password and one-time key arrive through inherited memory,
// never command arguments, config files, output or a connector response.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {access} from 'node:fs/promises';
import {postgresBackupEntries,writeDatabaseBackup} from '../clinical-server/database-backup.js';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const binDirectory=path.join(repository,'.codex/tooling/postgres17/runtime/pgsql/bin');
let key;
try{
 if(!/^[a-f0-9]{64}$/.test(process.env.PELLUM_BACKUP_KEY||''))throw Error('KEY_REQUIRED');
 key=Buffer.from(process.env.PELLUM_BACKUP_KEY,'hex');delete process.env.PELLUM_BACKUP_KEY;
 if(!process.env.PGPASSWORD||!process.env.PGSSLROOTCERT||process.env.PGSSLMODE!=='verify-full')throw Error('SECURE_CONNECTION_REQUIRED');
 await access(path.join(binDirectory,'pg_dump.exe'));await access(path.join(binDirectory,'pg_dumpall.exe'));
 const env={...process.env,PGHOST:'db.iddiiisimjaquhxhskcn.supabase.co',PGPORT:'5432',PGUSER:'postgres',PGDATABASE:'postgres',PGCONNECT_TIMEOUT:'15',PGAPPNAME:'pellum-readonly-backup',PGOPTIONS:'-c default_transaction_read_only=on'};
 const entries=postgresBackupEntries({binDirectory,env});
 const file=await writeDatabaseBackup({repository,directory:process.env.PELLUM_BACKUP_DIRECTORY,name:process.env.PELLUM_BACKUP_NAME,key,entries,forbiddenDirectories:[process.env.OneDrive,process.env.OneDriveConsumer,process.env.OneDriveCommercial]});
 console.log('Backup criptografado criado: '+file);console.log('Ainda requer recuperação em destino isolado. Não autoriza publicação.');
}catch{console.error('Backup não confirmado. Não publique. Confira conexão, certificado, senha e ferramentas locais; arquivos incompletos não são backups válidos.');process.exitCode=1}
finally{key?.fill(0);delete process.env.PGPASSWORD}
