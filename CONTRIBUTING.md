# Contribuindo com a Pellum

## Escolha a base certa

Leia o [mapa do repositório](docs/REPOSITORY_GUIDE.md) e o AGENTS.md existente na branch de trabalho. A main ainda contém o piloto histórico; não a utilize como base de uma correção da aplicação independente sem conferir o código e o SHA de origem.

Preserve alterações locais e crie uma branch específica a partir da base correta. Trabalhos clínicos locais posteriores precisam ser identificados antes de qualquer consolidação.

## Escopo e qualidade

- Reutilize as funcionalidades existentes e preserve a identidade visual e a abordagem mobile-first.
- Mantenha IDs, nomes internos de compatibilidade e histórico de dados.
- Prefira alterações pequenas e justificadas; evite dependências sem necessidade.
- Não edite artefatos gerados nem migrations já aplicadas.
- Use dados fictícios em testes, imagens, issues e exemplos.
- Nunca versione credenciais, sessões, exportações de clínicas ou dados de pacientes.

## Validação

Na versão independente, execute build, verificações de sintaxe e os testes adequados descritos no guia de ambiente. Para mudanças de interface, confira desktop e mobile. Para acesso ou persistência, valide autorização, isolamento e conflitos em ambiente controlado.

Registre o comando, resultado e ambiente. Identifique explicitamente testes não executados ou simulados. Não transforme evidência histórica em resultado atual. Não aplique autofix global ao legado.

Alterações remotas de banco, autenticação, permissões, infraestrutura e produção que afetem usuários exigem preparação, validação segura e autorização do proprietário antes da aplicação.

## Pull requests e commits

Informe o problema, comportamento resultante, arquivos relevantes, evidências e limitações. Confirme a branch de destino antes de abrir o PR; não escolha main automaticamente.

Use commits descritivos, por exemplo:

- `docs: clarify repository architecture and setup`
- `fix: prevent duplicate appointment submission`

Publicar código, executar migrations e mudar a branch padrão são decisões separadas da aprovação de um documento.

## Problemas e propostas

Use os modelos de bug e melhoria. Descreva passos reproduzíveis e impacto na rotina. Vulnerabilidades devem seguir [SECURITY.md](SECURITY.md), sem detalhes sensíveis em issues.
