---
name: e2e-ppc-stage
description: Fatos estáveis da suíte E2E do módulo PPC em stage (cosmos-erp-academic) — URLs, perfis e secrets, máquina de status, matriz de disciplinas, onde a suíte vive, como executar e limitações conhecidas. Use ao criar, executar ou manter testes E2E do PPC, ou ao investigar falhas dessa suíte.
---

# Suíte E2E do PPC em stage

Contexto estável para quem vai executar ou manter a suíte E2E do módulo PPC.
O procedimento de trabalho está nos playbooks "Autor de testes E2E em stage com
Playwright" e "Executar suíte E2E em stage e reportar"; aqui ficam apenas os
fatos do produto e do ambiente.

## Onde o código vive

- Repositório: `cogna-platos/opm-qa-automation`, branch `main`.
- Projeto `projects/erp-academico/`, com `tests/ppc/` (ciclo aprovado, ciclo com
  reprovação, máquina de status e documentos), Page Objects em `pages/ppc/`
  (`PpcListPage`, `PpcViewPage`, `PpcReviewPage`, `PpcExternalFormPage`,
  `PpcAiAssistPage`, `PpcExternalAccessPage`), fluxos em `flows/ppc.flow.ts`,
  fixture em `fixtures/index.ts` e cliente de API em `api/CoordinatorApi.ts`.
  `playwright.config.ts`, `shared/reporter.ts`, `shared/projects.ts` e
  `shared/pages/BasePage.ts` ficam na raiz.
- Documentação em `projects/erp-academico/README.md`; cobertura e pendências em
  `projects/erp-academico/relatorio-notas.md`; inventário de `data-testid` em
  `projects/erp-academico/TESTIDS.md`; relatório de cada execução em
  `test-results/relatorio-erp-academico.md`.
- Origem histórica: a suíte nasceu em `cosmos-erp-academic-frontend`, branch
  `devin/1788001792-ppc-e2e-stage` (PR 177 fechado sem merge).
- O frontend testado é `cogna-platos/cosmos-erp-academic-frontend` e o backend
  `cogna-platos/cosmos-erp-academic-service`. Não alterar nenhum dos dois sem
  autorização explícita.

## Ambiente

- Aplicação em stage: `https://infoprod.stage.platosedu.io/erp-academico`
- Módulo PPC: `https://infoprod.stage.platosedu.io/erp-academico/pt/ppc`
- API: `https://infoprod.stage.platosedu.io/api/service-erp-academic`
- Nunca apontar a suíte para produção; ela cria dados reais.

## Perfis e credenciais

- Coordenador: login por usuário e senha (o tenant infoprod não usa SSO), com os
  secrets de organização `ERP_STAGE_COORD_USERNAME` e
  `ERP_STAGE_COORD_PASSWORD`.
- Infoprodutor: não tem login. Entra por link de acesso com `token=`, obtido na
  interface do Coordenador pela ação Copiar Link do menu de ações. A leitura da
  área de transferência exige `grantPermissions(['clipboard-read',
  'clipboard-write'])`.
- Cada execução gera um e-mail de Infoprodutor único
  (`devin.e2e+{timestamp}@example.com`), que também serve para localizar o PPC
  criado.

## Máquina de status do PPC

1. `AGUARDANDO_RETORNO` — após a criação pelo Coordenador.
2. `EM_REVISAO` — após o Infoprodutor preencher e enviar.
3. `AGUARDANDO_AJUSTES` — quando a revisão é finalizada com algum campo
   reprovado. O Infoprodutor volta pelo mesmo link, edita apenas os campos
   reprovados e reenvia, voltando para `EM_REVISAO`.
4. `APROVADO` — quando a revisão é finalizada sem nenhuma reprovação, pelo botão
   Finalizar Revisão na aba Disciplinas.
5. `CONCLUIDO` — após informar as classificações CAPES e OCDE no modal de
   conclusão.
