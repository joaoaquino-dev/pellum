# Preparação da versão para testes

10/11/2026, America/Sao_Paulo. Leitura remota de metadados e ensaios locais. Nenhum dado de paciente real foi consultado/exportado, nenhuma migration remota aplicada, nenhum serviço contratado e nenhum deploy realizado.

## O que a conferência resolveu

O projeto Supabase iddiiisimjaquhxhskcn continua com as dez migrations anteriores ao prontuário. Consultei somente catálogo PostgreSQL, histórico de migrations e recomendações de segurança. A base local dessas dez migrations coincide com a captura remota nos seguintes itens:

| Catálogo comparado | Quantidade | Resultado |
| --- | ---: | --- |
| Funções da aplicação | 15 | Hash de pg_get_functiondef idêntico |
| Tabelas da aplicação | 8 | Nomes e RLS idênticos |
| Colunas | 39 | Tipos, nulabilidade e defaults idênticos |
| Políticas | 3 | Expressões e papéis idênticos |
| Índices | 13 | Definições idênticas |
| Constraints | 19 | Definições idênticas |
| Acessos efetivos de anon/authenticated | 46 | Leitura/escrita de tabelas e execução de funções idênticas |
| Triggers próprios | 0 | Ausentes em ambas as bases |

Isso caracteriza a estrutura atual observada, não comprova a identidade dos arquivos SQL originalmente aplicados ou de toda configuração do serviço. Não inclui definições de Auth/Storage, seus dados, proprietários de objetos, todos os papéis, configurações de e-mail, extensões ou backups.

As versões históricas de patient_phone_validation (local 20261029004713, remoto 20261029004749) e recoverable_procedure_catalog (local 20261103000000, remoto 20261103010054) continuam diferentes no histórico. Não houve rename, repair, reaplicação ou alteração desses arquivos. A correspondência atual do catálogo reduz a dúvida sobre a estrutura; não elimina a necessidade de definir a estratégia de histórico antes de usar db push. Não executar db push com include-all como atalho.

## Ensaio de atualização e recuperação

scripts/prepare-release.mjs executa exclusivamente offline: recria a base antiga em PostgreSQL descartável, compara o catálogo capturado, cadastra clínica/paciente fictícias, aplica as dez migrations posteriores em ordem e verifica preservação integral do snapshot e de sua revisão. Depois verifica gravação clínica, pesquisa, previsão de retorno e RLS nas 28 tabelas da aplicação.

As dez migrations posteriores incluem estruturas de mídia/documentos desenvolvidas antes do adiamento de fotos. Isso não habilita fotos: a interface padrão continua com mídia desativada e nenhum serviço de upload/assinatura foi contratado ou implantado. A cadeia completa foi ensaiada; omitir arquivos por conta própria pode quebrar dependências.

O relatório registra SHA-256 de cada arquivo pendente, comparação e impedimentos. Evidência: security/release-preparation-evidence-2026-11-10.json. A execução não contém cliente remoto, comandos de publicação ou operações de repair. A captura é datada; uma nova leitura é obrigatória antes de qualquer aplicação remota.

tests/release-recovery.mjs amplia a recuperação local para toda a cadeia atual: cria modelo/respostas, procedimento/adendo, consumo de estoque, evolução com retorno e fonte documental não assinada. Empacota o banco sintético criptografado, recupera em outro PGlite e compara contagem e digest de todas as 28 tabelas da aplicação. Confere fonte clínica, resposta, revisão, permissões e replay do consumo sem duplicação. A chave existe somente em memória; o teste não grava backup ou chave em Git e não lê produção.

Esse teste não equivale a pg_dump/pg_restore de um projeto Supabase real, backup externo ou recuperação de Auth. O pacote local PGlite é um formato de teste, não instrução para restaurar produção.

Verificação consolidada: build, 45 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências passaram com Node 24.22.2 no Windows, sem falhas, sem arquivos pulados e sem vulnerabilidades reportadas pelas auditorias. O novo teste de recuperação teve 13 verificações; o ensaio incremental foi executado separadamente. Evidência da bateria: security/release-validation-evidence-2026-11-10.json.

