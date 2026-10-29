# Recuperação de senha com autenticador

O suporte recebeu relato de erro genérico ao salvar nova senha. Os logs Auth confirmaram `insufficient_aal`: AAL2 é exigido pelo Supabase para alterar a senha de uma conta com MFA ativo. Nenhuma senha, token ou código do usuário foi consultado ou registrado nesta análise.

O frontend agora trata esse erro abrindo a verificação do autenticador existente e repetindo a atualização uma única vez após sucesso. Nesse fluxo, `allowEnrollment:false` impede criar novo fator no lugar do autenticador existente. Cancelamento interrompe a operação; ausência de sessão de recuperação pede novo link no mesmo navegador/dispositivo. Senha igual, fraca e link expirado passam a ter mensagens específicas. A proteção MFA e a conta administrativa não foram alteradas.

Validação: `tests/password-recovery.mjs` cobre MFA requerido, operação sem MFA, sessão ausente, cancelamento, limite de uma repetição e mensagens de erro. Build, teste de CSP/ações, painel concorrente e alvo estático passaram. Não houve troca de senha real, desafio TOTP real ou envio de recuperação durante a validação. O usuário precisa concluir a alteração no próprio formulário com seu autenticador.

Brevo: usuário confirmou a conta `joaoovcarvalhoo@gmail.com` para os e-mails Pellum. Remetente existente ativo e relay habilitado foram verificados pelo plugin. O plugin não fornece segredo SMTP nem configura Auth do Supabase; SMTP e templates permanecem pendentes até inserção privada da credencial no painel. Não gravar a credencial no código ou na documentação.
