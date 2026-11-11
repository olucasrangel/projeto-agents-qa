---
name: atdd
description: Acceptance Test-Driven Development no agente de automação. O teste de aceite é escrito e executado antes da funcionalidade, falha pelo motivo certo, guia o desenvolvimento e fica verde no fim. Use no A2 depois do G2, ao decidir o modo ATDD, escrever os testes de aceite, provar o vermelho e preparar o guia para quem desenvolve.
---

# ATDD no agente de automação

ATDD é uma prática de equipe: critérios de aceite são acordados antes do código, viram testes automatizados e esses testes determinam quando a funcionalidade está pronta. O agente existe para tornar esse ciclo barato e verificável, não para escrever teste depois que o código já está pronto.

## Ciclo e onde cada fase vive no fluxo

| Fase ATDD | O que significa | No fluxo do agente |
|---|---|---|
| **Discutir** | PO, dev e QA acordam o comportamento esperado | Discovery, alinhamento, BDD e **G1** |
| **Destilar** | Critérios viram casos e testes de aceite executáveis | Zephyr e **G2**, depois `skeleton` e ligação dos passos |
| **Desenvolver** | Teste vermelho pelo motivo certo, dev implementa, teste fica verde | Estados `RED`, `AWAITING_DEV` e `RUN` |
| **Demonstrar** | Mostrar a funcionalidade funcionando com evidência | `REPORT`, evidências por passo e **G3** |

Antes do G1, compartilhe o pacote de revisão com o PO e com quem vai desenvolver. Critério ambíguo descoberto depois do código custa retrabalho; descoberto aqui custa uma conversa. O G1 continua sendo registrado pelo QA.

## Escolha do modo (decisão explícita, nunca padrão)

O modo é marcado pelo QA no `APROVACOES.md` (seção Automação), junto do nome do aprovador; o G3 exibe quem foi:

- **`red-first`**: a funcionalidade ainda não foi entregue ou está em desenvolvimento (subtarefas de front ou back abertas). É o modo normal e o que dá valor ao dev.
- **`verify-existing`**: a funcionalidade já está entregue e em stage. Exige o Motivo no `APROVACOES.md` e dispensa a prova vermelha. Não use para fugir do vermelho quando o card ainda está em desenvolvimento.

Proponha o modo ao QA com a evidência (status do card e das subtarefas) e peça confirmação. O agente nunca escolhe `verify-existing` sozinho: quem marcou é o aprovador do arquivo.

## Como escrever o teste de aceite

- Um teste por cenário do BDD aprovado, com as tags `@<CARD>`, `@S01` (id do cenário no BDD), criticidade e, quando existir, a chave do caso do agente (`@VPOS-T...`). A tag `@Sxx` liga o teste ao critério antes mesmo de o caso existir no Zephyr.
- Gere o esqueleto com `npm run qa:atdd -- skeleton <CARD>`. Ele cria um `test.step` por linha Gherkin e nunca sobrescreve arquivo.
- Ligue cada passo importando Page Objects, flows, fixtures e clientes de API existentes. Nunca edite arquivo do time.
- `Given` prepara estado (preferir API a navegação). `When` executa a ação de negócio pela interface. `Then` contém **`expect` sobre o comportamento observável do critério de aceite**.
- Teste o comportamento, não a implementação: nada de depender de nome de função, estrutura interna ou texto que não esteja no critério.
- Dados novos por execução, nomes identificáveis, sem dependência de ordem entre cenários, a menos que o BDD declare.

## Prova vermelha

O vermelho só vale quando o teste **chega até a verificação do comportamento e ela falha**. Por isso a execução oficial classifica cada falha:

| `failureKind` | Significado | Vale como vermelho? |
|---|---|---|
| `assertion` | `expect` falhou: o critério ainda não é atendido | **Sim** |
| `execution` | passo não ligado, seletor, timeout de ação, login, massa ou ambiente | **Não**, é erro de automação, dados ou ambiente |

Além de ser `assertion`, a falha precisa acontecer **num passo `Then` do BDD aprovado**. O tipo do passo vem do `.feature`, não do título que o teste usa: falha em `Given` ou `When` (preparação ou ação quebrada), ou num passo que não existe no BDD, não vale. Por isso o título de cada `evidenceStep` deve ser exatamente a linha do Gherkin (o esqueleto já faz isso).

