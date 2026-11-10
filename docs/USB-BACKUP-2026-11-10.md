# Cópia no pendrive e chave portátil

10/11/2026, America/Sao_Paulo. O proprietário indicou USB DISK em D:. Volume removível FAT32, saudável, com aproximadamente 2,6 GB disponíveis antes da cópia. Nenhuma formatação, exclusão, instalação de serviço ou alteração de produção.

## Estado da entrega

O backup real criptografado de 517.195 bytes foi copiado para uma pasta nova no pendrive, junto de ferramentas públicas de recuperação para Windows de 64 bits e licença do Node. O pacote usa aproximadamente 95 MB. Cada arquivo copiado foi comparado ao original por SHA-256. Nenhum arquivo anterior do pendrive foi sobrescrito. Evidência sanitizada: security/usb-backup-preparation-evidence-2026-11-10.json.

**A preparação ainda aguarda a senha escolhida pelo proprietário.** Não declarar independência do usuário Windows nem recuperação externa concluída somente porque o arquivo .pellum foi copiado. A chave DPAPI original permanece no computador e não foi copiada para o pendrive.

## Passo do proprietário

Abra scripts/Proteger-pendrive.cmd no computador atual, com D: conectado. Escolha uma senha nova, exclusiva, de 20 a 1024 caracteres, e repita. Não é a senha do banco ou do Pellum. Não enviá-la no chat. Guarde-a separadamente do pendrive; a ferramenta não salva a senha e esta cópia não oferece recuperação de senha perdida.

O script confere o volume e o inventário preparados, desbloqueia a chave DPAPI somente na memória do computador atual, cria portable-key.json protegida pela nova senha e a lê novamente. Depois autentica **o backup real no USB usando a chave desbloqueada pela senha**, descartando o texto descriptografado em memória, sem gravar SQL. Só após isso cria COMPLETE.json e mostra “Pendrive protegido e conferido”.

Se houver erro ou faltar COMPLETE.json, a proteção portátil não está confirmada. Preserve os arquivos e informe apenas que falhou. Arquivos existentes não são substituídos silenciosamente. Se Windows bloquear execução, não alterar política global ou desativar proteções para continuar. A unidade não deve ser retirada durante a execução; depois da confirmação, ejetar pelo Windows.

## Recuperação em outro computador

O pendrive inclui RECUPERAR.cmd, RECUPERAR.ps1, usb-recover.mjs, bibliotecas e Node 24.22.2 para Windows x64, sem npm ou dependências instaladas. Em outro Windows compatível, RECUPERAR.cmd pede somente a senha portátil. Não precisa de DPAPI, senha do banco ou usuário Windows original.

A ferramenta verifica o hash do arquivo criptografado, desbloqueia a chave pela senha e extrai os arquivos com autenticação na pasta privada %LOCALAPPDATA%\Pellum\recovered-from-usb. Não importa SQL, altera bancos, instala PostgreSQL, inicia servidor ou acessa a rede. Extração e importação são etapas distintas; o destino SQL exige plataforma compatível e revisão própria. Em outro sistema operacional, seria necessário Node compatível instalado; esse cenário não foi testado.

O arquivo de instruções acompanha o pacote. A proteção impede leitura sem a senha, mas não previne perda física, falha do pendrive ou alteração dos programas por alguém com acesso físico. Guarde a mídia e a senha separadamente. Não publicar o pacote, arquivos extraídos ou chaves em Git, chats ou pastas públicas.

## Implementação e validação

- clinical-server/portable-backup-key.js usa scrypt com salt aleatório de 16 bytes, N=131072, r=8, p=1, memória máxima de 256 MiB; a chave derivada de 32 bytes protege a chave de backup com AES-256-GCM, IV aleatório de 12 bytes e tag de 16 bytes.
- O hash do arquivo .pellum é dado autenticado da chave portátil. Recuperar com outro arquivo, senha errada, tag/IV alterados, parâmetros de derivação adulterados ou formato excessivo falha. Os parâmetros de KDF e os tamanhos são fixos/limitados ao ler o envelope, evitando custo arbitrário escolhido pelo arquivo.
- Somente a chave criptografada por senha é gravada no USB. Buffers de chave são limpos ao fim; strings gerenciadas têm descarte de referência, sem promessa de apagar todas as cópias de memória do sistema. Senha e chave transitam temporariamente por ambiente entre processos locais, nunca por argumentos de linha de comando, mensagens ou configuração versionada.
- scripts/prepare-usb-backup.mjs prepara a pasta/inventário e registra a tarefa apenas em .codex/usb-copy.json, ignorado pelo Git. scripts/protect-usb-backup.ps1 faz entrada privada e confere volume/manifesto antes de usar a chave. Scripts de recuperação só são executáveis como pacote copiado, com as bibliotecas em lib/.
- tests/portable-backup-key.mjs passou 17 verificações sintéticas: ida/volta, senha errada, adulteração, vínculo com hash, formato/KDF limitados, salt aleatório e recuperação independente do DPAPI em outro perfil local simulado, a partir do pacote autônomo.

O teste com perfil simulado não equivale a ensaio físico em outro computador. A criação da chave portátil do backup real aguarda a senha do proprietário; o roteiro não foi executado com uma senha presumida ou guardada pelo agente. Permanecem as limitações de Vault/serviços/configuração externa descritas em REAL-BACKUP-RECOVERY-2026-11-10.md.

Verificação consolidada com Node 24.22.2: build, 47 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências passaram, sem falhas, arquivos pulados ou vulnerabilidades reportadas pelas auditorias. Scripts PowerShell novos foram analisados pelo parser. Evidência: security/portable-backup-evidence-2026-11-10.json.

Documentação de referência verificada: [crypto/scrypt do Node 24](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

## Validação manual informada pelo proprietário

Antes desta cópia, o proprietário confirmou entrada normal no site e presença dos dados atuais, e depois confirmou recebimento do e-mail de recuperação. Isso registra login/leitura da versão atual e entrega da mensagem; não comprova troca de senha, MFA, confirmação de conta nova ou testes remotos completos de isolamento da nova versão. Nenhuma publicação foi feita nesta continuidade.
