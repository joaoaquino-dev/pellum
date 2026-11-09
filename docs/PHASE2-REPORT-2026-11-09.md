# Pellum — Fase 2: relatório de implementação e aceite

Referência: 09/11/2026, America/Sao_Paulo. Branch local **feat/phase2-hardening**, derivada do código e das alterações anteriores, sem substituir a aplicação. **Não recomendada para liberação comercial neste estado.** Não houve push, deploy, migration remota, contratação ou alteração de dados/configurações de produção.

## A. Implementações concluídas no ambiente autorizado

### Fotografias e anexos

- Galeria por paciente/clínica; seleção pelo computador/celular e entrada de câmera quando suportada; data, região, observações, antes/pós-imediato/acompanhamento e vínculo ao registro da sessão.
- Visualização sob demanda, ampliação, linha do tempo paginada, comparação lado a lado e slider acessível. Sem retoque ou avaliação estética automática.
- Referências distintas para documentação clínica e tratamento/armazenamento; publicidade não autorizada por padrão. Revogação de divulgação é evento imutável e não apaga o histórico clínico. Não existe publicação automática.
- Originais preservados byte a byte e com SHA-256; apresentação JPEG orientada/redimensionada sem EXIF/GPS. JPEG, PNG e WebP estáticos; anexos PDF analisados em worker com limites de memória/tempo. Limite de 4 MB e 24 milhões de pixels; PDF até 100 páginas, sem recursos ativos suportados.
- Upload só é liberado após scanner, parser/decoder, armazenamento e confirmação no banco. Falha deixa estado pending privado; retry preserva ID/metadados e não sobrescreve objetos. A galeria permite retomar a pendência após sair da tela e selecionar novamente o mesmo original.
- Exportação individual do original exige concessão própria/AAL2 e confere hash. PDF é download autorizado, sem viewer inline; HEIC, DOCX e outros formatos não foram habilitados.

Arquivos: standalone/src/clinical-media.js, clinical.css e runtime-clinical.js; api/clinical-media.mjs; clinical-server/files.js, pdf-inspect.js, clamd.js, media-handler.js e supabase-gateway.js. Desenho/limites em clinical-server/README.md.

### Documentos e preparação de assinaturas

Pacotes imutáveis preservam a versão clínica revisada exata, autoria e digest. Categorias de registro profissional, consentimento de procedimento, fotografia clínica e divulgação permanecem separadas. A interface identifica a fonte como **não assinada**. Alteração posterior do vínculo profissional não reclassifica a categoria registrada na fonte. Versões históricas de categoria desconhecida permanecem desconhecidas, sem backfill por inferência, com perfil técnico conservador.

Coordenador independente de fornecedor, contratos de renderer/arquivo/verificador e eventos append-only com idempotência, vínculo de envelope, perfil exigido e proteção contra regressão por evento tardio. Callback de conclusão produz recebido não validado, não assinatura validada. Não há fornecedor, endpoint público de assinatura, renderer aprovado ou verificador criptográfico real configurado.

Arquivos: clinical-server/signatures.js, SIGNATURES.md, clinical-service.js, runtime-clinical.js e migration clinical_documents.

### Autenticação, proteção e recuperação

- Limpeza imediata do conteúdo clínico exibido ao encerrar a sessão; um cancelamento de navegação não mantém a ficha aberta. Erros inesperados de banco são ocultados e impedimentos de retenção têm mensagem compreensível.
- Banner de homologação também na tela de login. Configuração local pede 12 caracteres para novas senhas; a interface correspondente foi ajustada, preservando o mínimo existente de login/produção. Confirmação/recuperação usam a origem atual nos testes de tela.
- Build remoto não pode usar modo de desenvolvimento. Ambiente local usa loopback e staging rejeita origem de produção. Configuração Vercel separada preparada com CSP, instalação e arquivos do backend.
- Exercício de recuperação criptografada local: banco, fontes documentais, imagens originais/apresentação, migration e configuração sem segredos. AES-256-GCM, autenticação antes de expor conteúdo, hashes e bloqueio de travessia/duplicação. Ferramenta limitada a 64 MiB de conteúdo; não é rotina comercial de backup em escala.

