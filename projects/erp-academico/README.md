# Cosmos ERP Acadêmico — testes E2E (stage)

Suíte Playwright que executa fluxos do ERP Acadêmico contra um ambiente já
publicado (stage por padrão), sem subir a aplicação localmente. Os módulos
cobertos hoje são o **PPC** e o **Banco de Questões com IA**.

Execução a partir da raiz do repositório:

```bash
E2E_PROJECT=erp-academico npm run test:e2e   # erp-academico também é o padrão
```

A execução padrão deixa de fora os testes marcados com `@custo-alto`, que gastam
upload e geração por IA a cada chamada.

## PPC

O ciclo de vida tem dois cenários, cada um com o seu próprio PPC:
`tests/ppc/fluxo-completo.spec.ts` (revisão aprovada) e
`tests/ppc/revisao-reprovada.spec.ts` (revisão com campo reprovado). Além deles,
`tests/ppc/pausar-cancelar.spec.ts` cobre a máquina de status,
`tests/ppc/documentos.spec.ts` cobre os downloads,
`tests/ppc/listagem.spec.ts` cobre a tela de listagem,
`tests/ppc/acesso-invalido.spec.ts` cobre o link de acesso inválido e
`tests/ppc/assistente-ia.spec.ts` cobre o assistente de IA do Infoprodutor.

1. **Coordenador cria o PPC** — login por credenciais, acesso ao módulo PPC pelo
   card do dashboard, criação com área de conhecimento e e-mail do Infoprodutor,
   conferência do status `AGUARDANDO_RETORNO` e cópia do link pela ação
   Copiar Link do menu de ações (o teste lê a área de transferência e confere o
   `token=`).
2. **Infoprodutor preenche o PPC** — abre o link de acesso, preenche informações
   gerais, cadastra um especialista, preenche a carga horária e, ao continuar
   para a aba Disciplinas, confere a matriz criada pelo backend: 1 Ambientação
   (Anhanguera, já completa e fixa na ordem 1), 3 disciplinas Anhanguera vazias
   para o Infoprodutor selecionar e 6 disciplinas do Infoprodutor vazias para
   ele criar — 10 no total. Depois aplica a data de início, vincula as
   Anhanguera, preenche as disciplinas do Infoprodutor e envia para revisão
   (`EM_REVISAO`).
3. **Coordenador revisa** — abre o PPC nas quatro abas de leitura, entra no modo
   de revisão pela ação Revisar e aprova ou reprova pela tela cada campo das
   Informações Gerais, dos Especialistas e das disciplinas do Infoprodutor. As
   disciplinas Anhanguera vinculadas pelo Infoprodutor são preenchidas antes,
   porque sem o conteúdo do Coordenador a revisão não pode ser finalizada. Todos
   os campos precisam terminar aprovados ou reprovados, e a finalização é feita
   pelo botão Finalizar Revisão da aba Disciplinas:
   - com todos aprovados, a finalização leva o PPC para `APROVADO`
     (`tests/ppc/fluxo-completo.spec.ts`);
   - com um campo reprovado e comentário, leva para `AGUARDANDO_AJUSTES`
     (`tests/ppc/revisao-reprovada.spec.ts`).
4. **Infoprodutor ajusta e reenvia** — em `AGUARDANDO_AJUSTES` o Infoprodutor
   volta pelo mesmo link, edita a disciplina reprovada (só os campos reprovados
   ficam editáveis) e reenvia, e o PPC volta para `EM_REVISAO`. Na segunda
   revisão o Coordenador aprova o ajuste e finaliza em `APROVADO`.
5. **Coordenador conclui** — com o PPC em `APROVADO`, informa as classificações
   CAPES e OCDE no modal de conclusão e o PPC vai para `CONCLUIDO`.

Os testes rodam em série (`test.describe.serial`, um worker) porque cada etapa
depende do PPC criado na etapa anterior.

### Pausar, retomar e cancelar

`tests/ppc/pausar-cancelar.spec.ts` cria um PPC só para ele (sem preenchimento,
portanto barato) e percorre pela tela Pausar (`STAND_BY`), Retomar (volta a
`AGUARDANDO_RETORNO`) e Cancelar (`CANCELADO`). Cada transição confere o status
pela API e, principalmente, as ações que o menu passa a oferecer: em `STAND_BY`
só aparece Retomar; depois do cancelamento sobra apenas Visualizar.

