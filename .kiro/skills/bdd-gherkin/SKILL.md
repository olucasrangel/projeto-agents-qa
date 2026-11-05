---
name: bdd-gherkin
description: Padrão de escrita de cenários BDD em Gherkin (pt-BR) do agente de QA — estrutura do arquivo .feature, tags obrigatórias, granularidade e o que não colocar no cenário. Use ao escrever ou revisar cenários a partir de um card.
---

# BDD em Gherkin

## Arquivo

- Caminho: `<features_dir>/<modulo>/<CARD>.feature`, a partir de
  `templates/feature.template`.
- Primeira linha `# language: pt`. Palavras-chave em português:
  `Funcionalidade`, `Contexto`, `Cenário`, `Esquema do Cenário`, `Exemplos`,
  `Dado`, `Quando`, `Então`, `E`, `Mas`.

## Tags obrigatórias por cenário

- `@<CARD>` (ex.: `@PGPO-123`).
- Criticidade: `@critical`, `@high` ou `@medium`.
- Depois do G2, a chave do caso no Zephyr Scale (ex.: `@QSAU-T123`).
- Opcional: `@manual` para o que não será automatizado, `@custo-alto` quando o
  projeto usar essa marcação.

## Escrita

- Um comportamento por cenário. Título diz o resultado, não o passo a passo.
- `Dado` = estado; `Quando` = **uma** ação de negócio; `Então` = resultado
  observável. Use `E` com moderação.
- Linguagem de negócio: nada de seletor, `data-testid`, URL ou clique em botão
  específico.
- Dados concretos quando importam (valores-limite, status), via `Exemplos`
  quando houver variações.
- Cubra: caminho feliz, exceção de maior risco, validações dos critérios de
  aceite e transições de estado relevantes.
- O que ficou "a definir" no alinhamento **não** vira cenário: fica no
  `discovery.md`.

## Checklist manual

Junto com o `.feature`, liste no `discovery.md` os itens que o QA vai verificar
manualmente (visuais, exploratórios, fora do escopo da automação).
