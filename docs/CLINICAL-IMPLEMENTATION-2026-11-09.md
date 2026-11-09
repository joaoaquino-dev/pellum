# Pellum — relatório de implementação clínica

09/11/2026, America/Sao_Paulo. Trabalho local na branch feat/clinical-records, sobre a transferência derivada de produção. **Não liberado para operação clínica comercial.** Não houve contratação, push, merge, aplicação de migration remota, publicação ou alteração de dados de produção. A continuidade abaixo atende ao prompt de implementação e à orientação posterior sobre homologação/custos; não muda retroativamente o escopo dos documentos de transferência.

## 1. Diagnóstico inicial

Produção identificada em fix/whatsapp-contact, SHA 9d911fc86e0b7c3df109ce41274512c64997afe0. Frontend estático JavaScript/CSS/HTML, bundle esbuild e Supabase Auth/PostgreSQL por RPC. Next/D1 da raiz e main são legado. A base administrativa usa snapshot JSONB por clínica, apropriado para reaproveitar IDs e relações, mas insuficiente para preservar sozinho versões clínicas independentes.

Inspeção de metadados confirmou projeto Supabase ativo, Free, duas vagas gratuitas já ocupadas na organização, nenhuma branch de testes e nenhuma estrutura de arquivos clínicos existente nas listagens. O estado de produção Vercel permaneceu no deployment do SHA acima. Consultas remotas foram de catálogo/configuração; não foram consultados cadastros, prontuários ou snapshots reais para QA.

Riscos principais: ausência de homologação, arquivos e assinatura; recuperação externa sem evidência; validação real de Auth/SMTP ainda incompleta; divergências históricas de IDs de migrations; helper legado can_access não restringe por p_owner. Advisor sinalizou proteção contra senhas vazadas desabilitada. Não foram executadas propostas antigas de MFA nem correções automáticas de banco. A inspeção não equivale a auditoria independente integral.

## 2. Funcionalidades preservadas

Pacientes/contatos, agenda, equipe solo/parceria, catálogo, precificação, financeiro/parcelas/repasse, lotes/movimentos de estoque, snapshots/revisão otimista, onboarding, administração e WhatsApp permanecem na implementação existente. IDs e nomenclatura aura foram preservados. Nenhuma troca por React/Next, redesign, alteração de fórmulas ou nova dependência de produção.

A integração acrescenta um botão por paciente e referência opcional a agenda, plano e registro financeiro do mesmo paciente. Produtos/custos vêm do registro existente; não há segundo consumo. Não se afirma que todos os fluxos legados foram testados manualmente nesta sessão: os testes existentes passaram e o escopo clínico foi exercitado separadamente.

## 3. Recursos novos e classificação

“Implementada e testada” abaixo significa evidência **local isolada**, nunca aplicação ou certificação em produção.

