# Recuperação — execução local e plano externo

09/11/2026. Nenhum backup de produção foi acessado, exportado, alterado ou restaurado.

## Exercício executado

O teste tests/clinical-recovery.mjs cria banco PostgreSQL isolado e dados sintéticos, registra fotografia e fonte documental revisada, obtém um dump e copia bytes originais/apresentação. Inclui migration e configuração de ambiente sem segredos. O pacote recebe criptografia autenticada AES-256-GCM com nonce aleatório e chave de 32 bytes gerada em memória e descartada após o teste.

A recuperação autentica o pacote inteiro antes de interpretar caminhos/expor conteúdo, confere tamanhos/hashes e recusa chave incorreta, adulteração, truncamento, caminhos com travessia e nomes duplicados. Restaura o dump em uma segunda instância PostgreSQL e compara fontes clínicas, eventos e hashes das duas versões da imagem. O destino de objetos do teste é local e simulado; não é o serviço Storage remoto. Nenhum documento realmente assinado foi usado.

clinical-server/backup.js é uma ferramenta de exercício local limitada a 64 MiB de conteúdo e 100 MiB de pacote. Não possui conexão de banco, agendamento, upload remoto, exclusão ou API de restauração em produção. Não representa uma rotina comercial para bases grandes. A continuidade adicionou o formato V2 em clinical-server/backup-stream.js e o destino separado em clinical-server/backup-filesystem.js, ensaiados com 80 MiB sintéticos e recuperação de PostgreSQL dos arquivos restaurados; detalhes e limitações em LOCAL-CONTINUATION-2026-11-09.md. O gerenciador de chaves e a operação externa continuam pendentes. Não pedir chaves pelo chat nem incluí-las no pacote ou Git.

## Estratégia externa a implementar e aprovar

| Componente | Cópia e controle necessários | Aceite |
| --- | --- | --- |
| PostgreSQL | Dump consistente ou recuperação do provedor, incluindo versões, vínculos, documentos, idempotência e auditoria | Restaurar em projeto distinto e testar integridade/autorização |
| Storage | Originais, apresentações e anexos, inventário de objeto/versão/hash | Recuperar bytes em buckets privados e revalidar políticas/URLs |
| Assinaturas futuras | PDF preparado, PDF assinado, evidências e dados de verificação, sem alterar bytes | Validar as assinaturas após recuperação, com fornecedor/verificador reais |
| Configuração/migrations | Código/configuração aprovada, versões, região e dependências fixadas | Reconstruir ambiente sem reaplicar divergências históricas em produção |
| Segredos/chaves | Cofre independente, acesso mínimo/MFA, processo de recuperação separado | Exercício supervisionado de acesso à chave, sem cópia no mesmo arquivo |
| Cópia externa | Conta/destino separado com criptografia, retenção protegida e trilha | Simular indisponibilidade da conta principal e medir recuperação |

Metas propostas continuam RPO ≤24 h e RTO ≤8 h, sujeitas à aceitação do proprietário e capacidade contratada. O tempo de um exercício local não mede essas metas. Definir responsável titular/substituto, alertas de falha/atraso, frequência, retenção e orçamento. Não foi criada automação de exportação real.

O projeto consultado permanece Free; o plano tem limitações e pode pausar por inatividade. Planos pagos incluem retenção de backups de banco conforme modalidade, mas os objetos do Storage não estão nesses backups. Fontes: [planos](https://supabase.com/pricing), [backups e limites](https://supabase.com/docs/guides/platform/backups). Cópia automática existente ou snapshot da aplicação não comprova recuperação de desastre.

## Próximo ensaio externo

Após aprovação de homologação/destino: registrar população fictícia conhecida, backup de banco e objetos privados, retirar o acesso à origem no ensaio, restaurar em outro destino e verificar login, duas clínicas, revogação, documentos e hashes. Bloquear SMTP/assinatura reais no destino para evitar ações duplicadas. Registrar contagens, horários, resultado e responsáveis sem conteúdo clínico. Não restaurar sobre produção para testar.

Política clínica de guarda, retenção em litígio, atendimento a titulares e encerramento de clínica permanecem dependentes de revisão jurídica/clínica. Não automatizar expurgo de prontuários. Os procedimentos gerais em CLINICAL-OPERATIONS.md continuam aplicáveis; este documento acrescenta a evidência local da Fase 2.
