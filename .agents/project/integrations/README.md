# Integrações do projeto

- `mcp.json`: modelo copiado para `.kiro/settings/mcp.json` pelo
  `npm run agents:sync`. Sem segredos: o MCP Atlassian autentica por OAuth com a
  conta de cada QA na primeira chamada.
- Jira e Confluence: o discovery lê card, épico pai, vínculos diretos,
  comentários, anexos, bugs, subtarefas e páginas aplicáveis. A página raiz do
  Capítulo de Qualidade é obrigatória.
- Zephyr Scale: o projeto real é `VPOS`. A fase atual usa `dry-run` e gera
  `qa/cards/<CARD>/zephyr/zephyr-dry-run.json`; nenhuma escrita externa é
  permitida. O launcher `start-zephyr-mcp.mjs` carrega `ZEPHYR_API_TOKEN` do
  `.env` local e inicia `@smartbear/mcp`, sem copiar o segredo para `mcp.json`
  ou para arquivos versionados.
- Ciclo de teste: no modo real, cada execução cria um ciclo, adiciona somente os
  casos aprovados e anexa a evidência à execução de cada caso. No dry-run,
  somente o payload do ciclo é gerado.
- Evidências: screenshots ficam em `evidence/<CARD>/<runId>/PASS|FAIL/`; o
  manifesto sanitizado também fica em
  `qa/approvals/<CARD>/executions/<runId>/`.
- Credenciais dos ambientes ficam em variáveis locais ou secrets do CI. Nenhum
  token, usuário ou senha é versionado.
