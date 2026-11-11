# Aprovações — PGPO-3266

> **Este é o único arquivo que o QA preenche.** Toda decisão é uma marca: troque `[ ]` por `[x]` na opção escolhida. Só o nome do aprovador e as observações são texto.
> O agente valida, registra o gate e nunca marca nada por você.
> Para saber o que falta marcar agora: `npm run qa:approvals -- status PGPO-3266`

## Aprovador

- **Nome:** Victor Lance

## 1. G1 — BDD

Leia: `qa/cards/PGPO-3266/bdd/PGPO-3266-review.md`

Decisão (marque uma):

- [x] Aprovar todos os cenários
- [ ] Aprovar parcialmente
- [ ] Solicitar ajustes

Na aprovação parcial, marque "Aprovado no G1" nos cenários aprovados (seção 3).

Pendências do review (marque uma opção em cada):

<!-- sync:pendencias:start -->
### P1 — Renomear os 19 casos existentes
- [x] Aceito a proposta do review
- [ ] Não aceito (explique na observação)
Observação: não haverá renomeação. Casos do time são somente leitura; o agente cria os próprios casos (regra de propriedade).

### P2 — Precondições vazias
- [x] Aceito a proposta do review
- [ ] Não aceito (explique na observação)
Observação: os casos do time não são alterados; os casos do agente nascem com precondição (padrão do Confluence).

### P3 — Pasta dos casos novos
- [x] Aceito a proposta do review
- [ ] Não aceito (explique na observação)
Observação: pasta nova com sufixo AUT no final do nome; no Zephyr entram só os casos novos (S20 e S21). Os 21 cenários são automatizados.

### P4 — Nome da pasta
- [x] Aceito a proposta do review
- [ ] Não aceito (explique na observação)
Observação: `PGPO-3266 - [NFS-e] Solicitar a 2ª via e confirmar/editar o e-mail de destino - AUT`, conforme o nome completo do card no Jira. A pasta do time não é tocada.

### P5 — Palavras-chave do Gherkin
- [x] Aceito a proposta do review
- [ ] Não aceito (explique na observação)
Observação: `Feature/Scenario/Given/When/Then`, com texto de negócio em pt-BR, confirmado pelo QA.

### P6 — Criticidade
- [x] Aceito a proposta do review
- [ ] Não aceito (explique na observação)
Observação: 

### P7 — Ambiente de execução
- [x] Aceito a proposta do review
- [ ] Não aceito (explique na observação)
Observação: 

<!-- sync:pendencias:end -->

## 2. G2 — Plano do Zephyr

Leia: `qa/cards/PGPO-3266/zephyr/zephyr-sync-payload.json`

Marque "Publicar no Zephyr" nos cenários que vão para o Zephyr (seção 3).

- [x] Aprovo o plano do Zephyr
- [x] Autorizo a escrita no Zephyr (criar os casos do agente, em Draft, na pasta com sufixo AUT)

## 3. Automação

Modo ATDD (marque um):

- [ ] red-first — a funcionalidade ainda não foi entregue; o teste vem antes
- [x] verify-existing — a funcionalidade já existe em stage

Motivo (verify-existing): A 2ª via de NFS-e já está entregue no hml: o serviço aparece em Autosserviços (serviço, competência, e-mail de destino e botão de envio). O modo é único por card; S13 e S16 não existem como UI e ficam bloqueados.

Decisão por cenário. Cada cenário abaixo traz todas as opções: marque o `[x]` da escolhida.

<!-- sync:cenarios:start -->
### S01 — Validar que o autosserviço não aparece com o serviço desligado no tenant
Sugestão do agente: automatizar-depois: precisa de aluno em tenant com o serviço desligado

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [ ] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [x] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): precisa de aluno em tenant com o serviço desligado; os usuários do .env têm o serviço ligado

### S02 — Validar que o autosserviço aparece com o serviço ligado no tenant
Sugestão do agente: automatizar-depois: precisa de aluno em tenant com o serviço ligado

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S03 — Validar que as competências exibidas são as faturadas do aluno, sem limite de histórico
Sugestão do agente: automatizar-depois: precisa de competências faturadas em anos anteriores

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [ ] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [x] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): não há como saber pela interface quais competências são faturadas, nem aluno com histórico faturado conhecido

