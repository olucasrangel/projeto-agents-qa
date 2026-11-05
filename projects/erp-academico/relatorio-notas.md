## Cobertura do fluxo

| Passo                                                                 | Situação                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1. Coordenador faz login e acessa o módulo PPC pelo dashboard         | coberto pela UI                                                                                              |
| 2. Coordenador cria um novo PPC                                       | coberto pela UI                                                                                              |
| 3. Coordenador copia o link em Ações, Copiar Link                     | coberto pela UI (o teste lê a área de transferência)                                                         |
| 4. Infoprodutor acessa pelo link e preenche todas as abas             | coberto pela UI (informações gerais, especialistas, carga horária, disciplinas)                              |
| 5. Infoprodutor envia o PPC para revisão                              | coberto pela UI (status EM_REVISAO)                                                                          |
| 6. Coordenador visualiza, revisa todos os campos e finaliza a revisão | coberto pela UI (aprovação e reprovação campo a campo e o botão Finalizar Revisão)                           |
| 7. Infoprodutor ajusta o que foi reprovado e reenvia                  | coberto pela UI (AGUARDANDO_AJUSTES, ajuste da disciplina reprovada e volta para EM_REVISAO)                 |
| 8. Coordenador conclui e o PPC fica aprovado                          | coberto: finalizar a revisão sem reprovações leva a APROVADO e a conclusão com CAPES e OCDE leva a CONCLUIDO |
| 9. Coordenador pausa, retoma e cancela o PPC                          | coberto pela UI (STAND_BY, volta a AGUARDANDO_RETORNO, CANCELADO e as ações restantes no menu)                |
| 10. Coordenador baixa o PPC versionado e o PPC completo               | coberto pela UI (download concluído e arquivo não vazio, a partir de um PPC CONCLUIDO existente)             |
| 11. Coordenador busca, filtra, ordena e pagina a listagem             | coberto pela UI (busca por id e por nome, filtro por status, ordenação por id, itens por página, próxima página e as duas abas) |
| 12. Infoprodutor abre um link inválido ou expirado                    | coberto pela UI (link sem token, token inexistente e formulário sem sessão caem em "Link inválido ou expirado") |
| 13. Infoprodutor usa o Assistente de IA nas Informações Gerais        | coberto pela UI (spec `@custo-alto`: mínimo de caracteres por passo, geração e sugestões de nome aplicadas no formulário) |

Cronogramas e Contrato não têm o que testar: as ações existem no
`PPCActionEnum`, mas os handlers estão vazios e nunca aparecem no menu.

## Bloqueio do 401 — resolvido em stage

Em 02/10/2026 a suíte ficou verde nos 7 testes (3,7 min). O bloqueio abaixo está
resolvido em stage pelo PR 387 do `cosmos-erp-academic-service` (exclusão de
`ppc/external/(.*)` do `AuthMiddleware`), mergeado e deployado; o histórico fica
registrado para rastreabilidade.

O Infoprodutor não conseguia salvar nenhuma disciplina: `PUT
/ppc/external/disciplines/:disciplineId` respondia 401 `Token inválido`, a tela
mantinha o formulário aberto e a suíte parava no passo 4.

Causa no `cosmos-erp-academic-service`: `AuthMiddleware` (JWT do Coordenador) é
aplicado em `forRoutes(PPCController)` excluindo apenas `ppc/auth/(.*)`, e a
rota nova do Coordenador `PUT ppc/:id/disciplines/:disciplineId` casa também com
`ppc/external/disciplines/:disciplineId`. Com isso o middleware do Coordenador
intercepta a chamada do Infoprodutor e recusa o token do PPC antes do
`PPCTokenAuthMiddleware`. O `GET` da mesma rota funciona porque o
`PPCController` não tem `GET :id/disciplines/:disciplineId`.

Verificado direto na API de stage: com o token do Infoprodutor o `GET
/ppc/external/disciplines` responde 200 e o `PUT` responde 401 `Token inválido`;
com o token do Coordenador o mesmo `PUT` responde 401 `Token de acesso
inválido`. Correção fica com o time dono do service (excluir
`ppc/external/(.*)` do `AuthMiddleware`).

Reexecução durante o bloqueio: como o Salvar da tela passa por
server action, a recusa chega ao navegador como
`{"data":null,"error":"Unauthorized","status":401}` e some em um toast curto, sem
nada no DOM depois. A suíte agora lê a resposta da action, então a falha diz
`recusado pela API: Unauthorized` em vez de estourar o tempo esperando o
formulário fechar. Os dois cenários do PPC paravam nesse ponto e os cinco testes
seguintes não rodavam por dependência serial.

## Nova validação de envio: docente responsável pelo curso

Com o 401 resolvido, o envio para revisão passou a ser recusado pela validação
de completude do service (`PPCSubmissionValidator`): `É preciso selecionar um
professor responsável para enviar para revisão`. O botão Finalizar e enviar só
abre o modal de confirmação quando `GET /ppc/external/validation` não devolve
erro, e a mensagem aparecia apenas em alerta de duração curta — a suíte passou a
ler a resposta da server action, então a falha diz o motivo da recusa.

O cadastro de especialista do Infoprodutor agora marca Este docente é o
responsável pelo Curso. O input do checkbox fica atrás do controle visual do
Chakra, então o clique acontece no rótulo; o campo é bloqueado quando já existe
outro responsável.

## Preencher Disciplina (Anhanguera) pela tela — resolvido em stage

