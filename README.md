<p align="center">
  <img src="docs/assets/pellum-repository.svg" alt="Pellum — gestão com leveza" width="100%">
</p>

<p align="center">
  Gestão para profissionais e clínicas de estética.<br>
  Agenda, custos, estoque e financeiro em um só lugar.
</p>

<p align="center">
  <a href="https://usepellum.vercel.app/conheca/"><strong>Conheça a Pellum</strong></a>
  · <a href="https://usepellum.vercel.app/">Acessar o sistema</a>
  · <a href="https://www.instagram.com/usepellum/">Instagram</a>
</p>

## O produto

A Pellum nasceu da rotina de atendimento em estética: organizar horários, entender o custo dos procedimentos, acompanhar materiais e conferir os recebimentos. O sistema atende o trabalho individual e a gestão compartilhada de clínicas, com uma interface pensada primeiro para o celular.

| Área | Recursos presentes na referência documentada |
| --- | --- |
| Agenda | Calendário, profissionais, status e retornos vinculados |
| Pacientes | Contatos, histórico de atendimentos e acesso ao WhatsApp |
| Procedimentos | Catálogo personalizado, busca, ocultação e restauração |
| Precificação | Materiais, taxas, descontos e simulação de parceria |
| Estoque | Produtos e insumos, lotes, validade, consumo e movimentações |
| Financeiro | Recebimentos, despesas, parcelas estimadas e repasses |
| Clínicas e equipe | Múltiplas clínicas, vínculos de acesso e profissionais ativos/inativos |
| Administração | Liberação de contas, suspensão e gestão de acesso |

O WhatsApp abre uma conversa ou rascunho para envio pela pessoa. Parcelas são registros financeiros; não representam processamento de pagamentos.

## Por onde começar

> **Atenção à branch:** a árvore de código da `main` ainda corresponde ao piloto histórico Aura/ChatGPT/D1. Esta atualização melhora a documentação de entrada; não incorpora as branches da aplicação independente.

A referência independente documentada em **09/11/2026** é o commit [`9d911fc`](https://github.com/joaoaquino-dev/pellum/tree/9d911fc86e0b7c3df109ce41274512c64997afe0), da branch `fix/whatsapp-contact`. O [handoff técnico](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/CODEX_HANDOFF.md) deriva dessa versão. Mudanças locais posteriores devem ser verificadas no checkout de quem as desenvolveu; não estão comprovadas por esta apresentação.

- **Entender a arquitetura:** [contexto técnico e funcional](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/PROJECT_CONTEXT.md).
- **Preparar o ambiente:** [guia de instalação e verificação](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/ENVIRONMENT_SETUP.md).
- **Retomar desenvolvimento:** [handoff e pendências](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/CODEX_HANDOFF.md).
- **Navegar pelo repositório:** [mapa das versões e documentos](docs/REPOSITORY_GUIDE.md).
- **Propor alterações:** [guia de contribuição](CONTRIBUTING.md).
- **Relatar vulnerabilidades:** [política de segurança](SECURITY.md).

Os links técnicos acima usam um commit fixo para conservar a referência desta documentação.

## Arquitetura da versão independente

O navegador carrega o frontend estático na Vercel e utiliza Supabase Auth, Data API e RPCs PostgreSQL para identidade, acesso e persistência.

| Camada | Tecnologia / responsabilidade |
| --- | --- |
| Interface | JavaScript, HTML e CSS; abordagem mobile-first |
| Build | Node.js, npm e esbuild |
| Autenticação e dados | Supabase Auth e PostgreSQL |
| Autorização | RLS, vínculo com clínica, licença e verificações no servidor |
| Publicação | Vercel; saída gerada em `standalone/dist` |
| E-mail transacional | Supabase Auth com SMTP Brevo, conforme registro de configuração |

O estado de negócio usa snapshots JSONB por clínica, com revisão otimista e histórico. Os nomes internos `aura_*` e `public/aura` foram preservados por compatibilidade. React/Next e D1 presentes na raiz pertencem ao piloto legado.

## Desenvolvimento local

**Execute os comandos apenas em um checkout da versão independente**, seguindo o guia de ambiente. Eles não se aplicam à árvore histórica da `main`.

Com Node.js 24 e npm:

```sh
npm ci --prefix standalone --workspaces=false
npm --prefix standalone run build
npm --prefix standalone run check
node --check public/aura/app.js
node --check public/aura/features.js
```

O build gera `standalone/dist`. O comando `check` verifica sintaxe da entrada; não substitui testes funcionais. Testes JavaScript, dependências de ambiente e orientações para prévia local estão no [guia técnico](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/ENVIRONMENT_SETUP.md).

Testes SQL e migrations têm execução separada: alguns criam fixtures mesmo com rollback. Não apontá-los automaticamente ao banco de produção.

## Segurança e estado de validação

A documentação registra RLS, autorização por clínica, escrita via RPC, verificações de sessão e proteção administrativa. Esses controles precisam permanecer cobertos por testes ao alterar o produto.

A [auditoria de 04/11](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/AUDIT-PRODUCTION-2026-11-04.md) contém resultados e limitações daquela revisão. Não é um selo de segurança ou conformidade. Login real, entrega de e-mail, recuperação externa, permissões e experiência em dispositivos devem ser revalidados conforme o escopo de cada entrega.

Documentos jurídicos existentes são minutas para revisão humana. Funcionalidades clínicas desenvolvidas fora desta referência não devem ser anunciadas como publicadas sem evidência de homologação e deploy.

## Identidade e histórico

Verde `#345e4d`, creme `#f4f4e9` e dourado `#c39960`. Comunicação clara, acolhedora e profissional, com a rotina de quem atende no centro.

O projeto passou de Aura para Pellum. O [README original](docs/history/README-AURA.md) foi preservado como registro do piloto.

Repositório privado. Esta atualização não altera sua visibilidade nem concede uma licença de código aberto.
