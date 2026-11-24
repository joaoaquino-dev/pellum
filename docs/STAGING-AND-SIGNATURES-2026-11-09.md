# Homologação e assinaturas — requisitos e orçamento

Referência: 09/11/2026, America/Sao_Paulo. Proposta para decisão do proprietário. Nenhum serviço foi contratado, projeto criado, dado real copiado ou deploy realizado. Valores públicos podem mudar; confirmar moeda, impostos, franquia e contrato antes de autorizar cobrança.

## Recomendação

Continuar com testes locais gratuitos e dados fictícios. Preparar um projeto Supabase e um projeto Vercel exclusivos para homologação antes de testar autenticação, arquivos e assinaturas remotas. Avaliar primeiro o sandbox do Autentique para integração de consentimentos, sem assumir que ele comprova assinatura qualificada. Comparar Clicksign, ZapSign e Certisign para a assinatura ICP-Brasil do próprio profissional. A escolha depende de uma demonstração do fluxo exigido, além do preço.

Não há conta de assinatura ou ambiente remoto de homologação disponível. A organização Supabase consultada está no Free e já tem dois projetos ativos, Pellum e outro projeto independente. Nenhum deles foi pausado. O limite gratuito não deve ser contornado criando outra organização: a contagem considera organizações sob propriedade/administração do usuário. Ver [planos](https://supabase.com/pricing) e [regras de faturamento](https://supabase.com/docs/guides/platform/billing-on-supabase).

## Ambientes separados

| Aspecto | Desenvolvimento | Homologação proposta | Produção existente |
| --- | --- | --- | --- |
| Banco | PostgreSQL local isolado; testes em memória | Novo projeto Supabase, sem clone dos dados reais | Projeto atual, sem mudanças nesta entrega |
| Aplicação | Build local, origem loopback por padrão | Novo projeto Vercel e endereço exclusivo | Projeto Pellum atual |
| Contas | Usuários sintéticos | Contas de teste e caixas de e-mail controladas | Usuários reais, sem uso como fixtures |
| Dados | Pacientes fictícios | Duas clínicas e profissionais fictícios, sem CPF/fotos reais | Sem cópia para homologação |
| Arquivos futuros | Amostras sintéticas | Bucket privado e backend próprios | Habilitação somente após validação |
| Assinatura futura | Simulações identificadas como testes | Sandbox e credenciais próprios | Conta e credenciais próprias, após aprovação |

A região do projeto atual é us-east-1. Para o novo projeto, decidir residência, latência, contratos e transferência internacional de dados antes de criar; uma região brasileira, sozinha, não resolve todas as obrigações. A produção permanece no commit 9d911fc da branch fix/whatsapp-contact. A main legada não deve ser usada como referência de publicação.

## Configuração implementada no código

| Variável | Homologação | Observação |
| --- | --- | --- |
| `PELLUM_ENV` | `staging` | Definir inclusive no ambiente chamado Production do novo projeto Vercel |
| `PELLUM_SUPABASE_URL` | Origem HTTPS do novo projeto | Não aceita a origem atual de produção |
| `PELLUM_SUPABASE_PUBLISHABLE_KEY` | Chave publicável exclusiva do novo projeto | É configuração pública; nunca usar secret/service_role |
| `PELLUM_STAGING_PROJECT_REF` | Identificador do novo projeto | Precisa corresponder ao hostname da URL |
| Segredos de assinatura, SMTP e backend futuros | Somente servidor/gestor de segredos | Não são variáveis compiladas no frontend |

O build local sem configuração usa loopback. Preview Vercel exige configuração de staging e rejeita produção. Builds de produção em outro projeto Vercel são recusados, exigindo staging explícito. Os arquivos públicos atuais de configuração não foram duplicados nesta documentação.

O arquivo raiz vercel.json também contém CSP com a origem Supabase. Após configurar o novo projeto, executar localmente `node scripts/prepare-clinical-staging.mjs`: ele apenas prepara `.codex/staging/vercel.json`, sem criar ou publicar nada. O futuro deployment de homologação deve usar essa configuração local revisada, inclusive seus headers; configurar apenas as variáveis não basta. Não substituir o vercel.json da produção para resolver homologação. O processo de CI/deploy desse novo projeto ainda precisa ser conectado e testado.

## Sequência de provisionamento, ainda não executada

1. Aprovar cenário de custo e limites de uso. Escolher responsáveis e acesso administrativo mínimo com MFA.
2. Criar projeto Supabase distinto; configurar Auth Site URL e redirect allowlist apenas do endereço de homologação, SMTP de testes e nenhum redirecionamento para produção.
3. Reconciliar as migrations históricas contra um banco vazio. Existem divergências de versões descritas em PROJECT_CONTEXT.md; não aplicar toda a pasta cegamente nem usar produção para descobrir dependências. Depois aplicar a migration clínica nova somente nesse ambiente.
4. Criar projeto Vercel separado, Node 24, build independente e saída standalone/dist. Definir branch de homologação própria, sem usar main. Configurar variáveis, CSP, proteção de acesso e noindex. Não ligar previews sem variáveis próprias.
5. Criar usuários de teste pelo Auth; licenças e vínculos só no banco de homologação. Pelo menos: proprietário, profissional com escrita, leitor, usuário sem permissão e outra clínica. Conferir permissões por paciente, profissional arquivado, sessão revogada e MFA.
6. Usar nomes explicitamente fictícios, e-mails controlados para entrega e imagens sintéticas. Os endereços example.invalid dos testes locais não servem para validar SMTP.
7. Testar cadastro/confirmação/reset/logout, dois dispositivos, exportação AAL2, RLS via HTTP e arquivos privados quando implementados. Registrar evidências sanitizadas. Nada de exclusões reais como QA.
8. Validar restauração externa e assinaturas reais de teste autorizadas antes de qualquer promoção comercial. A promoção de produção terá aprovação própria.

## Custos de infraestrutura

Estimativas mensais de base, antes de uso excedente, impostos, câmbio e serviços adicionais. Supabase Pro começa em US$25 com US$10 de crédito de compute; a hipótese abaixo usa Micro de US$10 por projeto. Vercel Pro começa em US$20; Hobby é para uso pessoal não comercial. Fontes: [Supabase](https://supabase.com/pricing), [faturamento por organização](https://supabase.com/docs/guides/platform/billing-on-supabase), [Vercel](https://vercel.com/pricing), [restrições do Hobby](https://vercel.com/docs/plans/hobby).

| Cenário | Supabase estimado | Vercel comercial | Total base em USD | Limite |
| --- | ---: | ---: | ---: | --- |
| Continuar desenvolvimento local | 0 incremental | 0 incremental | 0 incremental | Não valida serviços reais nem libera operação clínica |
| Nova organização paga apenas para staging | 25 | 20, se necessário contratar Pro | 45 | Produção continua com suas limitações atuais; não resolve recuperação comercial |
| Organização paga dedicada com produção + staging Micro | 35 = 25 + 20 − 10 | 20 | 55 | Depende de transferência expressamente aprovada; não executada |
| Upgrade da organização atual com três projetos Micro | 45 = 25 + 30 − 10 | 20 | 65 | Inclui também o projeto independente; não cobrar apenas staging na estimativa |

Os cenários são alternativas, não valores a somar. Se o plano Vercel já contratado cobrir o uso, evitar cobrança duplicada; o plano atual da equipe não foi confirmado. Novos assentos e consumo podem alterar a conta. Pausar um projeto alheio para liberar vaga gratuita depende de decisão do proprietário e não faz parte da implementação.

Reservar orçamento adicional para cópia externa criptografada, armazenamento/transferência de imagens, processamento de arquivos, SMTP e certificados individuais. O volume ainda não foi informado; não há estimativa responsável de custo total dessas parcelas. Exemplo de capacidade, não franquia prometida: 1.000 pacientes × 10 sessões × 4 imagens × 2 MB = aproximadamente 80 GB de originais, antes de derivados e backups. Os backups de banco Supabase não incluem os objetos do Storage: [limite oficial](https://supabase.com/docs/guides/platform/backups).

## Assinatura: separar documentos e requisitos

A [Lei 14.063/2020](https://www2.camara.leg.br/legin/fed/lei/2020/lei-14063-23-setembro-2020-790659-normaatualizada-pl.html) distingue simples, avançada e qualificada. O art. 14 admite avançada ou qualificada em documentos de profissionais de saúde, observadas exceções e normas aplicáveis; isso não autoriza presumir que qualquer aceite por e-mail atende a um prontuário.

Para Enfermagem, a [Resolução Cofen 754/2024](https://www.cofen.gov.br/resolucao-cofen-no-754-de-16-de-maio-de-2024/), art. 2º e parágrafos, exige atenção específica ao prontuário sem papel: assinatura qualificada ICP-Brasil do respectivo profissional e requisitos de segurança do SRES/NGS2. Login individual ou selo do fornecedor no PDF não comprovam essa assinatura profissional. Há previsão de impressão e assinatura quando não atendidas as condições, que também exige procedimento operacional aprovado. Não declarar que o software possui certificação SRES.

O consentimento do paciente precisa vincular identidade, finalidade, versão exata e manifestação informada, além da avaliação jurídica do método. A assinatura profissional tem outro papel. Autorização de imagem para publicidade deve ser opcional e separada da assistência, com revogação futura rastreável. Um hash ou botão “revisar” não é assinatura digital. As minutas implementadas ainda não constituem um fluxo de assinatura.

## Comparação de fornecedores

| Opção | Integração e teste | Referência de preço | Adequação a verificar |
| --- | --- | --- | --- |
| Autentique | API GraphQL; sandbox | Página atual da API: Free 10 documentos/mês; criação R$0,06 + R$0,013 por signatário por e-mail. Plano pago tem compromisso mínimo, não apenas consumo | Candidato inicial para consentimentos de baixo volume; exigir prova de ICP-Brasil do profissional no fluxo/API escolhido |
| Clicksign | API REST v3, envelopes e webhooks; teste gratuito temporário | Start referência R$69/mês; promoção observada R$55,20 não usada como base permanente | Conferir franquia selecionada, API e modalidade de certificado. Recursos Enterprise não presumidos no Start |
| ZapSign | API REST e sandbox | Equipe 20 docs: R$69,90 mensal; R$598,80 anual antecipado equivale a R$49,90/mês | Confirmar franquia de API e custos por autenticação. Certificado promocional único não cobre a equipe toda |
| Certisign | API com A1/A3/nuvem e ambiente de teste | Sob consulta | Candidato para requisito qualificado se o fluxo econômico não provar assinatura individual e validação de cadeia |
| Gov.br | Portal gratuito para contas prata/ouro | Sem taxa do portal | Alternativa manual a avaliar; integração disponibilizada para aplicações públicas não deve ser presumida disponível ao SaaS privado; assinatura avançada não substitui automaticamente a exigência qualificada de Enfermagem |

Fontes oficiais de preços e integração: [Autentique API](https://docs.autentique.com.br/api/api-pricing), [planos Autentique](https://ajuda.autentique.com.br/pt-BR/articles/2973249-planos), [Clicksign preços](https://www.clicksign.com/preco), [API Clicksign](https://developers.clicksign.com/v3.0/docs/introducao-a-documentacao), [ZapSign preços](https://zapsign.com.br/planos-pre%C3%A7os), [API ZapSign](https://docs.zapsign.com.br/), [Certisign](https://desenvolvedor.certisign.io/docs/guias/assinaturas/), [Gov.br/ITI](https://www.gov.br/iti/pt-br/assuntos/assinatura-eletronica-avancada/assinatura-eletronica-avancada).

Exemplo Autentique: 100 documentos com dois signatários por e-mail geram R$8,60 de consumo básico; 1.000 geram R$86. Isso **não é a mensalidade final**: após a franquia gratuita há compromisso mínimo do plano, consultas, webhooks e opcionais. O suporte informa referência de R$99 no profissional, mas confirmar o checkout brasileiro vigente. Há materiais indexados com franquias antigas; adotou-se a página atual de API com 10 documentos. O sandbox não cobra documentos, mas não inclui trilha de auditoria e não serve para validar autenticidade jurídica; não habilitar biometria/outros adicionais pagos sem autorização. [Regras da API](https://docs.autentique.com.br/api/api-pricing).

## Critérios de aceite antes de contratar e integrar

- Cotação escrita para 20, 100 e 1.000 documentos/mês, dois signatários, modalidade ICP-Brasil por profissional, franquia API, armazenamento e exportação em massa; separar certificados, WhatsApp, biometria e carimbo do tempo.
- Demonstração de assinatura do próprio profissional, validação de certificado/cadeia/revogação e preservação dos bytes assinados e evidências. Não aceitar apenas alegação comercial de validade jurídica.
- Contrato de tratamento de dados, suboperadores, retenção, transferência internacional, eliminação/portabilidade e acesso após cancelamento revisados.
- API somente no backend, segredo fora do bundle, webhook autenticado, eventos idempotentes e fora de ordem, reconciliação por consulta e auditoria sem corpo clínico.
- Documento imutável por versão; alterações geram adendo/novo documento. Guardar original assinado, relatório de evidências, hashes e cópia externa recuperável. Nenhum envio real foi implementado ou realizado.

Ficam pendentes de decisão: quantidade de profissionais e pacientes, volume mensal e retenção de imagens, quem paga certificados e plano escolhido. Essas informações refinam o orçamento; não bloqueiam o desenvolvimento local já entregue.
