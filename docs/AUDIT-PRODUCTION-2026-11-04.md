# Pellum — revisão de produção em 04/11/2026 (Brasília)

## Escopo e arquitetura
Base remota inspecionada: bccc645514bf273390044264f94edfbce50cc2a1, branch security/application-review. Produção estática standalone, JavaScript + cliente Supabase; não é o servidor React/Next legado presente na raiz. Vercel aponta para standalone/dist, sem servidor legado. Não reconstruir a aplicação. As alterações desta revisão estão preparadas no repositório e NÃO foram publicadas.

## Evidência de controles existentes
- Oito tabelas de aplicação com RLS ativo: clínicas, membros, histórico e cinco tabelas privadas administrativas. Usuário autenticado tem SELECT somente nas três tabelas públicas; nenhuma permissão direta de escrita encontrada.
- identity() confere usuário confirmado, não anônimo, não banido e sessão viva com session_id. account_active() confere licença ativa, vencimento, revogação e MFA para contas com fator cadastrado.
- 40 assertions de segurança passaram via transação BEGIN/ROLLBACK com contas e clínicas fictícias. Incluem isolamento direto/RPC, acesso e gravação cruzados negados, suspensão/revogação, autorização administrativa, MFA admin e validação de estado. ROLLBACK confirmado pelo executor; nenhum usuário real alterado.
- Testes JS existentes cobrem recuperação com MFA, validação de telefone, ações sem eval, painel concorrente, equipe, alertas e produtos. Sem chave privilegiada encontrada pelo scan por padrões (não é garantia universal).
- CSP restringe scripts à própria origem; versão standalone não inclui env, mapas de código ou árvore de dependências.

## Achados e tratamento
1. Médio: ações delegadas tratavam exceções síncronas mas não Promise rejeitada. Corrigido com runAction(), feedback genérico sem erro técnico e teste de rejeição assíncrona.
2. Médio: faltavam robots.txt/sitemap/404 e noindex da entrada do sistema. Preparados; sitemap inclui só /conheca/. robots permite crawler ler noindex; não é autorização. Metadados existentes da landing preservados e imagem OG adicionada.
3. Médio: documentos jurídicos públicos não encontrados. Minutas em LEGAL-DRAFTS-REVIEW.md, com lacunas explícitas. NÃO publicadas e não consideradas conformidade LGPD.
4. Médio: advisor Supabase informa proteção contra senhas vazadas desabilitada. Configuração não alterada; avaliar plano/compatibilidade e aprovar ativação.
5. A revisar: can_access(p_owner) não diferencia dono e membro. Políticas com nome owner_read permitem membros vinculados consultarem histórico e vínculos. Não é vazamento entre clínicas demonstrado: compatível com poderes iguais pedidos para sócias. Confirmar modelo antes de introduzir profissionais com permissões menores.
6. MFA somente admin continua pendência antiga. Modelo atual exige aal2 em contas com fator verificado. Não alterar autenticação sem autorização específica da revisão e testes.
7. Infra: nenhum bucket encontrado. Isso NÃO significa que futuros arquivos clínicos estejam implementados/protegidos. Projetar buckets privados e políticas por clínica antes de fotos/anamnese.
8. Lint global: 75 erros e 440 avisos, preexistentes na base avaliada, incluindo servidor legado. Não aplicar autofix em massa. TypeScript --noEmit passou. Separar limpeza do legado da produção.
9. Performance: main.js ~244 KiB e runtime.js ~104 KiB sem gzip; sem dependência nova. Advisor performance apenas índice de auditoria ainda não utilizado: manter, ausência de uso não comprova que seja desnecessário.
10. Backups: histórico e restauração de aplicação têm testes existentes, mas recuperação completa do provedor/PITR e restauração real NÃO ensaiadas nesta revisão. Logs de provedor, entrega real de e-mails e configuração antiabuso de Auth não foram integralmente auditados.

## Validação e limites
Build standalone, verificação do pacote e TypeScript passaram antes/depois das mudanças. Suite JS executada e novo teste action-feedback passou. Scan por padrões: 190 objetos/arquivos, zero achados antes da mudança. Teste SQL: 40 assertions passaram. Fixture de estado validada no SQL não representa um teste de navegador.

Não executados nesta etapa: login/cadastro/reset por e-mail real; navegadores desktop/mobile autenticados; simulação visual de larguras; recuperação de backup do provedor. Não enviar e-mails ou alterar contas reais só para verificar. Os cinco testes HTTP anônimos passaram: clínicas/RPC/admin retornaram 401, schema privado 406 e listagem de buckets vazia. Evidência em security/evidence/http-anonymous.json.

## Próxima etapa e publicação
Revisar minutas com humano; definir retenção e responsáveis; planejar teste de recuperação, monitoramento com minimização de dados e auditoria de Auth/SMTP. Search Console depende de verificação da propriedade; não foi configurado nem adicionado Analytics.

Solicitar autorização para publicar este commit em produção, pois altera configuração de indexação e feedback de interface. Nenhuma migração, grant ou política foi modificada nesta revisão. Reversão do frontend: republicar commit bccc645; restaurar apenas os arquivos do commit auditado, sem tocar nos dados.
