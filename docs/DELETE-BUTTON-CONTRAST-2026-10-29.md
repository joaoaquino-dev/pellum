# Contraste da confirmação de exclusão

O botão Excluir item no modal de produtos/insumos recebia a cor vermelha da classe genérica danger sobre fundo verde. A regra específica `#confirmProductDelete { color: #fff }` preserva o fundo verde e mantém o texto branco.

Build standalone verificado. Mudança somente visual; não altera confirmação, estoque, histórico ou autorização.

O usuário relatou que a aba compartilhada do navegador não está disponível. Para concluir o SMTP, usar o painel Supabase no próprio navegador: https://supabase.com/dashboard/project/iddiiisimjaquhxhskcn/auth/smtp. O preenchimento anterior era somente um rascunho na aba compartilhada, sem salvamento; não presumir que aparece em outro navegador. Host e usuário foram conferidos no plugin Brevo. O segredo SMTP deve ser inserido pelo usuário diretamente no campo Password e nunca enviado ao chat, armazenado neste repositório ou confundido com a senha da conta Brevo.
