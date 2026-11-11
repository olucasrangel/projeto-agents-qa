# Execução run-2026-11-11-02 — PGPO-3266

- Projeto: erp-academico
- Ambiente: https://infoprod.stage.platosedu.io/erp-academico
- Resultado: failed
- Typecheck: passed
- Fase ATDD: green
- Ciclo Zephyr: não criado (dry-run)

| Cenário | Chave VPOS | Resultado | Screenshot |
|---|---|---|---|
| [PGPO-3266][Web][Sucesso] Validar que o autosserviço aparece com o serviço ligado no tenant | VPOS-T2098 | PASS | PASS/VPOS-T2098__pgpo-3266-web-sucesso-validar-que-o-autosservico-aparece-com-o-servico-ligado-no__r0.png |
| [PGPO-3266][Web][Falha] Validar que o envio é bloqueado sem competência selecionada | VPOS-T2100 | PASS | PASS/VPOS-T2100__pgpo-3266-web-falha-validar-que-o-envio-e-bloqueado-sem-competencia-selecionada__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que o campo de e-mail vem preenchido com o e-mail do cadastro e pode ser editado | VPOS-T2101 | PASS | PASS/VPOS-T2101__pgpo-3266-web-sucesso-validar-que-o-campo-de-e-mail-vem-preenchido-com-o-e-mail-__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que a tela informa para qual e-mail a nota será enviada | VPOS-T2102 | PASS | PASS/VPOS-T2102__pgpo-3266-web-sucesso-validar-que-a-tela-informa-para-qual-e-mail-a-nota-sera-en__r0.png |
| [PGPO-3266][Web][Falha] Validar que e-mail em formato inválido bloqueia o envio sem abrir o modal | VPOS-T2103 | PASS | PASS/VPOS-T2103__pgpo-3266-web-falha-validar-que-e-mail-em-formato-invalido-bloqueia-o-envio-sem-__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que o envio com o e-mail do cadastro cria a solicitação sem abrir o modal | VPOS-T2104 | PASS | PASS/VPOS-T2104__pgpo-3266-web-sucesso-validar-que-o-envio-com-o-e-mail-do-cadastro-cria-a-solici__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que alterar o e-mail abre o modal de atualização com o e-mail digitado | VPOS-T2105 | PASS | PASS/VPOS-T2105__pgpo-3266-web-sucesso-validar-que-alterar-o-e-mail-abre-o-modal-de-atualizacao-c__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que manter o e-mail antigo cria a solicitação sem alterar o cadastro | VPOS-T2106 | PASS | PASS/VPOS-T2106__pgpo-3266-web-sucesso-validar-que-manter-o-e-mail-antigo-cria-a-solicitacao-sem-__r0.png |
| [PGPO-3266][Web][Falha] Validar que fechar o modal sem escolher uma opção cancela o envio | VPOS-T2108 | PASS | PASS/VPOS-T2108__pgpo-3266-web-falha-validar-que-fechar-o-modal-sem-escolher-uma-opcao-cancela-o-__r0.png |
| [PGPO-3266][Web][Sucesso] Validar a confirmação "Solicitação enviada" após o envio | VPOS-T2110 | PASS | PASS/VPOS-T2110__pgpo-3266-web-sucesso-validar-a-confirmacao-solicitacao-enviada-apos-o-envio__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que a solicitação é gravada com a competência e o e-mail de destino | VPOS-T2111 | PASS | PASS/VPOS-T2111__pgpo-3266-web-sucesso-validar-que-a-solicitacao-e-gravada-com-a-competencia-e-o-__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que os botões ficam desabilitados durante o envio | VPOS-T2113 | PASS | PASS/VPOS-T2113__pgpo-3266-web-sucesso-validar-que-os-botoes-ficam-desabilitados-durante-o-envio__r0.png |
| [PGPO-3266][Web][Falha] Validar que a segunda solicitação em processamento para a mesma competência é bloqueada | VPOS-T2114 | PASS | PASS/VPOS-T2114__pgpo-3266-web-falha-validar-que-a-segunda-solicitacao-em-processamento-para-a-me__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que nova solicitação é permitida para competência já concluída com sucesso | VPOS-T2115 | FAIL | FAIL/VPOS-T2115__pgpo-3266-web-sucesso-validar-que-nova-solicitacao-e-permitida-para-competencia-__r0.png |
| [PGPO-3266][Web][Sucesso] Validar que o e-mail digitado com espaços nas pontas e maiúsculas é tratado como o e-mail do cadastro | VPOS-T2212 | PASS | PASS/VPOS-T2212__pgpo-3266-web-sucesso-validar-que-o-e-mail-digitado-com-espacos-nas-pontas-e-mai__r0.png |