Arquivos: standalone/src/main.js, cloud-error.js, security-ui.js, runtime-security.js e runtime-clinical.js; supabase/config.toml; scripts/prepare-clinical-staging.mjs; clinical-server/backup.js. Plano externo em PHASE2-RECOVERY.md e infra/staging/README.md.

### Preservação e commits

Frontend estático/esbuild, nomes aura, IDs, snapshots, revisão otimista, agenda, catálogo, equipe, estoque e cálculos financeiros foram preservados. Sem React/Next novo, alteração de fórmulas ou dependência nova no frontend. Sharp/pdf-lib são dependências fixadas do backend, justificadas por validação/decodificação de arquivos. As ferramentas de QA permanecem separadas.

Commits locais organizam baseline anterior, mídia, sessão/homologação, documentos e recuperação: a5b710d, 31c7695, cd9b06a, eee1e5b e a5a7442, seguidos do hardening/verificação final. Não há merge ou publicação implícita desses commits. Reversão de interface não deve apagar tabelas/objetos após haver dados clínicos.

## B. Banco e infraestrutura

| Migration | Situação | Conteúdo |
| --- | --- | --- |
| 20261109211636_clinical_records.sql | Anterior, revalidada localmente; não aplicada remotamente | Núcleo clínico, versões, concessões, auditoria, modelos e idempotência |
| 20261109220831_clinical_media.sql | Nova, aplicada só em bancos locais efêmeros | Metadados/eventos de mídia, imutabilidade, RPCs, commit exclusivo de backend e declaração de dois buckets privados |
| 20261109223043_clinical_documents.sql | Nova, aplicada só em bancos locais efêmeros | Categoria histórica nas novas versões, fontes documentais/eventos, vínculos privados de envelope e RPCs |

Nenhuma migration já aplicada em produção foi editada/reaplicada. As duas divergências históricas de versão continuam pendentes de reconciliação controlada em banco novo.

Os buckets **declarados no SQL**, não criados remotamente, são pellum-clinical-originals e pellum-clinical-display. Policy restritiva nega acesso direto de anon/authenticated, mesmo sob uma policy permissiva adicional; o gateway autoriza e audita as operações. Novas tabelas têm RLS e não recebem CRUD direto para o cliente. Funções privadas com privilégios elevados verificam acesso; confirmação de processamento/eventos externos é exclusiva do backend. A credencial de servidor não entra no bundle.

O gateway verifica o token no Auth e o banco revalida usuário, licença, sessão viva, clínica/paciente e concessão. O commit de mídia revalida depois do processamento. Links de apresentação duram 30 segundos: revogação impede novas emissões, sem invalidar instantaneamente links anteriores ou pixels já carregados. O original não pode ser sobrescrito silenciosamente em retry.

supabase/config.toml é configuração local concreta, sem segredo, projeto distinto, PostgreSQL 17, confirmação de e-mail/TOTP e caixa local. Auth/Storage locais não foram iniciados; o runtime necessário ainda não estava disponível. Nenhum projeto remoto de homologação existe. A criação, custo, variáveis e operações propostas estão em infra/staging/README.md; aguardam decisão do proprietário.

A produção foi consultada apenas por metadados de projetos/advisor. O aviso de proteção contra senhas vazadas desabilitada continua presente. As cinco informações de RLS sem policy referem-se a tabelas privadas operadas por funções, não foram tratadas como motivo para abrir acesso. Não foi aplicado o SQL histórico de MFA apenas administrativo. O vercel.json atual de produção também permanece intacto: ele não é o pipeline de staging com instalação do backend e não deve ser usado para promover esta fase sem revisão específica.

## C. Testes e evidências

Ambiente: Windows x64, Chrome headless em 390×844 e 1280×900, Node **24.22.2** portátil obtido do distribuidor oficial e conferido por SHA-256. Versão major correspondente à produção; não representa teste do runtime Linux/Vercel. Os resultados anteriores de Node 26 não foram usados como única evidência.

