# Homologação segregada — proposta após aprovação

09/11/2026. Há código/configuração local preparados, mas **nenhuma homologação remota criada ou publicada**. As consultas continuam mostrando Pellum e financas-app, sem projeto de staging. Não se solicita nem se recebe segredo no chat.

## Recursos propostos, ainda não provisionados

| Recurso | Operação proposta | Custo/base | Condição |
| --- | --- | --- | --- |
| Supabase exclusivo | Criar pellum-staging em organização paga escolhida, Auth/DB/Storage independentes | Pro a partir de US$25/mês; projetos adicionais/uso cobrados | Aprovar impacto na organização, não pausar projeto alheio |
| Vercel exclusivo | Criar pellum-staging, domínio padrão próprio, branch feat/phase2-hardening para ensaio | Pro a partir de US$20/mês, se ainda não coberto | Confirmar plano da equipe e assentos |
| Controle de entrada | Habilitar proteção Vercel disponível no plano, apenas para testers | Confirmar cobertura/add-ons | Proteger também a URL principal de staging, não só previews |
| Antivírus | ClamD atualizado em rede privada/túnel TLS com ACL | Software gratuito; hospedagem e operação sem cotação verificada | Não criar VM/serviço pago automaticamente |
| Assinatura | Conta sandbox separada do fornecedor aprovado | Conforme provedor | Sem envio real ou adicional pago antes de decisão |
| Backup externo | Destino separado, criptografia e controle de acesso | Sem cotação verificada de armazenamento/transferência | Aprovar destino, retenção e responsáveis |

Fontes consultadas em 09/11: [Supabase](https://supabase.com/pricing), [Vercel](https://vercel.com/pricing). Cenários completos da organização, US$55/65 de base para futura produção+staging e comparação de assinatura permanecem em docs/STAGING-AND-SIGNATURES-2026-11-09.md. Antivírus, backup e certificados são adicionais.

## Execução externa, pendente de autorização

1. Confirmar gasto, região e responsáveis. Criar Supabase vazio, sem copiar backups/snapshots de produção e sem transferir projetos existentes.
2. Revisar a cadeia histórica de migrations no banco vazio. Não reparar registros de produção. Divergências de versões permanecem descritas em PROJECT_CONTEXT.md.
3. Aplicar migrations só no novo projeto aprovado. Confirmar buckets privados/policies por HTTP, inclusive URL direta conhecida, listagem, INSERT/UPDATE/DELETE e usuários de duas clínicas.
4. Criar Vercel separado, Node 24; instalar standalone e clinical-server pelos lockfiles. Configurar staging no escopo Production desse projeto e em cada Preview usado. O ambiente chamado Production desse novo projeto deve manter PELLUM_ENV=staging.
5. Executar localmente scripts/prepare-clinical-staging.mjs com a configuração exclusiva; revisar `.codex/staging/vercel.json`. Ele inclui CSP de imagem/conexão, instalação do servidor e tracing de worker/dependências nativas. Usar esse arquivo para staging, preservando vercel.json de produção. O artefato não contém segredos.
6. Definir Site URL/redirects do Auth estritamente para a origem de staging e recuperação, e-mail de testes e nenhuma URL de produção. Não usar wildcard amplo. Testar entrega com caixas controladas.
7. Configurar segredos no gestor de variáveis, sem prefixos públicos. Ver clinical-server/README.md. Habilitar mídia só com antivírus real aprovado; sem scanner, uploads devem continuar recusados. Produção é recusada pela configuração de ativação desta fase.
8. Criar pelo Auth contas fictícias de proprietário, escritor, leitor e outra clínica. Autorizar licenças de teste e concessões clínicas explícitas. Não conceder acesso clínico automático ao administrador.
9. Testar cadastro/login/logout/reset, convite de conta confirmada/licenciada, MFA admin, MFA opt-in, expiração/revogação e dois dispositivos. Depois câmera/uploads, antivírus, URLs expiradas, anexos, exportação e restauração separada.
10. Registrar evidências sanitizadas e fechar a matriz de aceite. Nenhuma promoção para produção decorre automaticamente desse ensaio.

## Estrutura local preparada

supabase/config.toml define projeto local exclusivo, PostgreSQL 17, confirmação de e-mail, TOTP e caixa local, sem segredos ou seed automático. A CLI usada para scaffolding foi 2.58.5. Validar a versão escolhida e instalar o Docker/runtime necessário antes de iniciar: o stack Auth/Storage não foi iniciado nesta máquina.

Consultar --help antes de start/reset e usar destino local explícito. Não executar db push/reset vinculado remotamente. O frontend local usa origem http://127.0.0.1:3000 e configuração publicável do próprio stack, fornecida pelo ambiente.

Os testes atuais usam duas clínicas fictícias em PostgreSQL em memória, handlers HTTP e Chrome reais, com Auth/Storage/antivírus controlados e identificados. Demonstram componentes e integração local; não comprovam homologação completa.