## Passos

### [PGPO-3266][Web][Sucesso] Validar que o autosserviço aparece com o serviço ligado no tenant

- 01 PASS — Given o serviço de 2ª via de NFS-e está ligado no tenant do aluno (PASS/VPOS-T2098__pgpo-3266-web-sucesso-validar-que-o-autosservico-aparece-com-o-servico-ligado-no__r0__01-given-o-servico-de-2-via-de-nfs-e-esta-ligado-no-tenant-do-aluno.png)
- 02 PASS — When o aluno acessa a lista de autosserviços (PASS/VPOS-T2098__pgpo-3266-web-sucesso-validar-que-o-autosservico-aparece-com-o-servico-ligado-no__r0__02-when-o-aluno-acessa-a-lista-de-autosservicos.png)
- 03 PASS — Then o autosserviço de 2ª via de NFS-e é exibido (PASS/VPOS-T2098__pgpo-3266-web-sucesso-validar-que-o-autosservico-aparece-com-o-servico-ligado-no__r0__03-then-o-autosservico-de-2-via-de-nfs-e-e-exibido.png)

### [PGPO-3266][Web][Falha] Validar que o envio é bloqueado sem competência selecionada

- 01 PASS — Given o aluno está na tela de 2ª via de NFS-e sem competência selecionada (PASS/VPOS-T2100__pgpo-3266-web-falha-validar-que-o-envio-e-bloqueado-sem-competencia-selecionada__r0__01-given-o-aluno-esta-na-tela-de-2-via-de-nfs-e-sem-competencia-selecionada.png)
- 02 PASS — When o aluno clica em "Enviar Solicitação" (PASS/VPOS-T2100__pgpo-3266-web-falha-validar-que-o-envio-e-bloqueado-sem-competencia-selecionada__r0__02-when-o-aluno-clica-em-enviar-solicitacao.png)
- 03 PASS — Then a solicitação não é criada (PASS/VPOS-T2100__pgpo-3266-web-falha-validar-que-o-envio-e-bloqueado-sem-competencia-selecionada__r0__03-then-a-solicitacao-nao-e-criada.png)
- 04 PASS — And o sistema exige a escolha de mês e ano de competência (PASS/VPOS-T2100__pgpo-3266-web-falha-validar-que-o-envio-e-bloqueado-sem-competencia-selecionada__r0__04-and-o-sistema-exige-a-escolha-de-mes-e-ano-de-competencia.png)

### [PGPO-3266][Web][Sucesso] Validar que o campo de e-mail vem preenchido com o e-mail do cadastro e pode ser editado

- 01 PASS — Given o aluno possui um e-mail cadastrado (PASS/VPOS-T2101__pgpo-3266-web-sucesso-validar-que-o-campo-de-e-mail-vem-preenchido-com-o-e-mail-__r0__01-given-o-aluno-possui-um-e-mail-cadastrado.png)
- 02 PASS — When o aluno abre a tela de 2ª via de NFS-e (PASS/VPOS-T2101__pgpo-3266-web-sucesso-validar-que-o-campo-de-e-mail-vem-preenchido-com-o-e-mail-__r0__02-when-o-aluno-abre-a-tela-de-2-via-de-nfs-e.png)
- 03 PASS — Then o campo de e-mail exibe o e-mail atual do cadastro (PASS/VPOS-T2101__pgpo-3266-web-sucesso-validar-que-o-campo-de-e-mail-vem-preenchido-com-o-e-mail-__r0__03-then-o-campo-de-e-mail-exibe-o-e-mail-atual-do-cadastro.png)
- 04 PASS — And o campo de e-mail permite edição (PASS/VPOS-T2101__pgpo-3266-web-sucesso-validar-que-o-campo-de-e-mail-vem-preenchido-com-o-e-mail-__r0__04-and-o-campo-de-e-mail-permite-edicao.png)

### [PGPO-3266][Web][Sucesso] Validar que a tela informa para qual e-mail a nota será enviada

