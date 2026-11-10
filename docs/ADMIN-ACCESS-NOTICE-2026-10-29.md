# Mensagem de acesso administrativo

A conta administrativa foi conferida no servidor: licença ativa, sem vencimento e MFA verificado cadastrado. O usuário relatou que a tela dizia precisar de liberação, mas o painel administrativo abria após verificar o autenticador.

Causa: pendingAccess reutilizava o texto de licença pendente também para `mfa_required`. Agora cada motivo possui mensagem própria. MFA mostra que a conta já está autorizada e pede o código; licença pendente, expiração, suspensão e renovação de sessão têm explicações distintas. O caminho do painel aberto nessa tela inclui Ir para minha clínica, que recarrega o acesso após a autenticação.

Não houve autorização automática de outros usuários, atualização de licença ou remoção de MFA. A consulta não revelou senhas, códigos nem chaves do autenticador. Testes de estado de acesso, navegação, recuperação com MFA, CSP/ações e build estático passaram. A operação real com o código do proprietário continua sendo concluída por ele.
