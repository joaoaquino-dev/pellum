# Proteção do acesso da proprietária

Registro de 09/11/2026, America/Sao_Paulo. Continuidade posterior ao relatório BUSINESS-REGRESSION-2026-11-09.md, na branch local feat/phase2-hardening. Nenhuma contratação, alteração remota ou publicação foi realizada.

## Problema e mudança

O ensaio anterior mostrou que uma gestora podia remover o vínculo da proprietária. A propriedade registrada em owner_id não supria esse vínculo no acesso legado. A nova migration 20261110013613_protect_clinic_owner_membership.sql, gerada pela CLI e executada apenas em bancos descartáveis locais, impede remover ou reatribuir o e-mail/clínica desse vínculo enquanto a clínica existe.

A regra usa o owner_id persistido e o usuário correspondente; não confia no nome do papel, em metadados editáveis do usuário ou em informação enviada pela interface. Também impede que outra gestora use a exclusão de toda a clínica para contornar a proteção. A exclusão confirmada pela proprietária e a exclusão administrativa explícita de uma conta fictícia com clínica vazia continuam passando pelo fluxo existente, com confirmação, MFA e auditoria. O cascade só elimina os vínculos quando a clínica já foi removida legitimamente.

As funções de trigger ficam no schema privado, com search_path vazio e execução direta revogada para public/anon/authenticated. Não foram alteradas as semânticas de can_access(p_owner), os papéis históricos ou as permissões do prontuário. Não há transferência de propriedade, restabelecimento automático de vínculos antigos ou reparo em dados existentes.

## Experiência de uso

standalone/src/cloud-error.js traduz os dois erros específicos para mensagens compreensíveis. standalone/src/main.js mantém a sessão diante desses dois impedimentos de negócio, em vez de recarregar a página. Demais recusas de autorização continuam acionando a revalidação existente. A exceção exige correspondência exata de código e mensagem; não libera operações negadas no banco.

Uma gestora continua com os poderes amplos de gestão já documentados, incluindo edição do snapshot, histórico e outros vínculos. Não oferecer um papel de acesso restrito apenas por mudar seu rótulo. Restauração de snapshots e uma matriz mais detalhada de funções continuam dependentes de definição e revisão próprias.

## Evidência local

- tests/clinic-owner-protection.mjs: 25 verificações com a cadeia real de SQL. Remoção por RPC, normalização de e-mail, repetição de solicitação, reatribuição por SQL, operação em lote, tentativa de excluir a clínica pela gestora, rollback e vínculo preservado. Exercita exclusão autorizada de clínica vazia e exclusão administrativa de conta fictícia, além de comprovar que os registros clínicos continuam bloqueando exclusões da proprietária e do administrador.
- tests/clinic-owner-browser.mjs: sete verificações com main.js e runtime reais compilados, HTTP e PostgreSQL locais; remoção e exclusão negadas têm feedback sem recarga, a proprietária mantém acesso e a suspensão real no SQL ainda provoca reinicialização. O SDK Auth, sessão e verificação MFA são doubles explícitos.
- tests/clinic-management-permissions.mjs: 15 verificações atualizadas para a proteção nova; gerenciamento dos demais vínculos, snapshot e negações de prontuário/admin continuam preservados.
- tests/cloud-error.mjs: mensagens específicas, rejeição de variantes não reconhecidas e proteção contra detalhes internos.

A revisão consultou a [documentação de triggers do PostgreSQL 17](https://www.postgresql.org/docs/17/trigger-definition.html), especialmente rollback e cascatas referenciais, e o changelog atual do Supabase. O comportamento foi confirmado pelos testes locais; não constitui ensaio com Supabase Auth/PostgREST ou Storage reais, nem prova de concorrência em múltiplas conexões.

Verificação consolidada em 09/11 às 22:40, horário de São Paulo: `node scripts/verify-phase2.mjs` com Node 24.22.2 no Windows concluiu build, 36 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências, sem falhas ou arquivos de teste pulados. As auditorias não reportaram vulnerabilidades. O ensaio do banco executou as 16 migrations do repositório. Evidência sanitizada: security/owner-protection-evidence-2026-11-09.json. Os relatórios anteriores foram preservados.

## Limites para aplicação

Antes de aplicar remotamente, revisar as divergências históricas de migrations e conferir a compatibilidade das funções e chaves estrangeiras do ambiente segregado. Não executar este arquivo na produção como teste. Os testes de exclusão usam exclusivamente contas e clínicas descartáveis locais.

O vínculo depende do e-mail da conta no modelo legado. Alteração de e-mail, recuperação de proprietária que já perdeu vínculo e transferência de propriedade não foram implementadas nesta etapa; precisam de fluxo próprio, autenticado e auditado. A proteção nova não repara automaticamente situações anteriores.

Homologação real, scanner efetivo, recuperação externa, revisão clínica/jurídica e autorização de publicação continuam pendentes. Assinatura eletrônica externa permanece adiada; cobrança continua externa com liberação manual.