Comando consolidado: `node scripts/verify-phase2.mjs`, com Node 24 no executável. Ele força build local/loopback, executa tests/*.mjs, verificações de sintaxe e auditorias de dependências. Não conecta a banco remoto nem publica. Instalação reproduzível em tests/clinical/README.md.

Resultado final: **26 arquivos de teste aprovados, zero arquivos de teste com falha**; build e seis verificações adicionais de sintaxe aprovados; três auditorias npm sem vulnerabilidades conhecidas no momento da consulta. O relatório gerado está em outputs/phase2-verification.json, ignorado pelo Git; uma cópia sanitizada dos resultados foi registrada em security/phase2-local-evidence-2026-11-09.json. Não confundir quantidade de arquivos com quantidade de asserções.

| Grupo | Resultado | Escopo comprovado |
| --- | ---: | --- |
| Banco clínico anterior | 105 verificações | PostgreSQL local, versões, permissões, materiais, conflito e restore local |
| Banco de mídia | 45 verificações | Paciente/clínica, IDs conhecidos, CRUD negado, policy restritiva, worker, MFA e revogação |
| Integração de mídia | 34 verificações | Handler, decoder e PostgreSQL reais; falha/retry/resposta perdida, hash de export e restauração de bytes |
| Imagem/PDF | 16 verificações | Decodificação real, EXIF, formato/tamanho/pixels, arquivo corrompido e PDF ativo |
| Gateway | 13 verificações | Contrato de Auth, credenciais segregadas, limites e URLs; HTTP simulado |
| Scanner/configuração | 11 verificações | Protocolo TCP contra fixture local, definições antigas/configuração ausente e mensagens seguras |
| Auditoria de autorização | 19 verificações | SQL existente de identidade/conta/admin, suspensão, expiração, MFA, spoofing e sessão revogada |
| Documentos/adaptador | 48 verificações | Fonte/versionamento/finalidade, nomes congelados e hash integral da fonte; fornecedor/verificador/aprovação simulados |
| Recuperação criptografada | 18 verificações | Segundo PostgreSQL, fontes, originais/apresentação, hashes e adulteração do pacote |
| Navegador clínico/regressão | 48 verificações | Prontuário, fotos/slider, upload interrompido, fontes documentais e oito áreas existentes no celular |
| Navegador de autenticação | 8 verificações | Tela real, aviso de staging, redirecionamentos e erros; SDK Auth simulado |

Os demais testes existentes continuam aprovados. A navegação de regressão cobre visão geral, precificação, agenda, pacientes, financeiro, produtos, despesas e configurações; não comprova todos os fluxos financeiros/administrativos reais. A inspeção visual confirmou a comparação e a tela mobile com arquivos sintéticos, sem overflow horizontal nos tamanhos testados. Não houve paciente ou fotografia real.

**Doubles explícitos:** Auth/SMTP, transporte do Storage, resultado do antivírus e fornecedor/verificação criptográfica de assinatura. Os testes não foram descritos como integração real desses serviços. PGlite executa PostgreSQL real em memória, mas o bootstrap de Auth/Storage é mínimo, não o stack Supabase completo.

Oito grupos externos não puderam ser executados: (1) Auth/SMTP/convites/MFA real e dois dispositivos; (2) Storage/RLS por HTTP remoto e URLs conhecidas; (3) antivírus real atualizado; (4) assinatura de paciente/profissional e recuperação de provas reais; (5) restauração externa/RPO/RTO; (6) build nativo Linux, proteção/CSP e deployment Vercel de staging; (7) câmera em dispositivos físicos/Safari-iOS; (8) carga concorrente em PostgreSQL multi-conexão e escala. São grupos pendentes de ensaio, não um número inventado de asserções puladas.

Falhas encontradas durante o desenvolvimento foram corrigidas antes do resultado final: colisão de nomes na função SQL de mídia, import de ferramenta de imagem, seletor ambíguo no teste de login e validação base64 inadequada para dumps grandes no pacote local. O relatório de aprovação se refere à execução final, não oculta essas correções.

## D. Pendências, criticidade e critérios de aceite

| Requisito | Situação | Aceite objetivo restante |
| --- | --- | --- |
| Parser/decoder, hash, estados/retry e proteção de metadados | Implementado e validado | Evidência local acima; repetir no runtime remoto |
| Galeria, captura disponível, comparação, exportação individual | Implementado, mas não validado | Auth/Storage/scanner reais, dispositivo físico, revogação e URI conhecida em staging |
| Políticas e migrations novas | Implementado, mas não validado | Aplicação em Supabase isolado com cadeia histórica revisada; nunca produção como ensaio |
| Fontes clínicas e preparação documental | Implementado e validado | Evidência local; aprovação externa de conteúdo ainda necessária |
| Assinatura completa | Parcialmente implementado | Adaptadores/renderer/verificador, reconciliador e política aprovada; integrar depois em sandbox |
| Conta/provedor de assinatura e ICP-Brasil real | Bloqueado por dependência externa | Escolha, orçamento, credenciais seguras e validação jurídica/clínica |
| Configuração local de homologação | Parcialmente implementado | Iniciar stack completo com runtime compatível e executar Auth/Storage reais |
| Homologação remota segregada | Bloqueado por dependência externa | Aprovar recursos/custos, criar projetos e demonstrar fluxos completos |
| SQL de autorização e limpeza de sessão | Implementado e validado | Validação local; auditoria de Auth/SMTP remota permanece incompleta |
| Operação real de contas/convites/reset/MFA | Bloqueado por dependência externa | Contas fictícias e caixas controladas no ambiente isolado; evidências de entrega e dois dispositivos |
| Pacote criptografado de exercício/restore local | Implementado e validado | Limite de 64 MiB declarado; não afirmar rotina comercial em escala |
| Backup externo e recuperação comercial | Bloqueado por dependência externa | Destino, cofre, agendamento, restore separado e RPO/RTO medidos |
| Consentimentos/protocolos/LGPD | Parcialmente implementado | Revisão de profissionais habilitados, finalidades/bases, guarda, contratos e transferência internacional |
| Quotas/monitoramento, carga e exportação em lote/escala | Pendente | Limites contratados, alertas, limpeza assistida de órfãos, streaming de backup e testes de volume |

### Crítica — impede liberação

1. Não há homologação segregada executando Auth, Storage, scanner e migrations reais. A configuração de mídia recusa ativação em produção nesta fase.
2. Assinaturas e documentos legais completos não estão integrados/verificados. Preparar fonte ou passar testes com doubles não cumpre esse requisito.
3. Recuperação externa de banco/objetos/documentos assinados não está comprovada; RPO/RTO são metas propostas, não resultados.
4. Conteúdo/fluxos clínicos, requisitos de Enfermagem e privacidade/contratos ainda não têm aprovação dos responsáveis habilitados.

### Alta — antes do uso comercial

- Resolver o aviso de senhas vazadas, definir antiabuso/quotas e validar SMTP, reset, convites, MFA e sessões reais. A proteção de senhas vazadas do Supabase depende de Pro ou superior: [documentação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Nenhum upgrade foi realizado.
- Revisar o modelo administrativo legado: can_access não diferencia p_owner e membros manager compartilham poderes antigos. A nova concessão clínica não restringe automaticamente agenda/financeiro. Não foi inventado um papel restrito pelo nome da policy; definir a política de produto e testar antes de comercializar.
- Ensaiar contenção dos locks por clínica, concorrência real, índices/volume e quotas de arquivos. O rate limit atual não substitui orçamento/capacidade por clínica.
- Configurar monitoramento sem corpos clínicos, tokens ou URLs assinadas em logs/analytics; revisar também a observabilidade dos provedores. Não apenas o logger do aplicativo.
- Tornar operacional o encerramento com retenção e atendimento a titulares. O banco bloqueia exclusão por cascata e agora informa a proteção, mas a gestão completa de encerramento ainda requer procedimento/decisão.
- Testar dependências nativas/worker no Vercel e processo de backup em escala; rotação/cofre de chaves, retenção externa e responsáveis ainda não estão configurados.

### Média — melhorias delimitadas

Viewer PDF para leitura sem entregar original, exportação assistida de grande volume, paginação de pacotes documentais antigos e formatos adicionais somente após avaliação de segurança. A versão atual tem download autorizado de PDF, 50 pacotes documentais recentes na interface e limites declarados. Revisar acessibilidade com tecnologia assistiva e câmera/Safari reais; a cobertura atual é Chrome responsivo.

### Baixa — refinamento futuro

Aprimorar apresentação de comparações, navegação e organização dos tipos de arquivo após feedback de profissionais com dados fictícios, mantendo cores/tokens e evitando burocratizar atendimento.

Não há alegação de certificação SRES, conformidade integral LGPD ou aptidão regulatória. [Cofen 754/2024](https://www.cofen.gov.br/resolucao-cofen-no-754-de-16-de-maio-de-2024/) e a [Lei 14.063/2020](https://www2.camara.leg.br/legin/fed/lei/2020/lei-14063-23-setembro-2020-790659-normaatualizada-pl.html) exigem análise do tipo documental e categoria; selo do fornecedor não é assinatura qualificada do profissional. Guarda e responsabilidade permanecem conforme CLINICAL-OPERATIONS.md e revisão competente.

## E. Custos

Desenvolvimento/testes locais realizados sem contratação. Sharp, pdf-lib, PostgreSQL/PGlite, Playwright e ClamAV não implicam assinatura de serviço neste código; hospedar/operar o antivírus não tem custo cotado nesta entrega.

Referências públicas verificadas em 09/11: Supabase Pro a partir de US$25/mês e projeto Micro adicional na hipótese de US$10; Vercel Pro a partir de US$20/mês, antes de uso, assentos, impostos e câmbio. [Supabase](https://supabase.com/pricing), [Vercel](https://vercel.com/pricing).

| Alternativa | Base mensal estimada | Observação |
| --- | ---: | --- |
| Continuar local | US$0 incremental de assinatura contratada | Não libera operação clínica |
| Nova organização paga só para staging + Pro Vercel se necessário | US$45 | Evitar duplicar Vercel já coberta; produção atual continua sem resolver DR |
| Produção + staging Micro em organização paga dedicada + Vercel Pro | US$55 | Exige transferência separadamente aprovada; não realizada |
| Upgrade da organização atual com seus três projetos Micro + Vercel Pro | US$65 | Inclui o projeto independente; não pausar/transferir por conta própria |

São alternativas, não valores cumulativos. Antivírus hospedado, backup externo, SMTP, certificados individuais, assinatura e excesso de uso são adicionais sem orçamento total verificado. A organização já tinha dois projetos ativos Free na referência consultada; não prometer terceiro projeto gratuito nem usar outra organização para contornar limites.

Preços/regras de Autentique, Clicksign, ZapSign, Certisign e Gov.br estão discriminados em STAGING-AND-SIGNATURES-2026-11-09.md. Não foi escolhido o mais barato automaticamente. Para contratação, reconfirmar franquia/API, compromisso mínimo, ICP-Brasil do próprio signatário, evidências, arquivamento e cancelamento. Custos de implementação de um adaptador real não foram convertidos em horas/R$ fictícios.

## F. Próximo passo concreto

Revisar e aprovar a proposta de recursos de **infra/staging/README.md**, escolhendo a organização/plano sem afetar financas-app, o destino do antivírus e backup e os responsáveis. Depois criar Supabase/Vercel exclusivos, configurar segredos no gestor seguro e ensaiar as duas migrations novas mais o núcleo clínico com contas fictícias. Essa aprovação é necessária porque o proprietário determinou apresentar operações e custos antes de criar/alterar serviços, e proibiu contratar sem autorização.

A primeira evidência remota buscada deve ser um upload real verificado, revogação entre duas clínicas e restauração da mesma imagem em destino isolado, acompanhados de login/reset/MFA reais. Somente após fechar os bloqueios, solicitar aprovação distinta de promoção/publicação em produção. Até lá, manter a implementação em desenvolvimento/homologação.
