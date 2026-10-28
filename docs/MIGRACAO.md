# Próxima etapa: login independente do ChatGPT

## Estado atual

Este repositório contém a versão piloto publicada da Aura. A autenticação atual depende do ChatGPT e a persistência usa Cloudflare D1. A branch `feat/supabase-login` acrescenta uma versão independente com Supabase. O schema já foi aplicado no projeto `aura`; os testes de RLS e RPC passaram. Publicação externa, URLs de retorno e envio de e-mails ainda precisam de validação. Nenhum dado D1 foi transferido automaticamente.

## Plano de migração

1. Criar projeto Supabase sob a conta do proprietário.
2. Adaptar cadastro, login, confirmação de e-mail e recuperação de senha.
3. Migrar clínicas, membros, pacientes, agenda, produtos, movimentos, financeiro e histórico para PostgreSQL com autorização por clínica.
4. Implementar políticas de acesso e testar isolamento entre clínicas.
5. Configurar envio de e-mails de produção e URLs de retorno.
6. Publicar em hospedagem independente, com variáveis de ambiente seguras.
7. Testar com duas contas em dispositivos diferentes; conferir restauração e migração dos registros antes de trocar a versão principal.
8. Adicionar Google, domínio próprio e, após validar o piloto, assinatura e cobrança.

## Para comercialização

Ainda faltam cobrança, planos e limites, monitoramento, recuperação externa de backups, testes de carga e revisão dos fluxos de privacidade e atendimento. O protótipo utiliza snapshots por clínica, com controle de revisão; essa estrutura precisa evoluir para entidades relacionais antes de escalar.

Não incluir senhas, tokens, exportações de pacientes ou dados de produção no Git. Segredos devem ser configurados no serviço de hospedagem.