| Recurso | Classificação | Evidência e limite |
| --- | --- | --- |
| Prontuário por clínica/paciente, número interno e histórico | Implementada e testada localmente | PostgreSQL/RPC e navegador; não implantado |
| Identificação, nascimento/idade, CPF opcional e contatos pertinentes | Implementada e testada localmente | Modelo/formulários; revisão clínica de conteúdo pendente |
| Anamnese condicional, “não sei”, perguntas configuráveis e modelos versionados | Implementada e testada localmente | Validação cliente/servidor, edição do modelo preserva versões |
| Alertas de declarações revisadas | Implementada e testada localmente | Auxílio à revisão; sem liberação clínica automática; resumo independente da paginação |
| Avaliação, plano, procedimento, evolução e intercorrência | Implementada e testada localmente | Formulários e gravação; protocolos de cada especialidade ainda precisam de revisão |
| Cinco etapas de Enfermagem | Implementada e testada localmente | Bloqueio por categoria declarada no vínculo; credenciais profissionais não verificadas externamente |
| Rascunho, salvamento serial, revisão e adendo com motivo | Implementada e testada localmente | Conflito pausa escrita; nenhuma sobrescrita silenciosa |
| Rastreabilidade de material vinculado ao financeiro | Implementada e testada localmente | Cópia histórica de lote/custo, sem duplicar movimento |
| Consumo clínico independente do financeiro | Pendente | Exige transação unificada e teste; não simulado com duas gravações |
| Minutas de termo e finalidades separadas de imagem | Implementada e testada localmente | Registro descritivo; não equivale a consentimento assinado ou gestão completa de revogação |
| Exportação HTML legível/JSON completo, AAL2 e auditoria | Implementada e testada localmente | Dados e versões; autenticação real pendente; limite de volume explícito |
| Permissões explícitas por paciente, leitura/escrita/exportação | Implementada e testada localmente | Inclui outra clínica, admin sem bypass, vínculo/sessão/licença revogados |
| Fotos, câmera, anexos, comparação e revogação publicitária operacional | Pendente | Arquitetura documentada; upload e política de arquivos não implementados |
| Assinatura paciente/profissional e documentos assinados recuperáveis | Bloqueada para integração real | Sem conta/provedor; definição jurídica/ICP-Brasil e backend pendentes |
| Homologação Supabase/Vercel real | Bloqueada para provisionamento pago | Plano concreto e custo preparados; requer escolha e autorização de despesa |
| Guardas de ambiente e preparo de CSP de staging | Implementada e testada localmente | Preview recusa produção; deploy real ainda não validado |
| Recuperação externa de banco e arquivos | Pendente | Apenas dump/restore local de banco validado |
| Cadastro/Auth/SMTP/MFA remoto e dois dispositivos | Implementação existente, não validada nesta entrega | Nenhuma conta real usada como teste |
| Templates clínicos e minutas com aprovação profissional/jurídica | Implementada mas não validada externamente | Não declarar adequação clínica ou legal automática |
| Fluxo comercial integral de prontuário | Pendente | Fotografias, assinatura e recuperação impedem conclusão |

## 4. Banco e migrations

Nova migration aditiva `supabase/migrations/20261109211636_clinical_records.sql`, não aplicada remotamente. Tabelas públicas novas: aura_clinical_access, aura_clinical_patients, aura_clinical_entries, aura_clinical_versions, aura_clinical_audit e aura_clinical_templates; idempotência em aura_private.clinical_requests. Conteúdo clínico separado do snapshot legado.

Versões e auditoria são append-only para os papéis de aplicação. A RPC pública chama funções privadas que revalidam identidade, licença, sessão viva, vínculo e concessão por paciente. Foreign keys RESTRICT e trigger de snapshot impedem perda por cascata/restore que remova o paciente com prontuário. Isso muda o comportamento de encerramento/exclusão, cuja interface precisa de adaptação antes de publicar. Nenhuma migration já aplicada foi editada ou renumerada.

Os testes executam o SQL novo em PostgreSQL local e as funções de autorização existentes sem substituir a decisão por um mock permissivo. O bootstrap de Auth e parte do schema são sintéticos: a migration ainda precisa ser ensaiada no Supabase real isolado. Contrato adicional em supabase/clinical-design.md.

## 5. Proteções aplicadas

