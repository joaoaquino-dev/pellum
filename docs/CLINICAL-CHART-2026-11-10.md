# Ficha clínica como prioridade, sem fotos na versão atual

10/11/2026, America/Sao_Paulo. O proprietário adiou fotos na Pellum e priorizou ficha/prontuário, com uso simples em celular, iPad e notebook. Nada foi publicado ou alterado remotamente; nenhuma contratação foi feita.

## Escopo atual

A interface padrão não oferece câmera, galeria, comparação ou envio de imagens. createClinicalService tem mediaEnabled=false por padrão e main.js não habilita essa opção. O código anterior de mídia foi preservado, com sua cobertura isolada de testes opt-in; não houve exclusão de arquivos ou dados. Isso é uma decisão de disponibilidade da interface, não um substituto de autorização no backend: a guarda existente do serviço de mídia continua desativada.

A entrada antiga reunia “Fotografias e anexos”; também não expõe uploads binários nesta versão. Documentos textuais, registros clínicos, minutas e exportação do prontuário continuam disponíveis. Termos históricos sobre finalidades de imagem foram preservados; não ativam armazenamento ou publicação de fotos. As fotografias externas não são importadas ou gerenciadas automaticamente pela Pellum.

## Ficha ampliada sem um formulário excessivo

Preservados identificação complementar, anamnese configurável/condicional, avaliações, planos, procedimentos, evolução, intercorrências, minutas, autoria, revisão, histórico, adendos e materiais. Campos já existentes mantêm nomes e dados.

Novos detalhes são opcionais e ficam em seções recolhidas “se necessário”, abertas automaticamente quando possuem dados salvos:

- Anamnese: procedimentos anteriores com região/data/produtos/resultados conhecidos, reações e hábitos pertinentes.
- Avaliação facial: fototipo, hidratação/oleosidade, textura/acne/lesões, pigmentação/cicatrizes, rugas/flacidez/assimetria/volume.
- Avaliação corporal: pele e região, flacidez/estrias/cicatrizes/edema e medidas com unidades. A seção pertinente acompanha a seleção facial/corporal, preservando campos anteriores preenchidos.
- Plano: necessidade identificada e critérios de reavaliação/encaminhamento definidos pelo profissional.
- Procedimento: produto/marca/fabricante, lote/validade/quantidade/unidade, preparo e aplicação. Os rótulos acompanham toxina, preenchimento, bioestimulador, skinbooster, microagulhamento, peeling, limpeza ou procedimento personalizado. Não preenchem doses, indicação ou parâmetros automaticamente.
- Intercorrência: início/relação temporal, contatos/reavaliações e referência de notificação já realizada pelo responsável. Não notifica sistemas externos automaticamente.
- Termo: benefícios possíveis, riscos, alternativas, limitações, cuidados anteriores/posteriores e dúvidas esclarecidas. Permanece uma minuta sujeita a revisão; não há assinatura validada.

Campos livres de produtos/lotes permitem documentar o que foi usado mesmo sem cadastro em estoque. O fluxo opcional de materiais estruturados continua disponível, com saldo insuficiente como lembrete, conforme CLINICAL-STOCK-2026-11-10.md.

## Persistência, histórico e exportação

Os campos adicionais usam o payload clínico versionado existente, separado do snapshot administrativo. Não exigiram nova migration. Validações de tipo, tamanho, autoria e permissões continuam no SQL atual. A gravação não modifica versões revisadas anteriores; correções usam adendos. Não houve backfill de campos por inferência.

Os rótulos e valores adicionais aparecem na linha do tempo e na exportação HTML legível, com escape de conteúdo. Não ficam limitados à tela de preenchimento. Continuam válidos a exportação autorizada, o histórico e os limites já documentados; não se afirma validade jurídica automática ou aprovação profissional do conteúdo.

## Verificação

Build, 38 arquivos de testes, seis verificações de sintaxe e três auditorias de dependências passaram com Node 24.22.2 no Windows, sem falhas ou arquivos pulados; as auditorias não reportaram vulnerabilidades. Evidência: security/clinical-chart-evidence-2026-11-10.json.

O teste de navegador do fluxo clínico/estoque passou de 32 para 43 verificações: além do estoque não bloqueante, usa main/runtime e PostgreSQL locais para salvar os campos específicos de procedimento e medidas corporais, conferir os valores no SQL, validar seções pertinentes e comprovar ausência de botão/chamadas de mídia na configuração padrão. O teste de exportação confirma novos campos e escape de conteúdo malicioso; o teste de modelo cobre rótulos dos procedimentos e identificadores sem colisões.

O teste antigo da galeria habilita mídia explicitamente em sua própria fixture, para preservar regressão do código adiado. Esse teste não significa que fotos estejam disponíveis na versão atual. Auth/Storage/antivírus reais continuam fora da evidência local; larguras simuladas não equivalem a dispositivos físicos.

## Continuidade

O escopo imediato passa a ser ficha clínica sem fotos. Não é necessário provisionar scanner/Storage para testar este fluxo textual local, e fotos não devem ser tratadas como requisito obrigatório desta versão. Permanecem validação real de Auth e recuperação, backup externo, revisão clínica/jurídica dos modelos, operações de privacidade e autorização específica antes de publicar. Não criar ambiente pago para essas etapas sem autorização.

Os novos rótulos são referências de documentação profissional; ainda não representam um editor completo de modelos específicos de procedimento por clínica, certificação, ou aprovação clínica/regulatória. Assinaturas eletrônicas externas continuam adiadas. Mensalidades seguem externas, com liberação manual.
