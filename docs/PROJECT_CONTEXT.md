# Pellum — contexto técnico e funcional

Registro: 09/11/2026 (America/Sao_Paulo). Este documento descreve evidências recuperadas; não certifica prontidão comercial ou conformidade jurídica.

## 1. Fontes e estado de referência
Repositório privado [joaoaquino-dev/pellum](https://github.com/joaoaquino-dev/pellum).
Código de referência: [9d911fc](https://github.com/joaoaquino-dev/pellum/tree/9d911fc86e0b7c3df109ce41274512c64997afe0), branch fix/whatsapp-contact.
A API da Vercel associa esse SHA ao último deployment de produção READY consultado: dpl_FvcFVCJetUXgAAVmnfYpEUxXzPiN.
Endereço de uso: https://usepellum.vercel.app/; apresentação pública: /conheca/.
Isso confirma metadados de publicação, não uma nova validação autenticada da aplicação.

A main está em 76ced1d62f5c830341ee87b6c288244550636425, de 28/10/2026, com piloto Aura/ChatGPT/D1. Não acompanha a produção independente.
Outras pontas consultadas: feat/supabase-login b644bb6; security/application-review bccc645; audit/production-2026-11-04 737c2f7; ui/refinement-2026-11-05 11a3fd9. Não foram alteradas ou consolidadas.
O PR de transferência parte de fix/whatsapp-contact, para que o diff contenha só documentação.

Foram lidos arquivos de arquitetura, build, entrada, persistência, equipe, catálogo e relatórios na referência de produção; catálogos PostgreSQL, políticas, funções de identidade/acesso, histórico de migrations e metadados de Vercel.
Histórico Work consultado: Geral (6ae1f7e7-c780-83e8-9ec4-5d2682d699f1), Design (6aebf265-18c4-83e8-9e36-e692389eac4a), Prompt de segurança Pellum (6aeb23d0-6198-83e9-88d2-393dbd58574b) e Melhorar prontuário estético (6af21a7c-2074-83e9-82c5-279bef034ecf). A leitura foi limitada aos turnos recuperados; houve conteúdo truncado, anexos e histórico mais antigo não recuperados integralmente.
Busca de issues retornou zero resultados; PRs históricos encontrados: [1](https://github.com/joaoaquino-dev/pellum/pull/1), [2](https://github.com/joaoaquino-dev/pellum/pull/2), [3](https://github.com/joaoaquino-dev/pellum/pull/3). Não inferir merge pela publicação de uma branch.

## 2. Produto e funcionalidades verificadas
SaaS de gestão para profissionais e clínicas de estética, com múltiplas clínicas e uso individual ou em equipe.

| Área | Comportamento existente |
| --- | --- |
| Conta | Cadastro por e-mail/senha, confirmação, entrada, saída, recuperação e MFA; licença individual antes do uso |
| Clínica | Criação, alternância, vínculos por e-mail, histórico de snapshots e restauração; exclusão com confirmação |
| Visão geral | Recebimentos, resultado estimado, agenda do dia e gráficos de receita/custo |
| Pacientes | Contatos, telefone brasileiro, observações/histórico de atendimentos e ações de WhatsApp |
| Agenda | Calendário, profissional, horário, duração, status e retorno vinculado; validação de conflito |
| Precificação | Simulação individual/parceria, desconto, taxas, custo dos materiais e divisão de resultados |
| Produtos e insumos | Compra por embalagem/caixa, unidades, lote, validade, proprietário, custo unitário, saldo, consumo, movimentos e arquivamento |
| Financeiro | Atendimentos, recebimento, parcelas estimadas, repasses, despesas e exportações CSV/JSON |
| Equipe | Profissionais ativos/inativos e preservação de identidade histórica; acesso da conta é distinto do cadastro profissional |
| Procedimentos | Catálogo padrão e personalizado, busca, ocultação e restauração sem apagar histórico |
| Guia | Onboarding opcional e Como usar; progresso local por navegador/clínica |
| Administração | Liberação/suspensão/revogação de uso, gestão de usuários e exclusão protegida |
| Público | Conheça, CTA de contato, favicon, compartilhamento, sitemap e 404 |

Não há implementação verificada de prontuário completo, anamnese, fotos clínicas, assinatura clínica, cobrança recorrente ou pagamento por gateway. Parcelas são agenda financeira, não processamento de pagamento. WhatsApp abre um rascunho/conversa; não existe envio automático confirmado.
A conversa recente de prontuário é planejamento para um prompt futuro, não prova de implementação nem instrução para iniciar esse trabalho.

## 3. Arquitetura e estrutura
Produção: navegador → frontend estático Vercel → Supabase Auth/Data API/RPC → PostgreSQL.
O bundle usa @supabase/supabase-js 2.118.0 e esbuild 0.28.2, fixados em standalone/package.json e package-lock.json.

| Caminho | Responsabilidade |
| --- | --- |
| standalone/src/main.js | Supabase client, PKCE, telas de autenticação, licença, seleção de clínica e carregamento do runtime |
| standalone/src/security-ui.js | Interface de MFA e administração |
| standalone/src/runtime-*.js | Extensões de segurança, equipe, onboarding, catálogo, produtos, telefone e alertas |
| standalone/src/interface.js e actions.js | Melhoria de interface e delegação de comandos permitidos |
| public/aura/app.js e features.js | Telas e regras compartilhadas, estado, fila de gravação e atualização periódica |
| public/aura/style.css e index.html | Base visual e estrutura HTML |
| standalone/build.mjs | Gera main.js, runtime.js, CSS, HTML, assets e arquivos públicos |
| standalone/landing/ | Apresentação pública e 404 |
| standalone/assets/ e brand.json | Identidade e ícones |
| standalone/supabase.public.json | Configuração pública de conexão; valores não copiados para esta documentação |
| vercel.json | Framework Other, comandos de build, saída e headers |
| supabase/migrations/ e templates/ | Histórico SQL e templates de confirmação/recuperação |
| tests/ e security/ | Testes, evidências, relatórios e rascunhos não aplicados |
| app/, db/, drizzle/, worker/, components/ | Piloto legado Next/React, Cloudflare D1/Drizzle e infraestrutura do Sites |

A raiz ainda declara Next 16.3.4, React 19.2.6, TypeScript 5.9.3, Tailwind 4.2.1, vinext e Wrangler. Sua presença não significa que a produção seja React/Next. O endpoint legado app/api/clinic/route.ts não é o backend da versão independente.
Não há Edge Functions no projeto Supabase consultado. Não foram encontrados buckets de Storage.
O build substitui o bootstrap demonstrativo por window.AURA_DATA, concatena extensões em ordem e reescreve handlers para um dispatcher sem eval. O código demonstrativo não deve virar dados reais.
CSP restringe scripts à origem e conexão ao Supabase; estilos inline continuam permitidos. Headers incluem nosniff, strict-origin-when-cross-origin e no-cache.

## 4. Persistência e banco Supabase
Projeto pellum: iddiiisimjaquhxhskcn, região us-east-1, ACTIVE_HEALTHY, PostgreSQL 17 (17.11.0.003 no catálogo do projeto consultado).
Os dados de negócio permanecem em um agregado JSONB por clínica; não existem tabelas individuais de pacientes, agenda e estoque neste modelo.

Inventário de colunas observado, sem ler linhas de negócio:

| Tabela | Colunas |
| --- | --- |
| public.aura_clinics | id uuid, owner_id uuid, name text, data jsonb, revision bigint, updated_at timestamptz |
| public.aura_members | clinic_id uuid, email text, role text |
| public.aura_history | id uuid, clinic_id uuid, actor text, created_at timestamptz, action text, data jsonb, revision bigint |
| aura_private.licenses | email text, status text, expires_at timestamptz, max_clinics integer, revoked_before timestamptz, updated_at timestamptz |
| aura_private.platform_admins | email text, enabled boolean |
| aura_private.platform_audit | id uuid, actor_id uuid, action text, target text, created_at timestamptz, details jsonb |
| aura_private.rate_limits | user_id uuid, bucket text, window_start timestamptz, n integer |
| aura_private.request_results | user_id uuid, request_id uuid, body_hash text, response jsonb, created_at timestamptz |

O snapshot inclui names, percent, patients, appointments, records, products, expenses e extensões como inactivePros, customProcedures e hiddenProcedures. Identificadores e nomes históricos não devem ser renumerados.
A fila salva snapshots com revision e requestId. Antes da alteração, preserva a versão anterior no histórico. Conflito de revisão retorna erro, bloqueia a fila e oferece exportação antes de recarregar. Polling de 15 segundos evita substituir edição ativa/modal e não roda enquanto há gravações pendentes.
O limite de snapshot documentado é 3 MB. A restauração recupera a clínica inteira. Histórico interno não substitui backup externo/PITR.

### RLS e privilégios atuais
RLS ativo nas oito tabelas. Grants consultados para anon/authenticated: apenas authenticated tem SELECT nas três tabelas públicas; nenhuma escrita direta listada.
Políticas encontradas nos schemas public/storage:

| Tabela | Política | Comando/role | Predicado |
| --- | --- | --- | --- |
| aura_clinics | aura_clinic_read | SELECT authenticated | aura_private.can_access(id, false) |
| aura_history | aura_history_owner_read | SELECT authenticated | aura_private.can_access(clinic_id, true) |
| aura_members | aura_members_owner_read | SELECT authenticated | aura_private.can_access(clinic_id, true) |

Não foram encontradas políticas nas cinco tabelas privadas, que permanecem com RLS. A ausência é intencional segundo a revisão existente, com operações encapsuladas nos helpers.
A definição atual de can_access verifica account_active e vínculo por e-mail na clínica. O parâmetro p_owner não é utilizado; logo nomes owner_read não demonstram restrição ao proprietário. Isso já foi registrado na auditoria, não corrigido nesta transferência.

### RPCs e identidade
Entradas públicas SECURITY INVOKER:
- aura_rpc(p_action text, p_clinic uuid DEFAULT NULL, p_body jsonb DEFAULT '{}').
- aura_admin_rpc(p_action text, p_body jsonb DEFAULT '{}').

Helpers privados incluem identity, account_active, is_licensed, is_admin, can_access, rpc, rpc_core, admin_rpc, assert_state, limit_request e validadores. A maioria dos helpers de autorização/execução é SECURITY DEFINER no schema privado; identity/account_active/can_access consultados usam search_path vazio.
identity exige usuário confirmado, não anônimo, não banido, com session_id apontando para sessão viva e posterior à revogação.
account_active exige licença active, não vencida, sessão posterior a revoked_before e AAL2 se a conta possuir fator verificado.
Ações de cliente incluem get, create, save, member, history, restore, export, delete_preview e delete_clinic. O servidor valida o estado e a autorização. Não inferir autorização a partir de botões escondidos.

### Migrações registradas e divergências
As oito primeiras versões coincidem com os arquivos: 20261028152705 aura_initial; 20261028161248 licensing_admin_security; 20261028185829 clinic_professional_roster; 20261028192814 clinic_procedure_catalog; 20261028195618 platform_user_deletion; 20261028202415 owner_user_deletion; 20261028204011 clinic_deletion; 20261028235350 products_edit_archive.
Duas diferenças exigem conferência antes de qualquer futura operação de migrations:

| Nome | Arquivo no commit de produção | Registro remoto |
| --- | --- | --- |
| patient_phone_validation | 20261029004713 | 20261029004749 |
| recoverable_procedure_catalog | 20261103000000 | 20261103010054 |

Não foi comparado integralmente o SQL aplicado dessas duas versões. Não renomear, executar repair ou reaplicar automaticamente.
docs/PROPOSED-admin-only-mfa.sql e security/drafts/resource-limits.unvalidated.sql são propostas, não migrations aplicadas.

## 5. Autorização e regras essenciais
Conta e licença individual são pré-condições, além de vínculo com a clínica. Estar autenticado ou conhecer o link não libera uso.
Proprietário/gestora e cadastro de profissional são conceitos distintos; a equipe visual pode incluir pessoas sem um login correspondente. Os documentos de equipe pedem poderes equivalentes entre gestoras. Um novo papel limitado precisa de especificação e validação próprias.
Administração da plataforma exige proteção de servidor, sessão viva e MFA. A proposta de MFA apenas admin foi recusada anteriormente na revisão automática e não foi aplicada; o banco ainda exige AAL2 em contas com fator verificado. Não contornar a recusa.

Regras preservadas no código e relatórios:
- Atendimento solo é padrão na calculadora; parceria opcional.
- Dinheiro é calculado com arredondamento em centavos; desconto, divisão, custos e taxa alteram resultados. Custo do material é atribuído a quem o fornece; repasse não é lucro.
- Movimentos de estoque são explícitos. Novo lote/custo pede novo produto/lote; alteração de valor financeiro não reescreve consumo histórico.
- Profissional não pode ser arquivada se for a última ativa, tiver agenda futura pendente ou estoque com saldo. IDs e atendimentos anteriores permanecem.
- Catálogo: até 100 personalizados de até 120 caracteres; bloqueia duplicados e conserva ao menos um procedimento ativo. Ocultar/restaurar preserva atendimentos e valores históricos.
- Telefone brasileiro é validado e formatado; WhatsApp não envia mensagem sozinho.
- Exclusão de clínica exige preview, sincronização concluída, nome exato e confirmação; afeta dados e histórico daquela clínica.
- Exclusão administrativa de conta tem preview e confirmação de e-mail/UUID, proteção do próprio admin e de administradores ativos; clínicas apenas participadas são preservadas. Não testar exclusões reais.

## 6. Identidade visual
Marca atual Pellum; nomes internos Aura foram mantidos por compatibilidade. Emblema SVG verde com detalhe dourado, sem emoji dependente de sistema.
Fontes Georgia para títulos/marca e Segoe UI/Arial para interface. Verde #345e4d, dourado #c39960, fundo claro/creme e cards brancos.
O relatório UI registra creme #f4f4e9 e texto secundário refinado #5f7167; usar o CSS vigente como autoridade, pois há tons distintos por superfície.
Mobile-first: áreas de toque, campos de 16 px, foco visível, modais identificados, feedback dentro de dialogs e redução de movimento. Tabelas empilhadas abaixo de 768 px; desktop mantém colunas.
A conversa Design registra insatisfação com a altura dos registros de estoque no celular. Compactação foi discutida, sem implementação posterior comprovada.
Contato/suporte público abre o WhatsApp do proprietário conforme o commit 9d911fc; não substituir por outro canal.

## 7. Integrações e decisões
- GitHub: repositório privado e branches de desenvolvimento; main desatualizada.
- Vercel: projeto prj_xNNqxkDzMtJScbuTbt1Fhp5bjdRA, equipe team_O1p3X85GgLd3XRyMPwZIDZfJ; Node 24.x, framework null/Other, saída standalone/dist.
- Supabase: autenticação e banco; URL e chave publicável consumidas no build do arquivo existente, sem segredo privilegiado no navegador.
- Brevo: SMTP de confirmação/recuperação do Supabase. docs/EMAILS-ACTIVATED-AND-MARK-2026-10-29.md registra ativação e templates aplicados; isso supera a pendência de ativação de relatórios anteriores. Entrega real não foi comprovada nessa verificação nem nesta transferência.
- Sites/ChatGPT/D1: origem histórica, mantida na árvore; acesso ao D1 e dados antigos não foi recuperado.
- Nenhum provedor de cobrança/assinatura foi confirmado.
Decisões centrais: reutilizar a interface existente, separar frontend independente do legado, guardar agregado por compatibilidade, usar RPC transacional e licenças individuais, preservar histórico e marca em vez de reconstruir o produto.

## 8. Documentação existente e limites
Preservar README.md e docs/MIGRACAO.md como registros do piloto; suas afirmações de Supabase não implementado descrevem o passado.
Consultar standalone/README.md, security/REVIEW-2026-10-28.md, docs/AUDIT-PRODUCTION-2026-11-04.md, docs/UI-UX-2026-11-05.md, docs/TEAM-AND-ADMIN-FIX-2026-10-28.md, docs/ONBOARDING-AND-PROCEDURES-2026-10-28.md, docs/PRODUCTS-AND-PENDING-AUTH-2026-10-29.md, docs/EMAILS-ACTIVATED-AND-MARK-2026-10-29.md e docs/LEGAL-DRAFTS-REVIEW.md.
Esses relatórios distinguem testes simulados, SQL com rollback e fluxos reais não testados. Nenhum teste anterior foi reexecutado nesta transferência.
Pendências atuais e instruções para retomar estão em CODEX_HANDOFF.md; configuração em ENVIRONMENT_SETUP.md.
