# Mudança de hospedagem e aviso no endereço antigo

10/11/2026, America/Sao_Paulo. O proprietário autorizou a mudança para hospedagem gratuita com uso comercial e pediu aviso no endereço antigo. Criou conta Netlify via GitHub e autorizou a CLI pelo fluxo oficial. Nenhuma senha ou token foi solicitado no chat ou incluído no repositório.

## Alvos e ordem

- Nova hospedagem: Netlify, conta com type_slug credit-free e nome Free confirmados pela API. Site usepellum, ID 8645548c-6ffe-4b15-8af6-e6de73bc1a31, endereço https://usepellum.netlify.app. Criado vazio, sem integração Git, sem plano pago, adicionais ou novo banco.
- Banco permanece Supabase iddiiisimjaquhxhskcn. Contas/licenças/dados existentes não serão transferidos para outro banco. Novo domínio requer novo login; não transferir sessões entre origens.
- Endereço antigo: usepellum.vercel.app, no projeto Vercel existente. Só substituir pelo aviso após confirmar novo site, atualização do banco e acesso do proprietário.
- Recuperação/confirmação de e-mail: registrar os redirects exatos https://usepellum.netlify.app/ e https://usepellum.netlify.app/?mode=recovery, preservando os existentes durante a transição. Não executar config push integral ou sobrescrever SMTP/MFA. O proprietário recebeu a instrução para adicionar essas URLs no painel; não presumir que já fez isso.

A Vercel foi consultada e continua no commit de produção 8b550b77, com main nove commits à frente da base histórica 9d911fc. As alterações posteriores não mudam as fontes da aplicação estática, mas contêm documentação/governança e scripts/package.json. Não houve merge, consolidação de branches ou push remoto; a publicação usa pacote estático gerado localmente.

## Compatibilidade e arquivos

Foi comparado novamente o catálogo remoto ao registro anterior: oito tabelas e 15 funções, sem diferenças nos itens capturados. O histórico ainda tem dez migrations antigas, incluindo os dois aliases já conhecidos.

scripts/prepare-migration-workspace.mjs cria pasta temporária de SQL em outputs, preservando os bytes dos arquivos originais. Somente as cópias de patient_phone_validation e recoverable_procedure_catalog recebem os números já registrados remotamente. Não renomeia os originais nem altera o histórico remoto. O dry-run da CLI autenticada listou exatamente as dez migrations novas revisadas, sem include-all, seeds, roles ou repair. O vínculo da pasta SQL com o projeto usa o fluxo padrão de login da CLI; não copia credenciais para documentos. A aplicação real ainda deve ser registrada separadamente.

scripts/package-static-release.mjs permite empacotar somente artefatos gerados: HTML, JS, CSS, imagens, cabeçalhos, robots e sitemap. Rejeita diretórios inesperados, links, tamanho inesperado, build local ou padrão de chave privilegiada. Netlify recebe pasta própria, sem backups, API/functions, SQL, credenciais, histórico Git ou scripts operacionais.

PELLUM_PUBLIC_ORIGIN configura os metadados públicos do build, com validação de origem HTTPS sem usuário/senha, porta, caminho, query ou fragmento. Mantém o endereço padrão antigo até uma configuração explícita. A composição visual continua Pellum. O prontuário exibe “HOMOLOGAÇÃO” apenas fora de produção, usando a configuração do serviço.

## Aviso antigo

standalone/src/move-notice.js gera página estática com título “A Pellum está de casa nova”, orientação de manter o mesmo e-mail/senha e botão fixo para o novo endereço. Sem redirecionamento temporizado, scripts, formulários, acesso a storage do navegador ou consultas ao banco. Não lê ou encaminha query/hash, códigos, tokens de recuperação ou sessões. Cabeçalhos incluem no-store e no-referrer; recuperação antiga orienta solicitar nova mensagem no novo site.

scripts/prepare-move-notice.mjs prepara os arquivos e condições de publicação, sem publicar. Não aceita destino vazio, origem antiga ou URL arbitrária com caminho/credenciais. O destino definitivo deve ser o site verificado antes de promover o aviso na Vercel. Inspeção visual realizada em 390 px; layouts também verificados em 820 e 1366 px.

## Evidência

Build e 48 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências passaram com Node 24.22.2: sem falhas, arquivos pulados ou vulnerabilidades reportadas pelas auditorias. tests/move-notice-browser.mjs teve 15 verificações de URL, teclado, layouts, ausência de requisições e não encaminhamento de dados da URL/referrer. A busca clínica foi exercitada com main em produção, incluindo ausência do rótulo de homologação.

Evidência consolidada: security/hosting-move-local-evidence-2026-11-10.json. Auth dos testes automatizados continua explicitamente simulado; não é evidência de login remoto na nova origem.

## Custos e limites

O plano Netlify Free foi confirmado. A documentação atual indica 300 créditos mensais, limite rígido e sem recarga automática; atingir a franquia pode pausar os projetos. Não prometer capacidade ilimitada ou disponibilidade contratual. Não foi contratado domínio próprio, plano pago, funções, banco Netlify ou complementos.

Referências: [Netlify Free e créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [uso comercial no Free](https://www.netlify.com/blog/introducing-netlify-free-plan/), [redirects Supabase](https://supabase.com/docs/guides/auth/redirect-urls), [restrição Hobby](https://vercel.com/docs/plans/hobby). Esta preparação não declara certificação clínica/jurídica ou liberação comercial irrestrita.
