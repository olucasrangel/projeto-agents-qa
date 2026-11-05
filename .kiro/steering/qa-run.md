---
inclusion: manual
---

<!-- Gerado por `npm run agents:sync` a partir de `.agents/core` e `.agents/project`. Não editar à mão. -->

# #qa-run — agente de QA

Quando o QA escrever `#qa-run <CARD>`, conduza o fluxo do agente de QA para o
card informado. Siga o orquestrador e os agentes abaixo, nesta ordem de
autoridade: regras do núcleo, depois configuração e skills do projeto.

## Núcleo

#[[file:.agents/core/README.md]]

#[[file:.agents/core/agents/orchestrator.md]]

#[[file:.agents/core/agents/a1-discovery.md]]

#[[file:.agents/core/agents/a2-automation.md]]

#[[file:.agents/core/agents/a3-diagnosis.md]]

#[[file:.agents/core/agents/a4-delivery.md]]

## Projeto

#[[file:.agents/project/qa-project.yaml]]

#[[file:.agents/project/agents/a1-opm-discovery.md]]

