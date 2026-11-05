---
name: e2e-banco-questoes-stage
description: Fatos estáveis da suíte E2E do módulo Banco de Questões com IA em stage (cosmos-erp-academico) — URLs, estados assíncronos, endpoints, testids, separação entre a spec cara e a recorrente, variáveis e achados conhecidos. Use ao criar, executar ou manter testes E2E do Banco de Questões, ou ao investigar falhas dessa suíte.
---

# Suíte E2E do Banco de Questões com IA em stage

Contexto estável para quem vai executar ou manter a suíte do módulo Banco de
Questões. O procedimento de trabalho está nos playbooks "Autor de testes E2E em
stage com Playwright" e "Executar suíte E2E em stage e reportar"; aqui ficam
apenas os fatos do produto e do ambiente.

## Onde o código vive

- Repositório `cogna-platos/opm-qa-automation`, projeto `projects/erp-academico/`.
- Testes em `tests/question-bank/`: `geracao.spec.ts` (cara, marcada
  `@custo-alto`) e `gestao.spec.ts` (barata, entra na execução recorrente).
- Page Objects em `pages/question-bank/` (`QuestionBankListPage` e
  `QuestionBankDetailPage`) e cliente de API em `api/QuestionBankApi.ts` (com
  `waitForGeneration` e `waitForExport`), que reaproveita a autenticação de
  `api/auth.ts` (compartilhada com o cliente do PPC).
- Fixture de upload em `data/material-didatico.pdf` (material didático real
  de Benefícios por Incapacidade; disciplina e curso padrão acompanham ele).
- O módulo no frontend vive na branch `stage` de
  `cogna-platos/cosmos-erp-academic-frontend`, não na `main`.

## Ambiente

- Tela: `https://infoprod.stage.platosedu.io/erp-academico/pt/question-bank`
- API: `https://infoprod.stage.platosedu.io/api/service-erp-academic`
- Acesso pela dashboard, no card `card-question-bank-button`.
- Coordenador autentica com `ERP_STAGE_COORD_USERNAME` /
  `ERP_STAGE_COORD_PASSWORD`; o usuário de stage tem
  `ROLE_GERACAO_QUESTAO_ADMIN`, por isso enxerga a ação Excluir.

## Máquina de estados

```
criação → EM_PROCESSAMENTO → PROCESSANDO → COMPLETO (ou FALHOU)
        → envio ao Cosmos → PROCESSANDO → FINALIZADO
```

Rótulos na tela: `EM_PROCESSAMENTO` = Aguardando, `PROCESSANDO` = Processando,
`COMPLETO` = Pronta, `FALHOU` = Erro, `FINALIZADO` = Finalizada.

Dois pontos que custaram tempo para descobrir:

- A tela **não** faz polling; só um refetch manual (recarregar) mostra a
  mudança de status. A suíte observa o status pela API, nunca com espera fixa.
- O envio ao Cosmos **também é assíncrono**: depois da confirmação na tela o
  registro volta para `PROCESSANDO` e só então chega a `FINALIZADO` — por isso a
  espera do envio aceita `COMPLETO` e `PROCESSANDO` como intermediários.

As ações da listagem dependem do status: `EDIT`, `VIEW` e `SEND_TO_COSMOS` só em
`COMPLETO`; `DELETE` em `COMPLETO` ou `FALHOU`. Em `FINALIZADO` não sobra ação,
então o detalhe final é aberto direto pela URL.

## Endpoints usados

```
GET    /question-generation                       lista (resolve id e status)
GET    /question-generation/:id                   detalhe com as questões
POST   /question-generation                       criação (multipart: file, discipline,
                                                  course, infoproducerEmail,
                                                  numberOfQuestions, bloom)
PUT    /question-generation/:requestId/questions  salva edição das questões
DELETE /question-generation/:id                   exclusão
POST   /question-generation/:id/export            { "collectionId": 123 }
GET    /collection/filter?filter=<termo>          busca de coleções do Cosmos
```

A API serve para observar status, resolver o identificador do banco criado pela
tela e conferir o que foi salvo; todas as ações do fluxo são feitas pela
interface.

## Separação por custo

- `geracao.spec.ts` consome upload no S3 e uma geração por IA a cada execução.
  Fica fora da execução padrão (`grepInvert: /@custo-alto/`) e só roda com
  `E2E_QB_EXPENSIVE=1`. Por padrão **mantém** o banco criado, que é o insumo da
  outra spec; `E2E_QB_CLEANUP=1` o exclui pela tela.
- `gestao.spec.ts` não cria nada: usa `E2E_QB_ID` ou o banco `COMPLETO` mais
  recente, e termina levando-o a `FINALIZADO`. Ou seja, **consome um registro
  por execução** — sem banco `COMPLETO` disponível ela fica *skipped* com a
  orientação de rodar a geração antes, em vez de falhar como defeito.

Tempo observado em stage: geração de 5 questões a partir do PDF de ~650 KB leva
cerca de 2 minutos (timeout padrão de 15 min).

## Achados conhecidos

- O envio para a coleção **4126** (`WBA0881_v2 Teste e inspeção de software`)
  deixa o registro preso em `PROCESSANDO` indefinidamente — reproduzido com dois
  bancos, um deles por mais de 28 minutos — e nesse estado o banco perde todas
  as ações na tela. O mesmo envio para a coleção **928** (`WBA0597_v1`) conclui
  em segundos, por isso esse é o valor padrão de `E2E_QB_COLLECTION`. Parece
  específico da coleção, não do mecanismo de exportação.
- A listagem de stage costuma ter vários registros em `FALHOU`: não assuma que
  `FALHOU` indica regressão sem antes verificar o material usado.
