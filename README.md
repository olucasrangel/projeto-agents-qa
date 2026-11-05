# opm-qa-automation

Projeto de automação de testes de QA para validação funcional e de regressão do
produto OPM.

Os testes são de ponta a ponta (Playwright + TypeScript) e rodam contra
ambientes **já publicados** — stage por padrão. Não há aplicação subindo
localmente, não há mock e não há banco de teste: a suíte faz login com usuário
real, cria registros reais e confere as transições de estado no backend do
ambiente. Os registros criados ficam listados no relatório de cada execução.

## Estrutura

```
shared/              código comum a todos os projetos
  projects.ts        registro dos projetos cobertos (id, nome, URL de stage)
  reporter.ts        relatório Markdown gerado a cada execução
  pages/BasePage.ts  base dos Page Objects (testId, menus com nova tentativa)
  helpers/           utilidades sem dependência de tela (geração de texto)

projects/<projeto>/  uma pasta por projeto testado
  README.md          o que é coberto, variáveis e limitações
  config/env.ts      URLs, secrets e flags do projeto
  api/               clientes de API (conferência de estado, nunca ação de tela)
  pages/<modulo>/    Page Objects: elementos (Locator) e ações de cada tela
  flows/             fluxos de negócio que combinam páginas e API
  fixtures/          test.extend que injeta os Page Objects nos testes
  data/              massa de teste e arquivos de upload
  tests/<modulo>/    os testes, um diretório por módulo
  TESTIDS.md         data-testid consumidos (gerado por npm run testids)
  relatorio-notas.md cobertura e lacunas, anexadas ao relatório

scripts/             utilitários de manutenção
.agents/core/       núcleo genérico do agente de QA (não editar no projeto)
.agents/project/    personalização do projeto: qa-project.yaml, skills, agentes
.agents/skills/     skills geradas para o Devin (npm run agents:sync)
.kiro/              adaptador do Kiro gerado (steering, skills, mcp.json)
.github/workflows/   execução manual e agendada
```

Sistemas cobertos hoje:

| Sistema                                            | Módulos                        | Ambiente |
| -------------------------------------------------- | ------------------------------ | -------- |
| [`erp-academico`](projects/erp-academico/README.md) | PPC, Banco de Questões com IA  | stage    |

## Como executar

```bash
npm ci
npx playwright install chromium          # apenas na primeira vez

# credenciais vêm do ambiente, nunca do repositório
export ERP_STAGE_COORD_USERNAME=...
export ERP_STAGE_COORD_PASSWORD=...

npm run test:e2e                         # sistema padrão (erp-academico)
```

Em vez de exportar as variáveis a cada sessão, dá para colocá-las num arquivo
`.env` na raiz (ignorado pelo git). Copie o modelo e preencha os valores:

```bash
cp .env.example .env                     # depois edite .env com usuário e senha
```

O `.env` é carregado automaticamente pelo `playwright.config.ts`; variáveis já
definidas no ambiente têm precedência sobre o arquivo. Com ele preenchido,
nenhum `export` é necessário:

```bash
E2E_PROJECT=erp-academico npm run test:e2e
E2E_EVIDENCE=1 npm run test:e2e          # grava vídeo e trace de todos os testes
E2E_QB_EXPENSIVE=1 npm run test:e2e      # inclui os testes @custo-alto
```

Cada execução grava `test-results/relatorio-<sistema>.md` com data, ambiente,
commit da suíte, resultado por teste, registros criados no ambiente e as notas
de cobertura do sistema. É esse arquivo que vai para o time; o relatório HTML e
os vídeos ficam para investigar falha.

Variáveis comuns a qualquer sistema:

| Variável       | Para que serve                                            |
| -------------- | --------------------------------------------------------- |
| `E2E_PROJECT`   | qual pasta de `projects/` é exercitada (padrão `erp-academico`) |
| `E2E_BASE_URL` | sobrescreve a URL do ambiente                             |
| `E2E_EVIDENCE` | `1` grava vídeo e trace de todos os testes                |
| `E2E_QB_EXPENSIVE` | `1` inclui os testes `@custo-alto`, fora da execução padrão |

As variáveis específicas (URLs de API, secrets, flags) estão no README de cada
sistema.

## Rodar um subconjunto