6. `STAND_BY` — pela ação Pausar, a partir de `AGUARDANDO_RETORNO`,
   `AGUARDANDO_AJUSTES` ou `EM_REVISAO`. A ação Retomar devolve o PPC ao status
   anterior; nesse estado o menu oferece apenas visualizar, versionado, retomar
   e copiar link.
7. `CANCELADO` — pela ação Cancelar; é terminal e o menu passa a oferecer apenas
   Visualizar.

As três transições são cobertas por `tests/ppc/pausar-cancelar.spec.ts`, que cria
um PPC próprio sem preenchimento. Cada ação abre o modal compartilhado
(`ppc-confirmation-modal`, confirmação em `ppc-modal-confirm-button`).

## Documentos

PPC versionado está disponível em quase todos os status; PPC completo só em
`CONCLUIDO`, na aba Concluídos da listagem. Os dois são downloads do navegador:
`tests/ppc/documentos.spec.ts` espera o evento `download` e confere o tamanho do
arquivo, sem criar PPC — ela usa `E2E_PPC_CONCLUIDO_ID` ou o `CONCLUIDO` mais
recente, e fica *skipped* quando não existe nenhum em stage.

Importante: a ordem real é `APROVADO` e depois `CONCLUIDO`. Não existe ação
Aprovar depois de `CONCLUIDO` — nesse status o menu oferece apenas visualizar,
PPC completo e versionado.

## Listagem do Coordenador

A tela tem duas abas (`ppc-tab-0` Revisão, `ppc-tab-1` Concluídos; trocar de aba
reseta filtros e página), busca em `ppc-search-input` com debounce de 1s — por
isso espera-se o resultado com `expect.poll`, nunca com espera fixa —, filtro de
status em `ppc-filter-status` (renderizado apenas na aba Revisão), ordenação em
`ppc-filter-sort` (`ppcName|status|id|lastUpdated` com `:ASC`/`:DESC`), botões
`ppc-button-filter` e `ppc-button-clear`, e paginação em
`ppc-pagination-prev|next|page-${n}|page-size` (5, 10 e 20 itens).

Para ler a lista sem depender de texto, `PpcListPage.listedIds()` e `listedStatuses()`
extraem os ids de `ppc-actions-menu-${id}` e os status de `ppc-status-${status}`.
A API devolve `id` como string, então compare com `Number(...)`.
`tests/ppc/listagem.spec.ts` não cria registros: usa o que já existe em stage.

## Acesso externo inválido

Link sem token, token inexistente e acesso direto a `/ppc/external/fill` sem
sessão caem na tela "Link inválido ou expirado" (`/ppc-external/invalid-token`;
`next.config.mjs` reescreve `/:locale/ppc/external/*` para `/:locale/ppc-external/*`).
Coberto por `tests/ppc/acesso-invalido.spec.ts`, sem login e sem dado real.

## Validação de envio para revisão

O botão Finalizar e enviar do Infoprodutor só abre o modal de confirmação quando
`GET /ppc/external/validation` não devolve erro; a recusa aparece apenas em
alerta de duração curta, então a suíte lê a resposta da server action. Entre as
regras do `PPCSubmissionValidator` do service, uma exige um docente marcado como
responsável pelo curso — o cadastro de especialista marca Este docente é o
responsável pelo Curso, clicando no rótulo porque o input fica atrás do controle
visual do Chakra.

## Matriz inicial de disciplinas

Ao entrar na aba Disciplinas, depois da Carga Horária, o backend já criou 10
disciplinas:

- 1 Ambientação, do tipo Anhanguera, já completa e fixa na ordem 1;
- 3 disciplinas Anhanguera vazias, que o Infoprodutor seleciona do catálogo;
- 6 disciplinas do Infoprodutor, que ele cria e preenche.

A conferência usa `expect.soft`, então divergência de quantidade é reportada sem
interromper o fluxo. Stage já cria as 10 esperadas;
`E2E_ANHANGUERA_DISCIPLINE_COUNT` existe apenas para rodar contra ambientes com
outra quantidade.

