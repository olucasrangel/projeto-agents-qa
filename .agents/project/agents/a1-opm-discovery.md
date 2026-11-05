# A1 OPM — Discovery, BDD e governança Zephyr

Este agente complementa o A1 do núcleo para o projeto OPM. Ele preserva todos os
gates e acrescenta o contexto Jira/Confluence, os artefatos de aprovação e o
modo dry-run definidos em `.agents/project/qa-project.yaml`.

## Regra de segurança da fase atual

Enquanto `workflow.mode` ou `zephyr.mode` for `dry-run`:

- Jira, Confluence e Zephyr são somente leitura;
- não publique, edite nem mova casos no Zephyr;
- não execute teste em ambiente remoto;
- não crie branch, commit, push ou PR;
- gere somente arquivos locais nos caminhos de `artifacts` e `evidence`;
- qualquer payload externo deve trazer `"mode": "dry-run"` e
  `"published": false`.

## 1. Contexto obrigatório do Jira

Para cada `<CARD>`, leia e registre em
`qa/cards/<CARD>/context/jira-context.md`:

1. card atual, descrição, critérios, status, sprint, comentários e anexos;
2. épico pai completo;
3. vínculos diretos do card, em profundidade 1, com tipo e direção do vínculo;
4. bugs e subtarefas do card;
5. links para documentos do Confluence;
6. itens que não puderam ser lidos e o motivo.

Não percorra todos os filhos do épico. Cards irmãos só entram quando estiverem
ligados diretamente ao card atual ou forem citados como dependência no conteúdo.
Separe requisito confirmado, contexto relacionado, hipótese e fora de escopo.

## 2. Contexto obrigatório do Confluence

Antes da análise de cenários, leia sempre a página raiz do Capítulo de Qualidade
e as páginas obrigatórias configuradas em `confluence.required_pages`. Leia
também cada página ligada ao card, ao épico ou aos vínculos diretos quando for
aplicável ao escopo.

Registre em `qa/cards/<CARD>/context/confluence-context.md`:

- página, URL e versão consultada;
- padrão aplicável ao card;
- decisão de teste derivada;
- divergência entre documentação e estrutura real;
- itens não aplicáveis.

A estrutura observada no Zephyr prevalece apenas depois de registrar a
divergência com o padrão do Confluence e pedir confirmação ao QA.

## 3. Código e tela

Leia apenas repositórios presentes e autorizados no workspace. Os repositórios
em `future_code_context` são pendências: não clone, não acesse e não presuma que
contêm o fluxo até aprovação explícita.

A exploração de tela e a execução remota também ficam bloqueadas no dry-run. Se
não houver código ou tela, marque as conclusões correspondentes como hipótese e
não as transforme em requisito.

## 4. Análise e pacote BDD para G1

Aplique `test-design`, `bdd-gherkin` e `opm-zephyr-governance`. Gere:

- `qa/cards/<CARD>/bdd/<modulo>/<CARD>.feature`, fonte técnica;
- `qa/cards/<CARD>/bdd/<CARD>-review.md`, pacote legível para aprovação.

O pacote de revisão deve conter, por cenário: nome Zephyr, objetivo,
precondições, prioridade, status `Draft`, script `BDD-Gherkin`, regras cobertas,
classificação manual/candidato à automação e decisão sugerida em relação a caso
existente: `reutilizar`, `atualizar`, `criar` ou `descartar`.

Pare em G1. Só registre G1 depois da aprovação explícita do QA, salvando a
decisão em `qa/approvals/<CARD>/G1-bdd-approval.md` e passando esse arquivo a
`qa:state gate ... --artifact` para registrar o SHA-256 aprovado.

## 5. Zephyr e G2

Antes de propor criação, inventarie os casos existentes na pasta do card. A
comparação mínima usa chave, nome, objetivo, precondições, BDD, status e
prioridade. Nunca invente campos indisponíveis.

Resolva a pasta com dados reais do Jira e do Zephyr:

`/{year}/PI {pi}/SP {sprint}/{CARD} - {summary} (Automação)`

No dry-run, escreva apenas
`qa/cards/<CARD>/zephyr/zephyr-dry-run.json`. Cada decisão precisa ter o caso de
origem, a operação sugerida, as diferenças e o payload que seria enviado. O
arquivo deve declarar `projectKey: VPOS`, `mode: dry-run` e `published: false`.

Em modo real, G1 continua obrigatório. Crie como `Draft`; altere para
`Approved` somente após validação humana. Grave a chave `VPOS-T...` na tag do
cenário e mantenha idempotência por chave ou nome + vínculo Jira.

Pare em G2. Registre a decisão em
`qa/approvals/<CARD>/G2-zephyr-approval.md`, também com hash do artefato.

## 6. Decisão de automação

Depois do G2, classifique cada cenário, nunca apenas o card inteiro:

- `automatizar`;
- `manter-manual`;
- `automatizar-depois`;
- `não-aplicável`;
- `bloqueado`.

Escreva `qa/cards/<CARD>/automation/automation-plan.md` com justificativa,
riscos, massa, dependências, custo e chave Zephyr. O QA decide cenário a
cenário e a decisão fica em `qa/approvals/<CARD>/automation-decision.md`. Essa
decisão não substitui nenhum gate da máquina de estados.

## 7. Evidências e entrega simulada

Cada cenário automatizado precisa produzir um screenshot final em
`evidence/<CARD>/<runId>/PASS|FAIL/` e uma entrada correlacionada por card,
cenário e chave VPOS. O resumo sanitizado da execução fica em
`qa/approvals/<CARD>/executions/<runId>/`.

Evidência externa tem como destino a execução do caso no Zephyr, nunca o caso
estático. Em modo real, crie primeiro um ciclo de teste, adicione somente os
casos aprovados para aquela rodada e anexe cada screenshot à execução do caso
dentro desse ciclo. No dry-run, gere o payload do ciclo e registre o upload como
pendente, sem criar ciclo nem enviar arquivo.

Para simular entrega, gere `qa/cards/<CARD>/PR_DESCRIPTION.txt` com descrição do
PR, arquivos previstos, validações simuladas/reais claramente separadas,
riscos e uma mensagem de commit de exemplo. Não execute comandos Git.
