---
name: zephyr-scale
description: Como publicar e manter casos de teste no Zephyr Scale a partir dos cenários BDD aprovados — mapeamento cenário → caso, idempotência, vínculo com o card e gravação das chaves no .feature. Use na etapa ZEPHYR do fluxo #qa-run, sempre depois do G1.
---

# Zephyr Scale

**Pré-condição:** G1 registrado. Sem G1, não publique nada.

## Mapeamento

| Gherkin | Caso no Zephyr Scale |
|---|---|
| `Scenario` (título) | `name` |
| `Feature` + descrição | `objective` |
| `Given` | `precondition` |
| `When` / `Then` | passos do `testScript` (ação → resultado esperado) |
| Criticidade (`@critical`/`@high`/`@medium`) | `priorityName` (mapeamento em `zephyr.priorities`) |
| `@<CARD>` | link com a issue do Jira |
| `zephyr.folder` (com `{modulo}`) | pasta do caso |

## Idempotência

1. Antes de criar, procure caso existente pela tag de chave no cenário
   (`@QSAU-T123`) ou, sem tag, pelo nome + card vinculado.
2. Existe → atualize. Não existe → crie.
3. Grave a chave retornada como tag do cenário no `.feature` e em
   `qa/runs/<CARD>/zephyr.json` (`cenário → chave`).
4. Reexecutar a etapa não pode criar duplicados.

## Publicação

- Use a integração configurada em `zephyr` do `qa-project.yaml` (API do Zephyr
  Scale com token em variável de ambiente). O MCP Atlassian não escreve no
  Zephyr.
- Sem token disponível: gere `qa/runs/<CARD>/zephyr.json` no formato de
  importação e avise o QA (modo dry-run).

## Depois de publicar

Mostre ao QA a lista `cenário → chave → link` e peça a confirmação (G2).
