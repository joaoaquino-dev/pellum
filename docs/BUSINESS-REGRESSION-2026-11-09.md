# Continuidade — estoque, financeiro e poderes de gestão

Registro de 09/11/2026, America/Sao_Paulo. Complementa LOCAL-CONTINUATION-2026-11-09.md. Desenvolvimento local na branch feat/phase2-hardening, sem contratação, publicação ou escrita em serviço remoto.

## Defeito reproduzido e corrigido

O novo teste de navegador reproduziu um atendimento com R$360 de material no cálculo, mas saldo de estoque ainda em 100 unidades depois de consumir 40. A extensão de equipe escrevia em uma variável global de consumo diferente do rascunho fechado pela função que salvava o atendimento. O cálculo visual funcionava, mas os materiais e movimentos podiam ficar ausentes do snapshot.

public/aura/features.js agora disponibiliza explicitamente o rascunho compartilhado; standalone/src/runtime-team.js usa esse mesmo rascunho ao adicionar material e trocar profissionais. No teste corrigido, o saldo passa de 100 para 60, há um movimento de -40 e o atendimento mantém proprietário, custo e identificação do material. Uma segunda operação com ordem invertida das profissionais registra o custo na posição correta, baixa mais cinco unidades e preserva os movimentos anteriores. Mudar a profissional limpa o rascunho compartilhado.

Também foi reproduzido o bloqueio da fila ao editar o custo para um valor menor que os materiais históricos. O banco já recusava corretamente; agora o formulário avisa antes de enviar e permanece editável, sem pausar a sincronização. Uma edição válida não reescreve materiais ou movimentos anteriores. As fórmulas financeiras e as validações do banco foram preservadas.

Não foi executada correção retroativa de atendimentos existentes. A reprodução local não informa quantos registros reais, se houver, foram afetados. Uma eventual conferência de produção exige escopo separado, sem inventar materiais ou movimentos históricos.

## Testes novos

- tests/business-browser.mjs: 47 verificações com Chrome responsivo, runtime compilado, HTTP local e cadeia completa de SQL em PostgreSQL local. Cadastro de paciente, conflito de agenda, produto/lote, consumo, parcelas com centavos exatos, edição de atendimento, custo histórico protegido, despesa, equipe, ordem invertida de profissionais, exportação autorizada e perda de resposta depois do commit. A fila pausa e preserva o rascunho; alterações seguintes não são enviadas silenciosamente.
- tests/clinic-management-permissions.mjs: 15 verificações dos poderes existentes de gestão, com contas fictícias e fatores MFA sintéticos. Não altera a política de acesso.
- tests/clinical/full-schema-fixture.mjs: bootstrap comum usado pelos novos testes e pelo ensaio completo das migrations. Não recebe URL remota; Auth e Storage são schemas mínimos, não os serviços Supabase reais.

Esses testes não comprovam entrega de e-mail, autenticação real, concorrência de múltiplas conexões, Safari/iPhone físico ou recuperação externa. A exportação JSON de gestão testada não contém o prontuário separado e não equivale a backup de desastre.

Verificação consolidada em 09/11 às 22:33, horário de São Paulo: `node scripts/verify-phase2.mjs`, com Node 24.22.2 no Windows, concluiu build, 34 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências; zero falhas, nenhum arquivo de teste pulado e nenhuma vulnerabilidade reportada pelas auditorias. Evidência sanitizada em security/business-regression-evidence-2026-11-09.json. Falhas intermediárias de montagem da fixture e seletores foram corrigidas; a evidência corresponde à execução final, incluindo a reprodução e correção dos defeitos de consumo e validação do custo.

## Constatação sobre acesso de equipe

O SQL atual permite à gestora consultar/alterar o snapshot de gestão, ler histórico e gerenciar vínculos, inclusive remover o vínculo da proprietária. Isso foi reproduzido somente em banco descartável. O owner_id da clínica não substitui o vínculo exigido pelo acesso legado. A mesma gestora não ganhou acesso automático ao prontuário nem ao painel administrativo da plataforma.

A tela “Clínica e acesso” ganhou um aviso claro sobre o alcance desse vínculo e a concessão separada do prontuário. O aviso não restringe poderes no banco e não resolve sozinho o risco de gestão de acessos. Antes de oferecer papéis menores ou liberar a operação em equipe, definir e implementar a matriz desejada, incluindo proteção da proprietária, restauração de histórico e gestão de vínculos. Não tratar os nomes antigos owner/editor/manager como níveis restritos comprovados.

## Próximas pendências

Continuam válidos os bloqueios de homologação real, scanner, backup externo, revisão clínica/jurídica e autorização de publicação descritos na continuidade anterior. A política atual é nenhum serviço pago novo e mensalidade recebida externamente, com liberação manual.
