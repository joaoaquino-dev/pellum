# Mínimo de oito caracteres solicitado pelo proprietário

Formulários de cadastro, login e recuperação alterados de minlength 12 para 8. Orientações visíveis e erro de senha fraca ajustados para 8; máximo de 128 preservado. Senhas existentes não foram alteradas. Build, recuperação com MFA, CSP/ações e alvo estático verificados.

No painel Supabase Auth > Sign In / Providers > Email, Minimum password length foi preparado como 8, sem salvar. O navegador exige confirmação no momento de reduzir proteções de autenticação. A aprovação específica para salvar a política do servidor será solicitada ao proprietário antes da ação final. O valor anterior não foi exposto pelo navegador; não foi contornada a redação do campo.

Enquanto a política do servidor não for salva, pode continuar rejeitando senhas curtas mesmo com a interface preparada para 8. MFA administrativo, confirmação de e-mail e demais parâmetros não foram modificados. Não declarar a mudança concluída no servidor sem verificar o salvamento.

Sugestões para próxima versão: painel de pendências (agenda/recebimentos/estoque), mensagens de confirmação e retorno via WhatsApp iniciadas pelo usuário, visão semanal da agenda e fluxo simples de remarcação. Priorizar piloto completo com profissionais e backup externo/restauração antes de ampliar funcionalidades.
