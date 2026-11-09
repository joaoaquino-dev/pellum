# Pellum — preparação do ambiente Codex

Referência: 09/11/2026. Este guia contém instruções para uma configuração futura; não altera serviços, secrets ou ambientes nesta transferência.

## Abrir o código correto
Repositório privado: https://github.com/joaoaquino-dev/pellum
É necessário acesso GitHub à conta/repositório. Na máquina desta sessão Git não foi encontrado no PATH e a pasta de trabalho estava vazia; instalar/configurar Git é uma etapa local posterior.

Com Git disponível e autenticação segura já configurada:
```powershell
git clone --branch docs/codex-handoff-2026-11-09 https://github.com/joaoaquino-dev/pellum.git
Set-Location pellum
git status --short
git branch --show-current
```
Se já houver checkout, preservar alterações locais antes de trocar de branch. Abrir a pasta do checkout como projeto no Codex.
Não usar main para continuar a produção atual: ela permanece no piloto ChatGPT/D1. A branch documental deriva de fix/whatsapp-contact / 9d911fc.
Antes de qualquer alteração futura, ler AGENTS.md, PROJECT_CONTEXT.md e CODEX_HANDOFF.md.

O AGENTS.md versionado guarda instruções de trabalho que acompanham o repositório. Referência oficial: [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
Este guia não presume que histórico, credenciais ou permissões do Work sejam automaticamente transferidos para qualquer instalação do Codex.

## Ferramentas e comandos
A produção independente usa Node, npm e esbuild. O projeto Vercel informa Node 24.x; a raiz declara Node >=22.13.0. Preferir Node 24 compatível e lockfiles existentes.
Instalar o projeto independente, sem instalar toda a árvore legada por engano:
```powershell
node --version
npm --version
npm ci --prefix standalone --workspaces=false
npm --prefix standalone run build
npm --prefix standalone run check
node --check public/aura/app.js
node --check public/aura/features.js
```
Build gera standalone/dist. O script limpa/regenera esse diretório: usá-lo apenas em checkout de desenvolvimento com artefatos gerados descartáveis.
O caminho de build usa URL de arquivo e deve ser validado no Windows local; estes comandos não foram executados nesta transferência. Se houver incompatibilidade de caminho, registrar o erro e tratar em tarefa específica, sem modificar código por antecipação.

Testes JavaScript existentes, na raiz:
```powershell
Get-ChildItem -LiteralPath tests -Filter *.mjs | ForEach-Object {
    node $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Teste falhou: $($_.Name)" }
}
```
O comando check do standalone verifica apenas sintaxe da entrada. A suíte JS não comprova entrega SMTP, login real ou persistência multiusuário.
Testes .sql e geradores Python em tests/ têm fixtures e podem executar operações de escrita mesmo com rollback. Não executá-los no projeto conectado como parte de um setup.
Não rodar db:generate, migrations, supabase db push/pull/repair nem seeds nesta preparação.
Os scripts dev/build/start e o teste SQLite da raiz pertencem ao legado Sites/D1; não são o fluxo da publicação independente.
Para prévia local futura, servir standalone/dist com servidor HTTP estático local escolhido pelo ambiente. Não usar o servidor legado por engano. Login real depende das origens já autorizadas em Auth; localhost não foi confirmado nesta sessão. Não alterar Redirect URLs ou usar credenciais de pacientes só para fazer uma prévia funcionar.

## Configuração da aplicação
standalone/supabase.public.json já contém URL e chave publicável; standalone/build.mjs incorpora esses valores no bundle.
Não copiar os valores para documentos, prompts, novos arquivos de exemplo ou variáveis de ambiente sem necessidade. Não substituir por service_role, secret ou senha do banco.
Não foi identificado requisito de secret privilegiado para compilar o frontend independente.
O SMTP fica configurado no Supabase, não no JavaScript do cliente. O documento de e-mails existente registra ativação pelo proprietário; não solicitar senha nem exportar a configuração.
Variáveis e secrets de Vercel/Supabase não foram lidos ou modificados. Não executar env pull/export, rotação ou configuração remota para este handoff.

## Reutilização de integrações
As ferramentas GitHub, Supabase e Vercel responderam nesta sessão do Codex; isso comprova acesso atual de leitura, não garante acesso em outro computador, instalação, workspace ou sessão. O acesso GitHub de escrita é verificado pela criação da branch/PR documental.
O plugin Brevo está disponível, mas não foi testado: o handoff não precisou consultar contatos/campanhas nem enviar e-mails.

| Integração | O que pode ser reutilizado | O que validar/configurar no novo ambiente |
| --- | --- | --- |
| GitHub | Mesmo repositório privado e branches; conexão atual consultou código | Autenticação Git local é distinta do conector; autorizar acesso ao repositório e capacidade de criar branches/PRs |
| Supabase | Mesmo projeto pellum e banco existente; sem recriação | Conexão/MCP autorizada ao projeto correto; inicialmente leitura. Não copiar credenciais do Work |
| Vercel | Mesmo projeto, domínios e deploy existente | Conexão autorizada à equipe/projeto; ler status sem publicar ou relinkar |
| Brevo | SMTP já configurado no Supabase, segundo registro de ativação | Reconectar plugin só se uma tarefa futura exigir. Não reconfigurar SMTP para migrar o editor |
| Sites/ChatGPT/D1 | Arquivos do legado e relatórios | Acesso à hospedagem/D1 antiga não recuperado; necessário apenas se houver tarefa específica de legado/migração |
| Histórico Work | Resumo versionado e referências dos chats | Disponibilidade do histórico depende da sessão; não é requisito para clonar nem substitui os documentos |

Alvos verificados:
- Supabase: pellum / iddiiisimjaquhxhskcn / us-east-1.
- Vercel: pellum / prj_xNNqxkDzMtJScbuTbt1Fhp5bjdRA / equipe team_O1p3X85GgLd3XRyMPwZIDZfJ.
- Produção de referência: https://usepellum.vercel.app/.
IDs de projeto são referências operacionais, não credenciais.
Se uma integração estiver desconectada, usar o fluxo de conexão/autorização do próprio ambiente; não pedir token no chat nem salvar credencial no Git. Não criar arquivos MCP com secrets nesta tarefa.

## Checklist antes do próximo prompt
- Checkout na branch documental e sem alterações inesperadas.
- Documentos de transferência lidos; main antiga identificada.
- Conexões apontam aos projetos listados, com permissões adequadas ao escopo.
- Nenhum segredo ou dado de paciente adicionado a arquivos.
- Nenhuma mudança remota, migration ou publicação acionada pelo setup.
- Próximo trabalho definido pelo prompt separado do proprietário; nenhuma pendência deste handoff iniciada automaticamente.
