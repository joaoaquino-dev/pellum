# Pellum: marca e exclusão administrativa — 2026-10-28

## Nome e infraestrutura

Repositório privado renomeado para `joaoaquino-dev/pellum`; descrição atualizada. Remote local atualizado. Supabase e Vercel renomeados para `pellum`; IDs e banco permanecem os mesmos. Não renomeamos tabelas, RPCs, migrações antigas, chaves de armazenamento nem caminhos `public/aura`, por compatibilidade.

Endereço `pellum-piloto.vercel.app` autorizado expressamente após bloqueio inicial de revisão automática. Configuração e verificação final registradas abaixo. O endereço anterior será mantido durante a transição; cookies e sessões de uma origem não migram automaticamente para a outra, sendo necessário entrar no novo endereço.

## Exclusão de contas responsáveis por clínicas

Antes: o proprietário de qualquer clínica não podia ser excluído. Agora o painel mostra as clínicas e quantidade de vínculos afetados, exige marcar a confirmação da exclusão dessas clínicas e digitar o e-mail completo.

Servidor: admin com MFA, sessão válida, UUID exato e confirmação do e-mail continuam obrigatórios. Exclusão exige o mesmo preview de clínicas calculado no servidor (ID, nome, revisão e quantidade de vínculos), sob locks. Lista vazia, IDs adulterados ou revisão desatualizada são recusados. Clínicas próprias e seus históricos/vínculos são excluídos na mesma transação do login/licença/sessões. Clínicas onde o usuário apenas participa são preservadas. A auditoria administrativa é mantida e registra quais clínicas foram excluídas. Sua própria conta e administradores ativos permanecem protegidos. Não há suporte a remoção automática de arquivos Storage; contas com arquivos continuam bloqueadas, pois objetos precisam ser removidos pela API do Storage (nenhum bucket no projeto atual).

Migração: `20261028202415_owner_user_deletion.sql`. Só substitui a função existente; aplicá-la não exclui contas ou dados. Rollback de comportamento: criar nova migração restaurando o corpo da função em `20261028195618_platform_user_deletion.sql`; não editar migrações aplicadas. Exclusão confirmada não possui recuperação pela aplicação; exige backup externo previamente validado. Nenhuma conta real foi excluída neste trabalho.

## Testes

102 verificações SQL passaram tanto com a função preparada em transação quanto após a aplicação da migração. Todos os dados fictícios foram revertidos por rollback. Incluem: não admin, MFA insuficiente, UUID/email incorretos, proteção do admin, Storage, sessão revogada, preservação de outras clínicas, exclusão do proprietário com confirmação, cascatas, auditoria, adulteração de clínica e preview desatualizado.

Navegador com RPC simulado: confirmações necessárias, payload com clínicas exatas, exclusão simulada sem duplicar painel. O teste não demonstra entrega de e-mail. Testes JS de navegação, equipe, renderização concorrente, ações permitidas e configuração de build passaram. Frontend compilou.

Ícones de Financeiro e Configurações substituídos por SVGs de traço, com `currentColor`, sem emoji dependente de iOS. Cor verde e identidade mantidas. Checkbox da confirmação recebeu dimensões próprias para evitar herdar o tamanho dos campos de texto.

## Pendências

SMTP próprio/templates da Pellum ainda não ativados. Backups externos/restauração e demais itens da revisão de segurança continuam pendentes. Advisor de senhas vazadas permanece WARN; tabelas privadas sem políticas têm RLS deny-by-default intencional. Esta entrega não autoriza dados clínicos reais.

## Endereços

`pellum-piloto.vercel.app` adicionado e verificado na Vercel após autorização explícita. `pellum.vercel.app` indisponível (409 owned-on-other-team). A alternativa `usepellum.vercel.app` foi bloqueada pela revisão automática e ainda aguarda autorização específica. Não tentar contornar o bloqueio. Até decidir o endereço final, a configuração de retorno do Auth preserva o endereço atual.
