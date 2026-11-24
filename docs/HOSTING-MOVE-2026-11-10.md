# Mudança de hospedagem e aviso no endereço antigo

10/11/2026, America/Sao_Paulo. O proprietário autorizou a mudança para hospedagem gratuita com uso comercial e pediu aviso no endereço antigo. Criou conta Netlify via GitHub e autorizou a CLI pelo fluxo oficial. Nenhuma senha ou token foi solicitado no chat ou incluído no repositório.

## Publicação concluída — atualização posterior ao planejamento abaixo

O site https://usepellum.netlify.app foi publicado no mesmo Supabase, a partir do commit local 6022954, deployment Netlify 6af35e3c8944471fc11d6f31. A conta continuou credit-free, sem contratação ou extras. Apenas a proteção externa do frontend estático foi desativada; autenticação, licenças, isolamento e permissões do banco permanecem obrigatórios.

As dez migrations novas previstas foram aplicadas pelo workspace SQL revisado: o histórico remoto passou a vinte versões e as 28 tabelas da aplicação consultadas mantiveram RLS ativo. A comparação no servidor confirmou que os conteúdos preexistentes de aura_clinics, aura_members e aura_history permaneceram iguais; não foram exportados pacientes nem registrados seus hashes neste documento. Não reaplicar a lista antiga de pendências nem usar db push na raiz sem resolver explicitamente os dois aliases históricos.

O proprietário confirmou login na nova origem e pacientes, agenda, estoque e financeiro normais. Conferiu-se a inclusão dos dois Redirect URLs exatos da Netlify, preservando os anteriores, e o proprietário confirmou o Site URL novo. Isso não comprova entrega de novos e-mails de recuperação, troca real de senha ou funcionamento em todos os dispositivos físicos.

Após essa confirmação, usepellum.vercel.app passou a servir apenas o aviso estático de mudança, deployment dpl_4wTDzq3XwFPAnFVVkv28jD62fKLK, com destino fixo na Netlify, no-store e no-referrer. Ambos os endereços retornaram HTTP 200. Não houve transferência de sessão ou dados de URL. Um futuro deploy automático da branch vinculada à Vercel pode substituir o aviso; não promover o legado por engano. Não houve push, merge ou consolidação de branches nesta publicação.

O restante deste documento preserva o planejamento e as evidências locais anteriores à publicação.

### Correção dos links antigos após relato de 404

O aviso inicial cobria a raiz, mas caminhos como /conheca/ retornavam 404. A configuração estática agora reescreve /(.*) internamente para /index.html: qualquer caminho comum antigo apresenta o mesmo aviso, com destino fixo, sem encaminhar query, fragmento, códigos de recuperação ou sessões ao novo site. Não é um redirecionamento externo automático.

Correção publicada pelo conector Vercel no projeto existente, deployment dpl_8Af1vWPCKCqqVQqJYDFRree6qLNA, estado READY. Verificados doze casos públicos: raiz, /conheca/, /pacientes e caminho antigo com query sintética nos três endereços usepellum.vercel.app, pellum-piloto.vercel.app e aura-piloto.vercel.app. Todos responderam 200, exibiram aviso, botão com destino fixo na Netlify e no-referrer. Teste local ampliado: dezenove verificações, incluindo a configuração gerada. Sem screenshots, mudança de banco, sessão, plano ou aplicação Netlify.

O proprietário também solicitou o envio dos commits ao GitHub e corrigiu a visibilidade: repositório PUBLIC confirmado via API. A branch de desenvolvimento é feat/phase2-hardening, sem merge ou push para main. Varredura delimitada de 604 blobs textuais históricos não encontrou os padrões procurados de chave privilegiada Supabase, JWT service_role, tokens GitHub ou chave privada. Isso não é garantia de ausência de todo tipo de dado sensível; arquivos privados e artefatos locais continuam fora do commit.

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
