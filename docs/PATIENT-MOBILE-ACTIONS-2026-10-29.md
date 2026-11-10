# Ações de paciente no celular

As ações WhatsApp, Editar, Histórico e Excluir agora ficam no mesmo grupo flex no desktop, com altura, alinhamento central, fonte, espaçamento e margem uniformes. Corrige a diferença visual do link em relação aos botões.

Estilo mobile-first: até 650 px, pacientes viram cartões com contato formatado e ações em grade de duas colunas, min-height 44 px e sem tabela horizontal. A partir de 651 px, o layout volta à tabela com ações alinhadas e quebra de linha quando necessário. O SVG do WhatsApp foi ajustado para 16 px; não há emoji do sistema. Pacientes sem telefone válido continuam sem link e excluídos mantêm as ações de histórico/restauração.

Build e sintaxe do runtime verificados; testes de telefone passaram. A tentativa de abrir um arquivo HTML local de QA foi bloqueada pela política de protocolos do navegador e não foi repetida por rota alternativa. Não houve verificação visual automatizada da versão responsiva nesta entrega. Nenhuma mensagem foi enviada, e dados reais não foram modificados.
