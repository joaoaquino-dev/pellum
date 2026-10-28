# Aura independente · Supabase

Frontend estático que reutiliza as telas da Aura e conecta login e dados ao projeto Supabase. A versão publicada anteriormente, com ChatGPT/D1, permanece separada.

## Desenvolvimento e publicação

Dentro de `standalone`, execute `npm ci --workspaces=false` e `npm run build`. O resultado é `standalone/dist`. A configuração em `supabase.public.json` contém somente URL e chave **publicável**; nunca inserir secret/service_role ou senha do banco. Versões de dependências e lockfile estão fixados.

Na Vercel, importe o repositório e selecione a branch de migração, Root Directory na raiz do repositório, Framework Other. O `vercel.json` da raiz define instalação, build e diretório de saída; o build reutiliza os arquivos compartilhados de `public/aura`. Não comprar planos ou configurar domínio automaticamente. Escolher um plano compatível com o uso comercial antes de vender o produto.

## Configurações externas ainda necessárias

1. Publicar o frontend e anotar sua URL definitiva.
2. No Supabase, configurar Auth > URL Configuration: Site URL para a URL publicada; Redirect URLs para `/` e `/?mode=recovery` na mesma origem. Não adicionar curingas amplos.
3. Conferir o provedor de e-mail, confirmação de e-mail habilitada e política de senha. O frontend exige 12 caracteres. Configurar SMTP de produção para confirmação/recuperação de senha; o envio padrão do Supabase tem restrições para testes.
4. Validar cadastro, confirmação, login, logout e recuperação de senha com uma conta real controlada pelo proprietário.
5. Testar duas contas e dois dispositivos na mesma clínica. Autorizar o e-mail da outra profissional em Configurações. Ela entra com conta Aura, sem conta ChatGPT.
6. Planejar exportação/importação dos dados D1 antes da troca principal. Nenhum registro D1 foi copiado automaticamente; não criar clínicas reais de teste para simular uma migração concluída.

## Segurança e verificação

A Data API só oferece leitura das tabelas de acordo com RLS. Operações de escrita passam pela RPC transacional autorizada, com verificação de revisão e snapshot antes de salvar. Helpers privilegiados ficam no schema não exposto `aura_private`, com `search_path` vazio e verificação de identidade/membership; a função pública é SECURITY INVOKER. Chaves privilegiadas não são necessárias no navegador.

`tests/supabase-access.sql` testa isolamento, RLS, edição concorrente, backup/restauração, convites/revogação e bloqueio anônimo em uma transação com rollback. Não é teste de entrega de e-mail nem de navegador autenticado. Advisors de segurança e performance consultados após criar o schema: sem alertas.

O modelo de snapshot mantém compatibilidade com os fluxos existentes. Ainda não é a modelagem relacional final para escalar o SaaS. Há limite de 3 MB por salvamento. O build independente remove handlers de script inline e usa um dispatcher com lista fixa de comandos, sem eval. CSP de scripts é somente self; estilos inline ainda são permitidos. Consulte security/REVIEW-2026-10-28.md para o estado validado e pendências.

Migração inicial aplicada e registrada no Supabase: `20261028152705_aura_initial`. O guard torna a aplicação segura no projeto já provisionado; futuras mudanças devem usar novas migrações. Não modificar migrações já aplicadas.

## Revisão de segurança

Licenças, MFA administrativo, sessões vivas, idempotência e validação de negócio foram aplicados no Supabase de desenvolvimento pela migração 20261028161248. Nenhum administrador real foi provisionado; novas contas ficam pendentes. A publicação continua bloqueada para dados reais pelas pendências documentadas em `security/REVIEW-2026-10-28.md`. A migração adicional de resource_limits é rascunho não aplicado.
