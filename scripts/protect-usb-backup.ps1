# Ask for the portable password only here, on the owner's computer.
$ErrorActionPreference='Stop'
$repository=Split-Path -Parent $PSScriptRoot
$task=Get-Content -LiteralPath (Join-Path $repository '.codex/usb-copy.json') -Raw | ConvertFrom-Json
$volume=Get-Volume -DriveLetter D
if($volume.DriveType -ne 'Removable' -or $volume.UniqueId -ne $task.volumeId -or [IO.Path]::GetPathRoot($task.folder) -ne 'D:\'){throw 'O pendrive preparado não está em D:. Pare e informe o problema.'}
if((Get-FileHash -LiteralPath (Join-Path $task.folder 'bundle.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $task.manifestSha256){throw 'Inventário do pendrive mudou. Pare e informe o problema.'}
if($task.sourceBackupName -notmatch '^pellum-\d{8}-\d{6}-[a-f0-9]{8}$'){throw 'Referência de backup inválida.'}
if(Test-Path -LiteralPath (Join-Path $task.folder 'COMPLETE.json')){Write-Host 'Este pendrive já foi protegido e conferido.';return}
$release=Get-Content (Join-Path $repository '.codex/tooling/node24/release.txt')
$nodeExecutable=Join-Path $repository ".codex/tooling/node24/runtime/node-$release-win-x64/node.exe"
$first=$null;$second=$null;$firstPointer=[IntPtr]::Zero;$secondPointer=[IntPtr]::Zero;$keyBytes=$null
$names=@('PELLUM_PORTABLE_PASSPHRASE','PELLUM_BACKUP_KEY','PELLUM_USB_FOLDER');$previous=@{};foreach($name in $names){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try{
 Write-Host 'Crie uma senha NOVA e longa para o pendrive. Não é a senha do banco.'
 Write-Host 'Use ao menos 20 caracteres. Guarde essa senha fora do pendrive e não a envie no chat.'
 $first=Read-Host 'Nova senha do backup portátil' -AsSecureString
 $second=Read-Host 'Repita a nova senha' -AsSecureString
 $firstPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($first);$secondPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
 $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPointer);$confirmation=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPointer)
 if($plain.Length -lt 20 -or $plain.Length -gt 1024 -or $plain -cne $confirmation){throw 'Senhas diferentes ou fora do limite de 20 a 1024 caracteres. Nada foi confirmado.'}
 Add-Type -AssemblyName System.Security
 $keyPath=Join-Path $env:APPDATA ('Pellum/backup-keys/'+$task.sourceBackupName+'.dpapi')
 $keyBytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $env:PELLUM_PORTABLE_PASSPHRASE=$plain;$env:PELLUM_BACKUP_KEY=([BitConverter]::ToString($keyBytes)).Replace('-','').ToLowerInvariant();$env:PELLUM_USB_FOLDER=$task.folder
 & $nodeExecutable (Join-Path $PSScriptRoot 'protect-usb-backup.mjs')
 if($LASTEXITCODE -ne 0){throw 'Proteção não confirmada. Informe apenas que falhou.'}
}finally{
 foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}
 $plain=$null;$confirmation=$null;if($keyBytes){[Array]::Clear($keyBytes,0,$keyBytes.Length)}
 if($firstPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPointer)};if($secondPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPointer)}
 if($first){$first.Dispose()};if($second){$second.Dispose()}
}
