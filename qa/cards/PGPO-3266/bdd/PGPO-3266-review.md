# Revisão BDD — PGPO-3266

- **Card:** [NFS-e] Solicitar a 2ª via e confirmar/editar o e-mail de destino
- **Épico:** PGPO-3284 · **Sprint:** SP 26.4.3 · **Módulo:** NFS-e (autosserviço do aluno)
- **Projeto Zephyr:** VPOS · **Pasta existente:** PI 26.4 › SP 26.4.3 › PGPO-3266
- **Modo:** dry-run. Nada foi publicado no Zephyr nem executado no ambiente.
- **Fonte técnica:** `qa/cards/PGPO-3266/bdd/nfse/PGPO-3266.feature`
- **Plano de publicação:** `qa/cards/PGPO-3266/zephyr/zephyr-dry-run.json`

## Resumo

O Zephyr já tem 19 casos para este card (VPOS-T2097 a VPOS-T2115), e todos cobrem o comportamento proposto. A revisão propõe **atualizar os 19** para o padrão do Confluence (nome `[Chave][Web][Sucesso/Falha]`, precondição preenchida) e **criar 2 cenários** que não têm caso equivalente.

| # | Cenário | Operação | Caso VPOS | Prioridade | Criticidade |
|---|---|---|---|---|---|
| S01 | Autosserviço não aparece com o serviço desligado no tenant | atualizar | VPOS-T2097 | High | @critical |
| S02 | Autosserviço aparece com o serviço ligado no tenant | atualizar | VPOS-T2098 | Normal | @high |
| S03 | Competências são as faturadas do aluno, sem limite de histórico | atualizar | VPOS-T2099 | Normal | @high |
| S04 | Envio bloqueado sem competência selecionada | atualizar | VPOS-T2100 | High | @critical |
| S05 | Campo de e-mail pré-preenchido e editável | atualizar | VPOS-T2101 | Normal | @high |
| S06 | Tela informa para qual e-mail a nota será enviada | atualizar | VPOS-T2102 | Normal | @high |
| S07 | E-mail inválido bloqueia o envio sem abrir o modal | atualizar | VPOS-T2103 | High | @critical |
| S08 | E-mail do cadastro cria a solicitação sem modal | atualizar | VPOS-T2104 | High | @critical |
| S09 | E-mail diferente abre o modal de atualização | atualizar | VPOS-T2105 | High | @critical |
| S10 | Manter e-mail antigo não altera o cadastro | atualizar | VPOS-T2106 | High | @critical |
| S11 | Atualizar e-mail propaga para pessoa e todas as matrículas | atualizar | VPOS-T2107 | High | @critical |
| S12 | Fechar o modal cancela o envio | atualizar | VPOS-T2108 | Normal | @high |
| S13 | Cadastro não muda quando a solicitação não é criada | atualizar | VPOS-T2109 | High | @critical |
| S14 | Confirmação "Solicitação enviada" | atualizar | VPOS-T2110 | Normal | @high |
| S15 | Solicitação gravada com competência e e-mail de destino | atualizar | VPOS-T2111 | High | @critical |
| S16 | Envio publica a solicitação na fila de processamento | atualizar | VPOS-T2112 | High | @critical |
| S17 | Botões desabilitados durante o envio | atualizar | VPOS-T2113 | Normal | @high |
| S18 | Segunda solicitação em processamento para a mesma competência é bloqueada | atualizar | VPOS-T2114 | High | @critical |
| S19 | Nova solicitação permitida após conclusão com sucesso | atualizar | VPOS-T2115 | High | @critical |
| S20 | Comparação do e-mail ignora espaços e maiúsculas (RN06) | **criar** | novo | High | @critical |
| S21 | Nova solicitação permitida após falha anterior (RN14) | **criar** | novo | High | @critical |

Mapeamento de prioridade: High ↔ @critical, Normal ↔ @high, Low ↔ @medium (`zephyr.priorities` em `qa-project.yaml`).

## Pontos para decidir antes do G1

