# Produtos, insumos e pendências

## Entrega

Produtos e insumos possuem Editar e Excluir. A exclusão é lógica: o item desaparece da lista ativa e das opções de consumo, mantendo referências, movimentos e custos dos atendimentos anteriores. O servidor rejeita novos consumos ou movimentações de um item já excluído.

Compras sem movimentação podem ter preço, quantidade, proprietário, lote e validade corrigidos; o saldo inicial é recalculado. Após movimentação, os dados de compra ficam preservados; nome, categoria e alerta mínimo continuam editáveis. Uma nova compra com custo diferente deve ser cadastrada como outro lote.

Migração aplicada: `20261028235350_products_edit_archive.sql`. Não alterou dados reais, membros, licenças ou fatores MFA. A clínica compartilhada continua visível às contas convidadas, conforme a correção do proprietário. A escolha da clínica no navegador agora é lembrada separadamente para cada conta.

## Validação

10 verificações PostgreSQL com dados fictícios, BEGIN/ROLLBACK: correção de compra sem movimento, preservação de custo do lote usado, exclusão com referências históricas, bloqueio de saldo inconsistente, remoção física e novo consumo de item excluído. Nenhum usuário ou clínica real foi excluído.

`node tests/products-ui.mjs` verifica a edição, saldo recalculado, bloqueio de valores históricos, sincronização pendente e confirmação da exclusão. Testes existentes de CSP/ações, navegação, profissionais, painel concorrente e alvo estático de deployment passaram. Build standalone passou. Não representa teste autenticado em dois dispositivos nem entrega de e-mail.

## Autenticador: autorizado pelo usuário, bloqueado pela revisão automática

O proprietário solicitou MFA somente no painel administrativo. A migração combinada foi recusada pela revisão automática, sem justificativa específica no retorno. O banco mantém a política anterior; a interface publicada não promete exclusão de clínica sem MFA.

`PROPOSED-admin-only-mfa.sql` é uma proposta para revisão, fora da pasta de migrações. Ela remove a exigência de MFA das operações comuns de clínica e do acesso comum à conta. O endpoint administrativo continua exigindo administrador, sessão viva, AAL2 e fator verificado. Regras de licença, vínculo, isolamento, revisão, confirmação do nome da clínica e auditoria são preservadas. O usuário confirmou explicitamente as duas ações em 2026-10-29. Mesmo assim, a revisão automática recusou novamente a aplicação no Supabase, retornando apenas “Migration was declined.”. Não houve alteração da política de autenticação. O operador pode revisar este SQL e aplicá-lo manualmente no painel; não executar por outra rota para contornar a recusa. Após aprovação, gerar nova migração com a CLI e testar AAL1 comum, exclusão confirmada, restauração, convite e bloqueio administrativo sem MFA.

## E-mails e outras pendências

Publicação desta entrega bloqueada: duas tentativas de criar a árvore no GitHub foram recusadas pela revisão automática. A segunda ocorreu após verificar que a conta conectada é `joaoaquino-dev` e o repositório `joaoaquino-dev/pellum` é privado e pertence a ela, com permissão push. A revisão ainda exige autorização explícita do usuário para enviar os arquivos de código e SQL a esse destino. Nenhum commit remoto ou deployment desta entrega foi criado. Não tentar publicação indireta para contornar o bloqueio.

Modelos Pellum de confirmação e recuperação estão em `supabase/templates`. Continuam não ativados. O painel do Supabase exigiu novo login nesta sessão, e a integração não disponibiliza atualização de Auth/SMTP. Não foi configurado domínio, remetente verificado ou SMTP; não foi enviado e-mail real para fingir entrega validada. Não desabilitar confirmação para contornar a pendência.

Backup externo com restauração isolada, validação real com as profissionais, SMTP/domínio e proteção contra senhas vazadas continuam em aberto. Snapshots internos não equivalem a backup de desastre. `usepellum.vercel.app` não foi criado: autorização específica desse endereço segue pendente após o bloqueio anterior. O endereço existente é preservado.

## Continuação após autorização

O usuário confirmou explicitamente o envio de código, testes e SQL ao repositório privado `joaoaquino-dev/pellum` e a publicação na Vercel. O GitHub aceitou a criação da árvore após essa confirmação. A mudança de MFA continua bloqueada no Supabase, conforme o registro acima. A interface de exclusão da clínica mantém a exigência atual até o servidor ser alterado; produtos e insumos não exigem MFA adicional.
