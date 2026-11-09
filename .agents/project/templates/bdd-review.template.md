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

- **Decisão sugerida:** reutilizar | atualizar | criar | descartar
- **Caso existente:** {VPOS_OU_NAO_ENCONTRADO}
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

## Decisão do QA — G1

- [ ] Aprovar todos os cenários
- [ ] Aprovar parcialmente
- [ ] Solicitar ajustes

### Cenários aprovados

-

### Cenários rejeitados ou ajustados

-