```bash
# atalhos para o módulo PPC
npm run test:ppc                         # os dois specs de PPC, headless
npm run test:ppc:headed                  # com navegador visível

# por módulo / pasta (relativa ao testDir do sistema)
npx playwright test ppc
npx playwright test tests/ppc/fluxo-completo.spec.ts

# por título do teste
npx playwright test -g "Coordenador cria o PPC"

# por linha onde o teste começa
npx playwright test tests/ppc/fluxo-completo.spec.ts:30

# só o que falhou na última execução
npx playwright test --last-failed
```

Atenção aos blocos `test.describe.serial`: os testes dependem do estado deixado
pelo anterior (o mesmo PPC, por exemplo), então filtrar só um teste do meio da
cadeia costuma falhar por falta do registro que o teste anterior criaria. Isole
apenas o primeiro da cadeia ou rode o arquivo inteiro.

## Depurando uma falha

Quando um teste quebra, a evidência fica em `test-results/` e o caminho exato é
impresso no final da execução. Ferramentas que ajudam a entender o que
aconteceu, sem alterar nada:

```bash
# relatório HTML da última execução: screenshot, vídeo e trace do passo que falhou
npx playwright show-report

# trace navegável passo a passo (DOM, rede, console e timeline de cada ação)
# o caminho do .zip vem no rodapé da falha
npx playwright show-trace test-results/<pasta-da-falha>/trace.zip

# modo UI: timeline interativa, dá para re-rodar e inspecionar cada passo
npx playwright test tests/ppc/fluxo-completo.spec.ts --ui

# modo debug: abre o Inspector e pausa a cada ação
PWDEBUG=1 npx playwright test tests/ppc/fluxo-completo.spec.ts --headed

# com navegador visível, sem o Inspector
npx playwright test tests/ppc/fluxo-completo.spec.ts --headed

# grava vídeo e trace de TODOS os testes, não só dos que falham
E2E_EVIDENCE=1 npm run test:e2e
```

O `show-trace` é o mais completo para investigar: ele mostra o DOM e o estado da
tela em cada ação, as requisições de rede e o console no momento do erro. É com
ele que se decide a pergunta das três (mudança de tela, defeito no produto ou
instabilidade do ambiente) antes de repetir ou registrar um achado.

## Execução no GitHub Actions

O workflow [`e2e.yml`](.github/workflows/e2e.yml) roda a suíte de duas formas:

- **manual** (*Actions* → *E2E* → *Run workflow*), escolhendo o sistema e se quer
  evidência em vídeo/trace e os testes `@custo-alto`;
- **agendada**, de segunda a sexta às 11h UTC (08h em São Paulo), sempre sem os
  testes `@custo-alto`.

As credenciais vêm de *secrets* do repositório (`ERP_STAGE_COORD_USERNAME` e
`ERP_STAGE_COORD_PASSWORD`); não existe valor padrão no código, então a execução
falha de imediato se eles não estiverem configurados. Ao final, o relatório
Markdown é publicado no resumo do job e `test-results/` e `playwright-report/`
sobem como artifact por 30 dias.

## Custo e dados no ambiente

A suíte roda contra um ambiente compartilhado e tem custo real, então dois
mecanismos limitam esse custo:

- Testes marcados com **`@custo-alto`** (upload para o S3, geração por IA) ficam
  fora de qualquer execução padrão ou agendada — eles só rodam com
  `E2E_QB_EXPENSIVE=1`, por decisão explícita de quem executa.
- O que o teste cria em stage é sempre identificável (e-mail e disciplina com
  timestamp por execução) e fica listado no relatório, para o time conseguir
  separar dado de teste de dado de uso real.

## Reportando achados

Quando a suíte encontra comportamento divergente do esperado, o caminho é:

1. registrar o achado em `projects/<projeto>/relatorio-notas.md`, com a evidência
   (requisição, status observado, tempo) — esse arquivo vai anexado a todo
   relatório de execução;
2. levar o achado ao time dono do sistema, com o relatório da execução;
3. manter a asserção como está. O teste só muda quando o comportamento esperado
   muda, nunca para ficar verde.

## Convenções

- **Page Objects: teste não conhece seletor.** O teste lê como a descrição de
  um fluxo de negócio e recebe as páginas pela fixture
  (`import { test, expect } from '../../fixtures'`). Cada tela tem uma classe em
  `pages/` que estende `shared/pages/BasePage.ts`, expõe os elementos como
  `Locator` e as ações como métodos. Quando a tela muda, muda um arquivo.