- 01 PASS — Given o aluno está na tela de 2ª via de NFS-e com um e-mail no campo (PASS/VPOS-T2102__pgpo-3266-web-sucesso-validar-que-a-tela-informa-para-qual-e-mail-a-nota-sera-en__r0__01-given-o-aluno-esta-na-tela-de-2-via-de-nfs-e-com-um-e-mail-no-campo.png)
- 02 PASS — When o aluno visualiza o formulário (PASS/VPOS-T2102__pgpo-3266-web-sucesso-validar-que-a-tela-informa-para-qual-e-mail-a-nota-sera-en__r0__02-when-o-aluno-visualiza-o-formulario.png)
- 03 PASS — Then a tela informa que a nota será enviada para o e-mail do campo (PASS/VPOS-T2102__pgpo-3266-web-sucesso-validar-que-a-tela-informa-para-qual-e-mail-a-nota-sera-en__r0__03-then-a-tela-informa-que-a-nota-sera-enviada-para-o-e-mail-do-campo.png)

### [PGPO-3266][Web][Falha] Validar que e-mail em formato inválido bloqueia o envio sem abrir o modal

- 01 PASS — Given o aluno informou uma competência (PASS/VPOS-T2103__pgpo-3266-web-falha-validar-que-e-mail-em-formato-invalido-bloqueia-o-envio-sem-__r0__01-given-o-aluno-informou-uma-competencia.png)
- 02 PASS — And o aluno informou um e-mail em formato inválido (PASS/VPOS-T2103__pgpo-3266-web-falha-validar-que-e-mail-em-formato-invalido-bloqueia-o-envio-sem-__r0__02-and-o-aluno-informou-um-e-mail-em-formato-invalido.png)
- 03 PASS — When o aluno clica em "Enviar Solicitação" (PASS/VPOS-T2103__pgpo-3266-web-falha-validar-que-e-mail-em-formato-invalido-bloqueia-o-envio-sem-__r0__03-when-o-aluno-clica-em-enviar-solicitacao.png)
- 04 PASS — Then o modal de atualização de e-mail não é exibido (PASS/VPOS-T2103__pgpo-3266-web-falha-validar-que-e-mail-em-formato-invalido-bloqueia-o-envio-sem-__r0__04-then-o-modal-de-atualizacao-de-e-mail-nao-e-exibido.png)
- 05 PASS — And nenhuma solicitação é criada (PASS/VPOS-T2103__pgpo-3266-web-falha-validar-que-e-mail-em-formato-invalido-bloqueia-o-envio-sem-__r0__05-and-nenhuma-solicitacao-e-criada.png)
- 06 PASS — And o cadastro do aluno não é alterado (PASS/VPOS-T2103__pgpo-3266-web-falha-validar-que-e-mail-em-formato-invalido-bloqueia-o-envio-sem-__r0__06-and-o-cadastro-do-aluno-nao-e-alterado.png)

### [PGPO-3266][Web][Sucesso] Validar que o envio com o e-mail do cadastro cria a solicitação sem abrir o modal

- 01 PASS — Given o aluno informou uma competência (PASS/VPOS-T2104__pgpo-3266-web-sucesso-validar-que-o-envio-com-o-e-mail-do-cadastro-cria-a-solici__r0__01-given-o-aluno-informou-uma-competencia.png)
- 02 PASS — And o e-mail do campo é igual ao e-mail atual do cadastro (PASS/VPOS-T2104__pgpo-3266-web-sucesso-validar-que-o-envio-com-o-e-mail-do-cadastro-cria-a-solici__r0__02-and-o-e-mail-do-campo-e-igual-ao-e-mail-atual-do-cadastro.png)
- 03 PASS — When o aluno clica em "Enviar Solicitação" (PASS/VPOS-T2104__pgpo-3266-web-sucesso-validar-que-o-envio-com-o-e-mail-do-cadastro-cria-a-solici__r0__03-when-o-aluno-clica-em-enviar-solicitacao.png)
- 04 PASS — Then a solicitação é criada sem exibir o modal de atualização (PASS/VPOS-T2104__pgpo-3266-web-sucesso-validar-que-o-envio-com-o-e-mail-do-cadastro-cria-a-solici__r0__04-then-a-solicitacao-e-criada-sem-exibir-o-modal-de-atualizacao.png)
- 05 PASS — And o cadastro do aluno não é alterado (PASS/VPOS-T2104__pgpo-3266-web-sucesso-validar-que-o-envio-com-o-e-mail-do-cadastro-cria-a-solici__r0__05-and-o-cadastro-do-aluno-nao-e-alterado.png)

