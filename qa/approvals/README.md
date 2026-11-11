# Aprovações do fluxo de QA

Os registros ficam em `qa/approvals/<CARD>/`:

- `<CARD>-APROVACOES.md`: **único arquivo que o QA preenche**. Reúne o aprovador, o G1, o G2, o modo ATDD, a decisão de automação por cenário e o G3. Para ver o que falta marcar: `npm run qa:approvals -- status <CARD>`;
- `executions/<runId>/`: resumo sanitizado e manifesto de evidências.

Os binários de evidência ficam em `evidence/`, que não é versionado.
