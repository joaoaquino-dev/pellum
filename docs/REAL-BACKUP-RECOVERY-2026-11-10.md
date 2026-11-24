# Backup real e ensaio de preservação dos dados

10/11/2026, America/Sao_Paulo. Continuidade posterior a SAFE-BACKUP-2026-11-10.md. O proprietário executou a ferramenta e apresentou a confirmação de conclusão. **O backup real foi criado; esta etapa de aplicação e recuperação foi somente local. A nova versão continua sem publicação.**

## Resultado confirmado

O arquivo criptografado estava completo (517.195 bytes), acompanhado da chave DPAPI do usuário Windows. A recuperação autenticou os dois arquivos internos e conferiu o inventário do pg_dump: 671 entradas. Nenhuma senha ou chave foi impressa, copiada para documentos ou enviada por conector.

A cópia foi extraída fora do repositório, em diretório privado de %LOCALAPPDATA%\Pellum\recovery-checks. O PostgreSQL 17.11 temporário usou somente 127.0.0.1, porta disponível, senha local aleatória e SCRAM. Não reutilizou a senha do banco de produção ou abriu servidor na rede.

Foram recuperados os esquemas public, aura_private, auth, storage e supabase_migrations, com suas tabelas/dados e dependências locais disponíveis. As 27 tabelas de Auth foram recuperadas como dados SQL; isso não inicia o serviço Supabase Auth nem comprova entrega de e-mail ou login. Nomes de papéis necessários às políticas foram recriados como NOLOGIN/NOSUPERUSER, sem reproduzir senhas ou poderes de nuvem. Proprietários e ACLs gerenciados não foram reproduzidos; não é uma cópia operacional completa da plataforma.

O ensaio registrou em memória o digest de cada uma das oito tabelas originais da aplicação. Depois aplicou as dez migrations pendentes, verificando antes o SHA-256 de cada arquivo contra a preparação revisada. **Todos os digests originais permaneceram iguais após a atualização.** O relatório exporta apenas essa comparação booleana, sem nomes de clientes, contagens por clínica, dados de pacientes ou hashes das linhas.

RLS continuou ativo em todas as tabelas da aplicação. O servidor foi desligado ao final. Evidência sanitizada: security/real-backup-recovery-evidence-2026-11-10.json. As operações não acessaram o banco remoto para aplicar migrations ou ler prontuários; toda consulta aos dados foi feita na cópia local autorizada.

A remoção das duas cópias temporárias descriptografadas foi recusada pela revisão automática, com retorno somente “blocked by policy”. Não foi repetida por outra ferramenta ou contornado o bloqueio. Elas permanecem fora do repositório, na pasta privada de recuperação, com servidores desligados. O backup original criptografado e sua chave continuam preservados. A limpeza dessas cópias é uma pendência operacional distinta da atualização de produção.

## Ajustes e limites do ensaio

O primeiro ensaio foi interrompido na transação de restore porque os namespaces gerenciados, como auth, não estavam criados no PostgreSQL nativo. O segundo ensaio criou esses schemas vazios antes de recuperar objetos reais do dump; não criou tabelas/dados fictícios para substituir conteúdo do backup. Não houve correção ou exclusão em produção.

Também foi corrigida a execução de pg_ctl no Windows: seu processo de servidor podia manter os pipes herdados e atrasar o retorno ao processo pai. Agora pg_ctl usa stdio ignorado, log privado e retorno/erro conferidos. O ensaio sintético nativo foi repetido e passou com essa execução, sem conexões de produção.

Scripts novos: inspect-real-backup.mjs autentica/extrai e lê somente o inventário; rehearse-real-backup.mjs recupera os schemas selecionados e aplica migrations somente no PostgreSQL local. Precisam de diretório privado previamente autenticado e não aceitam host remoto. A chave de extração chega temporariamente por memória/ambiente; não está nos scripts.

O banco do provedor inclui supabase_vault e configurações gerenciadas que não foram recuperadas neste PostgreSQL nativo. A recuperação completa de Vault, chaves/segredos da plataforma, proprietários, ACLs e serviços Supabase em outro destino ainda precisa de plano e validação próprios. Um restore de Auth SQL não certifica funcionamento de login, emissão de sessões, SMTP ou MFA. Zero objetos Storage foram observados antes desta etapa; o dump não cobre eventuais arquivos binários externos futuros.

## O que ainda falta antes de publicar

- Preparar segunda cópia protegida e chave recuperável independentemente da perda deste usuário/computador Windows. O backup atual e a chave DPAPI permanecem no computador; isso ainda não é recuperação externa de desastre.
- Validar login, confirmação/recuperação de e-mail, MFA quando aplicável e isolamento/revogação nos serviços reais, sem usar dados das clientes como fixtures.
- Revalidar catálogo/versão de produção imediatamente antes da atualização, preservar mudanças posteriores do repositório e definir aplicação das dez migrations sem reaplicar as dez antigas. As duas diferenças históricas de versão não foram reparadas.
- Revisão dos formulários/documentos e publicação autorizada, seguida de conferência dos dados existentes. Fotos e assinatura externa continuam adiadas; nenhum serviço pago foi contratado.

O ensaio comprova preservação das tabelas originais **nesta cópia e neste lote de migrations**. Não promete risco zero em produção, não cobre alterações simultâneas posteriores ao backup nem autoriza substituir o banco atual pela cópia de teste.
