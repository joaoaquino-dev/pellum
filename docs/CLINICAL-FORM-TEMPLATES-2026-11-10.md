# Modelos reutilizáveis de procedimentos e termos

10/11/2026, America/Sao_Paulo. Continuidade local em feat/phase2-hardening. Sem publicação, mudanças no projeto conectado, dados reais, nova contratação ou infraestrutura paga. Fotos continuam fora da interface padrão; assinatura eletrônica externa permanece adiada.

## Funcionamento

No prontuário, a seção recolhida “Modelos de procedimentos e termos” abre os editores. Cada profissional com escrita clínica pode criar um modelo com nome, procedimento opcional, escopo compartilhado na clínica ou de sua profissional e campos personalizados. Nos termos, também escolhe a finalidade. Modelos não devem conter respostas ou dados de pacientes.

O editor reaproveita os tipos de anamnese: Sim/Não/Não sei, texto, data, número e seleção única/múltipla, com campo obrigatório apenas para revisão e detalhes condicionais. Opções de seleção só aparecem para os tipos pertinentes. O modelo começa com uma pergunta, evitando uma lista longa previamente imposta. O catálogo e procedimentos históricos são preservados ao editar.

Ao registrar procedimento ou minuta, “Modelo salvo (opcional)” oferece os modelos correspondentes ao procedimento/finalidade. Os campos habituais continuam disponíveis sem modelo. A seleção cria os campos personalizados, respeita condições e valida obrigatoriedade ao revisar. Se a pessoa cancelar uma troca de contexto que limparia respostas, a seleção e o texto permanecem.

Editar um modelo cria outra versão. O atendimento guarda ID, versão, nome, perguntas e respostas da versão utilizada. Alterações posteriores não reinterpretam o histórico. Na reabertura de um registro, usa a fonte capturada; um registro revisado não pode trocar silenciosamente seu modelo, procedimento/finalidade vinculados. Correções de respostas usam adendo auditado. Um novo modelo/contexto exige um registro adequado, preservando o anterior.

Minutas continuam identificadas como não assinadas. O editor não aprova juridicamente cláusulas, não verifica habilitação profissional e não assina ou envia documentos.

## Banco e preservação

Migration nova, criada pela CLI: supabase/migrations/20261110144000_clinical_form_templates.sql. Executada somente em PostgreSQL local descartável. Migrations anteriores não foram editadas.

- public.aura_clinical_form_templates armazena as versões imutáveis para procedure/consent, com clínica, autor, escopo profissional, procedimento/finalidade, nome e schema. RLS ativo, sem CRUD direto dos papéis de aplicação; índice por clínica/tipo/ID/versão.
- aura_private.clinical_form_template_requests mantém respostas idempotentes por ator/solicitação. Auth/licença, vínculo e concessão são revalidados antes do replay. Não há overwrite de modelo por tentativa repetida.
- A fachada pública de RPC é invoker; a função privada definer tem search_path vazio, autorização clínica e limite de corpo/requisições. Só o autor cria outra versão de seu modelo, com revisão otimista. Outra clínica não pode ler, usar ou editar o modelo pelo ID.
- A definição existente da RPC clínica foi preservada em nova migration com validação explícita dos campos JSON adicionais. O banco recupera o schema/nome da versão autorizada e ignora uma fonte forjada enviada pelo cliente. Confere tipo, escopo, procedimento/finalidade, respostas e campos obrigatórios.
- As respostas fazem parte do payload clínico, do digest e da exportação; ficam fora do snapshot administrativo e de localStorage/sessionStorage. A integração de materiais mantém o modelo original ao acrescentar seu adendo.

O ensaio cobre a cadeia atual de 18 migrations. Não aplicar esse arquivo ao projeto remoto sem revisar as divergências e funções históricas desse destino. Não foi feita inferência, importação ou alteração de registros existentes.

## Arquivos

standalone/src/clinical-questionnaire.js implementa o preenchimento seguro dos campos personalizados. clinical-service.js expõe a RPC; runtime-clinical.js integra editor, seleção, leitura histórica e formulários; clinical-document.js inclui modelo/versão/perguntas/respostas na exportação HTML com escape de conteúdo. Não foram instaladas dependências de produção.

## Evidência

Verificação consolidada com Node 24.22.2 no Windows: build, 40 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências aprovados; zero falhas ou arquivos pulados, sem vulnerabilidades reportadas pelas auditorias. Evidência sanitizada: security/clinical-form-templates-evidence-2026-11-10.json.

- tests/clinical-form-templates.mjs: 35 verificações. Versão, retry idempotente, conflitos, origem capturada no servidor, perguntas obrigatórias/condicionais, escopo por procedimento/finalidade/clínica, autor/leitor/escritor, acesso direto negado, adendos/materiais, digest e recuperação de schema/referência em outro PostgreSQL a partir de dump local.
- tests/clinical-form-template-browser.mjs: 26 verificações na execução focada final. Main/runtime reais, HTTP e PostgreSQL locais; criar/reutilizar/editar modelo, fonte antiga preservada, cancelamento sem perda de respostas, detalhes condicionais, termo obrigatório, adendo, exportação segura e fotos ausentes. Editor conferido em 390×844, 820×1180 e 1366×900, com captura visual de celular inspecionada. O SDK de Auth é um double explícito.
- As suítes anteriores de anamnese, prontuário, materiais, fontes documentais, administração, Auth e isolamento continuam aprovadas. A fixture isolada de mídia responde “RPC não habilitada” ao novo endpoint, sem fingir que a lista clínica é uma lista de modelos.

Os ajustes finais de preservação da seleção e dos controles de contexto também foram verificados no navegador. Essa evidência não equivale a teste remoto, aparelho físico, assinatura real ou recuperação externa de desastre.

## Continuidade

Esta entrega resolve a ausência do editor reutilizável de modelos de procedimentos e minutas. Permanecem lembretes/retornos, pesquisa de todo o histórico, indicadores por acesso, níveis administrativos mais específicos e processos operacionais de privacidade/monitoramento/recuperação. A validação com os serviços reais e a revisão clínica/jurídica ainda são necessárias antes de publicar para pacientes reais. Não contratar serviços ou criar ambiente pago para isso sem autorização.
