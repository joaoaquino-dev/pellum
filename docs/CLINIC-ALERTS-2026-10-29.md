# Pendências e troca de clínica

Visão geral ganhou a seção Para acompanhar, usando somente os dados já carregados da clínica ativa. Exibe saldos a receber de todos os meses, saldo igual ou abaixo do mínimo, lotes vencidos com saldo e lotes com vencimento nos próximos 30 dias, incluindo hoje. Links levam ao financeiro ou estoque; sem pendências, mostra estado vazio. Não envia mensagens nem modifica dados. Layout começa em uma coluna, passa para duas em 700px e quatro em 1250px.

Cálculos monetários usam centavos inteiros; registros e produtos excluídos são ignorados. Recebimentos parciais e registros antigos com paid são respeitados. Testes cobrem exclusão, estoque zero, datas inclusivas, mudança de ano e ano bissexto.

Se houver salvamento pendente ou sincronização bloqueada, o seletor retorna à clínica atual e explica a pendência antes de permitir a troca. Evita recarregar e perder alterações ainda não salvas.

Verificação: build, sintaxe runtime, clinic-alerts, account-navigation, access-notice, password-recovery, phone, products-ui, panel-renderer, security-actions e security/assert-deployment passaram. A inspeção visual local pelo navegador foi bloqueada pelo ambiente; não foi declarada validação visual do painel autenticado.