### [PGPO-3266][Web][Sucesso] Validar que alterar o e-mail abre o modal de atualização com o e-mail digitado

- 01 PASS — Given o aluno informou uma competência (PASS/VPOS-T2105__pgpo-3266-web-sucesso-validar-que-alterar-o-e-mail-abre-o-modal-de-atualizacao-c__r0__01-given-o-aluno-informou-uma-competencia.png)
- 02 PASS — And o e-mail do campo é diferente do e-mail atual do cadastro (PASS/VPOS-T2105__pgpo-3266-web-sucesso-validar-que-alterar-o-e-mail-abre-o-modal-de-atualizacao-c__r0__02-and-o-e-mail-do-campo-e-diferente-do-e-mail-atual-do-cadastro.png)
- 03 PASS — When o aluno clica em "Enviar Solicitação" (PASS/VPOS-T2105__pgpo-3266-web-sucesso-validar-que-alterar-o-e-mail-abre-o-modal-de-atualizacao-c__r0__03-when-o-aluno-clica-em-enviar-solicitacao.png)
- 04 PASS — Then o modal "Você deseja atualizar seu e-mail?" é exibido (PASS/VPOS-T2105__pgpo-3266-web-sucesso-validar-que-alterar-o-e-mail-abre-o-modal-de-atualizacao-c__r0__04-then-o-modal-voce-deseja-atualizar-seu-e-mail-e-exibido.png)
- 05 PASS — And o modal mostra o e-mail digitado (PASS/VPOS-T2105__pgpo-3266-web-sucesso-validar-que-alterar-o-e-mail-abre-o-modal-de-atualizacao-c__r0__05-and-o-modal-mostra-o-e-mail-digitado.png)

### [PGPO-3266][Web][Sucesso] Validar que manter o e-mail antigo cria a solicitação sem alterar o cadastro

- 01 PASS — Given o modal de atualização está aberto com um e-mail diferente do cadastro (PASS/VPOS-T2106__pgpo-3266-web-sucesso-validar-que-manter-o-e-mail-antigo-cria-a-solicitacao-sem-__r0__01-given-o-modal-de-atualizacao-esta-aberto-com-um-e-mail-diferente-do-cadastro.png)
- 02 PASS — When o aluno escolhe "Manter e-mail antigo" (PASS/VPOS-T2106__pgpo-3266-web-sucesso-validar-que-manter-o-e-mail-antigo-cria-a-solicitacao-sem-__r0__02-when-o-aluno-escolhe-manter-e-mail-antigo.png)
- 03 PASS — Then a solicitação é criada com o e-mail digitado como destino (PASS/VPOS-T2106__pgpo-3266-web-sucesso-validar-que-manter-o-e-mail-antigo-cria-a-solicitacao-sem-__r0__03-then-a-solicitacao-e-criada-com-o-e-mail-digitado-como-destino.png)
- 04 PASS — And o e-mail do cadastro da pessoa não é alterado (PASS/VPOS-T2106__pgpo-3266-web-sucesso-validar-que-manter-o-e-mail-antigo-cria-a-solicitacao-sem-__r0__04-and-o-e-mail-do-cadastro-da-pessoa-nao-e-alterado.png)
- 05 PASS — And o e-mail das matrículas não é alterado (PASS/VPOS-T2106__pgpo-3266-web-sucesso-validar-que-manter-o-e-mail-antigo-cria-a-solicitacao-sem-__r0__05-and-o-e-mail-das-matriculas-nao-e-alterado.png)

### [PGPO-3266][Web][Falha] Validar que fechar o modal sem escolher uma opção cancela o envio

- 01 PASS — Given o modal de atualização de e-mail está aberto (PASS/VPOS-T2108__pgpo-3266-web-falha-validar-que-fechar-o-modal-sem-escolher-uma-opcao-cancela-o-__r0__01-given-o-modal-de-atualizacao-de-e-mail-esta-aberto.png)
- 02 PASS — When o aluno fecha o modal sem escolher uma opção (PASS/VPOS-T2108__pgpo-3266-web-falha-validar-que-fechar-o-modal-sem-escolher-uma-opcao-cancela-o-__r0__02-when-o-aluno-fecha-o-modal-sem-escolher-uma-opcao.png)
- 03 PASS — Then nenhuma solicitação é criada (PASS/VPOS-T2108__pgpo-3266-web-falha-validar-que-fechar-o-modal-sem-escolher-uma-opcao-cancela-o-__r0__03-then-nenhuma-solicitacao-e-criada.png)
- 04 PASS — And o cadastro do aluno não é alterado (PASS/VPOS-T2108__pgpo-3266-web-falha-validar-que-fechar-o-modal-sem-escolher-uma-opcao-cancela-o-__r0__04-and-o-cadastro-do-aluno-nao-e-alterado.png)
- 05 PASS — And o aluno permanece na tela de 2ª via com os dados preenchidos (PASS/VPOS-T2108__pgpo-3266-web-falha-validar-que-fechar-o-modal-sem-escolher-uma-opcao-cancela-o-__r0__05-and-o-aluno-permanece-na-tela-de-2-via-com-os-dados-preenchidos.png)

