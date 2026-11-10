# Copied to USB. Does not need DPAPI or the original Windows account.
$ErrorActionPreference='Stop';$secret=$null;$pointer=[IntPtr]::Zero
$previous=[Environment]::GetEnvironmentVariable('PELLUM_PORTABLE_PASSPHRASE','Process')
try{
 Write-Host 'Isto extrai o backup somente neste computador. Não altera nenhum banco.'
 $secret=Read-Host 'Senha criada para o pendrive (não é a senha do banco)' -AsSecureString
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
 $env:PELLUM_PORTABLE_PASSPHRASE=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
 & (Join-Path $PSScriptRoot 'runtime/node.exe') (Join-Path $PSScriptRoot 'usb-recover.mjs')
 if($LASTEXITCODE -ne 0){throw 'Recuperação não confirmada. Guarde os arquivos e procure suporte.'}
}finally{
 [Environment]::SetEnvironmentVariable('PELLUM_PORTABLE_PASSPHRASE',$previous,'Process')
 if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)};if($secret){$secret.Dispose()}
}
