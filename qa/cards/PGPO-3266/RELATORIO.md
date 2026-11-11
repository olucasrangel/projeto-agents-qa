# Relatório de execução — PGPO-3266
[NFS-e] Solicitar a 2ª via e confirmar/editar o e-mail de destino

- Ambiente: AVA em hml, `https://infoprod.stage.platosedu.io/v2/lms` (o relatório automático mostra a URL do ERP porque é a `baseURL` do Playwright; os testes deste card navegam no AVA)
- Run oficial: `run-2026-11-11-03`, fase `green`, modo ATDD `verify-existing` (confirmado por Victor Lance)
- Comando: `npm run qa:atdd -- run PGPO-3266 --phase green --run-id run-2026-11-11-03`
- Resultado: 15 de 15 cenários passaram; typecheck verde
- Usuários: alunos de teste `LMS_HML_USERNAME_1`, `_2` e `_3`, fornecidos pelo time de QA (lidos do `.env`, nunca versionados)

## Por que `verify-existing`
A 2ª via de NFS-e já está entregue no hml: serviço, competência, e-mail de destino, modal de atualização e criação da solicitação funcionam. Nenhum cenário nasceria vermelho de forma legítima. O modo é único por card.

## Resultado por cenário
| Cenário | Resultado | Usuário | Cria registro no hml |
|---|---|---|---|
| S02 Autosserviço aparece com o serviço ligado | PASS | _1 | não |
| S04 Envio bloqueado sem competência | PASS | _1 | não |
| S05 E-mail vem preenchido e é editável | PASS | _1 | não |
| S06 Tela informa o e-mail de destino | PASS | _1 | não |
| S07 E-mail inválido bloqueia sem abrir o modal | PASS | _1 | não |
| S08 E-mail do cadastro cria a solicitação sem modal | PASS | _3 | sim |
| S09 E-mail diferente abre o modal com o e-mail digitado | PASS | _1 | não |
| S10 Manter e-mail antigo cria a solicitação sem alterar o cadastro | PASS | _3 | sim |
| S12 Fechar o modal cancela o envio | PASS | _1 | não |
| S14 Confirmação "Solicitação enviada" | PASS | _3 | sim |
| S15 Solicitação gravada com competência, e-mail e status | PASS | _3 | sim |
| S17 Botão de envio desabilitado durante o envio | PASS | _3 | sim |
| S18 Segunda solicitação em processamento é bloqueada (HTTP 409) | PASS | _2 | não (bloqueada) |
| S19 Nova solicitação para competência concluída | PASS | _3 | sim |
| S20 E-mail com espaços e maiúsculas = e-mail do cadastro (VPOS-T2212) | PASS | _3 | sim |

Cenários não automatizados, decisão `automatizar-depois` em `<CARD>-APROVACOES.md`:
- S01: precisa de aluno em tenant com o serviço desligado.
- S03: não há como saber, pela interface, quais competências são faturadas.
- S11: altera o e-mail de um usuário compartilhado e exige aluno com várias matrículas e conferência por API.
- S21: nenhum usuário tem solicitação com falha, e a falha não pode ser forçada.

Cenários `bloqueado`: S13 (falha da fila) e S16 (outbox) não são observáveis pela interface.

## Registros criados no ambiente
Cada execução completa cria 8 solicitações de 2ª via de NFS-e para o aluno `_3` (S08, S10, S14, S15, S17, S20 e 2 no S19). Todas concluem sozinhas. O aluno `_3` acumula essas solicitações de teste, e as explorações manuais também criaram algumas. Nenhum e-mail de cadastro foi alterado: toda escrita fora da criação da solicitação é abortada pelo `AvaNfsePage` e conta como falha.

## Pontos para o time
- **S17, botão de cancelamento:** a tela não tem botão de cancelar. O teste confere que o botão "Enviar solicitação" fica desabilitado durante o envio e que nenhuma ação de cancelar está habilitada. Se o critério de aceite previa um botão de cancelar, falta definir onde ele deveria aparecer.
- **S05, e-mail do cadastro:** o teste confere o valor pré-preenchido (formato válido e editável), sem comparar com outra fonte do cadastro.
- **S12 e S10, cadastro não alterado:** é conferido por nenhuma escrita além da criação ter sido tentada e pelo e-mail pré-preenchido voltar igual ao reabrir a tela.
- **S18 depende de massa:** usa uma solicitação do aluno `_2` que está "Em processamento" há dias. Se ela for concluída, o teste falha por falta de massa, não por defeito.
- **S19 e fila:** o teste cria a própria massa (uma solicitação numa competência que nenhum outro teste usa) e espera ela concluir, até 4 min, antes de enviar de novo. O processamento no hml leva de segundos a minutos.
- **Tour guiado:** a tela abre um tour que intercepta cliques. Os testes o escondem por CSS (remover os nós do DOM derruba o React com "Application error").
- **Execução remota:** `remote_test_execution` passou a `true` no `qa-project.yaml`, restrito ao AVA em hml.

## Rastreabilidade com o Zephyr
Os testes dos cenários S02 a S19 levam a tag `@VPOS-T…` do caso do time correspondente (a referência `Candidato` do `.feature`), só para ligar a evidência ao caso. Os casos do time não são alterados. S20 e S21 usam os casos do agente (VPOS-T2212 e VPOS-T2213).

## Zephyr
- Pasta do agente: `PGPO-3266 - [NFS-e] Solicitar a 2ª via e confirmar-editar o e-mail de destino - AUT` (id 61718487).
- VPOS-T2212 e VPOS-T2213, em Draft, renomeados e com objetivo próprio.
- Os 19 casos do time (VPOS-T2097 a T2115) não foram tocados.

## Evidências
- `evidence/PGPO-3266/run-2026-11-11-03/` (fica fora do Git: os prints mostram o e-mail dos alunos de teste)
- Manifesto e `execution.md`: `qa/approvals/PGPO-3266/executions/run-2026-11-11-03/`
