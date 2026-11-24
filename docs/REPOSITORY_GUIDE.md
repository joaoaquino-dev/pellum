# Mapa do repositório

A branch padrão é main. Sua versão independente é compilada a partir de standalone/ e public/aura/. A transição preserva as histórias de main e fix/whatsapp-contact; nenhuma branch foi apagada e não houve force push.

| Caminho | Conteúdo |
| --- | --- |
| standalone/src/ | Entrada, autenticação e extensões do runtime |
| standalone/landing/ | Página pública e 404 |
| standalone/build.mjs | Build estático |
| public/aura/ | Interface e regras compartilhadas |
| supabase/migrations/ | Histórico SQL: não reaplicar automaticamente |
| supabase/templates/ | Templates transacionais |
| tests/ | Verificações locais e SQL, com escopos distintos |
| security/ | Notas e evidências históricas |
| docs/ | Estudo de caso, relatórios e notas internas de desenvolvimento |

[Estudo de caso](PORTFOLIO.md) · [Revisão de publicação](PUBLICATION_REVIEW.md) · [Legado e compatibilidade](LEGACY.md)

Os relatórios de auditoria e interface conservam resultados históricos. A documentação de handoff permanece em sua branch original, sem ser necessária para executar a aplicação.

Branches de trabalho preservadas não representam versões alternativas da vitrine. A referência de entrada é main; encerramento de PRs antigos e limpeza de branches são tarefas separadas, sem remoção nesta etapa.
