# Backup antes da publicação

10/11/2026. O proprietário informou que ainda não possui backup completo. Esta etapa preparou a ferramenta local; **nenhum backup de produção foi criado** e a versão nova não foi publicada.

## Ação necessária no próprio computador

1. Abra o [projeto Pellum no Supabase](https://supabase.com/dashboard/project/iddiiisimjaquhxhskcn). Nas configurações do banco, obtenha o certificado CA/SSL do projeto. É um certificado público, não uma chave privada. Guarde o arquivo .crt/.pem no computador.
2. Tenha a senha atual do **banco de dados**, distinta da senha da conta ou do Pellum. Não envie essa senha no chat e não a coloque em arquivos do projeto. Não é necessário trocar a senha para executar a ferramenta; se ela não estiver disponível, interrompa e informe apenas que não a possui.
3. Na pasta scripts do projeto, abra Fazer-backup.cmd. Informe o caminho do certificado e digite a senha quando a janela pedir. A senha não aparece enquanto é digitada.
4. Aguarde a confirmação “Backup criptografado criado”. Se aparecer “Backup não confirmado”, o backup continua pendente. Arquivo .incomplete não é um backup válido. Não publique com base apenas na existência desse arquivo.
5. Informe apenas se concluiu ou falhou. Não envie os arquivos, o conteúdo, a chave ou a senha. Depois é necessário testar a recuperação desse backup real em destino isolado e preparar uma segunda cópia protegida com chave recuperável independentemente do computador.

O arquivo .pellum fica em %LOCALAPPDATA%\Pellum\backups. A chave fica protegida com DPAPI CurrentUser, em %APPDATA%\Pellum\backup-keys. A proteção depende do usuário Windows deste computador: **essa chave não é, sozinha, uma solução de recuperação após perda do computador**. Não apague a chave. Ainda será necessário definir uma cópia independente e a recuperação da chave antes de afirmar recuperação externa de desastre.

Não salvar backups no repositório, em OneDrive ou em pastas públicas. A rotina rejeita o repositório e as raízes OneDrive conhecidas. Se o Windows bloquear a execução, pare e informe o bloqueio; não desative proteções ou altere a política global para continuar.

## O que foi preparado

- Ferramentas portáteis PostgreSQL 17.11, mesma versão principal do servidor, em .codex/tooling/postgres17/runtime. Não houve instalação de serviço, alteração do PATH global, edição do Windows ou criação de infraestrutura remota.
- Origem oficial EDB, link de Windows x64 da página de binários: https://sbp.enterprisedb.com/getfile.jsp?fileid=1260616, redirecionando para postgresql-17.11-5-windows-x64-binaries.zip. SHA-256 conferido com o arquivo .sha256 do mesmo servidor: 80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f. Binários e arquivo ZIP ficam ignorados pelo Git; nenhum executável foi incorporado ao repositório.
- scripts/backup-database.ps1 pede os dois dados localmente, protege uma chave aleatória por DPAPI e repassa senha/chave temporariamente por ambiente ao processo filho. Não passa esses valores na linha de comando, em mensagens ou em arquivo de texto. Restaura o ambiente e limpa buffers ao terminar.
- scripts/backup-database.mjs fixa o destino de conexão no banco Pellum, usuário postgres, porta 5432 e banco postgres. Exige TLS verify-full e certificado CA, com operações em modo somente leitura. Não oferece opção de migration, exclusão, restore remoto ou publicação.
- pg_dump gera arquivo customizado comprimido com uma visão consistente do banco. pg_dumpall coleta papéis sem hashes de suas senhas; a coleta de papéis é separada da transação de dados e não representa captura atômica de mudanças administrativas simultâneas.
- clinical-server/database-backup.js encaminha os bytes diretamente para a criptografia autenticada já existente. Não grava dump SQL ou dados desprotegidos no disco. Falha do processo ou aviso em stderr impede a confirmação. O arquivo só recebe a extensão final após término do dump e fsync; não sobrescreve arquivos existentes. Falhas preservam o arquivo incompleto para revisão, sem apagar backups antigos.

O dump é do banco; não contém objetos binários do Storage, secrets de infraestrutura, senha de login dos papéis PostgreSQL, configurações externas de SMTP, OAuth ou chaves da plataforma. Em consulta somente de contagem ao projeto, storage.objects tinha zero objetos nesta data. Conferir novamente antes do backup; se arquivos forem adicionados, eles precisam de cópia própria. O objetivo atual é proteger os dados existentes de gestão e Auth antes de acrescentar prontuário; o dump ainda precisa de ensaio no ambiente Supabase adequado e análise das extensões/papéis gerenciados ao restaurar.

## Verificação realizada

tests/database-backup.mjs fez 16 verificações com fontes sintéticas de processos filhos: criptografia, término real do processo, falha/aviso, executável ausente, rejeição de arquivo incompleto, sem sobrescrita e destinos proibidos.

scripts/test-native-backup.mjs criou um PostgreSQL 17.11 nativo descartável, acessível somente em loopback, com dados fictícios. Executou pg_dumpall/pg_dump reais, criptografou, extraiu com autenticação e restaurou com pg_restore em um segundo banco. Contagem e texto em português foram preservados. O arquivo de papéis foi extraído, mas não reaplicado no cluster já inicializado. O servidor foi encerrado ao fim; não é um serviço de homologação operante ou teste dos serviços reais de Auth/SMTP.

Evidência: security/native-backup-evidence-2026-11-10.json. Os diretórios sintéticos ficam ignorados em .codex/qa-postgres. Nenhuma fixture aceita destino de produção. A rotina de backup real aguarda a etapa local do proprietário; não foi solicitada senha por conector nem exportado conteúdo das clientes em ferramentas de conversa.

A bateria consolidada passou com Node 24.22.2: build, 46 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências, sem falhas, sem arquivos pulados e sem vulnerabilidades reportadas pelas auditorias. Evidência: security/database-backup-evidence-2026-11-10.json. Também foram verificados a sintaxe PowerShell e o ciclo DPAPI Protect/Unprotect com chave sintética somente em memória.

## Limite atual de acesso

A organização do projeto foi confirmada como Free. A documentação recomenda exportação regular para projetos gratuitos; não foi habilitado plano pago. O conector disponível não expõe download de backup nem conexão pg_dump, e o controle visual do computador falhou na inicialização com “failed to write kernel assets” (os error 3). Não houve tentativa de recuperar senhas ou tokens do navegador/conector.

Fontes: [backups no Supabase](https://supabase.com/docs/guides/platform/backups), [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [verificação TLS](https://www.postgresql.org/docs/17/libpq-ssl.html), [binários EDB](https://productsdl.enterprisedb.com/download-postgresql-binaries). A presença desta ferramenta não comprova backup real, revisão jurídica ou autorização de publicação.
