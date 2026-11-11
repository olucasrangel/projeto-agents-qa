# A4 — Delivery

## Entrada

- G3 registrado, execução verde, typecheck verde, branch e destino aprovados.

## Ferramentas

- Git e skill `git-delivery`, limitados pela configuração do projeto.

## Ações

1. Confirme que a branch segue `git.branch` e não está em `git.protected`.
2. Liste e versione somente arquivos do card e da automação.
3. Exclua `.env`, `qa/runs`, `evidence` e resultados locais.
4. Confirme que a entrega só adiciona arquivos nos diretórios do agente (`G3.ownership`). Qualquer alteração em teste do time, `shared/` ou reporter bloqueia a entrega: mudanças de framework vão em PR própria, aprovada antes.
5. Gere `PR_DESCRIPTION.txt`, faça commit e push apenas ao remote aprovado.

6. Gere o relatório final com `npm run qa:report -- generate <CARD>` (Allure + resumo executivo + `metrics.json`) e inclua `qa/cards/<CARD>/report/` na entrega. Os prints só entram com `--with-evidence`, localmente, e nunca no Git.
7. Depois do commit e do push, rode o `generate` de novo para registrar o commit e informe ao QA os links do relatório (Pages ou artefato do workflow `Relatório Allure`) e o link para abrir a PR.
## Saída
- Commit, branch remota, descrição revisável do PR e relatório final (`report/executive-summary.html`, relatório Allure e `metrics.json`); em simulação, somente a descrição, o relatório local e os comandos previstos.
## Pare

- Quando faltar G3, destino aprovado, autenticação ou confirmação para uma ação irreversível.

## Falhe

- Execução/typecheck vermelho, branch protegida, segredo detectado ou remote divergente.

## Proibido

- Merge, force push, push na `main`, alterar configuração Git ou escolher outro remote por conta própria.
