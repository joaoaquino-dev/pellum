# Pesquisa no histórico clínico completo

10/11/2026, America/Sao_Paulo. Desenvolvimento local em feat/phase2-hardening. Nenhuma contratação, publicação ou alteração em produção. Fotos e assinatura externa continuam adiadas.

## Uso

“Pesquisar no prontuário” agora consulta todos os registros da paciente autorizada, inclusive os anteriores aos 100 carregados inicialmente na linha do tempo. A busca não consulta outras pacientes ou clínicas.

Texto é pesquisado nos valores do registro, incluindo campos opcionais, respostas e materiais. Maiúsculas e acentos portugueses são normalizados; palavras separadas por espaços precisam estar presentes, em qualquer ordem. Pontuação de SQL e curingas são texto literal. Não há busca aproximada ou correção automática.

“Tipo, período e versões” reúne filtros opcionais. O período é inclusivo, usa a data do atendimento e os limites de dia de São Paulo. Por padrão aparecem somente versões atuais. “Incluir versões anteriores” permite encontrar texto preservado em uma versão que foi complementada ou corrigida.

Cada página traz até 20 resultados; “Mais resultados” acrescenta a próxima página. Abrir um registro atual permite continuar o rascunho ou adicionar adendo quando a profissional possui autorização e autoria. Uma versão anterior é identificada e apresentada somente para leitura. “Ver versões” consulta o histórico. Voltar à pesquisa preserva filtros e resultados em memória enquanto o painel estiver aberto.

Pesquisa depende do botão “Pesquisar”, sem requisição a cada tecla. Alterar filtros esconde resultados antigos até aplicar a consulta; respostas atrasadas com critérios diferentes são descartadas. Não há persistência da consulta em localStorage/sessionStorage. Fechar o prontuário ou encerrar a sessão descarta o painel e seus resultados.

## Implementação e autorização

- Nova migration: supabase/migrations/20261110152901_clinical_history_search.sql, criada pela CLI e ensaiada somente em PostgreSQL local descartável. Migrations anteriores preservadas.
- RPC pública aura_clinical_search invoker chama função privada definer com search_path vazio. Revalida identidade, sessão/licença, vínculo com a clínica e concessão clínica por paciente antes de consultar dados. Administrador da plataforma não ganha acesso clínico automaticamente.
- Leitura direta das versões continua negada. Acesso anônimo à RPC é negado; parâmetros são validados, página limitada a 50 no servidor e operação limitada pelo controle existente de requisições.
- Filtros por clínica/paciente em ambas as tabelas e índice composto por escopo/data/registro/versão. Paginação por chave composta evita duplicação nos empates de data em um conjunto estável. Novas revisões durante a paginação podem mudar a composição; repetir a pesquisa atualiza a visão.
- Texto usa valores JSON escalares, sem pesquisar nomes internos dos campos, SQL dinâmico, extensão, serviço de indexação ou cópia externa de conteúdo. O índice restringe escopo e datas; a comparação textual ainda examina os valores autorizados da paciente. Não foi realizado benchmark de alto volume.
- Auditoria registra operação, clínica, paciente, ator e, quando solicitado, registro. Não grava palavras pesquisadas ou conteúdo clínico. Como qualquer consulta autenticada, o corpo transita pelo provedor; isso não certifica políticas de retenção dos logs da infraestrutura.
- standalone/src/clinical-search.js contém o painel. clinical-service.js expõe a RPC; runtime-clinical.js integra detalhes/versões e descarte de sessão. clinical.css mantém controles adequados ao toque e datas em duas colunas quando há espaço.

## Verificação e limites

Evidência consolidada: security/clinical-search-evidence-2026-11-10.json. Testes novos: tests/clinical-history-search.mjs e tests/clinical-history-search-browser.mjs.

Build, 44 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências passaram com Node 24.22.2 no Windows: nenhuma falha, nenhum arquivo pulado e nenhuma vulnerabilidade reportada pelas auditorias. A cadeia local ensaiada contém 20 migrations. Os testes novos tiveram 33 verificações SQL e 20 verificações de navegador.

O teste SQL verifica alcance além dos 100 registros, acentos, texto literal, versões atuais/anteriores, consulta de versão exata, paginação com empate, limites de dia de São Paulo, tipos, parâmetros inválidos, leitor, revogação e negações por paciente/usuário/administrador. O teste de navegador usa main/runtime e PostgreSQL reais locais, com SDK inicial de Auth explicitamente simulado; cobre abertura/retorno à busca, versão anterior sem edição, filtros, paginação, texto escapado, descarte no logout e ausência de persistência da consulta.

Layouts verificados em Chrome nas larguras 390, 820 e 1366 px; captura de celular inspecionada visualmente. Isso não comprova uso em aparelhos físicos ou Safari/iPadOS. Não houve teste com Supabase Auth/PostgREST reais, concorrência de múltiplas conexões ou banco remoto.

## Antes de publicar

Esta entrega resolve a pendência de pesquisa no histórico completo citada no documento de retornos. Continua necessária a conferência das divergências de migrations antes da aplicação remota, seguida da validação de login/e-mail, isolamento entre clínicas, recuperação externa de backup e revisão dos formulários e documentos. Estas alterações locais ainda não foram publicadas. Nenhum serviço pago foi contratado.
