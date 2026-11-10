# Pellum — estudo de caso

**Gestão de clínicas de estética · produto em evolução · referência de 09/11/2026**

[Conhecer o produto](https://usepellum.vercel.app/conheca/) · [Examinar a versão independente](https://github.com/joaoaquino-dev/pellum/tree/main)

## O problema

O trabalho de uma profissional de estética não termina no atendimento. Há agenda, reposição de materiais, custo de cada procedimento, recebimentos e acertos de parceria. Informações dispersas dificultam acompanhar o resultado da rotina.

A Pellum reúne essas atividades e permite organizar clínicas próprias e compartilhadas. O ponto de partida foi uma necessidade real; feedbacks de usuárias orientaram correções de navegação e simplificação do catálogo de procedimentos.

## O trabalho de produto e engenharia

O projeto envolve transformar necessidades de uso em fluxos de cadastro e gestão, implementar regras financeiras e de estoque, conectar autenticação e persistência, revisar permissões e validar mudanças sem apagar os registros anteriores.

A evolução ocorreu preservando a identidade visual e reutilizando o que já funcionava. A documentação registra decisões e o alcance dos testes, incluindo o que ainda não foi validado.

## Decisões técnicas

| Decisão | Motivo | Limite |
| --- | --- | --- |
| Frontend estático com JavaScript e esbuild | Reaproveitar as telas e publicar uma versão independente | Parte do runtime ainda depende de composição de scripts legados |
| Supabase Auth e PostgreSQL | Centralizar identidade e persistência | Sessão, confirmação, licença e vínculo precisam ser considerados juntos |
| RLS e RPCs autorizadas | Evitar depender de botões ocultos para proteger operações | Cada nova operação precisa manter o isolamento e a validação no servidor |
| Snapshot JSONB por clínica | Manter compatibilidade com o estado existente | Escrita agregada e limite de tamanho exigem evolução antes de maior escala |
| Revisão otimista | Rejeitar gravação sobre uma versão já alterada | Conflitos precisam de feedback e recuperação, sem sobrescrita automática |
| Ocultar e restaurar catálogo | Facilitar a gestão sem perder histórico | Identificadores antigos precisam continuar estáveis |

## Exemplo: procedimentos mais simples

O catálogo passou a oferecer lista visível, busca por nome e ações para ocultar e restaurar procedimentos. A mudança melhora uma tarefa frequente sem apagar os atendimentos já registrados.

A interface e a persistência precisam concordar: esconder o item da lista ativa não significa eliminar o nome usado nos registros anteriores. Essa preocupação também aparece no tratamento de profissionais inativos e movimentos de estoque.

## Exemplo: segurança de múltiplas clínicas

Conhecer um identificador de clínica não deve conceder acesso. A versão independente usa identidade de sessão, autorização de uso e vínculo com a clínica, com RLS nas tabelas privadas de negócio e operações de escrita encapsuladas em RPCs.

A [auditoria](https://github.com/joaoaquino-dev/pellum/blob/main/docs/AUDIT-PRODUCTION-2026-11-04.md) documenta testes transacionais com fixtures e rollback, além de limitações ainda abertas. Não se trata de uma certificação de segurança.

## Exemplo: experiência no celular

A interface prioriza uso com toque e leitura em telas pequenas. A revisão documentada tratou organização de tabelas, espaçamento de ações, foco e feedback em modais, preservando a marca.

O [relatório de UI](https://github.com/joaoaquino-dev/pellum/blob/main/docs/UI-UX-2026-11-05.md) registra verificações em múltiplas larguras com dados fictícios e APIs simuladas. Isso não comprova comportamento em todos os dispositivos ou uma sessão autenticada real.

## Evidências que podem ser examinadas

- [Código de entrada e autenticação](https://github.com/joaoaquino-dev/pellum/tree/main/standalone/src).
- [Histórico de migrations](https://github.com/joaoaquino-dev/pellum/tree/main/supabase/migrations).
- [Testes existentes](https://github.com/joaoaquino-dev/pellum/tree/main/tests).
- [Revisão de produção e limites](https://github.com/joaoaquino-dev/pellum/blob/main/docs/AUDIT-PRODUCTION-2026-11-04.md).
- [Contexto de arquitetura e regras](https://github.com/joaoaquino-dev/pellum/blob/main/docs/PROJECT_CONTEXT.md).

Os links apontam à main. Relatórios históricos conservam suas datas e limitações. A verificação atual está em PUBLICATION_REVIEW.md.

## Próximas etapas técnicas

Concluir homologação dos fluxos reais de acesso e e-mail, comprovar recuperação externa, esclarecer os papéis de acesso e avaliar evolução da persistência com base no uso. A main foi preparada com a versão independente, preservando as linhas de histórico.

O repositório mostra um produto em evolução, com decisões, evidências e limitações explícitas. Não há métricas comerciais, número de clientes ou ganhos de produtividade comprovados nesta documentação.

## Minha participação e uso de IA

João Aquino participou do levantamento de requisitos e feedbacks, das decisões de produto, do acompanhamento e revisão das alterações e da definição de verificações. Ferramentas de IA apoiaram implementação, testes, revisão e documentação. Esta apresentação não atribui autoria manual integral nem competência não comprovada.
