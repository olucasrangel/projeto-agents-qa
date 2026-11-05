---
name: git-delivery
description: Padrão do agente de QA para entregar automação em Git — branch de trabalho, escopo do commit, mensagem, push restrito e conteúdo do PR_DESCRIPTION.txt. Use na etapa DELIVERY do fluxo #qa-run, depois do G3.
---

# Entrega em Git

## Branch

- Nome: `git.branch` do `qa-project.yaml` (ex.: `qa/{CARD}-{slug}`), `slug` em
  minúsculas, sem acento, com hífens, até 40 caracteres.
- Base: `git.base` (padrão `main`).

## Commit

- Só os arquivos do card: `.feature`, specs, Page Objects, flows, fixtures, dados
  e documentação tocados. Nunca `qa/runs/`, `evidence/`, `.env`, relatórios.
- Mensagem: `test(<modulo>): <o que passou a ser coberto> (<CARD>)`, em
  português, com acentuação correta.

## Push

- Só para a branch de trabalho. Recuse qualquer push para `git.protected`.
- Não abra merge; a revisão do PR é humana.

## PR_DESCRIPTION.txt

Gere a partir de `templates/PR_DESCRIPTION.template.txt` com: título sugerido,
objetivo, card e casos do Zephyr, cenários implementados, arquivos alterados,
resultado do typecheck e da execução, caminho das evidências, riscos e
limitações, checklist de revisão. Se `git.pr_no_apostrophes` for `true`, não use
apóstrofos.
