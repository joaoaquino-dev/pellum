# WhatsApp e validação de telefone

Botão WhatsApp na lista de pacientes ativas com telefone válido; link HTTPS `wa.me` inclui o DDI 55 e abre nova aba com noopener/noreferrer, sem mensagem automática e sem envio de dados clínicos. O botão só inicia a navegação quando a pessoa o escolhe. SVG local no mesmo estilo da interface, sem emoji do sistema.

Formulários novo/editar: máscara brasileira, teclado de telefone, sugestão de preenchimento e validação antes de salvar. Aceita telefone opcional, números nacionais de 10 dígitos para fixos (prefixo 2–5) ou 11 para celulares (prefixo 9), DDD existente e entrada com +55. Rejeita tamanhos excessivos, letras, DDD inexistente e sequência local toda repetida. Não comprova que o número existe, pertence ao paciente ou possui WhatsApp; essa conferência continua sendo da clínica.

Migração patient_phone_validation substitui o validador de estado e adiciona helper no schema privado sem permissões públicas. Telefones antigos inalterados são preservados para não bloquear salvamentos da clínica; novos ou alterados precisam ser válidos ou vazios. Nenhum telefone real foi reescrito.

Testes JS de formatos, DDD, repetição, tamanho e URL; testes PostgreSQL com BEGIN/ROLLBACK validam novo/alterado, manutenção de legado, correção e campo opcional. Build, sintaxe, CSP/ações e recuperação de senha passaram. Não foi enviada mensagem nem aberto WhatsApp de paciente real.
