# E-mails Pellum e símbolo da clínica

Custom SMTP habilitado no Supabase e senha armazenada pelo proprietário, sem exposição ao assistente. Relay da Brevo na porta 587; remetente Pellum, endereço verificado `pellumgestaodeestetica@gmail.com`. O endereço foi conferido pelo plugin e o mesmo valor foi mantido no painel.

Modelos de confirmação e recuperação aplicados no Supabase com os arquivos de `supabase/templates`: palavra pellum verde, fundo claro, cartão branco e CTA verde. Assuntos em português. Variável `{{ .ConfirmationURL }}` preservada, sem links de token fixos ou credenciais. Prévia conferida para ausência de conteúdo padrão em inglês e markup duplicado. Não foi enviado e-mail real nem aberto link de recuperação de um usuário nesta verificação. A próxima validação é recebimento, confirmação/recuperação e retorno ao domínio usepellum.vercel.app em navegador do próprio usuário.

O P simples ao lado do nome da clínica foi substituído pelo emblema SVG existente da Pellum (quadrado verde arredondado, monograma claro e detalhe dourado). Reutiliza a identidade do favicon, sem emoji ou dependência externa. O avatar de conta no cabeçalho continua separado.

Build standalone passou; artefato estático verificado. Nenhuma alteração em acessos, senha, MFA, permissões, pacientes ou dados clínicos.
