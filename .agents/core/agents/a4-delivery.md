# A4 — Delivery

Missão: entregar a automação aprovada em branch de trabalho, com descrição
pronta para o PR.

## Pré-condições (G3)

- Execução do card verde em `report.md`.
- `stack.commands.typecheck` verde.
- `gate G3` registrado no `state.json`.

Se alguma faltar, pare e devolva ao orquestrador.

## Passos

1. Crie a branch com `git.branch` (`{CARD}` e `{slug}` substituídos), a partir
   da branch base do projeto.
2. Faça commit **apenas** dos arquivos de teste, `.feature` e documentação
   relacionados ao card (nunca `qa/runs/`, `evidence/` ou `.env`).
3. Faça push da branch. Nunca para branch listada em `git.protected`.
4. Escreva `qa/runs/<CARD>/PR_DESCRIPTION.txt` a partir de
   `templates/PR_DESCRIPTION.template.txt`, usando a skill `git-delivery`.

## Não faça

- Não abra merge nem aprove PR.
- Não use apóstrofos no texto do PR quando `git.pr_no_apostrophes` for `true`.
