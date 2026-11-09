# Operação clínica — plano de homologação e liberação

09/11/2026. Procedimentos propostos; não executados em produção. Responsáveis clínico, jurídico, privacidade e operação precisam ser designados pelo proprietário. A base de código permanece em homologação.

## Migração e retorno seguro

1. Confirmar a referência de produção fix/whatsapp-contact / 9d911fc, inventariar funções, tabelas, grants, triggers e versões aplicadas. Comparar com PROJECT_CONTEXT.md. Não reaplicar migrations históricas com nomes divergentes para “alinhar” o registro.
2. Preparar homologação isolada conforme STAGING-AND-SIGNATURES-2026-11-09.md. Verificar em PostgreSQL 17 do Supabase a compatibilidade que os testes locais não cobrem: Auth, permissões geridas, extensões, API, concorrência entre conexões e políticas remotas.
3. Revisar o SQL novo `20261109211636_clinical_records.sql`, suas dependências e o bloqueio de exclusão/restore de pacientes com prontuário. A nova proteção pode fazer a exclusão legada da clínica/conta falhar; antes da liberação comercial, adaptar as mensagens e o fluxo de encerramento para retenção, sem apagar o prontuário por cascata.
4. Aplicar em staging com papel autorizado e backup do ambiente de teste; capturar resultado sem tokens. Validar isolamento com dois usuários/clínicas, revogação, licença, MFA, escrita direta negada e exportação auditada.
5. Ensaiar impacto de locks: cada RPC clínica bloqueia a linha do snapshot da clínica para serializar mudanças de vínculo e dados. É uma escolha conservadora inicial; medir latência, contenção e limites com carga antes de ampliar equipes. Há rate limit de 120 solicitações por janela da função existente, não garantia de capacidade.
6. Antes de produção: backup externo recuperado em destino separado, revisão independente do SQL, aceite de QA e aprovação explícita de publicação. A aplicação de migration e o deploy não foram autorizados como ação automática nesta entrega.
7. Se uma aplicação da migration falhar dentro da transação, confirmar rollback e estado real antes de tentar novamente. Se já houver registros clínicos, não usar down migration/drop/delete. Voltar o frontend a uma versão aprovada e manter tabelas, auditoria e dados; corrigir o banco com nova migration aditiva. Não restaurar backup antigo por cima da clínica para desfazer uma alteração de interface.

## Backup e recuperação de desastre

Metas iniciais propostas para aprovação: RPO de até 24 horas e RTO de até 8 horas. Ainda não medidos nem contratados. Se o negócio exigir menor perda tolerável, reavaliar PITR, frequência e custos.

