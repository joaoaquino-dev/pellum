# Continuidade local — otimização e operação sem novas contratações

Registro de 09/11/2026, America/Sao_Paulo. Este documento complementa a Fase 2 e aplica as decisões mais recentes em OWNER-DECISIONS-2026-11-09.md: orçamento de R$0 para novas contratações, recebimento externo por Pix/cartão e controle manual de acesso no administrador. Nenhum deploy ou migration de produção foi executado.

## Otimização de fotografias

A apresentação mantém limite de 2.048 pixels, sem aumentar imagens pequenas, e passou a usar JPEG qualidade 90, mozjpeg e amostragem de cor 4:4:4. Continua sem EXIF/GPS e sem retoque estético. O original é preservado integralmente com seu hash; documentos assinados não são recomprimidos por esta etapa.

Na amostra sintética determinística do teste, a apresentação anterior ocupava 380.715 bytes e a otimizada 197.814 bytes, redução de aproximadamente 48%. Isso não é uma promessa para fotografias reais nem aprovação clínica de fidelidade; o ganho varia por conteúdo. A comparação reutiliza as duas imagens recém-autorizadas para a sobreposição, evitando duas emissões adicionais de URL.

## Controle de armazenamento

A migration 20261110003930_clinical_media_limits.sql foi gerada pela CLI, mas aplicada apenas a bancos locais descartáveis. Seu nome usa UTC; o registro de continuidade usa a data local de São Paulo.

O banco limita bytes, quantidade de arquivos e envios pendentes por clínica. Reserva o tamanho original e até 4 MB de apresentação durante um envio; ao concluí-lo, ajusta a reserva ao tamanho real. Retry idempotente não reserva duas vezes. Reservas pendentes continuam contando para impedir acúmulo ilimitado de arquivos privados órfãos. Nenhum arquivo clínico é apagado automaticamente para liberar espaço.

Sem limite configurado, novos uploads são recusados. Configuração só é permitida ao backend/operador autorizado; clientes não podem elevar seus próprios limites. O configurador recalcula o consumo dos registros existentes e não aceita limites menores que o uso atual. A consulta agregada é restrita ao proprietário da clínica e aparece na galeria como “Consultar armazenamento da clínica”.

Esse limite é uma proteção interna, não uma leitura do consumo/faturamento do Supabase e não uma contratação de espaço. Antes de habilitar em infraestrutura real, é necessário considerar o espaço restante de todo o projeto, originais/apresentações, outros arquivos e tráfego. Não prometer armazenamento ilimitado ou upgrade automático. As quotas de teste são fictícias e não foram impostas à produção.

## Administração manual da mensalidade

O teste manual-access-administration.mjs exercita o SQL administrativo existente: liberar, suspender, reativar, exigir uma nova sessão depois da suspensão, revogar sessões e preservar clínica/vínculos. Não cria gateway ou cobrança automática. Um pagamento não ressuscita uma sessão revogada; a cliente precisa entrar novamente após a liberação.

O teste full-schema-rehearsal.mjs cria PostgreSQL em memória e executa a cadeia completa do repositório. Confirma clínica solo, licença, paciente no snapshot, fonte clínica, pacote documental, isolamento entre clínicas e suspensão. Auth e Storage são schemas mínimos de teste; não são os serviços Supabase reais, nem comprovam entrega de e-mail.

## Continuidade e limites

O formato adicional de recuperação em streaming está em clinical-server/backup-stream.js. Usa chave derivada por arquivo com HKDF-SHA-256 e salt aleatório de 32 bytes; cada bloco de até 64 KiB é autenticado com AES-256-GCM, posição, tipo e tamanho. Só confirma a recuperação após o encerramento autenticado de todo o pacote. O teste cobre 80 MiB sintéticos, acima do limite de 64 MiB da ferramenta anterior, sem materializar o pacote inteiro na memória. O limite operacional padrão desse formato é de 16 GiB, configurável para baixo.

clinical-server/backup-filesystem.js implementa um destino local separado, com caminhos conferidos, abertura exclusiva, sincronização dos arquivos e movimentação da pasta completa apenas após validação. Não sobrescreve destinos existentes. Falhas mantêm a pasta de estágio marcada como abortada para inspeção, sem exclusão recursiva automática. O teste escreve em disco e recarrega PostgreSQL dos bytes recuperados. Essas evidências continuam sendo locais; em uso real, a pasta de destino deve ter ACL/permissões adequadas e a chave deve estar em cofre separado. Não restaurar pacientes reais dentro do repositório ou pasta sincronizada de desenvolvimento.

O coordenador de assinatura ganhou reconciliação por consulta, sem envio automático quando falta o vínculo do envelope. IDs de eventos recebem identificadores derivados e estáveis; callbacks repetidos de um estado terminal não repetem downloads/verificação. Uma falha temporária ou um resultado inconclusivo do verificador preserva “recebido não validado”, permitindo nova tentativa sem declarar a assinatura inválida. Políticas assíncronas que negam acesso são respeitadas. Toda essa integração permanece desativada, sem fornecedor ou custo; os testes usam provedores/verificadores explicitamente simulados e SQL real local.