### S04 — Validar que o envio é bloqueado sem competência selecionada
Sugestão do agente: automatizar: só interface, sem massa especial

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S05 — Validar que o campo de e-mail vem preenchido com o e-mail do cadastro e pode ser editado
Sugestão do agente: automatizar: só interface

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S06 — Validar que a tela informa para qual e-mail a nota será enviada
Sugestão do agente: automatizar: só interface

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S07 — Validar que e-mail em formato inválido bloqueia o envio sem abrir o modal
Sugestão do agente: automatizar: interface; conferir que o cadastro não mudou

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S08 — Validar que o envio com o e-mail do cadastro cria a solicitação sem abrir o modal
Sugestão do agente: automatizar: interface; conferir que o cadastro não mudou

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S09 — Validar que alterar o e-mail abre o modal de atualização com o e-mail digitado
Sugestão do agente: automatizar: só interface (modal)

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S10 — Validar que manter o e-mail antigo cria a solicitação sem alterar o cadastro
Sugestão do agente: automatizar: interface; conferir que o cadastro não mudou

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S11 — Validar que atualizar o e-mail propaga o novo e-mail para a pessoa e todas as matrículas
Sugestão do agente: automatizar-depois: precisa de aluno com várias matrículas e conferência por API

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [ ] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [x] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): altera o e-mail do cadastro de um usuário compartilhado e exige aluno com várias matrículas e conferência por API

### S12 — Validar que fechar o modal sem escolher uma opção cancela o envio
Sugestão do agente: automatizar: só interface (modal)

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S13 — Validar que o cadastro não muda quando a solicitação não é criada
Sugestão do agente: bloqueado: exige forçar falha na fila, impossível pela interface

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [ ] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [x] bloqueado — não dá para automatizar agora
Justificativa (opcional): sem UI: exige forçar falha na fila; ficaria fora de qualquer modo ATDD

### S14 — Validar a confirmação "Solicitação enviada" após o envio
Sugestão do agente: automatizar: só interface

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S15 — Validar que a solicitação é gravada com a competência e o e-mail de destino
Sugestão do agente: automatizar-depois: exige conferência do registro por API

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S16 — Validar que o envio publica a solicitação na fila de processamento
Sugestão do agente: manter-manual: linha na outbox não é observável pela interface

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [ ] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [x] bloqueado — não dá para automatizar agora
Justificativa (opcional): sem UI: linha na outbox não é observável pela interface

### S17 — Validar que os botões ficam desabilitados durante o envio
Sugestão do agente: automatizar: interface com envio lento simulado

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S18 — Validar que a segunda solicitação em processamento para a mesma competência é bloqueada
Sugestão do agente: automatizar-depois: precisa de solicitação já em processamento

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S19 — Validar que nova solicitação é permitida para competência já concluída com sucesso
Sugestão do agente: automatizar-depois: precisa de solicitação já concluída

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [ ] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S20 — Validar que o e-mail digitado com espaços nas pontas e maiúsculas é tratado como o e-mail do ca
Sugestão do agente: automatizar: só interface (e-mail com espaços e maiúsculas)

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [x] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [x] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [ ] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): 

### S21 — Validar que é possível solicitar novamente a competência cuja solicitação anterior terminou com
Sugestão do agente: automatizar-depois: precisa de solicitação com falha anterior

- [x] Aprovado no G1 (só vale na aprovação parcial)
- [x] Publicar no Zephyr (criar o caso do agente em Draft, na pasta com sufixo AUT)

Decisão de automação (marque uma):
- [ ] automatizar — o agente cria o teste de aceite
- [ ] manter-manual — continua como teste manual
- [x] automatizar-depois — fica para outra rodada (falta massa ou acesso)
- [ ] não-aplicável — não se aplica a esta entrega
- [ ] bloqueado — não dá para automatizar agora
Justificativa (opcional): nenhum usuário do .env tem solicitação com falha; sem massa nem como forçar a falha

<!-- sync:cenarios:end -->

## 4. G3 — Execução e entrega

O agente informa abaixo a execução em análise (Run-id); você só marca a aprovação.

Run-id: run-2026-11-11-03

- [x] Aprovo a execução e a entrega