1. **Renomear os 19 casos existentes.** Hoje eles têm o formato `TC01 - ...`, sem chave da história nem tipo de aplicação. O Confluence pede `[Chave][Aplicação][Sucesso/Falha]`. Confirmar se o time aceita a renomeação.
2. **Precondições vazias.** Os 19 casos não têm precondição. A proposta preenche com os passos Dado.
3. **Pasta dos casos novos.** S20 e S21 podem ficar na pasta existente ou em uma nova `PGPO-3266 - ... (Automação)` dentro de SP 26.4.3. Recomendo a pasta nova, conforme a regra de identificar o que o agente criou.
4. **Nome da pasta.** A pasta existente diz "confirmar-editar", e o Jira diz "confirmar/editar". Confirmar qual nome manter.
5. **Palavras-chave do Gherkin.** Os casos atuais usam `Given/When/Then` em inglês com texto em português. A skill `bdd-gherkin` diz o contrário. Este pacote segue o Zephyr, porque é onde o QA trabalha.
6. **Criticidade.** Pela regra de risco, 14 cenários ficaram como @critical. Se o QA achar excesso, pode rebaixar sem mudar os passos.
7. **Ambiente de execução.** A massa (aluno com várias matrículas, tenant com serviço ligado e desligado, e competências) ainda não foi confirmada. Os cenários S11, S18, S19 e S21 dependem dela.

## Cenários

> Texto dos cenários. Cada bloco usa os nomes que serão publicados no Zephyr.