O runner de verificação agora registra um relatório de falha mesmo quando o build não permite executar os testes, identificando os grupos pulados. Não reutiliza silenciosamente um resultado verde anterior.

A recuperação em blocos, o destino de arquivos separado e a reconciliação do coordenador foram implementados e testados nesta continuidade. A integração externa de assinatura clínica permanece adiada por orientação do proprietário. Não exigir fornecedor de assinatura para armazenar a ficha/anamnese em desenvolvimento; também não chamar a revisão autenticada de assinatura jurídica.

O antivírus não é um serviço pago obrigatório, mas a implementação atual exige scanner efetivo para liberar uploads. Não remover essa verificação apenas para fazer o botão funcionar. A disponibilidade de uma infraestrutura gratuita segura e o ensaio real de Auth/Storage continuam pendentes. Os custos históricos sugeridos em relatórios anteriores não foram autorizados.

## Verificação consolidada e liberação comercial

Em 09/11/2026 às 22:19, horário de São Paulo (10/11 às 01:19 UTC), o runner concluiu build, 32 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências, sem falhas e sem vulnerabilidades reportadas pelas auditorias. Evidência sanitizada: security/local-continuation-evidence-2026-11-09.json. Usou Node 24.22.2 no Windows; os testes de navegador usaram Chrome local. A cadeia completa ensaiada contém 15 migrations. Esse resultado não equivale a homologação remota.

O computador não tem Docker/Podman disponíveis; a consulta ao WSL informou que o subsistema não está instalado. Não foi instalada virtualização, alterado o Windows nem reiniciado o computador. A configuração local Supabase está preparada, mas os serviços reais de Auth/Storage não foram iniciados. Uma alternativa gratuita precisa de um ambiente local compatível ou de capacidade isolada autorizada; não utilizar produção ou pausar outro projeto como atalho.

Antes da liberação comercial desta versão, continuam pendentes:

- Ambiente segregado com Auth, confirmação/recuperação por e-mail, MFA, duas clínicas e Storage reais; ensaiar novamente isolamento e revogação.
- Scanner efetivo, privado, atualizado e validado com arquivos de teste; limites de armazenamento dimensionados para a capacidade real. Upload continua desativado até isso ser comprovado.
- Backup externo com chave separada, retenção, responsáveis e recuperação em outro destino, medindo tempo e perda máxima tolerada.
- Revisão clínica/jurídica dos formulários, bases de tratamento, retenção e documentos. A integração de assinatura permanece adiada; documentos preparados continuam não assinados.
- Conferência das divergências históricas de migrations antes de qualquer aplicação remota; revisão e autorização específicas para configuração/publicação. Nenhuma alteração desta continuidade chegou à produção.

Mensalidades continuam por recebimento externo e liberação manual. Nada foi contratado; o resultado local não declara o SaaS liberado comercialmente.

Continuidade posterior desta data: BUSINESS-REGRESSION-2026-11-09.md registra a correção da baixa de estoque e da validação de custo na edição, testes completos dos fluxos de gestão e a constatação sobre os poderes amplos de gestoras. A nova execução consolidada tem 34 arquivos de testes aprovados; a evidência anterior de 32 arquivos foi preservada como registro histórico.

OWNER-PROTECTION-2026-11-09.md registra a proteção local posterior contra remoção/reassociação do vínculo da proprietária e contra exclusão da clínica por outra gestora. Preserva retenção clínica, exclusão autorizada e os demais poderes legados; ainda não aplicada remotamente.

Continuidade de 10/11: CLINICAL-STOCK-2026-11-10.md implementa materiais diretamente pelo prontuário, sem lançamento financeiro obrigatório. Saldo insuficiente gera lembrete sem impedir o registro, seguindo a orientação mais recente. A interface foi simplificada para celular/tablet/notebook; sem contratação ou aplicação remota.

Orientação posterior e entrega: CLINICAL-CHART-2026-11-10.md prioriza ficha textual e adia fotos. A configuração padrão esconde a entrada de imagens; a ficha ganhou detalhes opcionais por avaliação/procedimento e conteúdo de termos, preservados no banco e na exportação. Relatórios anteriores de mídia registram trabalho histórico, não uma obrigação de habilitá-la nesta versão.

CLINICAL-FORM-TEMPLATES-2026-11-10.md registra o editor posterior de modelos reutilizáveis/versionados de procedimentos e minutas, com schema capturado no atendimento, escopos e exportação. Resolve a pendência de editor citada no relatório anterior, sem habilitar assinaturas ou fotos.

CLINICAL-FOLLOWUPS-2026-11-10.md registra previsões a partir da evolução, listas de retornos, agendamento na agenda existente, conclusão/reabertura e auditoria. Sem mensagens automáticas ou serviços novos; validação local, ainda não publicada.
