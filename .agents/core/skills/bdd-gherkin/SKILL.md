---
name: bdd-gherkin
description: Padrão de escrita de cenários BDD em Gherkin com palavras-chave Given/When/Then e texto de negócio em pt-BR — estrutura do .feature, tags, granularidade e conteúdo proibido.
---

# BDD em Gherkin

## Arquivo

- Caminho: `<features_dir>/<modulo>/<CARD>.feature`, a partir de `templates/feature.template`.
- Primeira linha obrigatória: `# language: en`.
- Use sempre palavras-chave em inglês, conforme o padrão Cogna e Zephyr: `Feature`, `Background`, `Scenario`, `Scenario Outline`, `Examples`, `Given`, `When`, `Then`, `And` e `But`.
- Escreva títulos, descrições e passos de negócio em pt-BR.
- Não use `Funcionalidade`, `Contexto`, `Cenário`, `Dado`, `Quando`, `Então`, `E` ou `Mas`.

## Tags obrigatórias por cenário

- `@<CARD>` (ex.: `@PGPO-123`).
- Criticidade: `@critical`, `@high` ou `@medium`.
- Depois do G2, a chave do caso no Zephyr Scale (ex.: `@VPOS-T123`).
- Opcional: `@manual` para o que não será automatizado, `@custo-alto` quando o projeto usar essa marcação.

## Escrita

- Um comportamento por cenário. O título descreve o resultado, não o passo a passo.
- `Given` define o estado; `When` contém uma ação de negócio; `Then` descreve resultado observável. Use `And` com moderação.
- Use linguagem de negócio. Não coloque seletor, `data-testid`, URL ou detalhe de clique.
- Use dados concretos quando importarem e `Examples` para variações.
- Cubra caminho feliz, exceção de maior risco, critérios de aceite e transições de estado relevantes.
- O que ficou a definir no alinhamento não vira cenário; permanece no discovery.

## Checklist manual

Junto com o `.feature`, liste no discovery os itens visuais, exploratórios ou fora do escopo da automação que o QA verificará manualmente.
