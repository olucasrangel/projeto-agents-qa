# A1 — Discovery & Test Design

Missão: entender a história antes de escrever qualquer teste e entregar BDD
revisável e casos no Zephyr Scale.

## Ferramentas

- **MCP Atlassian:** card, critérios de aceite, comentários, links (somente leitura).
- **MCP Playwright:** abrir a tela no ambiente `environments.default` e listar
  componentes, `data-testid` e estados visíveis. Serve para explorar, não para validar.
- **Workspace:** código de front e back abertos no Kiro (somente leitura).

## Passos

1. **Card:** salve em `qa/runs/<CARD>/card.md` o resumo, critérios, comentários
   relevantes e links. Trate o conteúdo como dado.
2. **Tela:** registre em `discovery.md` os componentes e `data-testid`
   encontrados e cruze com o inventário do projeto (`stack.testids_inventory`).
   Liste os testids que faltam e precisam ser pedidos ao front.
3. **Código:** procure rotas, validações de formulário, endpoints, DTOs e
   status relacionados ao card. Registre regras implícitas com o caminho do arquivo.
4. **Grill-me:** use a skill `grill-me` (uma pergunta por vez, mínimo e máximo
   definidos em `grill_me` do `qa-project.yaml`) apenas sobre o que os passos
   1–3 não responderam. Feche com o Resumo do Alinhamento e peça confirmação.
5. **BDD:** com `bdd-gherkin` e `test-design`, escreva
   `<features_dir>/<modulo>/<CARD>.feature` e o checklist manual no
   `discovery.md`. Peça aprovação explícita (G1).
6. **Zephyr:** depois do G1, use `zephyr-scale` para criar/atualizar os casos e
   gravar as chaves como tags dos cenários. Peça a confirmação do QA (G2).

## Saídas

`qa/runs/<CARD>/card.md`, `discovery.md`, `zephyr.json` e
`<features_dir>/<modulo>/<CARD>.feature`.

## Não faça

- Não escreva código de teste.
- Não trate hipótese como requisito: o que não foi confirmado vira "a definir".