### Documentos

`tests/ppc/documentos.spec.ts` baixa o PPC versionado e o PPC completo pela aba
Concluídos e confere que o arquivo chegou com tamanho maior que zero. Ela não
cria nada: usa o PPC de `E2E_PPC_CONCLUIDO_ID` ou, sem ele, o `CONCLUIDO` mais
recente em stage — se não houver nenhum, os testes ficam *skipped* com a
instrução de rodar o fluxo completo antes, em vez de falhar como defeito.

### Listagem

`tests/ppc/listagem.spec.ts` não cria nada: parte dos PPCs que já existem em
stage (lidos pela API apenas para saber o que esperar) e exercita pela tela a
busca por identificador e por nome, o filtro por status, a ordenação por
identificador nas duas direções, a troca de itens por página, o avanço de página
e as abas Revisão e Concluídos. A busca tem debounce de 1s na tela, então os
testes esperam o resultado da lista com `expect.poll`, nunca com espera fixa. O
filtro por status só existe na aba Revisão, e a aba Concluídos mostra apenas
`CONCLUIDO`.

### Assistente de IA do Infoprodutor (`@custo-alto`)

`tests/ppc/assistente-ia.spec.ts` cria um PPC, abre o link do Infoprodutor e
aceita o assistente oferecido antes do formulário: confere que o avanço fica
bloqueado enquanto a resposta não atinge o mínimo de caracteres (200, 200 e 100
nos três passos), responde os três passos e, depois da geração, confere que as
Informações Gerais chegaram preenchidas com os mínimos que o service exige da IA
(1000, 750 e 1250 caracteres), que os três objetivos específicos vieram
preenchidos e que as três sugestões de nome aplicam o título ao serem clicadas.

A oferta do assistente depende de `COGNA_IA_PPC_SUGGESTION_ENABLED` no service e
de o PPC ainda não ter Informações Gerais preenchidas. Cada execução gasta uma
chamada de IA, então a spec fica fora da execução padrão e roda com
`E2E_QB_EXPENSIVE=1`. A geração não salva nada: o PPC continua em
`AGUARDANDO_RETORNO` até o Infoprodutor enviar o formulário.

### Link de acesso inválido

`tests/ppc/acesso-invalido.spec.ts` confere a tela "Link inválido ou expirado"
nos três caminhos de erro do acesso externo: link sem token, token inexistente e
acesso direto ao formulário sem sessão. Não precisa de dado real nem de login.

## Variáveis de ambiente

| Variável                          | Obrigatória | Padrão                                                         |
| --------------------------------- | ----------- | -------------------------------------------------------------- |
| `ERP_STAGE_COORD_USERNAME`        | sim         | —                                                              |
| `ERP_STAGE_COORD_PASSWORD`        | sim         | —                                                              |
| `E2E_BASE_URL`                    | não         | `https://infoprod.stage.platosedu.io/erp-academico`            |
| `E2E_API_URL`                     | não         | `https://infoprod.stage.platosedu.io/api/service-erp-academic` |
| `E2E_LOCALE`                      | não         | `pt`                                                           |
| `E2E_PPC_AREA`                    | não         | `Engenharia`                                                   |
| `E2E_INFOPRODUCER_EMAIL`          | não         | `devin.e2e+{stamp}@example.com`                                |
| `E2E_SPECIALIST_CPF`              | não         | CPF de teste válido                                            |
| `E2E_ANHANGUERA_DISCIPLINE_COUNT` | não         | `3`                                                            |
| `E2E_PPC_CONCLUIDO_ID`            | não         | PPC `CONCLUIDO` mais recente em stage                          |
| `E2E_PPC_AI_TIMEOUT_MS`           | não         | `300000` (5 min para a geração do assistente)                  |
| `E2E_QB_EXPENSIVE`                | não         | desligada (`1` habilita os testes `@custo-alto`)               |
| `E2E_QB_ID`                       | não         | banco COMPLETO mais recente em stage                           |
| `E2E_QB_PDF`                      | não         | `fixtures/material-didatico.pdf`                               |
| `E2E_QB_DISCIPLINE`               | não         | disciplina do material didático do fixture                     |
| `E2E_QB_QUESTIONS`                | não         | `5`                                                            |
| `E2E_QB_BLOOM`                    | não         | `APLICAR`                                                      |
| `E2E_QB_COURSE`                   | não         | `Previdência social`                                           |
| `E2E_QB_COLLECTION`               | não         | `WBA0597_v1`                                                   |
| `E2E_QB_TIMEOUT_MS`               | não         | `900000` (15 min para a geração)                               |
| `E2E_QB_EXPORT_TIMEOUT_MS`        | não         | `600000` (10 min para o envio ao Cosmos)                       |
| `E2E_QB_CLEANUP`                  | não         | desligada (`1` exclui o banco criado pelo teste)               |

