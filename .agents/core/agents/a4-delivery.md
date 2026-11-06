# A4 — Delivery

## Entrada

- G3 registrado, execução verde, typecheck verde, branch e destino aprovados.

## Ferramentas

- Git e skill `git-delivery`, limitados pela configuração do projeto.

## Ações

1. Confirme que a branch segue `git.branch` e não está em `git.protected`.
2. Liste e versione somente arquivos do card e da automação.
3. Exclua `.env`, `qa/runs`, `evidence` e resultados locais.
4. Gere `PR_DESCRIPTION.txt`, faça commit e push apenas ao remote aprovado.

## Saída

- Commit, branch remota e descrição revisável do PR; em simulação, somente a descrição e os comandos previstos.

## Pare

- Quando faltar G3, destino aprovado, autenticação ou confirmação para uma ação irreversível.

## Falhe

- Execução/typecheck vermelho, branch protegida, segredo detectado ou remote divergente.

## Proibido

- Merge, force push, push na `main`, alterar configuração Git ou escolher outro remote por conta própria.
