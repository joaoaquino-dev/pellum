<p align="center">
  <img src="docs/assets/pellum-repository.svg" alt="Pellum — gestão com leveza para profissionais e clínicas de estética" width="100%">
</p>

<p align="center">
  <strong>Gestão para quem cuida.</strong><br>
  Agenda, precificação, estoque e financeiro conectados à rotina de uma clínica.
</p>

<p align="center">
  <a href="https://usepellum.vercel.app/conheca/"><strong>Conheça o produto</strong></a>
  · <a href="https://github.com/joaoaquino-dev/pellum/tree/9d911fc86e0b7c3df109ce41274512c64997afe0/standalone">Código da versão independente</a>
  · <a href="docs/PORTFOLIO.md">Estudo de caso</a>
  · <a href="https://www.instagram.com/usepellum/">Instagram</a>
</p>

## Por que a Pellum existe

Entre os atendimentos, uma profissional de estética precisa organizar horários, conferir materiais e entender quanto recebe depois dos custos. A Pellum reúne essas tarefas em um sistema para uso individual ou compartilhado entre profissionais.

O projeto surgiu de uma necessidade real de gestão e evoluiu com feedbacks de usuárias. A interface prioriza o celular, mantendo navegação e tabelas para uso no computador.

**Tecnologias da versão independente:** JavaScript · HTML · CSS · esbuild · Supabase Auth · PostgreSQL · Vercel.

## O que você pode conhecer

| Área | Funcionalidades |
| --- | --- |
| Agenda e pacientes | Calendário, retornos, contatos, histórico de atendimentos e abertura de conversa no WhatsApp |
| Procedimentos | Catálogo personalizado, busca, ocultação e restauração |
| Precificação | Custos de materiais, descontos, taxas e simulação de parceria |
| Estoque | Produtos e insumos, lotes, validade, saldo e movimentos de consumo |
| Financeiro | Recebimentos, despesas, parcelas estimadas e repasses |
| Clínicas e acesso | Múltiplas clínicas, vínculos de equipe, liberação de contas e administração |

O acesso ao sistema depende de confirmação de e-mail e liberação administrativa. A [página pública](https://usepellum.vercel.app/conheca/) apresenta o produto sem exigir cadastro. Não há credenciais de demonstração publicadas.

WhatsApp abre uma conversa ou rascunho; o envio é feito pela pessoa. Parcelas são registros financeiros, sem processamento de pagamento.

## Pontos técnicos do projeto

- **Autorização no servidor:** acesso vinculado à conta e à clínica, com RLS e RPCs PostgreSQL.
- **Consistência de dados:** revisão otimista evita sobrescrita silenciosa de um snapshot desatualizado.
- **Histórico preservado:** alterações de catálogo e equipe mantêm a identificação dos atendimentos anteriores.
- **Regras de negócio conectadas:** consumo de materiais participa do custo do procedimento e dos registros financeiros.
- **Compatibilidade:** a versão independente reutiliza a interface existente em vez de reconstruir o produto.
- **Evidência de validação:** testes SQL, JavaScript e verificações de interface documentados, com distinção entre simulação e uso real.

Leia o [estudo de caso](docs/PORTFOLIO.md) para entender decisões, limites e exemplos do trabalho técnico.

## Onde está o código atual?

> **A árvore de código da main ainda é o piloto histórico Aura/ChatGPT/D1.** A apresentação desta página descreve a versão independente, disponível no link abaixo. Os códigos não foram consolidados nesta atualização documental.

| Referência | Conteúdo |
| --- | --- |
| [Versão independente `9d911fc`](https://github.com/joaoaquino-dev/pellum/tree/9d911fc86e0b7c3df109ce41274512c64997afe0) | Frontend estático, Supabase e configuração Vercel, conforme referência documentada |
| [Handoff `901646a`](https://github.com/joaoaquino-dev/pellum/tree/901646a153d94ec2770148ef7238f41f06dba726) | Mesma base com contexto técnico e orientação de continuidade |
| `main` | Código do piloto original e apresentação de portfólio |

Referências verificadas em **09/11/2026**. Os links usam commits fixos; não representam uma consulta permanente ao estado de produção. Desenvolvimento local posterior não é comprovado por estes commits.

## Arquitetura

| Camada | Responsabilidade |
| --- | --- |
| Frontend estático | JavaScript, HTML e CSS; entrada em `standalone/src/` e telas compartilhadas em `public/aura/` |
| Build | esbuild; artefatos em `standalone/dist` |
| Identidade | Supabase Auth, confirmação de e-mail, sessão e licença individual |
| Acesso e persistência | PostgreSQL, RLS e RPCs autorizadas; snapshots JSONB por clínica |
| Hospedagem | Vercel |
| E-mail transacional | Supabase Auth com SMTP Brevo, conforme registro de configuração |

React/Next, D1 e Drizzle na raiz pertencem ao legado. Os nomes internos `aura_*` foram mantidos por compatibilidade.

## Executar e verificar

Primeiro, abra a [versão independente](https://github.com/joaoaquino-dev/pellum/tree/901646a153d94ec2770148ef7238f41f06dba726) e leia seu `AGENTS.md`. Os comandos abaixo **não se aplicam ao código legado desta main**.

Com Node.js 24 e npm:

```sh
npm ci --prefix standalone --workspaces=false
npm --prefix standalone run build
npm --prefix standalone run check
node --check public/aura/app.js
node --check public/aura/features.js
```

Instalação, testes JavaScript e orientações para prévia local: [guia de ambiente](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/ENVIRONMENT_SETUP.md). O comando `check` verifica sintaxe da entrada, não o fluxo completo.

Não execute migrations ou testes SQL automaticamente contra produção. Use dados fictícios em ambiente controlado.

## Evidências e limites

A [auditoria de 04/11](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/AUDIT-PRODUCTION-2026-11-04.md) registra 40 asserções SQL, 11 scripts JavaScript e as limitações daquela execução. O [relatório de interface](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/UI-UX-2026-11-05.md) distingue testes responsivos com dados fictícios e APIs simuladas de validação remota real.

Esses resultados são históricos. Não significam cobertura total, CI atual aprovado ou garantia de segurança. Entrega de e-mail, autenticação real, recuperação externa e homologação precisam ser verificadas no contexto de cada publicação.

Prontuários, imagens clínicas e assinaturas desenvolvidos fora dessas referências não são anunciados aqui como recursos publicados. Minutas jurídicas não equivalem a conformidade comprovada.

## Documentação

- [Estudo de caso para portfólio](docs/PORTFOLIO.md)
- [Mapa do repositório](docs/REPOSITORY_GUIDE.md)
- [Contexto técnico completo](https://github.com/joaoaquino-dev/pellum/blob/901646a153d94ec2770148ef7238f41f06dba726/docs/PROJECT_CONTEXT.md)
- [Guia de contribuição](CONTRIBUTING.md) e [segurança](SECURITY.md)
- [Revisão para publicação](docs/PUBLICATION_REVIEW.md)
- [README histórico do piloto](docs/history/README-AURA.md)

## Autoria e uso

Projeto de **[João Aquino](https://github.com/joaoaquino-dev)**, desenvolvido a partir de uma necessidade real na área de estética.

A publicação do código permite conhecer o trabalho técnico, mas não disponibiliza dados de clínicas, acesso administrativo ou credenciais. Nenhuma licença de código aberto foi adicionada nesta atualização; avisos de terceiros permanecem nos respectivos arquivos.