O e-mail do Infoprodutor recebe um timestamp por execução, o que também é usado
para localizar o PPC criado. Nenhuma credencial fica no repositório.

## Execução

```bash
npm ci
npx playwright install chromium   # apenas na primeira vez
npm run test:e2e                  # headless
npm run test:e2e:headed           # com navegador visível
npm run test:e2e:report           # abre o relatório HTML da última execução
```

Toda execução grava um relatório curto em `test-results/relatorio-erp-academico.md` com
data, ambiente, commit, resultado de cada teste, os PPCs criados em stage e as
notas de cobertura de `projects/erp-academico/relatorio-notas.md` (a lista do que ainda falta). É
esse arquivo que deve ser compartilhado com o time; o relatório HTML e os vídeos
ficam para quando alguém precisar investigar uma falha.

Para gerar evidências (vídeo e trace de todos os testes, e não só dos que
falham), rode com `E2E_EVIDENCE=1`; os arquivos ficam em `test-results/`.

## Banco de Questões com IA

O fluxo é separado em duas specs porque o custo das etapas é muito diferente.

**`tests/question-bank/geracao.spec.ts` (`@custo-alto`, sob demanda).** Faz o
upload real de um PDF para o S3 e consome uma geração por IA a cada execução,
então fica fora da execução agendada e só roda quando pedida:

```bash
E2E_QB_EXPENSIVE=1 npx playwright test tests/question-bank/geracao.spec.ts
```

O Coordenador faz login, entra no módulo pelo card do dashboard, cria o banco
pelo modal (disciplina com timestamp, curso, e-mail do Infoprodutor, quantidade
de questões e nível de Bloom) e entrega o PDF de
`fixtures/material-didatico.pdf` ao input de arquivo (material didático real de
Benefícios por Incapacidade, usado para a IA gerar questões sobre conteúdo de
verdade; a disciplina e o curso padrão acompanham esse material). O identificador criado é
resolvido pela disciplina única e registrado no relatório. A espera pela geração
é por status real (`EM_PROCESSAMENTO` ou `PROCESSANDO` até `COMPLETO` ou
`FALHOU`), sem espera fixa: a falha informa em que status o registro ficou preso
e por quanto tempo. Com `COMPLETO`, o teste confere a quantidade pedida,
enunciado e explicação preenchidos, no mínimo duas alternativas, exatamente uma
correta, e compara o detalhe na tela com o que a API devolveu. O banco criado é
mantido em stage por padrão, porque é o insumo da spec de gestão; com
`E2E_QB_CLEANUP=1` ele é excluído pela tela ao final.

**`tests/question-bank/gestao.spec.ts` (barata, entra na execução recorrente).**
Não cria nada: reutiliza um banco em `COMPLETO` — o de `E2E_QB_ID` ou o mais
recente da listagem — e valida as questões na tela, a edição de enunciado, a
exclusão de questão e o envio ao Cosmos até `FINALIZADO` com a coleção
vinculada. Se não houver nenhum banco em `COMPLETO`, os testes são marcados como
*skipped* com a orientação de rodar a geração primeiro, em vez de falharem como
se fosse defeito do produto.

```bash
npx playwright test tests/question-bank/gestao.spec.ts
E2E_QB_ID=64 npx playwright test tests/question-bank/gestao.spec.ts
```

