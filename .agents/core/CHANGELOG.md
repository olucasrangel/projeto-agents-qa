# Changelog do núcleo do agente de QA

## 0.2.0

- Adiciona `qa:doctor` para validar ambiente, segredos por presença, browser, MCP, Git, allowlists HTTPS e adaptadores sem exibir valores.
- Adiciona `qa:validate` e torna a validação executável obrigatória antes de G1, G2 e G3.
- Registra o modo de discovery (`complete`, `without-code` ou `documental`) em manifesto com hash.
- Reduz os contratos A1–A4 para entradas, ações, saídas e condições explícitas de parada e falha.

## 0.1.0

- Primeira versão do núcleo: orquestrador, agentes A1–A4, skills corporativas
  (grill-me, bdd-gherkin, test-design, zephyr-scale, failure-triage,
  git-delivery), stack `playwright-typescript`, templates, schemas e scripts
  `qa-state` e `agents-sync`.
