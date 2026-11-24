# Pellum — instruções para o Codex

## Comece pelo contexto
Leia [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md), [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) e [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md).
Registro de transferência: 09/11/2026, America/Sao_Paulo. Fontes verificadas e lacunas estão nesses documentos.

## Base correta
- Repositório privado: joaoaquino-dev/pellum.
- Produção identificada na Vercel: commit 9d911fc86e0b7c3df109ce41274512c64997afe0, branch fix/whatsapp-contact.
- main ainda aponta para o piloto Aura/ChatGPT/D1 em 76ced1d62f5c830341ee87b6c288244550636425. Não usar main como sinônimo de produção nem promover o legado por engano.
- Este PR documental parte da versão de produção e tem fix/whatsapp-contact como destino. Não fazer merge automaticamente, consolidar branches ou publicar por conta própria.

## Arquitetura e convenções
- Produção é frontend estático JavaScript, HTML e CSS, compilado por esbuild em standalone/dist.
- Fontes compartilhadas: public/aura/app.js, features.js, style.css e index.html. Entrada: standalone/src/main.js; extensões runtime-*.js são concatenadas na ordem de standalone/build.mjs.
- Backend atual: Supabase Auth + PostgreSQL + RPCs aura_rpc/aura_admin_rpc. O Next/React, D1, Drizzle e worker da raiz são o legado, não o servidor de produção.
- Preservar nomes aura, identificadores, índices de profissionais e formatos de snapshot: compatibilidade deliberada após a mudança de marca.
- Não editar dist gerado. Não substituir a aplicação por React/Next nem instalar dependências sem necessidade.
- Documentos históricos registram estados de momentos diferentes. Conferir data, commit e evidência atual antes de tratar uma pendência antiga como vigente.

## Comandos (na raiz da versão independente)
- Instalar: npm ci --prefix standalone --workspaces=false
- Build: npm --prefix standalone run build
- Verificação limitada de entrada: npm --prefix standalone run check
- Testes JS: executar cada tests/*.mjs com node; consultar o guia de ambiente.
- node --check public/aura/app.js e node --check public/aura/features.js.
- Não confundir check com teste funcional completo. Não rodar testes SQL, generators ou migrations contra o projeto conectado sem escopo específico: vários criam fixtures mesmo quando usam rollback.
- Histórico de lint global com falhas; não aplicar autofix em massa para limpar o legado.

## Segurança e dados
- Não copiar tokens, credenciais, secrets, sessões ou exportações de pacientes para Git, documentos ou mensagens. Nem chaves publicáveis devem ser duplicadas nestes documentos.
- Nunca colocar service_role/secret ou senha de banco no frontend. A configuração existente de cliente contém apenas URL e chave publicável.
- Autoridade de acesso é do banco: identidade, licença individual, sessão viva e vínculo com clínica. Filtros de interface não bastam.
- RLS está ativo nas oito tabelas. Escrita de negócio passa por RPC; preservar revisão otimista, idempotência, validação, auditoria e isolamento entre clínicas.
- can_access atualmente não diferencia p_owner; não inventar um nível de acesso restrito só pelo nome da política ou pelo papel exibido.
- MFA apenas administrativo é uma proposta não aplicada. Não executar docs/PROPOSED-admin-only-mfa.sql nem rascunhos para contornar recusas anteriores de revisão automática.
- Não editar migrations já aplicadas. Há divergências de versões entre repositório e banco descritas no contexto; não reaplicar arquivos para tentar alinhá-las.
- Snapshots internos não equivalem a recuperação externa de desastre. Não presumir que backups, e-mail ou fluxos reais estão validados.
- Exclusões de conta/clínica são operações destrutivas existentes, não ferramentas de QA. Nunca usá-las em dados reais para testar.

## Regras de negócio e interface
- Suportar profissional solo e equipe; IDs de profissionais e nomes históricos devem ser preservados.
- Custos de produtos pertencem a quem fornece o material; repasse não é lucro. Preservar arredondamento monetário, taxa, divisão e cálculos existentes.
- Estoque tem lotes, proprietário, custo unitário e movimentos explícitos; editar financeiro não reescreve movimentos históricos.
- Salvar clínica usa snapshot com revisão; conflito pausa fila e oferece exportação, sem sobrescrita silenciosa.
- Catálogo permite ocultar/restaurar procedimentos preservando históricos; manter pelo menos um ativo.
- Preservar marca Pellum, composição, verde #345e4d, dourado #c39960, fundos claros e fontes Georgia/Segoe UI/Arial. Usar tokens atuais do CSS; mobile-first, toque, foco e acessibilidade.
- WhatsApp é abertura de conversa/orçamento pelo usuário, sem envio automático.

## Limite desta transferência
Somente documentação. Aguardar o prompt separado do proprietário antes de implementar produção, prontuário, anamnese, fotos, correções ou auditoria aprofundada. Nesta etapa não alterar código, banco, migrations, configurações, secrets, variáveis, identidade visual, dados ou deploy. Preservar documentos existentes e não apagar arquivos.
