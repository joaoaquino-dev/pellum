# Backend clínico da Fase 2

Código local e desativado por padrão. Nenhum bucket ou endpoint foi criado remotamente. O frontend continua estático; api/clinical-media.mjs é uma função Node separada, sem migração para Next/React.

## Preparação local

```powershell
npm ci --prefix clinical-server --workspaces=false
npm ci --prefix tests/clinical --workspaces=false
node tests/clinical-media-files.mjs
node tests/clinical-media-database.mjs
node tests/clinical-media-integration.mjs
node tests/clinical-media-service.mjs
```

Sharp é necessário para decodificar pixels e remover metadados da apresentação. pdf-lib analisa PDFs em worker com limite de heap/tempo; recursos ativos, formulários e anexos internos são recusados. Nenhum desses passos comprova validade jurídica de um PDF ou ausência absoluta de malware. As dependências estão fixadas em lockfile, separadas do frontend.

## Configuração futura de homologação

As decisões atuais estão em docs/OWNER-DECISIONS-2026-11-09.md: R$0 em novas contratações. Custos sugeridos em docs/STAGING-AND-SIGNATURES-2026-11-09.md são históricos e não foram autorizados. Provisionar ambiente segregado somente com autorização específica. Além das variáveis públicas segregadas já documentadas:

| Variável somente de servidor | Conteúdo |
| --- | --- |
| `PELLUM_MEDIA_ENABLED` | `true` somente após ensaio de segurança no projeto de teste |
| `PELLUM_APP_ORIGIN` | Origem exata e exclusiva da aplicação de homologação |
| `PELLUM_SUPABASE_SERVER_KEY` | Credencial restrita de servidor, configurada no gestor de segredos, nunca no chat/bundle/Git |
| `PELLUM_CLAMD_URL` | Endpoint privado do ClamD por túnel TLS com ACL; plaintext apenas em loopback de desenvolvimento |

A configuração recusa ativação de mídia em produção nesta fase. Não contornar essa guarda para testar com dados reais. Uma futura promoção exige revisão própria.

Dois buckets privados são declarados na migration nova: pellum-clinical-originals e pellum-clinical-display. Uma policy restritiva nega acesso direto de anon/authenticated mesmo se existir outra policy permissiva. O backend verifica o token no Auth e encaminha o JWT do usuário à RPC, que revalida licença, sessão viva, clínica, paciente e concessão. Apenas a credencial de servidor pode confirmar o resultado de processamento. O commit revalida o usuário depois do upload; uma revogação intermediária deixa objetos privados pendentes, sem liberá-los.

O Storage exige uma credencial com autoridade suficiente para gravar/assinar objetos; ela é poderosa. Mantê-la exclusivamente no servidor, em projeto de staging isolado. A superfície do endpoint não aceita bucket, caminho, URL ou SQL fornecidos pelo cliente. O corpo binário não deve ser capturado por monitoramento.

Uploads aceitam até 4 MB por arquivo, JPEG/PNG/WebP estáticos e PDF de até 100 páginas. Não há conversão HEIC nesta versão. O limite fica abaixo do limite de request da função Vercel; fotos grandes exigem outro arquivo, sem reduzir silenciosamente o original. [Vercel limits](https://vercel.com/docs/functions/limitations), [Sharp input limits](https://sharp.pixelplumbing.com/api-constructor/).

O antivírus é obrigatório e falha fechado: configuração ausente, assinatura com mais de sete dias, timeout ou resposta inconclusiva impedem a liberação. Configurar atualização de definições, limites de arquivos/recursão e alertas de limite excedido no daemon. Um ClamD exposto diretamente à internet é inadequado; o protocolo TCP não autentica clientes. [Documentação ClamAV](https://docs.clamav.net/manual/Usage/Scanning.html).

Não foi contratado nem iniciado um serviço ClamAV. Os testes usam um veredito explicitamente simulado para exercitar o fluxo e um servidor TCP de protocolo para o adaptador; uma inspeção real de malware continua pendente em homologação.

## Integridade, falhas e acesso

O original validado é preservado byte a byte com SHA-256. A apresentação é JPEG orientado/redimensionado até 2048 px, sem EXIF/GPS ou retoque. Uma repetição usa o mesmo ID e metadados; não sobrescreve objetos existentes e confere seus hashes. Só após todas as etapas o registro passa de pending a ready. PDF é entregue como download, sem execução inline. Exportar original exige permissão específica e AAL2, com nova conferência do hash.

A apresentação usa qualidade 90, mozjpeg e cor 4:4:4; a redução varia por foto e não altera o original. A migration local de limites reserva bytes/quantidade/pendências por clínica e ajusta a reserva após concluir. Sem orçamento interno configurado pelo operador, o banco recusa novos uploads. A consulta agregada é exclusiva do proprietário; não consulta faturamento do provedor. Nenhuma quota foi aplicada remotamente.

URLs de apresentação expiram em 30 segundos. Revogar acesso impede novas emissões; links já emitidos podem continuar válidos até expirar, assim como pixels já carregados podem permanecer na tela do destinatário. Não alegar revogação instantânea. Nenhuma URL assinada entra em localStorage/sessionStorage. Políticas e validação remotas ainda precisam de ensaio pelo Storage real. [Signed URLs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl), [RLS do Storage](https://supabase.com/docs/guides/storage/security/access-control).

Documentação clínica, referência da base de tratamento/armazenamento e publicidade são registradas separadamente. Nenhuma imagem recebe autorização publicitária por padrão. Revogação de divulgação gera evento imutável e preserva o histórico clínico; remoção de publicações externas exige ação do responsável. As referências registradas dependem de revisão clínica/jurídica e não são prova automática de consentimento.

Registros pending não são apagados automaticamente. Após interrupção, repetir a mesma solicitação com o mesmo arquivo recupera o fluxo. Se a página foi fechada, a seleção em memória não sobrevive: a galeria lista a pendência e oferece “Retomar envio pendente”, preservando ID/metadados e exigindo selecionar o mesmo original. Um arquivo diferente é recusado. Limpeza de órfãos e exportação em lote ainda precisam de rotina administrativa com retenção e auditoria.

## Limite das evidências

Os testes executam o handler HTTP, os decoders e PostgreSQL local reais. Auth e transporte do Storage são doubles explícitos; o schema Storage do teste é mínimo e inclui deliberadamente uma policy permissiva para testar a restritiva. Não representam validação do serviço Supabase remoto. A restauração local compara banco e bytes/hashes de um segundo armazenamento fictício; recuperação externa de desastre continua pendente.
