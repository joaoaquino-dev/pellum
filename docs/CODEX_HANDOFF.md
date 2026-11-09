# Pellum — transferência Work → Codex

Preparado em 09/11/2026, America/Sao_Paulo. Escopo exclusivo: documentação. O proprietário enviará outro prompt para desenvolvimento.

## Ponto de retomada
- Repositório privado: https://github.com/joaoaquino-dev/pellum
- Versão de produção identificada: 9d911fc86e0b7c3df109ce41274512c64997afe0, branch fix/whatsapp-contact.
- Branch documental: docs/codex-handoff-2026-11-09, derivada desse SHA.
- Destino do PR: fix/whatsapp-contact, para manter diff documental. Não fazer merge automático.
- Atenção: main = 76ced1d62f5c830341ee87b6c288244550636425, piloto Aura/ChatGPT/D1. Não contém o desenvolvimento independente atual.
- Não foi consolidado o histórico de branches, nem mudada a branch padrão. Isso deve ser decidido em trabalho futuro, sem confundir com a preparação documental.

## Estado observado
Vercel: último deployment consultado dpl_FvcFVCJetUXgAAVmnfYpEUxXzPiN, READY, target production, SHA 9d911fc.
Endereço de uso: https://usepellum.vercel.app/; apresentação: https://usepellum.vercel.app/conheca/.
O deploy anterior 11a3fd9 traz refinamentos mobile; 9d911fc altera os contatos para WhatsApp. A conversa Design confirma a publicação dessas duas etapas.
A consulta registra estado do provedor, sem testar login, navegação autenticada ou gravação nesta etapa.

Supabase pellum: iddiiisimjaquhxhskcn, ACTIVE_HEALTHY, us-east-1. Oito tabelas com RLS, três políticas SELECT públicas, helpers privados e RPCs de negócio. Zero buckets e zero Edge Functions nas listagens consultadas.
Não foram lidos usuários, licenças individuais, pacientes ou snapshots de produção.
A pasta local estava vazia e Git não estava no PATH; o repositório foi consultado e a branch/PR preparados pelo conector GitHub.

## O que já existe
Autenticação Supabase por e-mail, confirmação e recuperação; licença individual e administração com MFA; clínicas e vínculos; pacientes/contatos; agenda; procedimentos/precificação; equipe solo ou parceria; estoque e insumos; financeiro/despesas/parcelas/repasse; snapshots, histórico e exportações; onboarding e guia; apresentação pública, SEO e suporte via WhatsApp.
Arquitetura atual é estática (public/aura + standalone), com PostgreSQL/RPC, e não o servidor Next/D1 da main.
Detalhes de fluxos, tabelas, RLS, autorização, cálculos e referências: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Pendências registradas — não executar nesta transferência
| Tema | Evidência e limite |
| --- | --- |
| Testes reais | Cadastro/confirmação/login/logout/reset, SMTP, MFA e dois dispositivos ainda precisam de validação completa. Relatórios existentes não comprovam entrega real de e-mail. |
| E-mail | Documento de 29/10 registra SMTP Brevo e templates ativados. Não repetir a afirmação antiga de que nunca foram configurados. Estado atual do painel/entrega não revalidado. |
| MFA | Desejo de MFA apenas admin não foi aplicado; proposta em docs/PROPOSED-admin-only-mfa.sql. account_active ainda exige AAL2 em conta com fator verificado. Há recusas históricas de revisão automática; não contornar por outra rota. |
| Papéis | can_access ignora p_owner; nomes owner_read não restringem leitura só ao proprietário. Confirmar escopo antes de adicionar profissionais com poderes menores. |
| Migrações | Divergências de versão em patient_phone_validation e recoverable_procedure_catalog; detalhes no contexto. Não reaplicar, renomear ou reparar sem análise específica. |
| Senhas vazadas/antiabuso | Auditoria anterior registra proteção desabilitada e avaliação incompleta. Configuração não consultada novamente; não afirmar que o alerta foi resolvido. |
| Backup | Recuperação externa/PITR, retenção e restauração isolada continuam sem comprovação recuperada. Histórico da aplicação não é backup de desastre. |
| UI/UX | Validação anterior usou Chrome e APIs simuladas. Falta fluxo real, Safari/iPhone físico e outras verificações descritas em UI-UX. Usuário apontou registro de estoque alto demais no celular; compactação discutida sem mudança comprovada. |
| Lint | Relatório de 04/11: 75 erros e 440 avisos preexistentes; não executado agora. Build, TypeScript e testes passados são evidência histórica, não resultado desta transferência. |
| Jurídico | Minutas em LEGAL-DRAFTS-REVIEW.md dependem de revisão humana e informações faltantes; não foram publicadas como páginas no histórico recuperado. |
| Escala/comercial | Agregado JSONB, limites e retenção, observabilidade, carga, cobrança e entitlements comerciais ainda demandam definição. Rascunho resource-limits não aplicado. |
| Legado | Importação D1 não comprovada; main não alinhada à produção; não migrar dados ou consolidar branches nesta etapa. |

Prontuário completo, anamnese, acompanhamento com imagens e assinatura foram discutidos em Melhorar prontuário estético como planejamento. Não implementados nesta tarefa; o conteúdo jurídico daquela conversa não foi revalidado e não é especificação aprovada.

## Evidência histórica e validação desta entrega
Relatórios existentes registram 40 asserções SQL na revisão de produção, outras suítes transacionais e 11 testes JavaScript. A etapa de UI descreve sete áreas em seis larguras com dados fictícios e API simulada. Não transformar esses resultados em afirmação de teste real end-to-end.
Nesta transferência: leitura de código/documentos, histórico acessível, metadados GitHub/Vercel e consultas SELECT em catálogos PostgreSQL. Verificação do diff para limitar alterações aos quatro arquivos de documentação.
Sem execução de build/testes da aplicação, migrations, escrita no banco, alteração de configuração, variáveis, secrets, identidade ou acionamento de deploy.

## Lacunas de recuperação
- Histórico completo do Work, mensagens truncadas, memórias não expostas e anexos visuais não foram recuperados integralmente.
- Não foi obtido um checkout local completo nem acesso aos dados antigos D1.
- Não foram verificados configuração Auth/SMTP atual, entrega real, plano/PITR/backup, provedor de cobrança ou logs completos.
- Não foi comparado todo o corpo SQL remoto às migrations; apenas inventário, RLS, grants e funções essenciais selecionadas.
- A relação do deploy com o SHA é confirmada por metadados, sem comparação byte a byte do artefato nesta etapa.
- Não foi estabelecido se cada PR histórico foi incorporado à main; a divergência observada já impede assumir isso.
Essas lacunas não devem ser preenchidas por suposição.

## Como continuar
1. Abrir o checkout da branch documental, não a main antiga.
2. Ler AGENTS.md e os três documentos de transferência.
3. Conferir branch/commit e o acesso de leitura aos projetos corretos.
4. Configurar somente o ambiente local necessário, seguindo ENVIRONMENT_SETUP.md.
5. Aguardar e aplicar o prompt separado do proprietário. Este documento não autoriza resolver as pendências listadas.