As 3 disciplinas Anhanguera vinculadas pelo Infoprodutor precisam de ementa,
conteúdo programático e referências preenchidos pelo Coordenador, senão o
backend recusa finalizar a revisão. Vincular a mesma disciplina do catálogo em
duas posições Anhanguera não funciona — nunca foi esclarecido se é regra de
negócio ou defeito.

## Execução

```bash
npm ci                                 # na raiz de opm-qa-automation
npx playwright install chromium        # apenas na primeira vez
npm run test:e2e                       # headless, gera o relatório Markdown
npm run test:e2e:headed                # navegador visível, para depurar
npm run test:e2e:report                # relatório HTML da última execução
E2E_EVIDENCE=1 npm run test:e2e        # vídeo e trace de todos os testes
```

São 7 testes em dois cenários (revisão aprovada e revisão reprovada com ajuste e
reenvio), em série com um worker, cerca de 3,5 minutos no total. A execução
padrão exclui `@custo-alto`; o Assistente de IA roda com `E2E_QB_EXPENSIVE=1`.

## Assistente de IA do Infoprodutor

O acesso pelo link redireciona para `/{locale}/ppc/external/ai-assist` em vez do
formulário quando `authenticate-ppc-token` devolve `aiSuggestionEnabled` — o que
exige `COGNA_IA_PPC_SUGGESTION_ENABLED=true` no service e um PPC sem Informações
Gerais preenchidas. Por isso os demais testes do Infoprodutor dispensam a oferta
(`ai-assist-skip`) e só `tests/ppc/assistente-ia.spec.ts` a aceita
(`ai-assist-accept`).

O wizard tem três passos num mesmo `ai-assist-textarea` (objetivos,
justificativa, público-alvo), com `ai-assist-next` desabilitado abaixo de 200,
200 e 100 caracteres e máximo de 500. O último avanço dispara a geração
(`ai-assist-loading`) e termina no formulário externo com as Informações Gerais
escritas — o service recusa resposta da IA abaixo de 1000 caracteres de objetivo
geral, 750 de justificativa e 1250 de público-alvo, com 3 objetivos específicos
e 3 sugestões de nome (`title-suggestions`, cada botão aplica o título). As
sugestões trafegam por `sessionStorage` (`ppc-external-ai-suggestions`) e nada é
salvo: o PPC continua em `AGUARDANDO_RETORNO`. A geração levou cerca de 15s em
stage; o teto é `E2E_PPC_AI_TIMEOUT_MS` (5 min).

## Limitações conhecidas

- Todo o fluxo é validado pela tela; a API é usada apenas para conferir status e
  revisões pendentes entre as etapas, nunca para executar um passo do fluxo.
- O formulário externo é um wizard: mesmo no ajuste depois de
  `AGUARDANDO_AJUSTES`, só se chega à aba Disciplinas passando por Especialistas
  e Carga Horária.
- Um modal de Assistente de Preenchimento aparece no fluxo do Infoprodutor e
  precisa ser dispensado de forma tolerante à ausência.
- A lista refaz a busca sozinha depois de filtrar ou trocar de aba, e isso fecha
  o menu de ações recém-aberto e mantém por instantes o resultado anterior na
  tela: abrir o menu precisa de `toPass` e ler a lista precisa de `expect.poll`
  sobre o conteúdo esperado, nunca sobre a quantidade de linhas.
- Cronogramas e Contrato não têm o que testar: as ações existem no
  `PPCActionEnum`, mas os handlers estão vazios e nunca aparecem no menu.

## Achados já reportados ao time

- A matriz vinha com 9 disciplinas em vez de 10 (corrigido em stage).
- O reenvio depois de `AGUARDANDO_AJUSTES` estava bloqueado por validação de
  completude (corrigido).
- A tela Preencher Disciplina não salvava por validação de campo não renderizado
  (PGPO-3299, corrigido e deployado em stage; o preenchimento das 3 Anhanguera
  pelo Coordenador passou a ser feito pela tela).
- O Infoprodutor não salvava disciplina por colisão de rota no `AuthMiddleware`
  (PGPO-3414, PR 387 do service, corrigido e deployado em stage).
- Não existe ação Aprovar depois de `CONCLUIDO`.
