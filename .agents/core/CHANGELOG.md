# Changelog do núcleo do agente de QA

## 0.4.0

- ATDD no agente de automação: skill `atdd`, A2 reescrito como especialista e A3 com leitura de `failureKind`.
- Novos estados `RED` e `AWAITING_DEV`; entrada em `AUTOMATION` exige `--atdd-mode` (`red-first` ou `verify-existing` com motivo).
- Prova vermelha validada: só falha por asserção vale; passo não ligado, seletor, login ou ambiente invalidam.
- `qa:atdd` com `skeleton`, `run` e `guide` (guia para desenvolvedores) e `qa:state atdd-ack`.
- Reporter registra `scenario` (@Sxx), `failureKind`, `failedStep` e `atddPhase`.
- G3 exige prova ATDD: vermelho anterior ao verde, mesmos testes (hash) e execução final do `run-id`.
- Execuções `dev-*` (sem distinção de caixa) são locais e nunca valem como evidência oficial.
- Prova amarrada ao que rodou: manifesto grava runner oficial e hash de todos os arquivos do agente; o G3 relê os manifestos do disco, confere hash, ordem no tempo e evidência.
- Vermelho só vale por `expect()` num passo `Then` do BDD aprovado (tipo do passo vem do `.feature`).
- Modo ATDD confirmado pelo QA (`--by`); `atdd-ack` só pelo QA, em AUTOMATION ou AWAITING_DEV, com cadeia de custódia dos testes no G3.

## 0.3.0

- Política de propriedade: o agente só escreve o que criou. Casos do time no Zephyr e testes, Page Objects, flows e fixtures do time são somente leitura.
- Casos do agente ficam sempre em pasta própria com sufixo `(Automação)` e seguem o padrão do Confluence (nome com `Validar`, objetivo, precondição, BDD-Gherkin, Draft).
- `zephyr-sync` deixa de gerar `atualizar` sobre caso do time; caso do time vira `teamReference` somente leitura.
- G2 valida pasta própria, ausência de escrita no time e padrão do Confluence.
- G3 valida que a entrega só adiciona arquivos nos diretórios do agente.

## 0.2.1

- Padroniza BDD com palavras-chave `Feature/Scenario/Given/When/Then` em inglês e texto de negócio em pt-BR, conforme Cogna e Zephyr.
- Validadores e `zephyr-sync` rejeitam `.feature` com dialeto em português.

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