Inventário obrigatório: banco (incluindo clínica, versões, auditoria e idempotência), objetos originais e derivados, documentos assinados/evidências, configurações e segredos por processo separado. Snapshot interno da aplicação não é backup de prontuário; backup SQL não inclui bytes do Storage. [Limites do Supabase](https://supabase.com/docs/guides/platform/backups).

Procedimento a implementar e ensaiar:

1. Gerar cópia consistente e criptografada em conta/destino externo à conta principal, com acesso mínimo, chave guardada separadamente e retenção protegida. Não salvar exports de pacientes no Git, pasta sincronizada de desenvolvimento ou logs.
2. Para arquivos, copiar bytes e inventário de caminho, tamanho, hash, clínica e vínculo. Preservar a versão original de documentos assinados, sem recompressão que invalide assinatura. Manter objetos privados na recuperação.
3. Registrar horário, duração, contagens e hashes sem conteúdo clínico; alertar em falha/atraso. Documentar responsável e custo. Não configurar automação de exportação real antes de revisar destino, autorização e segredos.
4. Restaurar em projeto separado com conectividade externa de e-mail/assinatura bloqueada. Nunca restaurar sobre produção para ensaiar. Verificar versões, relações, auditoria, ausência de acesso cruzado e recuperação dos originais e derivados.
5. Testar com contas sintéticas a visualização, exportação e permissões; comparar hashes de arquivos e assinaturas. Medir RPO/RTO e registrar aceite. Só então considerar recuperação validada. Repetir após mudanças relevantes e em periodicidade aprovada.

Evidência atual: dump e restauração do banco clínico fictício em duas instâncias PGlite com comparação de conteúdo/hash/auditoria. Não há evidência de restauração remota ou de arquivos. Esse item continua bloqueando liberação comercial.

## Arquitetura pendente de fotografias e anexos

Não há upload habilitado. A ausência de um serviço pago não impede desenvolver esta etapa localmente, mas a operação segura precisa de backend e validação em Storage separado. A implementação completa continua pendente.

- Autorização por clínica/paciente/usuário validada no servidor em upload, visualização, download, comparação e exportação; sem bucket público ou listagem geral pelo cliente. Nome de objeto aleatório, sem nome/CPF/telefone.
- Fluxo de quarentena privado: limite de bytes, tipo permitido, inspeção real por decoder, limites de pixels e descompressão, rejeição de HTML/SVG executável, antivírus e tratamento de falha. Não confiar no MIME/extensão do navegador. Definir formatos iniciais e conversão segura de HEIC antes de prometer câmera de iPhone. [OWASP upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- Derivados sem EXIF/GPS, preservando cadeia de custódia do original em área restrita conforme política. Acesso por URL curta assinada após auditoria, sem URL persistida em analytics ou documento público. Sessões revogadas devem impedir nova emissão; avaliar janela residual da URL emitida.
- Metadados imutáveis: data de captura e registro, sessão, região/lado, responsável, finalidade, hash e autorização. Comparação sem retoque, com indicação de datas/escala e critérios fotográficos; processamento não altera original.
- Consentimentos separados: assistência, documentação clínica e uso externo por finalidade. Negar publicidade não impede atendimento. Registrar revogação e impedir usos futuros, sem apagar automaticamente evidência clínica sujeita a retenção.
- Testes obrigatórios: MIME falso, arquivo excessivo/corrompido, EXIF/GPS, URL expirada, revogação, travessia de caminho, acesso cruzado, falha de processamento e restauração externa. Um preview local isolado não comprova upload seguro.

O backend deverá usar segredos restritos somente no servidor. O frontend continua com chave publicável. Não se propõe chave service_role no cliente nem endpoint de bypass genérico. [Storage e RLS](https://supabase.com/docs/guides/storage/security/access-control).

## Privacidade, retenção e atendimento a titulares

Identificar controlador, operador, encarregado/canal, suboperadores e matriz de finalidades/bases legais. Saúde é dado sensível; consentimento genérico não é base universal. Minimização, contratos, registro de tratamento e avaliação de transferência internacional exigem revisão concreta. [LGPD consolidada](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html), [guia ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte).

Definir política de guarda com responsável clínico/jurídico. A Lei 13.787/2018 prevê referência mínima de 20 anos desde o último registro no seu âmbito; outras regras e retenções judiciais podem interferir. Não há rotina automática de purge. Pedido de exclusão deve passar por identificação, análise das obrigações de guarda, resposta e registro, sem executar a exclusão de conta como atalho. [Lei 13.787](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13787-27-dezembro-2018-787543-publicacaooriginal-157119-pl.html).

Exportação clínica exige permissão específica e AAL2. O arquivo exportado contém dados sensíveis e passa a depender do manuseio do destinatário; definir canal seguro, conferência de identidade e descarte das cópias temporárias. Exports acima de 5.000 versões ou 5 MiB de payload exigem processamento assistido ainda não implementado; não entregar arquivo parcial como se fosse completo.

Em incidentes: conter acessos e emissão de links, preservar evidências, acionar responsáveis, avaliar obrigações de comunicação segundo norma vigente e documentar recuperação. Não incluir prontuários, tokens, payloads, URLs assinadas ou dados identificadores em tickets, analytics e mensagens de erro. Alertas operacionais devem usar códigos e métricas agregadas. A auditoria atual é local ao banco; admins privilegiados continuam capazes de alteração, portanto avaliar cópia externa protegida antes de afirmar inviolabilidade.

## Validação clínica e jurídica

As cinco etapas de Enfermagem são campos de documentação, não inferência de competência ou diagnóstico automático. Validar protocolos, formulários, contraindicações e minutas com responsável habilitado. Referências: [Cofen 736/2024](https://www.cofen.gov.br/resolucao-cofen-no-736-de-17-de-janeiro-de-2024/), [529/2016 e alterações](https://www.cofen.gov.br/resolucao-cofen-no-05292016/), [Manual Coren-BA 2025](https://www.coren-ba.gov.br/wp-content/uploads/2025/05/Aprovado-manual-pdf-300425-1.pdf).

A [IN SES/DF 01/2026](https://www.sinj.df.gov.br/sinj/Norma/a4b6d69449904e07a7af9872fec2e198/ses_svs_dvs_int_01_2026.html) tem âmbito territorial próprio; confirmar local, tipo de serviço e responsável técnico antes de converter requisitos em regra nacional do produto. A [RDC Anvisa 63/2011](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/rdc0063_25_11_2011.pdf) trata de funcionamento dos serviços; software sozinho não comprova observância pela clínica. Assinatura e guarda eletrônica também precisam da análise específica de Cofen 754/2024 descrita no plano de assinaturas.
