# Piloto e compatibilidade

A main usa standalone/Supabase/Vercel. O piloto Aura/ChatGPT/D1 permanece no histórico Git, sem reescrita ou exclusão de branches.

public/aura contém telas e regras compartilhadas necessárias ao build atual; não é material descartável. Os nomes aura_* do banco foram conservados por compatibilidade.

app/, db/, drizzle/, worker/, components/, examples/ e ferramentas do framework na raiz pertencem à infraestrutura histórica. Permanecem nesta preparação para evitar uma remoção ampla apressada. Não são o backend publicado na Vercel. Use os comandos standalone do README.

Documentos datados em docs/ e security/ são notas de desenvolvimento e evidências de seu momento, não garantias atuais nem instruções automáticas de execução. Rascunhos SQL não devem ser aplicados ao projeto por serem encontrados no repositório.
