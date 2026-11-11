# Revisão BDD — {CARD}

- Modo de discovery: complete | without-code | documental
- Manifesto: `qa/cards/{CARD}/context/discovery.json`
- Épico: {EPIC}
- Módulo: {MODULO}
- Aplicação: {APLICACAO}
- Pasta Zephyr prevista: `{PASTA_ZEPHYR}`
- Projeto Zephyr: `VPOS`
- Modo: `dry-run`
- Gerado em: {DATA}

## Cobertura e riscos

{RESUMO_ANALISE}

## Cenários propostos

### {NOME_ZEPHYR}

- **Operação:** criar (caso próprio na pasta Automação) | atualizar (somente caso criado pelo agente) | descartar
- **Referência do time (somente leitura):** {VPOS_OU_NENHUM}
- **Objetivo:** {OBJETIVO}
- **Precondições:** {PRECONDICOES}
- **Prioridade:** High | Normal | Low
- **Status:** Draft
- **Tipo:** BDD-Gherkin
- **Regras cobertas:** {REGRAS}
- **Automação:** candidato | manual | a definir

```gherkin
# language: en
@{CARD} @critical
Scenario: Validar {RESULTADO}
  Given {ESTADO_INICIAL}
  When {ACAO_DE_NEGOCIO}
  Then {RESULTADO_OBSERVAVEL}
```

## Decisões e aprovações

Não se marca nada neste arquivo. Todas as decisões do QA ficam em `qa/approvals/{CARD}/{CARD}-APROVACOES.md`.
