# Revisão BDD — {CARD}

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
# language: pt
@{CARD} @critical
Cenário: Validar {RESULTADO}
  Dado {ESTADO_INICIAL}
  Quando {ACAO_DE_NEGOCIO}
  Então {RESULTADO_OBSERVAVEL}
```

## Decisão do QA — G1

- [ ] Aprovar todos os cenários
- [ ] Aprovar parcialmente
- [ ] Solicitar ajustes

### Cenários aprovados

-

### Cenários rejeitados ou ajustados

-
