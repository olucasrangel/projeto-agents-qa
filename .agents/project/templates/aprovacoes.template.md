# Aprovações — {CARD}

> **Este é o único arquivo que o QA preenche.** Toda decisão é uma marca: troque `[ ]` por `[x]` na opção escolhida. Só o nome do aprovador e as observações são texto.
> O agente valida, registra o gate e nunca marca nada por você.
> Para saber o que falta marcar agora: `npm run qa:approvals -- status {CARD}`

## Aprovador

- **Nome:** 

## 1. G1 — BDD

Leia: `qa/cards/{CARD}/bdd/{CARD}-review.md`

Decisão (marque uma):

- [ ] Aprovar todos os cenários
- [ ] Aprovar parcialmente
- [ ] Solicitar ajustes

Na aprovação parcial, marque "Aprovado no G1" nos cenários aprovados (seção 3).

Pendências do review (marque uma opção em cada):

<!-- sync:pendencias:start -->
<!-- sync:pendencias:end -->

## 2. G2 — Plano do Zephyr

Leia: `qa/cards/{CARD}/zephyr/zephyr-sync-payload.json`

Marque "Publicar no Zephyr" nos cenários que vão para o Zephyr (seção 3).

- [ ] Aprovo o plano do Zephyr
- [ ] Autorizo a escrita no Zephyr (criar os casos do agente, em Draft, na pasta com sufixo AUT)

## 3. Automação

Modo ATDD (marque um):

- [ ] red-first — a funcionalidade ainda não foi entregue; o teste vem antes
- [ ] verify-existing — a funcionalidade já existe em stage

Motivo (verify-existing): 

Decisão por cenário. Cada cenário abaixo traz todas as opções: marque o `[x]` da escolhida.

<!-- sync:cenarios:start -->
<!-- sync:cenarios:end -->

## 4. G3 — Execução e entrega

O agente informa abaixo a execução em análise (Run-id); você só marca a aprovação.

Run-id: 

- [ ] Aprovo a execução e a entrega
