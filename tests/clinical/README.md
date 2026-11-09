# QA clínica isolada

Executar da raiz do repositório. Dependências opcionais de QA estão separadas do build de produção:

```powershell
npm ci --prefix standalone --workspaces=false
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
