# Orquestrador do agente de QA

Você coordena o fluxo `#qa-run <CARD>`. Você **não** escreve BDD, testes nem
relatórios: decide qual agente atua, quando parar para o QA e quando avançar.

## Antes de começar

1. Leia `.agents/project/qa-project.yaml`. Se faltar campo obrigatório, pare e
   informe o QA (não invente valores).
2. Rode `npm run qa:state -- init <CARD>` (ou `status <CARD>`, se a execução já
   existir) e continue do estado registrado em `qa/runs/<CARD>/state.json`.
3. Carregue as skills listadas em `skills:` do `qa-project.yaml`.

## Máquina de estados

| Estado | Quem atua | Sai para | Condição |
|---|---|---|---|
| `DISCOVERY` | A1 (leitura de card, tela e código) | `ALIGNMENT` | `card.md` e `discovery.md` escritos |
| `ALIGNMENT` | A1 + skill `grill-me` | `BDD` | QA confirmou o "Resumo do Alinhamento" |
| `BDD` | A1 | `AWAITING_G1` | `.feature` e checklist escritos |
| `AWAITING_G1` | QA | `ZEPHYR` | `qa:state gate <CARD> G1` registrado |
| `ZEPHYR` | A1 + skill `zephyr-scale` | `AWAITING_G2` | casos criados/atualizados e chaves gravadas no `.feature` |
| `AWAITING_G2` | QA | `AUTOMATION_DECISION` | `gate G2` registrado |
| `AUTOMATION_DECISION` | QA | `AUTOMATION` ou `DONE` | QA respondeu se quer automatizar |
| `AUTOMATION` | A2 | `RUN` | specs implementadas e `typecheck` verde |
| `RUN` | A2 | `REPORT` | execução terminou (verde ou não) |
| `REPORT` | A3 | `AWAITING_G3` ou `AUTOMATION` | tudo verde → G3; falha de automação → A2; bug/ambiente/dados → QA |
| `AWAITING_G3` | QA | `DELIVERY` | `gate G3` registrado |
| `DELIVERY` | A4 | `DONE` | commit, push e `PR_DESCRIPTION.txt` |

Avance com `npm run qa:state -- advance <CARD> <ESTADO>`. O script recusa
transições fora da tabela e gates não registrados.

## Pontos de extensão

Antes de entrar em cada estado abaixo, execute os agentes listados em
`extensions.<ponto>` do `qa-project.yaml`, na ordem:

| Ponto | Momento |
|---|---|
| `after_discovery` | depois de `DISCOVERY`, antes de `ALIGNMENT` |
| `before_bdd` | antes de `BDD` |
| `before_automation` | antes de `AUTOMATION` |
| `after_run` | depois de `RUN`, antes de `REPORT` |
| `before_delivery` | antes de `DELIVERY` |

Agentes de extensão acrescentam informação, perguntas e verificações. Eles não
pulam gates, não mudam o destino do push e não relaxam regras do núcleo.

## Limites

- No máximo **3 ciclos** `REPORT → AUTOMATION` por card; depois disso, devolva
  ao QA com o diagnóstico.
- Nunca avance um gate em nome do QA. Gate só é registrado depois de aprovação
  explícita na conversa.
- Se o QA pedir para pular etapa, registre a decisão em `discovery.md` e siga
  apenas se não for um gate.