- Concessão clínica explícita por paciente; nem proprietário nem admin de plataforma recebem leitura automática. Proprietário administra concessões, com vínculo/licença/sessão válidos.
- RLS em todas as tabelas novas, revogação de acesso direto e leitura via RPC auditada. Testes separados de grants e de isolamento RLS. Referências: [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) e [Supabase checklist](https://supabase.com/docs/guides/security/production-checklist).
- Revisão otimista, idempotência por ator/solicitação/corpo e reautorização até em replay; sessão/membership revogadas não permitem reaproveitar resposta clínica.
- Revisão autenticada e adendo com motivo, sem aceitar campos que aleguem assinatura. Digest SHA-256 detecta mudança de conteúdo; não é assinatura jurídica nem torna o banco inviolável para administradores privilegiados.
- Materiais históricos derivados no servidor, validação de vínculos do mesmo paciente e campos de Enfermagem limitados à categoria.
- Erros sanitizados, escape de conteúdo, export HTML sem scripts/requisições externas, ausência de persistência clínica em localStorage/sessionStorage e aviso de alterações não salvas.
- Exportação com permissão própria/AAL2, auditoria sem payload, limites de tamanho e proibição de chave administrativa no build. Sem upload ou envio de assinatura ficticiamente apresentado como ativo.

Limites: o controle clínico novo não torna os papéis administrativos legados mais restritos; permissões de agenda/financeiro continuam as existentes. O SQL não verifica registro profissional em conselho. Segurança de endpoint remoto, Storage, monitoramento e recuperação precisam de validação própria.

## 6. Testes executados

Suite de 16 arquivos tests/*.mjs: todos passaram. Inclui os 11 testes preexistentes e cinco novos grupos de ambiente/modelo/documento/banco/navegador. Banco: 105 assertivas, incluindo resumo independente de uma timeline com mais de 100 registros, rejeição de payload malformado e de modelo no escopo de outro profissional. Navegador: 26 verificações em 390×844 e 1280×900, serviço clínico real via HTTP local e PostgreSQL PGlite.

Cobertura: versões/adendo, autorizações cruzadas, SQL direto negado, admin sem bypass, revogação, trilha, limites de respostas e formulários, autoria, idempotência após resposta perdida, conflitos, lote histórico após alteração de estoque, agenda removida sem perda clínica, export AAL2, HTML/XSS, modelos editados sem apagar versões e ausência de armazenamento clínico persistente no navegador. Dump/restore local comparou conteúdo, hashes e auditoria. Inspeção visual das telas confirmou identidade Pellum, foco de modal e ausência de overflow horizontal nos tamanhos testados; não equivale a auditoria completa de acessibilidade.

Build independente, check limitado de entrada e sintaxe de app.js/features.js passaram. Runtime novo passou no navegador. Node desta máquina: 26.13.0; produção informa 24.x, que ainda precisa de execução equivalente em staging/CI. Dependências de produção e QA foram instaladas por lockfile, com auditoria npm sem vulnerabilidades conhecidas na consulta. Ferramentas opcionais de QA ficam fora do build.

Não testados: Auth/SMTP/MFA remotos, Safari/iOS, upload/comparação de fotos, documentos realmente assinados, restore externo com Storage, carga concorrente entre conexões e jornada comercial completa. As 18 situações mínimas solicitadas têm cobertura parcial; fotos/assinaturas e sua recuperação continuam sem evidência, e revogação publicitária não foi implementada como operação completa. Execução reproduzível em tests/clinical/README.md.

## 7. Falhas corrigidas nesta implementação

Build Windows agora resolve caminho de URL corretamente. Builds locais deixam de apontar implicitamente para produção. Preview não pode reutilizar configuração de produção. O resumo clínico deixa de depender da primeira página do histórico. Validação de perguntas existe também no servidor. Falha de resposta depois de commit pode repetir o mesmo pedido sem duplicar versão. Finalização não pode ser reaberta por escrita comum; adendo preserva materiais históricos. Exportação inclui metadados de seções e todas as versões dentro do limite, com indicação clara de ausência de assinatura digital.

## 8. Pendências e riscos

Prioridade de liberação: implementar a cadeia de arquivos privada e recuperação; validar assinatura adequada; provisionar staging; ensaiar migration/Auth/RLS reais; adaptar encerramento e mensagens às proteções de retenção; realizar QA com responsável clínico. Também faltam fluxo completo de revogação de imagem, exportação assistida de grande volume, teste de concorrência/carga, revisão independente de segurança e ajustes identificados na homologação.

Conflito mantém o rascunho na tela e interrompe a fila; permite consultar o histórico sem descartar o formulário e exportar o rascunho explicitamente não confirmado, mediante permissão/AAL2 e auditoria. Não há mesclagem automática de versões. Fechar/atualizar a página após aceitar descarte pode perdê-lo; o sistema avisa e não guarda PHI em armazenamento persistente do navegador. A busca da timeline indica que pesquisa a página carregada; exportação autorizada recupera o conjunto completo limitado. Não há busca global de texto clínico implementada.

Leaked-password protection, SMTP, políticas operacionais e identidade profissional devem ser resolvidos/validados com seu próprio escopo. Não contornar recusas anteriores de MFA nem alterar produção para obter evidência de teste.

## 9. Dependências e custos

Plano com variáveis, provisionamento, cenários de infraestrutura e comparação de fornecedores em [STAGING-AND-SIGNATURES-2026-11-09.md](STAGING-AND-SIGNATURES-2026-11-09.md). Desenvolvimento local não exige contratação. Base estimada futura: US$55/mês para dois projetos Micro em organização paga dedicada e Vercel Pro, ou US$65 se o upgrade atingir os três projetos da organização atual, antes de extras. Esses cenários exigem decisões distintas, não são despesa autorizada. Assinaturas, certificados, armazenamento/backup, SMTP e uso excedente são adicionais.

## 10. Checklist de liberação

- [x] Base correta, arquitetura e identidade preservadas.
- [x] Migration clínica revisável e testada em banco local, sem produção.
- [x] Permissões/versões/idempotência e interface mobile exercitadas localmente.
- [x] Plano de homologação, custos e operação documentados.
- [ ] Homologação separada provisionada e pipeline/configurações verificados.
- [ ] Migration compatível e reconciliada no Supabase real, sem reaplicar histórico divergente.
- [ ] Auth, recuperação, SMTP, MFA, licenças e dois dispositivos validados de ponta a ponta.
- [ ] Fotos/anexos privados, comparação e revogação de usos externos implementados/testados.
- [ ] Assinatura de paciente e profissional aprovada, integrada e validada com documentos recuperáveis.
- [ ] Backup externo de banco, objetos e documentos assinado restaurado com RPO/RTO medidos.
- [ ] Retenção/encerramento, privacidade, incidentes e responsabilidades aprovados.
- [ ] Formulários, protocolos, minutas e aplicabilidade normativa validados pelos responsáveis.
- [ ] Revisão independente de segurança, carga e acessibilidade concluída.
- [ ] Aprovação explícita de despesas e de publicação/promover produção.

Resultado atual: implementação clínica parcial disponível para revisão e testes, com pendências críticas explícitas. Manter em homologação. O pedido de prontuário completo continua em andamento; esta entrega não certifica conformidade, assinatura ou aptidão comercial.

## Rastreio dos 18 casos mínimos solicitados

| Caso | Resultado desta entrega |
| --- | --- |
| 1. Criar paciente e prontuário | Prontuário sobre paciente fictício existente testado; cadastro completo do paciente pelo fluxo real não revalidado |
| 2. Atualizar anamnese preservando versões | Testado localmente, inclusive rascunho, revisão e adendo |
| 3. Avaliação e plano | Testados no navegador e persistência local |
| 4. Procedimento e produto | Referência ao financeiro e snapshot de materiais testados; consumo independente pendente |
| 5. Retorno e evolução | Gravação de evolução testada; jornada real de reagendamento não revalidada |
| 6. Enviar/ver fotos autorizadas | Pendente, sem upload habilitado |
| 7. Comparar imagens | Pendente |
| 8. Bloquear profissional não autorizado | Testado localmente, incluindo revogação e profissional arquivado |
| 9. Bloquear outra clínica | Testado na RPC e RLS local |
| 10. Registrar/recuperar assinatura | Bloqueado para validação real; sem provedor e sem assinatura implementada |
| 11. Remover agendamento sem perder clínica | Testado localmente |
| 12. Preservar lote após alteração do estoque | Testado localmente, inclusive adendo |
| 13. Revogar publicidade sem apagar histórico | Apenas minuta descritiva; operação completa pendente |
| 14. Exportação autorizada | Testada localmente, inclusive AAL2, auditoria e rascunho não confirmado; MFA remoto pendente |
| 15. Restaurar banco e fotos | Banco fictício local restaurado; recuperação externa/objetos pendente |
| 16. Fluxo completo móvel | Núcleo clínico testado a 390×844; câmera, assinaturas, iOS e jornada integral pendentes |
| 17. Falhas de rede/rascunho | Testadas resposta perdida, repetição idempotente e pausa por conflito |
| 18. Não vazar conteúdo em logs/erros/analytics | Erros e armazenamento local testados, auditoria sem payload e varredura pontual de credenciais aprovada; observabilidade remota ainda não validada |
