---
name: opm-zephyr-governance
description: Padrões OPM e Cogna para discovery Jira/Confluence, pacote BDD revisável, publicação idempotente no Zephyr VPOS, aprovações e evidências por execução.
---

# Governança OPM para Jira, BDD e Zephyr

## Fontes obrigatórias

Consulte sempre o Capítulo de Qualidade da Cogna e as páginas configuradas em
`confluence.required_pages`. Acrescente páginas ligadas ao card quando forem
aplicáveis. Registre URL, versão e regra utilizada; não copie conteúdo sem
necessidade.

O contexto Jira inclui somente: card atual, épico pai, vínculos diretos em
profundidade 1, comentários, anexos, bugs, subtarefas e Confluence ligado. Não
varra todos os cards do épico.

## Nome e conteúdo do caso

Todo cenário do pacote de revisão deve estar pronto para o Zephyr:

- nome: `[{CARD}][{aplicação}][Sucesso|Falha] {descrição}`;
- objetivo claro e focado no comportamento;
- precondições que estabelecem o estado inicial;
- prioridade derivada do risco;
- status inicial `Draft`;
- tipo de script `BDD-Gherkin`;
- cenário em português, com título iniciado por `Validar`;
- um comportamento por cenário, sem `ou` e sem condição `se`;
- vínculo com o card Jira e cobertura das regras de negócio.

## Pasta

Resolva ano, PI e sprint a partir do Jira e confirme a estrutura existente no
Zephyr. O padrão do projeto é:

`/{ano}/PI {pi}/SP {sprint}/{CARD} - {resumo} (Automação)`

Não crie uma segunda hierarquia quando a pasta do ano ou da PI já existir.
Registre divergências com o Confluence e pare para confirmação.

## Propriedade: o agente só escreve o que criou

Casos que já existem no Zephyr são do time e ficam **somente leitura**. O agente
nunca cria, atualiza, renomeia, move, reordena ou apaga um caso do time, nem
mexe na pasta dele.

- O agente cria sempre uma **pasta própria** com o sufixo `(Automação)` e grava
  somente nela.
- Caso do time equivalente ao cenário entra como `teamReference` (chave e nome),
  apenas para rastreabilidade. Não é alvo de nenhuma operação.
- O agente cria o próprio caso seguindo o padrão do Confluence: nome
  `[{CARD}][{aplicação}][Sucesso|Falha] Validar ...`, objetivo, precondição,
  `BDD-Gherkin`, prioridade e status `Draft`.
- Operações permitidas: `criar` e, só para caso do próprio agente, `atualizar`.
  Não existem `reutilizar` nem `atualizar` sobre caso do time.
- Um caso é do agente somente se a chave estiver em `owned-cases.json`
  (`ownership.zephyr.owned_registry`), gravado quando o agente o cria.
- Reexecutar nunca duplica: caso já registrado em `owned-cases.json` é
  atualizado pelo agente; os demais são criados uma única vez.
- Duplicidade com caso do time é aceita e registrada. Quem decide eliminá-la é o
  time, fora do fluxo do agente.

## Gates e estados

- G1 aprova o pacote BDD e seu hash.
- G2 aprova o plano/payload Zephyr e seu hash.
- G3 aprova o relatório, as evidências e a entrega depois da execução.

Toda decisão do QA (G1, G2, modo ATDD, seleção de automação cenário a cenário e G3) é registrada em um único arquivo, `qa/approvals/{CARD}/APROVACOES.md`. O agente monta as listas com `npm run qa:approvals -- sync <CARD>` e nunca marca por você. Execuções ficam abaixo de
`qa/approvals/{CARD}/executions/{runId}`.

## Dry-run

Com `workflow.mode: dry-run` ou `zephyr.mode: dry-run`, nenhuma escrita externa,
execução remota ou ação Git é permitida. O JSON deve declarar explicitamente:

```json
{
  "mode": "dry-run",
  "published": false
}
```

## Ciclo e evidência

Antes de uma execução real, crie um ciclo de teste para o card e o `runId` e
inclua apenas os casos aprovados para automação naquela rodada. O screenshot de
cada cenário deve ser anexado à execução correspondente dentro do ciclo, nunca
ao caso estático. No dry-run, gere o payload do ciclo sem publicá-lo.

Capture um screenshot final por cenário aprovado, mascare campos sensíveis e
mantenha o binário em `evidence/{CARD}/{runId}/PASS|FAIL`. O manifesto
sanitizado associa card, chave VPOS, cenário, resultado e caminho do arquivo.
O destino futuro do upload é a execução do caso no Zephyr.
