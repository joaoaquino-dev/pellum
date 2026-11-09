# Revisão para publicação do repositório

Data: 09/11/2026. Escopo: preparar a apresentação de portfólio e avaliar exposição do repositório privado antes de eventual mudança de visibilidade.

## Verificações executadas

- Inventário das sete branches retornadas pela API.
- Histórico alcançável dessas branches: 38 commits únicos, com paginação de até 100 por branch; nenhuma lista atingiu o limite.
- Árvores dos 38 commits consultadas sem truncamento.
- 338 blobs únicos identificados; 333 versões de arquivos de texto lidas. Cinco blobs binários não tiveram o conteúdo inspecionado nesta etapa.
- Busca por padrões conhecidos de chaves privadas, tokens GitHub, AWS, segredos Supabase/Brevo, URLs de banco com senha, atribuições literais de credenciais e JWTs.
- Nenhuma correspondência nesses padrões nos textos examinados.
- Busca de candidatos a CPF com validação de dígitos: nenhuma correspondência nos textos examinados.
- Revisão dos corpos dos quatro pull requests listados.
- Inspeção das fixtures de navegador: registros descritos como fictícios.
- Configuração Supabase observada contém URL e chave publicável; não é uma credencial privilegiada. Não foi copiada para esta documentação.

## Identificadores encontrados

Há contatos de suporte/autoria, telefone de contato intencional na landing, referências operacionais de serviços e dados de teste. Não foram removidos por serem usados no produto ou no histórico técnico. Antes de publicar, o proprietário deve estar ciente de que esses arquivos e mensagens de commit se tornam consultáveis.

IDs públicos de projeto e chaves publicáveis não substituem autorização no servidor. Tornar o código público não valida as políticas de acesso.

## Limites importantes

Esta revisão usa leitura pela API e regras de busca específicas, não uma certificação ou prova de ausência de segredos. Não inspecionou conteúdo binário, comentários e revisões de PR, anexos, Discussions, Actions/artifacts, refs de PR, commits inalcançáveis, clones externos ou arquivos locais fora do GitHub.

A listagem de tags pela rota disponível foi rejeitada pelo conector e não foi validada. Não houve varredura dos serviços Supabase/Brevo/Vercel nem de seus dados.

Desenvolvimento clínico local posterior precisa de uma nova revisão caso seja enviado ao repositório.

## Antes de mudar a visibilidade

- Conferir comentários, anexos e demais superfícies não cobertas acima.
- Confirmar que contatos e autoria de commits podem ficar públicos.
- Definir a política de uso do código: não foi adicionada licença de código aberto.
- Planejar a consolidação da branch padrão: main ainda contém o piloto, e os links do portfólio apontam à versão independente.
- Se algum segredo real for identificado, revogá-lo e tratar o histórico; removê-lo apenas do último commit não resolve a exposição.
- Fazer a mudança de visibilidade como uma ação explícita e separada, após a revisão.

Nenhum dado, branch, commit histórico ou configuração de produção foi removido ou reescrito nesta preparação. A visibilidade permanece privada.