### [PGPO-3266][Web][Sucesso] Validar a confirmação "Solicitação enviada" após o envio

- 01 PASS — Given a solicitação foi criada com sucesso (PASS/VPOS-T2110__pgpo-3266-web-sucesso-validar-a-confirmacao-solicitacao-enviada-apos-o-envio__r0__01-given-a-solicitacao-foi-criada-com-sucesso.png)
- 02 PASS — When o aluno conclui o envio (PASS/VPOS-T2110__pgpo-3266-web-sucesso-validar-a-confirmacao-solicitacao-enviada-apos-o-envio__r0__02-when-o-aluno-conclui-o-envio.png)
- 03 PASS — Then a tela exibe a mensagem "Solicitação enviada" (PASS/VPOS-T2110__pgpo-3266-web-sucesso-validar-a-confirmacao-solicitacao-enviada-apos-o-envio__r0__03-then-a-tela-exibe-a-mensagem-solicitacao-enviada.png)
- 04 PASS — And a tela não exibe erro de processamento (PASS/VPOS-T2110__pgpo-3266-web-sucesso-validar-a-confirmacao-solicitacao-enviada-apos-o-envio__r0__04-and-a-tela-nao-exibe-erro-de-processamento.png)

### [PGPO-3266][Web][Sucesso] Validar que a solicitação é gravada com a competência e o e-mail de destino

- 01 PASS — Given o aluno escolheu a competência 03/2026 (PASS/VPOS-T2111__pgpo-3266-web-sucesso-validar-que-a-solicitacao-e-gravada-com-a-competencia-e-o-__r0__01-given-o-aluno-escolheu-a-competencia-03-2026.png)
- 02 PASS — And o aluno informou o e-mail "nota@exemplo.com" (PASS/VPOS-T2111__pgpo-3266-web-sucesso-validar-que-a-solicitacao-e-gravada-com-a-competencia-e-o-__r0__02-and-o-aluno-informou-o-e-mail-nota-com.png)
- 03 PASS — When o aluno envia a solicitação (PASS/VPOS-T2111__pgpo-3266-web-sucesso-validar-que-a-solicitacao-e-gravada-com-a-competencia-e-o-__r0__03-when-o-aluno-envia-a-solicitacao.png)
- 04 PASS — Then a solicitação é criada com a competência 03/2026 (PASS/VPOS-T2111__pgpo-3266-web-sucesso-validar-que-a-solicitacao-e-gravada-com-a-competencia-e-o-__r0__04-then-a-solicitacao-e-criada-com-a-competencia-03-2026.png)
- 05 PASS — And a solicitação é criada com o e-mail de destino "nota@exemplo.com" (PASS/VPOS-T2111__pgpo-3266-web-sucesso-validar-que-a-solicitacao-e-gravada-com-a-competencia-e-o-__r0__05-and-a-solicitacao-e-criada-com-o-e-mail-de-destino-nota-com.png)
- 06 PASS — And a solicitação é criada com o status "Em processamento" (PASS/VPOS-T2111__pgpo-3266-web-sucesso-validar-que-a-solicitacao-e-gravada-com-a-competencia-e-o-__r0__06-and-a-solicitacao-e-criada-com-o-status-em-processamento.png)

### [PGPO-3266][Web][Sucesso] Validar que os botões ficam desabilitados durante o envio

