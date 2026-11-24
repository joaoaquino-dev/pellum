# Retornos integrados ao prontuário e à agenda

10/11/2026, America/Sao_Paulo. Continuidade local na branch feat/phase2-hardening. Sem contratação, ambiente remoto novo, envio de mensagens, deploy ou alterações em produção. Fotos e assinatura externa permanecem adiadas.

## Fluxo para a profissional

Na evolução, “Retorno previsto” continua opcional. Revisar a evolução cria um lembrete, não um agendamento. Rascunhos não geram lembretes. No prontuário, “Retornos” mostra a situação; na agenda, “Ver retornos” reúne somente pacientes cujo prontuário a pessoa pode consultar.

As listas separam previstos/agendados, atrasados e concluídos. Na visão da clínica há busca por paciente. Datas são apresentadas em formato brasileiro; atraso compara o dia de São Paulo, sem deslocamento por UTC. Não há SMS, WhatsApp, e-mail automático ou serviço externo.

“Agendar retorno” abre a ficha com paciente identificado, profissional original e data prevista preenchidos. Se a previsão passou, sugere o dia atual, sem alterar a previsão histórica. A profissional confere horário, duração e atendimento e toca em “Salvar retorno”. Se a profissional original não estiver ativa, exige uma escolha explícita; não a substitui silenciosamente.

O horário entra na agenda existente, com verificação de conflitos e revisão otimista. Repetir uma resposta perdida não duplica o agendamento. Uma atualização de agenda durante o preenchimento pede conferência e preserva os campos, sem sobrescrever alterações de outra pessoa. O snapshot/revisão locais são atualizados após confirmar.

Cancelar, marcar falta, remover ou modificar um horário continua sendo uma operação da agenda. Um retorno cujo horário foi cancelado/removido/faltou aparece novamente para agendar; o horário anterior é preservado. Marcar o horário como Atendido faz a lista apresentar o retorno como concluído. “Marcar concluído” e “Reabrir retorno” também permitem controlar o acompanhamento explicitamente, com auditoria; não geram atendimento financeiro ou evolução clínica fictícia.

Alterar a data prevista por adendo não move um horário já marcado. Limpar a data de uma previsão sem horário ativo dispensa o lembrete; não cancela horários existentes. Um retorno concluído não é reaberto silenciosamente por uma edição clínica. A reabertura explícita mantém histórico, inclusive de um horário já atendido, sem desfazê-lo.

## Banco e regras

Migration gerada pela CLI: supabase/migrations/20261110150345_clinical_followups.sql. Aplicada somente em PostgreSQL local descartável. Não altera migrations já existentes nem as versões clínicas anteriores.

- public.aura_clinical_followups vincula uma previsão à evolução e à versão que a originou, clínica/paciente, profissional, data, estado, revisão e ID de horário. RLS ativo; CRUD direto de aplicação negado.
- aura_private.clinical_followup_events preserva eventos imutáveis com ator e data. aura_private.clinical_followup_requests guarda resultados idempotentes. Ambas têm RLS e acesso direto negado.
- Trigger após versão revisada cria/atualiza a previsão. A migration também importa datas já registradas nas evoluções revisadas mais recentes, sem editar fontes ou criar horários automaticamente. Foi ensaiada sobre registros anteriores à migration.
- RPC pública invoker chama função privada definer com search_path vazio. Revalida sessão/licença, vínculo e concessão clínica; leitura global filtra por paciente autorizado. Permissão administrativa da plataforma não concede leitura clínica.
- Agendar bloqueia a linha da clínica, verifica revisões, constrói o horário sem conteúdo da evolução, reutiliza o validador de agenda existente e grava snapshot/histórico/estado/evento/resposta na mesma transação. Falha posterior à inclusão do horário desfaz a operação inteira.
- A relação clínica com o horário fica fora do snapshot administrativo; este recebe somente os dados usuais de agendamento. Não há cópia de relato clínico, sintomas ou plano para a agenda.

## Código e experiência

standalone/src/clinical-followups.js contém lista, filtros, formulário e ações. clinical-service.js oferece a RPC. runtime-clinical.js integra prontuário/agenda e limpa o componente em logout/fechamento. clinical.css mantém a identidade Pellum, controles de 44 px, campos de 16 px e data/horário lado a lado quando há espaço.

O painel é carregado quando solicitado, sem guardar dados clínicos em localStorage/sessionStorage. O formulário pede confirmação somente ao abandonar alterações; não adiciona uma segunda confirmação ao salvamento normal. Situação do retorno é acompanhamento de tarefa, não declaração automática de resultado ou segurança clínica.

## Verificação e limites

Build, 42 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências passaram com Node 24.22.2 no Windows: zero falhas, nenhum arquivo pulado e nenhuma vulnerabilidade reportada pelas auditorias. Cadeia completa de 19 migrations. Evidência sanitizada: security/clinical-followups-evidence-2026-11-10.json.

- tests/clinical-followups.mjs: 50 verificações. Revisão/rascunho, autorização por paciente e clínica, leitor sem escrita, administrador sem bypass, rollback induzido após inserir horário, duas revisões otimistas, replay, conflitos, cancelamento/reagendamento, conclusão/reabertura, edição de previsão sem mover horário, auditoria imutável e importação de datas anteriores à migration.
- tests/clinical-followup-browser.mjs: 24 verificações. Main/runtime e PostgreSQL locais reais, evolução com previsão, preenchimento de profissional/data, resposta perdida após commit, retry sem duplicar, visão na agenda, atrasados, conclusão/reabertura e ausência de persistência clínica no navegador. Layout em 390×844, 820×1180 e 1366×900; captura de celular inspecionada visualmente.

Auth inicial é um double explícito no navegador. Não houve teste com Supabase Auth/PostgREST reais, aparelhos físicos, Safari/iPadOS ou concorrência de múltiplas conexões. Backups comerciais deverão incluir as novas tabelas/eventos em uma cópia consistente; evolução exportada preserva a data clínica, mas não representa sozinha todo o histórico operacional do retorno.

## Pendências

Sem canal externo de mensagens ou preferências para envio, pois nada é enviado. Novas previsões para acompanhamentos subsequentes podem ser registradas em novas evoluções; reabrir é uma ação explícita e auditada. Não são inferidas ligações com horários antigos criados manualmente sem este fluxo.

Permanecem pesquisa do histórico completo, indicadores por acesso, níveis administrativos mais específicos, operações de privacidade, monitoramento, recuperação externa e validações reais antes de publicação. Qualquer aplicação remota exige revisão da compatibilidade histórica do banco e autorização própria; não criar infraestrutura paga para essa validação sem autorização.