- **Flows para o que atravessa telas.** Encadeamentos reutilizados por vários
  testes (por exemplo, criar e preencher um PPC) ficam em `flows/`, montados a
  partir dos Page Objects e da API.
- **`data-testid` como seletor preferencial**, porque texto de tela muda com
  copy e tradução. Os testids consumidos são contrato com o frontend e ficam
  listados em `TESTIDS.md`, gerado por `npm run testids`.
- **Ação funcional sempre pela interface.** A API é usada apenas para conferir
  estado, resolver identificadores e, excepcionalmente, como atalho documentado
  quando a tela está comprovadamente quebrada — e isso vira uma linha em
  `relatorio-notas.md`.
- **Um worker, sem retry.** O ambiente é compartilhado e os testes criam
  registros reais: paralelismo geraria interferência e retry esconderia
  instabilidade que precisamos enxergar.
- **Dados novos a cada execução, sempre que possível.** O teste cria o que vai
  exercitar, em vez de depender de registro deixado por outra rodada. Onde o
  insumo é caro demais para recriar (geração por IA), o teste reaproveita um
  registro existente e, se não encontrar nenhum, é marcado como *skipped* com a
  orientação do que rodar antes — nunca falha como se fosse defeito.
- **Divergência é achado, não motivo para mexer no produto.** Não relaxamos
  asserção nem alteramos código de produção para a suíte ficar verde: a
  divergência é reportada ao time dono do sistema.
- **Nunca apontar para produção**, e nenhuma credencial no repositório.

## Adicionar um projeto ou módulo novo

1. Registre o projeto em `shared/projects.ts` (id, nome e URL de stage).
2. Crie `projects/<projeto>/` com `config/env.ts`, `pages/`, `fixtures/`,
   `tests/<modulo>/`, `README.md` e `relatorio-notas.md`.
3. Escreva um Page Object por tela, registre-o na fixture e escreva o teste
   descrevendo o fluxo.
4. Rode `npm run testids` para atualizar o inventário de `data-testid`.
5. Registre os fatos estáveis do módulo em
   `.agents/project/skills/e2e-<modulo>-<ambiente>/SKILL.md`, liste a skill em
   `.agents/project/qa-project.yaml` e rode `npm run agents:sync`, para as próximas sessões
   não precisarem redescobrir o fluxo.
6. Rode a suíte contra stage e versione o relatório da primeira execução verde.

O procedimento detalhado de autoria e de execução está nos playbooks
`!autor_e2e_stage` e `!executar_e2e_stage`.

## Agente de QA (Kiro)

O repositório traz o agente de QA em camadas:

- `.agents/core/`: agente genérico (orquestrador, A1–A4, skills corporativas,
  stack `playwright-typescript`, templates, schemas e scripts). Não editar aqui.
- `.agents/project/`: o que é deste projeto (`qa-project.yaml`, skills de
  domínio, perguntas extras do grill-me, agentes próprios, MCP).
- `.kiro/` e `.agents/skills/`: gerados por `npm run agents:sync`.
  `npm run agents:check` falha se estiverem desatualizados.

Uso no Kiro: abra o workspace com este repositório e, quando o acesso for
aprovado, com os repositórios de frontend e backend relacionados. Autentique o
MCP Atlassian e escreva `#qa-run <CARD>`. O discovery consulta card, épico,
vínculos diretos, comentários, anexos, bugs, subtarefas e padrões aplicáveis do
Confluence antes de propor cenários.

Inicialize os artefatos versionáveis com
`npm run qa:card:init -- <CARD>`. BDDs e planos ficam em `qa/cards/<CARD>/`;
aprovações e resumos de execução ficam em `qa/approvals/<CARD>/`. O estado
transitório continua em `qa/runs/<CARD>/` (`npm run qa:state -- status <CARD>`),
e os screenshots permanecem em `evidence/`, fora do Git.

O projeto começa em `dry-run`: não publica no Zephyr, não executa em ambiente
remoto e não cria commit ou PR. A integração real usa o projeto Zephyr `VPOS`,
cria um ciclo com os casos aprovados e anexa cada evidência à execução do caso.