- 01 PASS — Given o aluno clicou em "Enviar Solicitação" (PASS/VPOS-T2113__pgpo-3266-web-sucesso-validar-que-os-botoes-ficam-desabilitados-durante-o-envio__r0__01-given-o-aluno-clicou-em-enviar-solicitacao.png)
- 02 PASS — When a solicitação está sendo processada (PASS/VPOS-T2113__pgpo-3266-web-sucesso-validar-que-os-botoes-ficam-desabilitados-durante-o-envio__r0__02-when-a-solicitacao-esta-sendo-processada.png)
- 03 PASS — Then o botão "Enviar Solicitação" fica desabilitado (PASS/VPOS-T2113__pgpo-3266-web-sucesso-validar-que-os-botoes-ficam-desabilitados-durante-o-envio__r0__03-then-o-botao-enviar-solicitacao-fica-desabilitado.png)
- 04 PASS — And o botão de cancelamento fica desabilitado (PASS/VPOS-T2113__pgpo-3266-web-sucesso-validar-que-os-botoes-ficam-desabilitados-durante-o-envio__r0__04-and-o-botao-de-cancelamento-fica-desabilitado.png)

### [PGPO-3266][Web][Falha] Validar que a segunda solicitação em processamento para a mesma competência é bloqueada

- 01 PASS — Given existe uma solicitação "Em processamento" para a matrícula e a competência 03/2026 (PASS/VPOS-T2114__pgpo-3266-web-falha-validar-que-a-segunda-solicitacao-em-processamento-para-a-me__r0__01-given-existe-uma-solicitacao-em-processamento-para-a-matricula-e-a-competencia-0.png)
- 02 PASS — When o aluno tenta enviar nova solicitação para a competência 03/2026 (PASS/VPOS-T2114__pgpo-3266-web-falha-validar-que-a-segunda-solicitacao-em-processamento-para-a-me__r0__02-when-o-aluno-tenta-enviar-nova-solicitacao-para-a-competencia-03-2026.png)
- 03 PASS — Then nenhuma nova solicitação é criada (PASS/VPOS-T2114__pgpo-3266-web-falha-validar-que-a-segunda-solicitacao-em-processamento-para-a-me__r0__03-then-nenhuma-nova-solicitacao-e-criada.png)
- 04 PASS — And a tela informa que já existe uma solicitação em andamento (PASS/VPOS-T2114__pgpo-3266-web-falha-validar-que-a-segunda-solicitacao-em-processamento-para-a-me__r0__04-and-a-tela-informa-que-ja-existe-uma-solicitacao-em-andamento.png)

### [PGPO-3266][Web][Sucesso] Validar que nova solicitação é permitida para competência já concluída com sucesso

- 01 FAIL — Given existe uma solicitação concluída com sucesso para a matrícula e a competência 03/2026 (FAIL/VPOS-T2115__pgpo-3266-web-sucesso-validar-que-nova-solicitacao-e-permitida-para-competencia-__r0__01-given-existe-uma-solicitacao-concluida-com-sucesso-para-a-matricula-e-a-competen.png)

### [PGPO-3266][Web][Sucesso] Validar que o e-mail digitado com espaços nas pontas e maiúsculas é tratado como o e-mail do cadastro

- 01 PASS — Given o e-mail atual do cadastro é "aluno@exemplo.com" (PASS/VPOS-T2212__pgpo-3266-web-sucesso-validar-que-o-e-mail-digitado-com-espacos-nas-pontas-e-mai__r0__01-given-o-e-mail-atual-do-cadastro-e-aluno-com.png)
- 02 PASS — And o campo de e-mail contém " Aluno@Exemplo.com " (PASS/VPOS-T2212__pgpo-3266-web-sucesso-validar-que-o-e-mail-digitado-com-espacos-nas-pontas-e-mai__r0__02-and-o-campo-de-e-mail-contem-aluno-com.png)
- 03 PASS — When o aluno clica em "Enviar Solicitação" (PASS/VPOS-T2212__pgpo-3266-web-sucesso-validar-que-o-e-mail-digitado-com-espacos-nas-pontas-e-mai__r0__03-when-o-aluno-clica-em-enviar-solicitacao.png)
- 04 PASS — Then o modal de atualização de e-mail não é exibido (PASS/VPOS-T2212__pgpo-3266-web-sucesso-validar-que-o-e-mail-digitado-com-espacos-nas-pontas-e-mai__r0__04-then-o-modal-de-atualizacao-de-e-mail-nao-e-exibido.png)
- 05 PASS — And a solicitação é criada sem alterar o cadastro (PASS/VPOS-T2212__pgpo-3266-web-sucesso-validar-que-o-e-mail-digitado-com-espacos-nas-pontas-e-mai__r0__05-and-a-solicitacao-e-criada-sem-alterar-o-cadastro.png)
