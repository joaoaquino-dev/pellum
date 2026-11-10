# Execute locally in a private terminal. Never paste passwords into the chat.
# Reads production only. Does not install services, modify data or deploy.
param([string]$RootCertificate)
$ErrorActionPreference='Stop'
$repository=Split-Path -Parent $PSScriptRoot
$release=Get-Content (Join-Path $repository '.codex/tooling/node24/release.txt')
$nodeExecutable=Join-Path $repository ".codex/tooling/node24/runtime/node-$release-win-x64/node.exe"
if(!(Test-Path -LiteralPath $nodeExecutable)){throw 'Node local não encontrado.'}
if(!(Test-Path -LiteralPath (Join-Path $repository '.codex/tooling/postgres17/runtime/pgsql/bin/pg_dump.exe'))){throw 'Ferramentas PostgreSQL locais não encontradas.'}
if(!$RootCertificate){$RootCertificate=Read-Host 'Caminho do certificado CA baixado do painel Supabase (arquivo .crt ou .pem)'}
if(!(Test-Path -LiteralPath $RootCertificate -PathType Leaf)){throw 'Certificado não encontrado. Não use senha no lugar deste caminho.'}
$backupDirectory=Join-Path $env:LOCALAPPDATA 'Pellum/backups'
$keyDirectory=Join-Path $env:APPDATA 'Pellum/backup-keys'
New-Item -ItemType Directory -Path $keyDirectory -Force | Out-Null
$backupName='pellum-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$keyBytes=New-Object byte[] 32
$rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($keyBytes);$rng.Dispose()
Add-Type -AssemblyName System.Security
$protected=[Security.Cryptography.ProtectedData]::Protect($keyBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$keyPath=Join-Path $keyDirectory ($backupName+'.dpapi')
$keyHandle=[IO.File]::Open($keyPath,[IO.FileMode]::CreateNew);try{$keyHandle.Write($protected,0,$protected.Length)}finally{$keyHandle.Dispose()}
$names=@('PGPASSWORD','PGSSLMODE','PGSSLROOTCERT','PELLUM_BACKUP_KEY','PELLUM_BACKUP_DIRECTORY','PELLUM_BACKUP_NAME')
$previous=@{};foreach($name in $names){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
$password=$null;$pointer=[IntPtr]::Zero
try{
 $password=Read-Host 'Senha do banco Supabase (não é a senha de entrada no Pellum)' -AsSecureString
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
 $env:PGPASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
 $env:PGSSLMODE='verify-full';$env:PGSSLROOTCERT=(Resolve-Path -LiteralPath $RootCertificate).Path
 $env:PELLUM_BACKUP_KEY=([BitConverter]::ToString($keyBytes)).Replace('-','').ToLowerInvariant()
 $env:PELLUM_BACKUP_DIRECTORY=$backupDirectory;$env:PELLUM_BACKUP_NAME=$backupName
 & $nodeExecutable (Join-Path $PSScriptRoot 'backup-database.mjs')
 if($LASTEXITCODE -ne 0){throw 'Backup não confirmado; publicação continua bloqueada.'}
 Write-Host ('Chave protegida pelo seu usuário Windows: '+$keyPath)
 Write-Host 'Não apague a chave. Recuperação em outro computador exige planejamento separado; DPAPI depende deste usuário Windows.'
}finally{
 foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}
 [Array]::Clear($keyBytes,0,$keyBytes.Length)
 if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
 if($password){$password.Dispose()}
}
