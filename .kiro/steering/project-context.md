---
inclusion: always
---

<!-- Gerado por `npm run agents:sync` a partir de `.agents/core` e `.agents/project`. Não editar à mão. -->

# opm-qa-automation

Suíte E2E dos produtos de Pós-Graduação (OPM). O discovery cobre o contexto funcional do Jira e do Confluence antes de propor BDDs. A automação atual exercita PPC e Banco de Questões com IA no Cosmos ERP Acadêmico contra stage, com usuário e registros reais.

- Squad: pos-graduacao · Idioma: pt-BR
- Stack: `playwright-typescript` em `projects/erp-academico`
- Ambiente padrão: `stage` · Proibidos: `production`
- Typecheck: `npm run typecheck` · Testes de um card: `npm run typecheck && E2E_TYPECHECK_STATUS=passed npx playwright test --grep @{CARD}`
- Jira: PGPO · Zephyr scale: VPOS
- Fluxo do agente de QA: `#qa-run <CARD>`. Alinhamento avulso: `#grill-me`.
- Nunca relaxe assertion para o teste passar, nunca aponte para ambiente proibido
  e nunca versione segredo.
