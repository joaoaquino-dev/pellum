<p align="center">
  <img src="docs/assets/pellum-repository.svg" alt="Pellum — gestão com leveza para profissionais e clínicas de estética" width="100%">
</p>

<p align="center">
  <strong>Gestão para quem cuida.</strong><br>
  Agenda, precificação, estoque e financeiro conectados à rotina de uma clínica.
</p>

<p align="center">
  <a href="https://usepellum.vercel.app/conheca/"><strong>Conheça o produto</strong></a>
  · <a href="https://github.com/joaoaquino-dev/pellum/tree/main/standalone">Código da versão independente</a>
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

## Código e estrutura

A `main` contém a aplicação independente Supabase + Vercel. O piloto Aura/ChatGPT/D1 permanece no histórico; parte de sua infraestrutura ainda está na árvore por compatibilidade, mas não entra no build publicado. Veja [o mapa do repositório](docs/REPOSITORY_GUIDE.md) e [as notas do legado](docs/LEGACY.md).

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

Clone este repositório e use a main. Os comandos abaixo instalam apenas a aplicação independente, sem as dependências do piloto histórico.

Com Node.js 24 e npm:

```sh
npm ci --prefix standalone --workspaces=false
npm --prefix standalone run build
npm --prefix standalone run check
node --check public/aura/app.js
node --check public/aura/features.js
npm --prefix standalone test
```

O build gera `standalone/dist`. Para servir uma prévia local com Python 3, execute `python -m http.server 4173 --directory standalone/dist --bind 127.0.0.1` e abra `http://127.0.0.1:4173/conheca/`. Build e testes foram executados em Linux com Node 24; a abertura do servidor e os fluxos autenticados não foram homologados nesta sessão. Não altere a lista de redirects do Supabase para fazer uma prévia funcionar.

O comando `test` executa os 11 scripts JavaScript e a verificação do alvo estático; rode o build antes dele. Não é teste de entrega de e-mail ou gravação remota.

Não execute migrations ou testes SQL automaticamente contra produção. Use dados fictícios em ambiente controlado.

## Evidências e limites

**Verificação desta preparação:** instalação standalone, build, 11 testes JavaScript, check de sintaxe e verificação de artefatos aprovados em Node 24/Linux. Consulte o [relatório final](docs/PUBLICATION_REVIEW.md). Capturas de tela novas não foram geradas: o navegador automatizado não iniciou neste ambiente. Não foram usados dados de pacientes para produzir imagens.


A [auditoria de 04/11](https://github.com/joaoaquino-dev/pellum/blob/main/docs/AUDIT-PRODUCTION-2026-11-04.md) registra 40 asserções SQL, 11 scripts JavaScript e as limitações daquela execução. O [relatório de interface](https://github.com/joaoaquino-dev/pellum/blob/main/docs/UI-UX-2026-11-05.md) distingue testes responsivos com dados fictícios e APIs simuladas de validação remota real.

Esses resultados são históricos. Não significam cobertura total, CI atual aprovado ou garantia de segurança. Entrega de e-mail, autenticação real, recuperação externa e homologação precisam ser verificadas no contexto de cada publicação.

Prontuários, imagens clínicas e assinaturas desenvolvidos fora dessas referências não são anunciados aqui como recursos publicados. Minutas jurídicas não equivalem a conformidade comprovada.

## Documentação

- [Estudo de caso para portfólio](docs/PORTFOLIO.md)
- [Mapa do repositório](docs/REPOSITORY_GUIDE.md)
- [Contexto técnico completo](https://github.com/joaoaquino-dev/pellum/blob/main/standalone/README.md)
- [Guia de contribuição](CONTRIBUTING.md) e [segurança](SECURITY.md)
- [Revisão para publicação](docs/PUBLICATION_REVIEW.md)
- [README histórico do piloto](docs/history/README-AURA.md)

## Autoria e uso

Projeto de **[João Aquino](https://github.com/joaoaquino-dev)**. Minha atuação inclui levantamento de requisitos com usuárias, decisões de produto, acompanhamento da implementação, revisão e solicitação de testes e correções. **Usei IA como apoio no desenvolvimento, na revisão e na documentação.** O código e os relatórios permitem examinar o resultado; não afirmo autoria manual de cada linha.

Código disponibilizado para avaliação de portfólio sob [todos os direitos reservados](LICENSE). Não é uma licença open source. Licenças de componentes de terceiros permanecem válidas em seus arquivos.