Cada execução da gestão consome um registro: o banco sai de `COMPLETO` e termina
em `FINALIZADO`, e não volta. Então a frequência da gestão está limitada ao
estoque de bancos `COMPLETO` em stage — por isso a geração precisa ser rodada de
tempo em tempo, ou alguns bancos precisam ser mantidos para teste.

## Perfis e dados de teste

| Perfil           | Como entra                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| **Coordenador**  | login por credenciais (`ERP_STAGE_COORD_*`) na tela do ERP Acadêmico        |
| **Infoprodutor** | sem login: abre o PPC pelo link com `token=` que o Coordenador copia na tela |

O link do Infoprodutor carrega um token de acesso. Ele não é impresso em
relatório, mas aparece na URL dentro de trace e vídeo, então trate o artifact de
uma execução com `E2E_EVIDENCE=1` como material interno.

## Manutenção

- Depois de mexer nos helpers ou specs: `npm run typecheck` e `npm run testids`
  (o segundo regenera [TESTIDS.md](TESTIDS.md); o diff dele mostra que testid
  entrou ou saiu do contrato com o frontend).
- Quando um teste quebra, a primeira pergunta é qual das três: mudança de tela
  (testid renomeado → ajustar o helper), defeito no produto (→ achado em
  `relatorio-notas.md`) ou instabilidade do ambiente (→ repetir e, se persistir,
  registrar). A suíte não tem retry justamente para essa pergunta ser feita.
- O módulo do Banco de Questões vive na branch `stage` do frontend, não na
  `main` — é lá que os `data-testid` devem ser conferidos.

## Observações

- Todo passo do fluxo é executado pela tela. O uso da API
  (`projects/erp-academico/api/CoordinatorApi.ts`) se limita a conferir status e revisões
  pendentes entre as etapas — nenhuma ação do Coordenador ou do Infoprodutor é
  feita por requisição.
- O preenchimento das disciplinas Anhanguera pelo Coordenador passou a ser feito
  pela tela Preencher Disciplina depois do deploy do PGPO-3299 (PR 193), que
  corrigiu a validação de `educatorId` num modo sem o campo Especialista.
- A conferência da matriz inicial usa `expect.soft`, então uma divergência de
  quantidade é reportada sem interromper o restante do preenchimento. Stage já
  cria as 10 disciplinas esperadas (Ambientação + 3 Anhanguera + 6 Infoprodutor),
  que é o padrão da suíte; `E2E_ANHANGUERA_DISCIPLINE_COUNT` existe apenas para
  rodar contra ambientes com outra quantidade.
- A ordem no produto hoje é `APROVADO` e depois `CONCLUIDO`: finalizar a revisão
  sem reprovações leva a `APROVADO`, e a conclusão com CAPES e OCDE leva a
  `CONCLUIDO`. Não existe ação Aprovar depois de `CONCLUIDO`: nesse status o menu
  oferece apenas visualizar, PPC completo, versionamento e contrato.
- O formulário externo é um wizard: mesmo no ajuste depois de
  `AGUARDANDO_AJUSTES`, a suíte só chega na aba Disciplinas passando por
  Especialistas e Carga Horária.
- A suíte cria dados reais em stage (um PPC por execução) e não altera PPCs de
  outras execuções. No Banco de Questões, a spec de gestão altera e finaliza um
  banco já existente, porque é esse o fluxo em teste.
- O envio ao Cosmos também é assíncrono: o registro volta para `PROCESSANDO`
  depois da confirmação e só então chega a `FINALIZADO`, por isso a espera usa
  `E2E_QB_EXPORT_TIMEOUT_MS`.
- No Banco de Questões, a API serve para observar o status assíncrono, resolver o
  identificador do banco criado pela tela e conferir as questões salvas; todas as
  ações do fluxo são feitas pela interface.
- A tela do Banco de Questões não faz polling: quem acompanha a geração precisa
  recarregar a listagem para ver a mudança de status.
- Não aponte a suíte para produção.
- Os `data-testid` consumidos estão listados em [TESTIDS.md](TESTIDS.md), gerado
  por `npm run testids`. Renomear um deles no frontend quebra o teste que o
  referencia.
