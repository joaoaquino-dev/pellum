# Preparação para publicação — relatório

Referência: 09/11/2026, America/Sao_Paulo. Repositório permanece privado.

## Alterações realizadas

- [PR #5](https://github.com/joaoaquino-dev/pellum/pull/5) mesclado: main alinhada à versão Supabase/Vercel de fix/whatsapp-contact, preservando ambas as histórias.
- [PR #6](https://github.com/joaoaquino-dev/pellum/pull/6) mesclado, documental e de ferramentas: README, estudo de caso, licença de direitos reservados escolhida pelo proprietário, comando de testes e mapa do projeto.
- CONTRIBUTING e SECURITY preservados e ajustados. Notas internas identificadas; nenhum arquivo histórico ou branch removido.
- Participação do autor e apoio de IA explicitados.

## Exposição e histórico

Foram lidas 15 refs (sete branches e oito refs de PR), 43 commits alcançáveis, 43 árvores sem truncamento e 336 versões únicas de arquivos de texto em 341 blobs. Nenhuma tag estava presente na listagem completa de refs. Foram revisados quatro PRs/issues e três comentários, sem revisões inline retornadas e sem anexos identificados nesses corpos. Actions e releases retornaram zero itens.

A busca incluiu formatos conhecidos de chaves privadas, tokens GitHub/AWS/Supabase/Brevo, URLs de banco com senha, literais de credencial e JWTs. Nenhuma correspondência foi encontrada. Foram examinadas fixtures de navegador com registros fictícios. Contatos de autoria/suporte, telefones intencionais do produto e identificadores operacionais foram identificados sem reproduzir valores neste relatório. E-mails de autoria permanecem nos commits.

Nenhum arquivo .env foi identificado nas árvores consultadas. O .gitignore contém .env*, incluindo variantes aninhadas. Configuração de cliente contém URL Supabase e chave publishable: são identificadores públicos de cliente, não credenciais privilegiadas. Service role, segredo SMTP e senha do banco não devem estar no cliente ou no Git.

Consulta somente de catálogo confirmou RLS ativo nas oito tabelas de negócio/administração: public.aura_clinics, public.aura_history, public.aura_members e as cinco tabelas aura_private. Isso não substitui teste funcional de cada política.

## Validação executada nesta preparação

Linux, Node 24.22.1:

| Verificação | Resultado |
| --- | --- |
| npm ci --prefix standalone --workspaces=false --ignore-scripts | PASS, 11 pacotes instalados |
| npm --prefix standalone run build | PASS |
| tests/*.mjs | 11 PASS, zero falhas |
| npm --prefix standalone run check | PASS |
| node security/assert-deployment.mjs | PASS: saída estática sem servidor legado, env, source maps ou dependências |
| Capturas por Chromium/Playwright | BLOQUEADO: navegador encerra na inicialização deste ambiente |

O runner adicionado permite repetir os testes sem executar SQL. Resultados de SQL, SMTP, login remoto ou Safari não foram alegados como testes atuais.

## Limites e bloqueios

- Esta varredura não certifica ausência de segredos; formatos desconhecidos e conteúdo binário de imagens não foram inspecionados semanticamente. Os arquivos binários existentes são ícones e arte de marca por caminho, sem nova captura clínica usada nesta etapa.
- Arquivos locais fora do GitHub, commits inalcançáveis, clones externos e superfícies não listadas pelo conector não são verificáveis nesta sessão.
- Capturas reais novas com dados fictícios continuam pendentes pelo bloqueio do navegador. Não foram inventadas telas.
- Após o merge em main (30cc02c), 215 arquivos da aplicação foram comparados por hash de blob Git com o checkout validado, sem diferenças. Os 11 testes e o guard estático foram repetidos com zero falhas; build também repetido. Alterações posteriores deste relatório são apenas documentais.
- A main dispara deploy automático de produção; o efeito foi comunicado antes da conclusão solicitada pelo proprietário. Não houve mudança manual em configuração de Vercel, Auth, banco ou permissões. A página pública /conheca/ retornou HTTP 200 após o merge.
- Uma remoção ampla da infraestrutura histórica e encerramento de PRs antigos foram adiados; nada foi apagado sem aviso.

## Links e imagens

Referências internas de README e PORTFOLIO verificadas contra a árvore consolidada: sem destinos ausentes. Links de código/documentos apontam para main; banner SVG existente preservado. O site público respondeu HTTP 200. A navegação visual e capturas novas permanecem bloqueadas pelo ambiente. Não foi alegado teste externo de login do Instagram ou uma renderização autenticada do GitHub.

## Checklist para tornar público manualmente

- [x] PRs #5 e #6 integrados e código final da main conferido.
- [x] Build e testes repetidos após merge, com identidade dos arquivos validada.
- [ ] Capturas reais adicionadas quando houver navegador funcional.
- [ ] Contatos e autoria de commits aceitos como exposição pública pelo proprietário.
- [x] Licença de direitos reservados escolhida pelo proprietário.
- [ ] Relatório final revisado pelo proprietário.
- [ ] Conferência final de comentários/anexos e novas refs criados após esta revisão.
- [ ] Alterar visibilidade manualmente somente após confirmação do proprietário.

Nenhuma alteração de visibilidade é autorizada por este relatório.
