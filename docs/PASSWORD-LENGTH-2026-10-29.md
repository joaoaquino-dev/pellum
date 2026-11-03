# Mínimo de oito caracteres

Formulários de cadastro, login e recuperação usam mínimo 8 e máximo 128. Orientações e erro de senha fraca ajustados. Senhas existentes não foram alteradas.

Após autorização do proprietário, Supabase Auth > Sign In / Providers > Email > Minimum password length foi salvo como 8. O modal fechou após Save; ao reabrir, preencher novamente 8 manteve Save desabilitado (sem alteração), confirmando persistência. Captura da configuração: pellum-senha-configurada-1793236608201.jpg.

MFA administrativo, confirmação de e-mail e demais parâmetros não foram modificados. Build, recuperação com MFA, CSP/ações e alvo estático passaram nas verificações.
