# Uso individual, precificação e anamnese

10/11/2026, America/Sao_Paulo. Implementação solicitada pelo proprietário para reduzir dúvidas no celular e manter uso individual e em equipe, sem novas contratações.

## Precificação

A tela passa a mostrar atendimento, materiais usados e divisão opcional. Começa sem parceria e sem valores fictícios. Custo dos materiais é calculado pela quantidade do lote; a lista permite remover um item antes de registrar. Simulação não movimenta estoque nem salva atendimento. Desconto/taxa, custo manual e preço por objetivo ficam em opções recolhidas. O custo manual é o total, incluindo materiais selecionados, e não uma segunda adição ao custo.

“Adicionar pessoa para dividir” cadastra somente um nome no mesmo cadastro de profissionais, preservando índices históricos. Não cria usuário, licença ou vínculo de acesso. O atalho preserva preço e materiais da profissional responsável; a troca comum de pessoas pede confirmação antes de limpar custos. Cálculos financeiros, atribuição do material a quem o fornece e regras de divisão existentes permanecem. Lembrete discreto de estoque continua; o prontuário permanece salvável sem saldo.

## Espaço individual e equipe

A apresentação usa “espaço de trabalho” e explica que atender em salas alugadas não exige criar outra clínica para cada endereço. Não há fusão de clínicas existentes nem transferência de pacientes. O cadastro de nomes é descrito como recurso da agenda/divisão; compartilhar a gestão com outra conta fica em opção separada e recolhida, com o aviso de acesso amplo preservado. A seleção de espaços fica oculta quando há apenas um.

O proprietário de um espaço com uma profissional recebe os próprios dados preenchidos na concessão clínica, com registro habilitado para confirmar. A confirmação ainda vale por paciente, depende da autorização do banco e não libera exportação automaticamente. Acesso clínico de equipes e suporte administrativo não recebe exceções. Automatizar concessões clínicas gerais não faz parte desta alteração.

## Anamnese pronta

Três pontos de partida: geral, cuidados faciais/pele e histórico para avaliação de toxina botulínica. As perguntas aparecem prontas para responder, com detalhes condicionais quando a paciente informa “Sim”. Criar modelo é opcional. Perguntas não determinam indicação, contraindicação ou conduta automática, e o prontuário continua documentado pelo profissional habilitado.

Referências públicas consultadas por HTTP em 10/11/2026, sem envio de respostas: [histórico de toxina](https://docs.google.com/forms/d/e/1FAIpQLSfn58Y-BvnGT5sb1YFP5_ihjfz_z1BJl8rs8S5OfuCrvo9Zkg/viewform) e [ficha facial](https://forms.gle/6CKxgTNLwo75fxVx9). Acesso pelo leitor web falhou; HTTP direto retornou 200 e os títulos/perguntas foram extraídos do formulário público. Não foram consultadas respostas de pacientes.

Cada registro guarda suas próprias perguntas e respostas. Modelos novos não reinterpretam registros antigos. Trocar a ficha com respostas pede confirmação; adendos continuam usando o questionário capturado. Não foram copiados termos de aceite como se fossem assinatura validada.

## Verificação e limites

Testes locais com pacientes fictícios, navegador e SQL descartável verificam cálculos, estoque, atalhos, permissões existentes, modelos, histórico, adendos e larguras de celular/tablet/notebook. Capturas automáticas de tela foram removidas conforme preferência do proprietário; verificações de layout usam medidas do documento, sem imagens. Isso não equivale a validação em aparelhos físicos ou revisão clínica/jurídica dos modelos.

Sem migration, alteração de permissões SQL, contratação, importação de dados ou testes em pacientes reais nesta melhoria.
