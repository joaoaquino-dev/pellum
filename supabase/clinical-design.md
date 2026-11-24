# Prontuário — contrato de implementação em homologação

09/11/2026. A migration nova é aditiva e ainda não foi aplicada ao projeto conectado.

O cadastro administrativo continua no snapshot existente. A chave clínica é o par
`clinic_id, patient_id` e conserva o ID original; não há procura por CPF nem união
entre clínicas. O conteúdo clínico fica fora de snapshots, financeiro, CSV e analytics.

Permissões clínicas são concessões explícitas por usuário e paciente. Só o proprietário
da clínica com licença/sessão válidas administra concessões; ele não recebe leitura
clínica automaticamente. A concessão exige vínculo atual e índice profissional ativo.
Administrador da plataforma não tem exceção. Remoção de vínculo, suspensão, expiração,
revogação da sessão e arquivamento profissional são rechecados a cada RPC.

Todos os registros são versões append-only, inclusive rascunhos. Finalização é uma
revisão autenticada do profissional, **não assinatura eletrônica/digital**. Depois dela,
correções exigem motivo de adendo e não alteram a versão original. Nenhum texto do
cliente pode marcar um registro como assinado. Exportação exige permissão própria e
AAL2. Não há exclusão clínica por RPC; referências impedem cascata de exclusões legadas.

As tabelas têm RLS e nenhum grant de leitura/escrita direta ao cliente. Leitura passa
pela RPC para registrar auditoria sem o corpo clínico. Policies SELECT são defesa
adicional; as funções privadas verificam autorização antes de usar privilégios elevados.
Testes isolados devem cobrir tanto a RPC quanto as quatro operações diretas.

Imagens/arquivos e assinatura não são habilitados nesta base: dependem de backend de
quarentena, decodificação real, antivírus, derivados sem EXIF, bucket privado, auditoria
de download, restauração de objetos e integração de assinatura com webhook verificado.
Não aceitar upload direto como substituto dessa cadeia. Termos são minutas para revisão.

O consumo financeiro/estoque existente permanece a autoridade de movimentos. A ficha
clínica pode referenciar um atendimento financeiro da mesma paciente e guardar uma
cópia histórica de seus materiais. Não cria segundo consumo nem troca lotes silenciosamente.
Consumo clínico sem atendimento financeiro requer futura transação unificada, não duas
gravações independentes. Agenda é referência opcional e não é FK com cascata.
