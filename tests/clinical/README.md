# QA clínica isolada

Executar da raiz do repositório. Dependências opcionais de QA estão separadas do build de produção:

```powershell
npm ci --prefix standalone --workspaces=false
npm ci --prefix clinical-server --workspaces=false
npm ci --prefix tests/clinical --workspaces=false
npm --prefix standalone run build
Get-ChildItem tests -Filter '*.mjs' -File | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Teste falhou: $($_.Name)" }
}
npm --prefix standalone run check
node --check public/aura/app.js
node --check public/aura/features.js
```

O teste de navegador usa Chrome instalado no caminho padrão do Windows. Para outro executável Chromium compatível, definir `PELLUM_BROWSER` com seu caminho absoluto. Não é necessário comprar serviços ou fornecer chave remota. Nunca inserir pacientes reais nas fixtures.

PGlite executa PostgreSQL em memória com a migration clínica real e funções existentes de autorização extraídas da migration de referência. O bootstrap de Auth/sessões é sintético; não executa o serviço Supabase Auth. O teste restaura um dump local em outra instância, sem equivaler à recuperação externa do ambiente comercial.

O navegador exercita o runtime compilado e a camada clínica via HTTP local para esse banco. Confirmações, autenticação inicial e entrega de e-mail são controladas no teste. Não certifica SMTP, MFA remoto, Storage, assinatura, iOS/Safari ou todos os módulos legados. Capturas fictícias ficam em `.codex/clinical-qa/`, ignoradas pelo Git.

A suite não aceita URL de banco remoto e não executa fixtures no projeto conectado. A configuração de desenvolvimento usa loopback por padrão. Resultado registrado em docs/CLINICAL-IMPLEMENTATION-2026-11-09.md.

## Fase 2

Preferir Node 24. Com as três instalações acima, `node scripts/verify-phase2.mjs` executa build local, todos os arquivos tests/*.mjs, sintaxe e auditorias npm. O relatório local fica em outputs/phase2-verification.json. Não há deploy, link de projeto ou SQL remoto nesse comando.

O navegador clínico agora inclui galeria/slider, recuperação de upload pendente, fontes documentais e navegação nas oito áreas existentes. As fixtures de Auth, antivírus e transporte do Storage continuam identificadas como doubles; o handler, os decoders e PostgreSQL são reais locais. O teste separado da tela de autenticação substitui explicitamente o SDK para verificar interface/redirecionamentos, sem comprovar entrega de e-mail.

Os testes de documentos não geram assinatura real. O exercício de recuperação criptografada não restaura produção nem serviço externo. Relatório atual e matriz de aceite: docs/PHASE2-REPORT-2026-11-09.md; o relatório anterior permanece como registro da Fase 1.

Continuidade: tests/business-browser.mjs salva os fluxos de gestão pelo HTTP local e pela cadeia completa de SQL, incluindo consumo de estoque em atendimento solo/parceria, edição histórica e interrupção da sincronização. tests/clinic-management-permissions.mjs caracteriza os poderes amplos existentes e as negações clínicas/administrativas. Resultado e limitações em docs/BUSINESS-REGRESSION-2026-11-09.md; estes testes também usam Auth sintético.