As três disciplinas Anhanguera vinculadas pelo Infoprodutor precisam de ementa,
conteúdo programático e referências do Coordenador, senão a finalização da
revisão é recusada com Todas as disciplinas devem estar aprovadas ou reprovadas
antes de finalizar a revisão. O Salvar dessa tela não enviava requisição porque
a validação exigia `educatorId` num modo em que o campo Especialista não é
renderizado — a suíte usava a chamada equivalente à da tela como contorno.

Com o deploy do PGPO-3299 (PR 193) em stage o Salvar passou a funcionar, então o
contorno por API foi removido: esse passo é executado pela tela, e a suíte ficou
verde nos dois cenários. A API continua sendo usada apenas para conferir status e
revisões pendentes entre as etapas.

## O que ainda falta

- Ação Aprovar depois de CONCLUIDO: não existe no produto. Nesse status o menu
  oferece apenas visualizar, PPC completo, versionamento e contrato.
- Contrato e cronogramas não têm o que testar: as ações existem no enum, mas os
  handlers estão vazios e nunca aparecem no menu.
- A suíte roda apenas sob demanda contra stage, fora do CI, e cria dados reais a
  cada execução.

## Geração do documento PPC completo — intermitente em stage

Numa execução da suíte completa, a ação PPC completo do PPC 250 não devolveu o
arquivo em 5 minutos (nenhum download iniciado, sem erro na tela). O versionado
do mesmo PPC, baixado minutos antes, veio em 20 segundos, e a reexecução isolada
da spec de documentos baixou o PPC completo em 10 segundos. Ou seja, a geração
falha em silêncio de vez em quando: quem clica fica sem arquivo e sem mensagem.

## Banco de Questões com IA — cobertura

| Passo                                                                | Situação                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Coordenador faz login e abre o Banco de Questões pelo dashboard   | coberto pela UI                                                                     |
| 2. Coordenador cria o banco com upload real do PDF                   | coberto pela UI (spec de geração, `@custo-alto`)                                    |
| 3. Geração assíncrona por IA chega a COMPLETO                        | coberto por observação do status real, sem espera fixa                              |
| 4. Questões geradas têm enunciado, alternativas, correta e explicação | coberto pela API e conferido no detalhe da tela                                      |
| 5. Coordenador edita o enunciado e salva                             | coberto pela UI (spec de gestão)                                                     |
| 6. Coordenador exclui uma questão                                    | coberto pela UI (spec de gestão, quando o banco tem mais de uma questão)             |
| 7. Coordenador envia o banco para o Cosmos                           | coberto pela UI (busca e seleção da coleção no modal)                                |
| 8. Registro chega a FINALIZADO com a coleção vinculada               | coberto por observação do status real                                                |

## Banco de Questões — achados em stage

- O envio ao Cosmos é assíncrono e não tem indicação na tela: o registro volta
  para `PROCESSANDO` depois da confirmação, e a espera da suíte usa
  `E2E_QB_EXPORT_TIMEOUT_MS`. Com uma coleção saudável o envio conclui em poucos
  segundos (banco 61 para a coleção 928, `WBA0597_v1`).
- Envio para a coleção 4126 (`WBA0881_v2 Teste e inspeção de software`) fica
  preso em `PROCESSANDO` indefinidamente. Reproduzido duas vezes, com bancos
  diferentes: o banco 67 ficou mais de 28 minutos e o 64 estourou o limite de 10
  minutos, os dois com `collectionId` 4126 já gravado no registro. O mesmo fluxo
  com a coleção 928 conclui em segundos, então não é o envio em si, e sim algo
  dessa coleção.
  Reexecução em 05/10/2026: o banco 64 aparece agora em `FINALIZADO` com a
  coleção 4126, ou seja, o envio concluiu bem depois dos 10 minutos de espera da
  suíte (o registro não expõe quando); o banco 67 continua em `PROCESSANDO`. O
  envio para essa coleção é, no mínimo, muito mais lento e sem garantia de
  conclusão. Vale investigação do time dono do service; a tela não oferece
  nenhuma saída para o usuário nesse estado (o banco deixa de ser `COMPLETO` e
  perde as ações de editar, visualizar e enviar).
- Por isso o padrão de `E2E_QB_COLLECTION` é o código `WBA0597_v1` e não um
  termo genérico: buscar por `teste` traz justamente a coleção 4126.
- A listagem tem registros antigos presos em `EM_PROCESSAMENTO` (63) e vários em
  `FALHOU` (62, 68), então a geração em stage não é confiável hoje. A suíte
  reporta o status final observado em vez de tratar `FALHOU` como sucesso.
- A tela não faz polling: o usuário que acabou de criar o banco fica vendo
  Aguardando até recarregar a página.
- O estoque de bancos `COMPLETO` é consumido pela spec de gestão (cada execução
  leva um registro a `FINALIZADO`), então a geração precisa ser rodada
  periodicamente ou alguns bancos precisam ser reservados para teste.
  Em 05/10/2026, depois da execução da gestão (banco 71), restavam 12 bancos em
  `COMPLETO` em stage (10, 17, 33, 34, 36, 45, 46, 48, 58, 60, 69 e 70).
- A geração com o material didático real (PDF de 632 KB, 5 questões, Bloom
  APLICAR) concluiu em cerca de 2 minutos em stage, com as 5 questões na
  estrutura esperada. O limite de 15 minutos de `E2E_QB_TIMEOUT_MS` fica como
  margem para o ambiente lento, não como tempo esperado.