```gherkin
# language: en
@PGPO-3266
Feature: Autosserviço de 2ª via de NFS-e com e-mail de destino

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que o autosserviço não aparece com o serviço desligado no tenant
    Given o serviço de 2ª via de NFS-e está desligado no tenant do aluno
    When o aluno acessa a lista de autosserviços
    Then o autosserviço de 2ª via de NFS-e não é exibido

  @PGPO-3266 @high
  Scenario: [PGPO-3266][Web][Sucesso] Validar que o autosserviço aparece com o serviço ligado no tenant
    Given o serviço de 2ª via de NFS-e está ligado no tenant do aluno
    When o aluno acessa a lista de autosserviços
    Then o autosserviço de 2ª via de NFS-e é exibido

  @PGPO-3266 @high
  Scenario: [PGPO-3266][Web][Sucesso] Validar que as competências exibidas são as faturadas do aluno, sem limite de histórico
    Given o aluno possui competências faturadas em anos anteriores
    When o aluno abre o seletor de competência
    Then todas as competências faturadas do aluno são listadas
    And nenhuma competência não faturada é listada

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Falha] Validar que o envio é bloqueado sem competência selecionada
    Given o aluno está na tela de 2ª via de NFS-e sem competência selecionada
    When o aluno clica em "Enviar Solicitação"
    Then a solicitação não é criada
    And o sistema exige a escolha de mês e ano de competência

  @PGPO-3266 @high
  Scenario: [PGPO-3266][Web][Sucesso] Validar que o campo de e-mail vem preenchido com o e-mail do cadastro e pode ser editado
    Given o aluno possui um e-mail cadastrado
    When o aluno abre a tela de 2ª via de NFS-e
    Then o campo de e-mail exibe o e-mail atual do cadastro
    And o campo de e-mail permite edição

  @PGPO-3266 @high
  Scenario: [PGPO-3266][Web][Sucesso] Validar que a tela informa para qual e-mail a nota será enviada
    Given o aluno está na tela de 2ª via de NFS-e com um e-mail no campo
    When o aluno visualiza o formulário
    Then a tela informa que a nota será enviada para o e-mail do campo

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Falha] Validar que e-mail em formato inválido bloqueia o envio sem abrir o modal
    Given o aluno informou uma competência
    And o aluno informou um e-mail em formato inválido
    When o aluno clica em "Enviar Solicitação"
    Then o modal de atualização de e-mail não é exibido
    And nenhuma solicitação é criada
    And o cadastro do aluno não é alterado

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que o envio com o e-mail do cadastro cria a solicitação sem abrir o modal
    Given o aluno informou uma competência
    And o e-mail do campo é igual ao e-mail atual do cadastro
    When o aluno clica em "Enviar Solicitação"
    Then a solicitação é criada sem exibir o modal de atualização
    And o cadastro do aluno não é alterado

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que alterar o e-mail abre o modal de atualização com o e-mail digitado
    Given o aluno informou uma competência
    And o e-mail do campo é diferente do e-mail atual do cadastro
    When o aluno clica em "Enviar Solicitação"
    Then o modal "Você deseja atualizar seu e-mail?" é exibido
    And o modal mostra o e-mail digitado

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que manter o e-mail antigo cria a solicitação sem alterar o cadastro
    Given o modal de atualização está aberto com um e-mail diferente do cadastro
    When o aluno escolhe "Manter e-mail antigo"
    Then a solicitação é criada com o e-mail digitado como destino
    And o e-mail do cadastro da pessoa não é alterado
    And o e-mail das matrículas não é alterado

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que atualizar o e-mail propaga o novo e-mail para a pessoa e todas as matrículas
    Given o modal de atualização está aberto com um e-mail diferente do cadastro
    And o aluno possui mais de uma matrícula
    When o aluno escolhe "Atualizar E-mail"
    Then a solicitação é criada com o e-mail digitado como destino
    And o e-mail do cadastro da pessoa passa a ser o digitado
    And o e-mail de todas as matrículas da pessoa passa a ser o digitado

  @PGPO-3266 @high
  Scenario: [PGPO-3266][Web][Falha] Validar que fechar o modal sem escolher uma opção cancela o envio
    Given o modal de atualização de e-mail está aberto
    When o aluno fecha o modal sem escolher uma opção
    Then nenhuma solicitação é criada
    And o cadastro do aluno não é alterado
    And o aluno permanece na tela de 2ª via com os dados preenchidos

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Falha] Validar que o cadastro não muda quando a solicitação não é criada
    Given o modal de atualização está aberto com um e-mail diferente do cadastro
    And a publicação da solicitação na fila de processamento vai falhar
    When o aluno escolhe "Atualizar E-mail"
    Then nenhuma solicitação é criada
    And o e-mail do cadastro não é alterado

  @PGPO-3266 @high
  Scenario: [PGPO-3266][Web][Sucesso] Validar a confirmação "Solicitação enviada" após o envio
    Given a solicitação foi criada com sucesso
    When o aluno conclui o envio
    Then a tela exibe a mensagem "Solicitação enviada"
    And a tela não exibe erro de processamento

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que a solicitação é gravada com a competência e o e-mail de destino
    Given o aluno escolheu a competência 03/2026
    And o aluno informou o e-mail "nota@exemplo.com"
    When o aluno envia a solicitação
    Then a solicitação é criada com a competência 03/2026
    And a solicitação é criada com o e-mail de destino "nota@exemplo.com"
    And a solicitação é criada com o status "Em processamento"

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que o envio publica a solicitação na fila de processamento
    Given o aluno escolheu uma competência e informou um e-mail de destino
    When o aluno envia a solicitação
    Then a solicitação é publicada na fila de processamento na mesma transação de criação
    And a mensagem publicada contém a competência e o identificador da solicitação

  @PGPO-3266 @high
  Scenario: [PGPO-3266][Web][Sucesso] Validar que os botões ficam desabilitados durante o envio
    Given o aluno clicou em "Enviar Solicitação"
    When a solicitação está sendo processada
    Then o botão "Enviar Solicitação" fica desabilitado
    And o botão de cancelamento fica desabilitado

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Falha] Validar que a segunda solicitação em processamento para a mesma competência é bloqueada
    Given existe uma solicitação "Em processamento" para a matrícula e a competência 03/2026
    When o aluno tenta enviar nova solicitação para a competência 03/2026
    Then nenhuma nova solicitação é criada
    And a tela informa que já existe uma solicitação em andamento

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que nova solicitação é permitida para competência já concluída com sucesso
    Given existe uma solicitação concluída com sucesso para a matrícula e a competência 03/2026
    When o aluno envia nova solicitação para a competência 03/2026
    Then a nova solicitação é criada com o status "Em processamento"

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que a comparação do e-mail ignora espaços nas pontas e diferença de maiúsculas
    Given o e-mail atual do cadastro é "aluno@exemplo.com"
    And o campo de e-mail contém " Aluno@Exemplo.com "
    When o aluno clica em "Enviar Solicitação"
    Then o modal de atualização de e-mail não é exibido
    And a solicitação é criada sem alterar o cadastro

  @PGPO-3266 @critical
  Scenario: [PGPO-3266][Web][Sucesso] Validar que nova solicitação é permitida para competência cuja solicitação anterior falhou
    Given existe uma solicitação com falha no processamento para a matrícula e a competência 03/2026
    When o aluno envia nova solicitação para a competência 03/2026
    Then a nova solicitação é criada com o status "Em processamento"
```

## Decisão do QA (G1)

- [ ] Aprovar todos os cenários
- [ ] Aprovar parcialmente (listar os números abaixo)
- [ ] Solicitar ajustes

**Cenários aprovados:**

**Cenários rejeitados ou ajustados:**

**Respostas aos pontos 1 a 7 acima:**
