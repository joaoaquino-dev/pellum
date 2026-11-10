# Exclusão de clínica e ícones SVG — 2026-10-28

## Implementado

Configurações → Conta e proteção → Excluir esta clínica. Mostra resumo do servidor com nome, ID, revisão, contagem de pacientes, agendamentos, atendimentos, produtos/insumos, despesas, versões no histórico e vínculos. Exige verificação MFA, nome exato e confirmação de perda permanente. Exportação opcional usa a cópia atual do navegador; não representa backup externo nem restauração validada.

As profissionais com vínculo manager têm os mesmos poderes na clínica, inclusive excluir, conforme o modelo solicitado. Não se exige conta de administrador da plataforma. Quem não tem vínculo, foi removido ou está sem licença/sessão ativa não pode usar a operação. A exclusão remove somente a clínica confirmada e os vínculos e históricos dela; contas Auth, licenças e outras clínicas são preservadas. A última clínica pode ser excluída e a conta volta ao cadastro de uma clínica. Administrador sem clínicas continua com botão para entrar no painel administrativo, sem precisar criar outra clínica. Seleção local antiga de clínica inacessível é descartada no carregamento, evitando uma tela de erro permanente após exclusão por outra pessoa.

## Banco

Migração `20261028204011_clinic_deletion.sql` substitui apenas a RPC privada existente. Endpoints públicos, RLS e grants não foram ampliados. Não contém execução de exclusões de clínicas reais durante a migração.

`delete_preview`: identidade e licença válidas, vínculo atual, quota de leitura; resumo mínimo sem conteúdo clínico. `delete_clinic`: mesmas verificações mais MFA verificado/AAL2, UUID de requisição, quota de escrita, lock de proprietário e de clínica, nova verificação de acesso sob lock, comparação exata do resumo atual do servidor, confirmação booleana e nome. Mudança de revisão, vínculo ou resumo invalida a confirmação; UUID adulterado é recusado. Exclusão e auditoria restrita são atômicas. Repetição após exclusão é recusada, sem efeitos adicionais. Auditoria registra resumo/contagens, nunca conteúdo clínico. Nenhum Storage usado atualmente; futuro suporte a arquivos exige fluxo próprio de limpeza.

Rollback de comportamento: nova migração restaurando o corpo de aura_private.rpc em `20261028161248_licensing_admin_security.sql`. Não editar migrações aplicadas. Exclusão confirmada não tem desfazer pela aplicação; restaurar dados eliminados requer backup externo, ainda pendente na revisão de segurança.

## Ícones

SVGs locais com `currentColor` e `aria-hidden`, sem imagens externas ou emoji de sistema: Ver agenda, Simular um procedimento, navegação completa, indicadores do dashboard, confirmação financeira, legenda da agenda e ornamento do cabeçalho. As cores da Pellum foram mantidas.

## Validação

Suíte SQL em transação com rollback: 122 asserts durante preparação; 125 após aplicar a migração, incluindo cenário da última clínica e bloqueio de DELETE direto à tabela. Contas de pelo menos duas clínicas, parceiro manager, usuário removido, anônimo, AAL1, IDs adulterados, nome/confirmação incorretos, revisão alterada, repetição, cascatas e preservação de contas/licenças/outras clínicas. Nenhuma clínica ou conta real foi excluída.

Comando para gerar a suíte reproduzível: `python tests/build-platform-security-test.py`. Executar a saída integral (BEGIN/ROLLBACK) apenas em ambiente de testes apropriado.

Build e testes JS existentes de ações/CSP, navegação da conta, profissionais, painel concorrente e alvo de deployment passaram. Navegador com RPC simulada confirmou SVG em ambos os atalhos e 9 de 9 itens de navegação, sem setas emoji nos links; modal de exclusão exibe o resumo correto; nome incorreto bloqueia o envio; confirmação correta enviou resumo, nome, flag e requestId e recarregou a página na simulação. Testes de navegador não equivalem a autenticação real/MFA real nem entrega de e-mail.

## E-mails: bloqueio verificado

SMTP próprio desligado no painel Supabase; Vercel não possui integrações de envio instaladas. Usuário informou que ainda não tem domínio ou serviço SMTP. Os modelos `supabase/templates/confirmation.html` e `recovery.html` estão prontos com identidade Pellum, mas não ativados no provedor. Sem domínio/remetente verificado e credenciais SMTP não é possível prometer envio personalizado. Não foi comprado domínio, criado remetente não verificado, desabilitada confirmação ou enviado e-mail de teste real.

Próximo passo para e-mail: registrar domínio em conta do usuário, verificar domínio/remetente no provedor escolhido (SPF/DKIM e DMARC conforme instruções), inserir credenciais de forma privada no SMTP do Supabase, aplicar os dois modelos e assuntos, testar cadastro e recuperação em destinatários autorizados. Não enviar senhas/tokens SMTP pelo chat ou commitá-los. O domínio do site na Vercel não dá autorização para enviar e-mails por vercel.app.
