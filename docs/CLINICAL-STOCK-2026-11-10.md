# Materiais no prontuário — fluxo direto e simples

Registro de 10/11/2026, America/Sao_Paulo. Branch local feat/phase2-hardening. Sem contratação, criação de ambiente remoto, deploy, migração remota ou alteração de dados reais. Orçamento de novas contratações permanece R$0.

## Comportamento entregue

Em um procedimento revisado do próprio profissional, “Adicionar materiais” abre uma tela dentro do prontuário. Ela começa com um material: produto/lote e quantidade usada. “Adicionar outro material” permite incluir outros quando necessário, até 20. “Salvar materiais” conclui sem uma segunda confirmação. Rótulos são simples, com controles de toque de pelo menos 44 px e campos de 16 px.

Conforme a orientação do proprietário, estoque desatualizado não impede registrar o atendimento ou os materiais. Quando a quantidade informada cabe no saldo, o sistema registra uma baixa única. Quando não cabe — inclusive saldo zero — preserva a quantidade, lote e custo no prontuário, mantém o saldo sem inventar número negativo e mostra discretamente “Lembre-se de revisar seu estoque”. Não cria cobrança nem atendimento financeiro fictício. Em uma seleção com vários materiais, o resultado de cada item fica identificado no histórico.

O atendimento clínico pode ser salvo antes e independentemente desse fluxo opcional. O registro de materiais acrescenta um adendo auditado, preservando a versão anterior. Procedimentos já vinculados a consumo financeiro não oferecem a segunda baixa. Não há reconstrução retroativa de materiais antigos por inferência.

## Segurança e integridade

Migration nova, gerada pela CLI: supabase/migrations/20261110134817_clinical_stock_consumption.sql. Aplicada somente em PostgreSQL local descartável. Não altera migrations antigas.

- aura_private.clinical_stock preserva materiais do procedimento, quantidade declarada, custo calculado no servidor, lote/unidade/proprietário e se a baixa foi efetivada. RLS ativo, sem acesso direto dos papéis de aplicação, com registros imutáveis.
- aura_private.clinical_stock_requests mantém a resposta idempotente por usuário e solicitação. A autorização é conferida novamente antes de devolver uma resposta repetida. Uma resposta perdida depois do commit não causa outra baixa.
- public.aura_clinical_stock_rpc é uma fachada invoker para função privada com search_path vazio. Exige licença, sessão/vínculo vivos, concessão clínica de escrita e autoria do procedimento, clínica/paciente corretos e revisão otimista do registro e do estoque.
- A alteração do snapshot de estoque, o registro privado e o adendo acontecem na mesma transação. Falha em qualquer etapa desfaz as três partes. Não há chamada externa mantendo locks abertos.
- O movimento persistido é clinical_consumption, separado de consumo financeiro. Não inclui relato clínico ou nome do paciente no snapshot administrativo. O custo histórico é calculado com o lote informado, sem aceitar custo enviado pelo navegador.
- A validação monetária/estoque anterior é reaproveitada por uma transformação privada, sem mudar as fórmulas financeiras. Gravações comuns não podem criar, retirar ou alterar movimentos clínicos. Uma restauração compatível preserva esses movimentos; snapshots anteriores que eliminariam a baixa são recusados.
- O material e seu resultado de estoque permanecem nas versões seguintes e no digest do conteúdo. Fontes documentais preparadas anteriormente continuam apontando à versão antiga exata. Adendo não equivale a assinatura digital.

Itens inexistentes, arquivados ou vencidos não são substituídos silenciosamente. Quantidades inválidas, lotes repetidos e conflitos pedem conferência, sem apagar o procedimento já salvo. Essa proteção de integridade não determina se um procedimento é clinicamente indicado.

## Interface e atualização

Arquivos: standalone/src/runtime-clinical.js, clinical-service.js, clinical-model.js e clinical.css; public/aura/features.js. Após a confirmação, o snapshot e sua revisão são atualizados antes de continuar o trabalho. A atualização se recusa a sobrescrever mudanças locais que tenham surgido enquanto aguardava a resposta.

Se uma resposta se perder, “Tentar salvar novamente” repete os mesmos dados e identificador. Os campos ficam protegidos durante essa tentativa. Se a baixa já estiver confirmada e faltar apenas atualizar a tela, não é reenviada uma nova operação. Nenhum rascunho clínico é persistido em localStorage/sessionStorage.

## Testes e limites

- tests/clinical-stock.mjs: 73 verificações no SQL real local. Inclui permissões, lote vencido/arquivado, saldo insuficiente e zero como lembrete, vários materiais com resultados diferentes de estoque, rollback induzido depois do ledger, idempotência, autoria, versão/revisão, proteção de snapshot/restore, materiais e digest históricos e ausência de lançamento financeiro.
- tests/clinical-stock-browser.mjs: 32 verificações com main/runtime reais, HTTP e PostgreSQL locais. Seleção de lote, resposta perdida após commit, repetição sem duplicar baixa, estoque/revisão atualizados, despesa posterior sem sobrescrever consumo, falta de saldo não bloqueante, ausência de confirmação extra e múltiplos materiais. Layout em 390×844, 820×1180 e 1366×900; inspeção visual adicional da captura de celular.

O SDK de Auth é um double explícito no teste de navegador; não houve validação do serviço Auth, PostgREST remoto, dispositivos físicos, Safari/iPadOS, múltiplas conexões concorrentes ou restauração externa. Não apresentar emulação de largura como teste em iPad físico.

Verificação consolidada de 10/11: build, 38 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências passaram com Node 24.22.2 no Windows; zero falhas e nenhum arquivo pulado. Auditorias sem vulnerabilidades reportadas. A cadeia completa contém 17 migrations. Evidência sanitizada: security/clinical-stock-evidence-2026-11-10.json. As mensagens finais simplificadas também passaram em novo build e no teste de navegador do fluxo.

## Pendências preservadas

O lembrete de revisão não ajusta estoque automaticamente depois. O histórico registra quais materiais não tiveram baixa; a conferência posterior deve ser explícita para evitar desconto em duplicidade após um ajuste manual. Não há rotina automática de reconciliação de pendências ou correção retroativa nesta entrega.

Backups comerciais deverão incluir também as novas tabelas privadas e os movimentos do snapshot em uma cópia consistente; exportar apenas o JSON de gestão não é suficiente. Recuperação externa, ambiente gratuito compatível, scanner real para uploads, revisão clínica/jurídica e autorização específica de publicação continuam pendentes. Não criar infraestrutura paga para resolver essas pendências sem autorização.

Os arquivos de demonstração visual criados antes do cancelamento do deploy permanecem separados e não foram publicados nem incluídos nesta entrega.