A prova vermelha é inválida quando: nenhum cenário falha (teste fraco ou funcionalidade já pronta), alguma falha é de execução, cenário foi ignorado ou algum cenário selecionado não foi executado. Um cenário que já passa é aceito e informado como "já atendido".

Passo `PENDENTE_LIGAR` do esqueleto nunca vira vermelho válido, de propósito.

## Entrega para quem desenvolve

1. Rode a prova vermelha: `npm run qa:atdd -- run <CARD> --phase red --run-id <id>`.
2. Gere o guia: `npm run qa:atdd -- guide <CARD> --run-id <id>`. Ele lista cada critério em Gherkin, o estado do teste, o passo que falha e o comando para rodar só aquele cenário.
3. Avance para `AWAITING_DEV` e pare. O dev trabalha com o comando por cenário (run-id `dev-local`, nunca oficial).
4. Quando o dev avisar que terminou, o QA confirma, e o agente roda a fase `green` oficial.

O dev usa o teste como especificação: pega um cenário vermelho, implementa o mínimo, roda de novo até ficar verde. Se achar o critério errado, volta ao QA e ao PO. **Não altera o teste para passar.**

## Mudou o teste depois do vermelho?

O runner oficial grava no manifesto o hash de **tudo o que o agente escreveu** (testes, Page Objects, flows e dados nos diretórios do agente). A prova vermelha, a execução verde e os testes atuais precisam ter o mesmo hash, e o G3 relê os manifestos do disco para conferir. Mover um `expect()` para um helper também muda o hash.

Mudança legítima (seletor que quebrou, passo reescrito sem alterar o critério) é registrada **pelo QA** com `npm run qa:state -- atdd-ack <CARD> --by "Nome do QA" --reason "motivo"`. O agente não registra ack por conta própria. O ack descarta a execução final, exige nova execução verde e aparece no G3 com quem aprovou e por quê. Mudança no critério volta ao BDD e ao G1.

## Falha na execução final

- `assertion` no modo `red-first`: o critério ainda não foi atendido. Devolva ao desenvolvimento (`REPORT → AWAITING_DEV`) com o passo que falhou.
- `execution`: erro de automação, dados ou ambiente. Volta ao A2 ou ao QA, conforme o diagnóstico.
- `assertion` no modo `verify-existing`: é bug de produto. Devolva ao QA para abrir o defeito; não mexa no teste.

## O que o G3 exige do ATDD

Modo confirmado pelo QA; no `red-first`, prova vermelha oficial (runner `qa-atdd`, typecheck verde, evidência em disco, falha por `expect()` em `Then`) que terminou antes de a verde começar; execução final verde, oficial, do mesmo `run-id` e sobre os testes atuais; todos os cenários selecionados com teste `@Sxx`; manifestos íntegros (hash igual ao registrado); cadeia de custódia dos testes sem mudança, ou com ack do QA.

## O que isso não garante

Esses controles pegam atalho e erro, não adulteração deliberada: quem tem escrita no repositório poderia forjar manifestos e estado. A defesa final é o G3 humano e o CI, que deve rodar o card com o runner oficial. Os arquivos do framework (`shared/`, reporter, `playwright.config.ts`) são do time: mudanças neles entram em PR própria e aprovada **antes** de um card usar ATDD; um card nunca as inclui.

## Demonstrar

Ao fechar, apresente: critérios aprovados no G1, o vermelho inicial, o verde final e as evidências por passo (`PASS/` e `FAIL/`). Se sobrar tempo, o QA complementa com teste exploratório: critério de aceite não cobre tudo.

## Armadilhas

- Escrever o teste depois de o código existir e chamar de ATDD.
- Vermelho por seletor errado ou passo vazio, que não prova nada.
- Assertion genérica (`toBeVisible` em algo que sempre existe) que passa sem a funcionalidade.
- Relaxar assertion ou mudar o critério para ficar verde.
- Dev rodar com run-id oficial e poluir a evidência.
- Automatizar tudo: só os cenários que o QA marcou como `automatizar`.