## Versão publicada conferida

A Vercel informa produção READY em dpl_6E4z8Kyt6v7XZ1KmMW3QEmvqay49, projeto prj_xNNqxkDzMtJScbuTbt1Fhp5bjdRA, equipe team_O1p3X85GgLd3XRyMPwZIDZfJ. Commit 8b550b77de25bee9c1408b492573a30d10e07d41, ref main, endereço usepellum.vercel.app. É uma publicação externa a esta continuidade local.

A comparação GitHub de 9d911fc até 8b550b77 encontrou nove commits posteriores e 15 arquivos alterados: documentação/governança, templates, scripts/test-standalone.mjs e standalone/package.json. Não há alteração listada nas fontes public/aura ou no código-fonte standalone da aplicação. Isso atualiza a referência histórica do handoff; não autoriza assumir que a main antiga e a versão atual sejam iguais. Não houve merge, push ou consolidação de branches. Antes da publicação, preservar também esses arquivos posteriores do repositório, sem sobrescrevê-los com o checkout antigo.

## Ordem para liberação

1. Revalidar catálogo, versão publicada, arquivos e hashes pendentes. Preparar a integração da branch preservando as mudanças documentais recentes, sem merge automático. Definir aplicação das novas migrations sem reaplicar as dez antigas ou contornar recusas históricas de MFA.
2. Ter cópia consistente e protegida do banco real, responsável e chave em destino separado; recuperar em destino isolado e registrar tempo e ponto recuperável. Snapshots administrativos ou exportação individual do prontuário não cobrem essa obrigação operacional. Não enviar arquivos com pacientes para Git, chat ou pastas públicas.
3. Validar serviços reais de login, confirmação/recuperação de e-mail, sessão, licença e MFA; usar duas clínicas fictícias para provar isolamento/revogação. Atualmente só existe teste local com Auth simulado. O computador não possui stack Supabase local operante; não foi contratado ambiente adicional. Sem destino isolado disponível, essa etapa permanece pendente, sem usar dados reais como teste.
4. Conferir com responsável habilitado os campos e as minutas, definir canal de privacidade e uso permitido na fase de testes. Documentos continuam sem assinatura externa; fotos permanecem desativadas. Não apresentar esta entrega como certificação clínica/jurídica.
5. Após as condições anteriores, submeter a publicação concreta à autorização do proprietário. Aplicar somente o lote revisado, verificar banco e então publicar o frontend compatível. Se houver falha, interromper a promoção; não apagar tabelas/prontuários como rollback. Uma reversão do frontend não desfaz registros já feitos nem uma atualização de banco.
6. No piloto, usar dados fictícios e roteiro: acesso autorizado → paciente → identificação/anamnese → procedimento/materiais → evolução/retorno → pesquisa/adendo → exportação autorizada → logout/revogação. Confirmar em celular, iPad/Safari e notebook, além do Chrome automatizado. Não usar exclusão de conta/clínica como teste.

Não é necessário contratar assinatura eletrônica, antivírus ou processamento de fotos para esta versão textual. Isso não afirma que qualquer uso comercial/volume esteja coberto pelos planos atuais: esta etapa não mudou planos ou contratação.

## Recomendações do provedor

O advisor remoto informou cinco avisos INFO de RLS sem política nas tabelas privadas. Isso corresponde ao desenho de acesso por funções com CRUD direto negado; não criar políticas permissivas para eliminar o aviso. Também informou WARN de proteção contra senhas vazadas desativada. Não alterei Auth nem habilitei recurso com custo potencial; o alerta continua documentado, sem equivaler por si só a comprometimento de conta.

Fontes de processo: [migrations Supabase](https://supabase.com/docs/guides/deployment/database-migrations), [segurança de senhas](https://supabase.com/docs/guides/auth/password-security), [comparação dos commits publicados](https://github.com/joaoaquino-dev/pellum/compare/9d911fc86e0b7c3df109ce41274512c64997afe0...8b550b77de25bee9c1408b492573a30d10e07d41). Changelog consultado; CLI local permanece na série 2, sem adoção automática das mudanças da CLI 3.
