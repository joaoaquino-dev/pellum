# Mapa do repositório

Referência documental: 09/11/2026. Branches são referências móveis; SHAs preservam o estado consultado.

## Versões

| Referência | Papel |
| --- | --- |
| `main` | Piloto histórico Aura/ChatGPT/D1, com apresentação documental atualizada |
| `fix/whatsapp-contact` / `9d911fc` | Versão independente associada à produção no handoff consultado |
| `docs/codex-handoff-2026-11-09` / `901646a` | Contexto, ambiente e instruções de retomada sobre a versão independente |
| `audit/production-2026-11-04` | Revisão anterior de segurança e SEO |
| `ui/refinement-2026-11-05` | Refinamentos de interface anteriores ao ajuste de contato |

Estar em uma branch, ter um PR ou ter um build aprovado não prova publicação. Consulte o SHA do deployment antes de afirmar qual versão está em produção. Não consolidar branches nem mudar a branch padrão como efeito colateral de uma tarefa documental.

## Código da versão independente

Os diretórios abaixo estão na [referência de desenvolvimento](https://github.com/joaoaquino-dev/pellum/tree/901646a153d94ec2770148ef7238f41f06dba726); alguns não existem na árvore histórica da main.

| Caminho | Conteúdo |
| --- | --- |
| `standalone/src/` | Entrada, autenticação, administração e extensões do runtime |
| `standalone/landing/` | Página pública e 404 |
| `standalone/build.mjs` | Build estático e composição do runtime |
| `public/aura/` | Interface e lógica compartilhadas |
| `supabase/migrations/` | Histórico de alterações SQL |
| `supabase/templates/` | Templates de autenticação |
| `tests/` e `security/` | Verificações, evidências históricas e rascunhos |
| `app/`, `db/`, `drizzle/`, `worker/` | Infraestrutura do piloto legado |

## Leitura recomendada

1. [Contexto técnico](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/PROJECT_CONTEXT.md): produto, dados e decisões.
2. [Ambiente](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/ENVIRONMENT_SETUP.md): ferramentas e comandos.
3. [Handoff](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/CODEX_HANDOFF.md): pendências e limitações.
4. [Auditoria](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/AUDIT-PRODUCTION-2026-11-04.md): evidências da revisão de produção.
5. [Refinamentos de interface](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/UI-UX-2026-11-05.md).
6. [Minutas jurídicas](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/LEGAL-DRAFTS-REVIEW.md): revisão humana pendente.

Documentos antigos descrevem seu momento de criação. Uma proposta SQL ou item de planejamento não comprova implementação. Relatórios de testes locais não comprovam homologação remota.

## Histórico preservado

[README original do piloto](history/README-AURA.md). Seu conteúdo foi mantido integralmente, com um aviso de contexto.
