# Fluxo documental e adaptadores de assinatura

09/11/2026. A preparação documental funciona localmente. **Nenhum fornecedor foi escolhido/configurado; nenhuma assinatura real foi enviada, produzida ou validada.**

## Implementado

Uma versão revisada do próprio profissional pode originar um pacote imutável de fonte clínica. O banco copia a versão exata, autoria, data e digest, sem seguir automaticamente adendos posteriores. Há categorias distintas para registro profissional, consentimento de procedimento, fotografia para cuidado e divulgação publicitária; a finalidade da minuta precisa corresponder ao documento. “Preparado” permanece identificado como não assinado na interface e exportação.

O digest do pacote cobre toda a fonte, inclusive categoria, autoria, nomes de paciente/clínica e perfil documental, não só o payload clínico. A exportação inclui canonicalSource e identifica o algoritmo SHA-256 dos bytes UTF-8 da representação JSONB PostgreSQL; não recalcular sobre um JSON reserializado arbitrariamente pelo cliente. O coordenador confere esses bytes e o perfil antes de despachar. Essa integridade não substitui assinatura digital.

A categoria profissional é registrada no momento de novas versões clínicas; uma alteração posterior da concessão não reclassifica a fonte. Versões históricas sem essa informação não são preenchidas por inferência. Para registro profissional de Enfermagem ou categoria histórica desconhecida, o perfil técnico é qualificado; para outra categoria registrada, avançado ou qualificado sujeito a análise; consentimentos permanecem legal_review_required. Esses perfis não equivalem a aprovação jurídica.

As tabelas aura_clinical_documents e aura_clinical_document_events têm RLS, acesso direto negado e triggers de imutabilidade. Preparação, leitura de histórico e exportação passam por RPC e auditoria; exportação exige permissão específica/AAL2. Somente o backend com credencial de serviço pode registrar eventos de provedor. A tabela privada clinical_signature_envelopes vincula unicamente provedor/envelope/documento/hash dos bytes preparados, impedindo associação por ID fornecido pelo paciente.

## Contratos do coordenador

clinical-server/signatures.js fornece um coordenador sem adaptador padrão. Para despachar, exige policy aprovada e versionada, renderer PDF revisado, arquivo imutável, fornecedor com idempotência demonstrada e suporte ao perfil. O documento renderizado é arquivado uma vez e reutilizado em retries, evitando alteração de bytes por timestamps ou geração repetida. Nenhum desses componentes externos está configurado na aplicação.

| Componente a integrar | Contrato obrigatório |
| --- | --- |
| Repository | Autorizar usuário/clinica/paciente a cada despacho; carregar fonte fixa; registrar eventos via RPC de serviço; resolver envelope apenas pela vinculação imutável |
| Policy | Decisão clínica/jurídica por tipo/categoria/jurisdição, com versão; não aceitar aprovação enviada pelo frontend |
| Renderer | Gerar PDF final da fonte e template aprovados, preservando texto/Unicode e layout; não reutilizar HTML como se já fosse PDF assinado |
| Provider | Criar envelope com idempotência real; identidade e ordem de signatários; verificar o protocolo oficial de webhook antes de normalizar; recuperar originais e evidências sem expor tokens |
| Validator | Conferir assinatura criptográfica, conteúdo correspondente ao preparado, identidade de todos os signatários e, quando exigível, certificado ICP-Brasil do próprio profissional, cadeia e revogação; definir preservação temporal com o responsável |
| Archive | Gravar bytes originais imutáveis e hashes, em armazenamento privado autorizado e auditado, com backup externo; não recomprimir um PDF assinado |

O coordenador preserva estados preparado/envio/envelope/recebido não validado/validado/recusado/expirado/cancelado/falha. Um callback de “concluído” não produz estado validado sem um verificador independente. Eventos têm hash de corpo, chave por provedor/evento e vínculo documental; replays diferentes são recusados, eventos tardios não reabrem estados terminais e preservam hashes anteriores.

Ainda implementar no adaptador escolhido: autenticação exata do webhook, reconciliador por consulta após timeout/callback anterior ao vínculo, tratamento de filas/retries, identidades reais, renderer final aprovado e verificador criptográfico efetivo. O adaptador de Repository/Archive para serviços remotos não está configurado. Não há endpoint público de assinatura nesta fase.

## Requisitos externos de validação

A [Lei 14.063/2020](https://www2.camara.leg.br/legin/fed/lei/2020/lei-14063-23-setembro-2020-790659-normaatualizada-pl.html) distingue níveis de assinatura e trata de documentos de saúde. A [Resolução Cofen 754/2024](https://www.cofen.gov.br/resolucao-cofen-no-754-de-16-de-maio-de-2024/) exige atenção específica ao prontuário de Enfermagem sem papel, assinatura qualificada do profissional e requisitos do sistema. Um selo da empresa fornecedora não comprova a assinatura ICP-Brasil do autor. A implementação não possui certificação SRES ou aprovação clínica/jurídica declarada.

A comparação anterior de Autentique, Clicksign, ZapSign, Certisign e Gov.br continua sendo o ponto de partida, não uma escolha automática pelo menor preço. A contratação depende de prova do fluxo individual qualificado, API/webhook, evidências recuperáveis, portabilidade e proposta de custo. Nada foi contratado.

## Evidência e limites

tests/clinical-documents.mjs exercita PostgreSQL real local e o coordenador com fornecedor, aprovação e verificador explicitamente simulados. Os testes provam o fluxo/negações e preservação da fonte, **não validade jurídica ou criptográfica de uma assinatura**. O navegador prepara e exporta a fonte não assinada com os mesmos limites explícitos. Antes da operação comercial, repetir o fluxo com o fornecedor/validador escolhidos em homologação segregada, incluindo documentos de teste recuperados por backup.
