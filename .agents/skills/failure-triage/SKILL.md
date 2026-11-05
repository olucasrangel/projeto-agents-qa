---
name: failure-triage
description: Método do agente de QA para investigar falhas de teste e classificá-las com evidência (bug-produto, erro-automacao, ambiente, dados, dependencia) e grau de confiança. Use ao analisar qualquer execução com falha antes de corrigir ou reportar.
---

# Triagem de falhas

## Ordem de investigação

1. **Onde parou:** linha do teste, passo (`test.step`) e mensagem de erro.
2. **O que a tela mostrava:** print e trace do momento da falha.
3. **O que a rede respondeu:** status e corpo das requisições do passo
   (trace/HAR). 5xx e timeouts apontam para ambiente/dependência; 4xx com
   mensagem de regra aponta para produto ou dados.
4. **O que mudou:** commits recentes do front/back no workspace e do próprio
   teste. Um elemento que sumiu da tela por decisão de produto é
   `erro-automacao` (teste desatualizado), não bug.
5. **Reproduz?** Reexecute uma vez só o teste que falhou. Passou na segunda →
   registre como instável com a evidência das duas execuções.

## Classificação

`bug-produto`, `erro-automacao`, `ambiente`, `dados` ou `dependencia` (definições
em `agents/a3-diagnosis.md`).

## Grau de confiança

- **Alto:** evidência direta (resposta HTTP, mensagem de regra, commit que
  explica).
- **Médio:** evidência indireta consistente.
- **Baixo:** hipótese; diga o que falta para confirmar.

## Regras

- Nunca proponha relaxar assertion como correção.
- Separe fato (o que a evidência mostra) de hipótese.
- Sanitize logs e prints: sem token, senha ou dado pessoal no relatório.
