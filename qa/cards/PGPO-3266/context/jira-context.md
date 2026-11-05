# Contexto Jira — PGPO-3266

- **Card atual:** PGPO-3266 · [NFS-e] Solicitar a 2ª via e confirmar/editar o e-mail de destino
- **Tipo / status:** Story · Em Desenvolvimento · Labels: DoR
- **Épico pai:** PGPO-3284 · [NFS-e] Autosserviço de 2ª via de nota fiscal por e-mail (Em Andamento)
- **Sprint:** [PGPO] SP 26.4.3 (indicada pelo comentário automático do Jira)
- **Reporter:** Bruno Rodrigues Melo de Meneses · **Assignee:** Wallace de Freitas Branco
- **Data da leitura:** 2026-11-04 (MCP Atlassian, somente leitura)

## Requisitos confirmados

- Regras RN01 a RN14 descritas no card (serviço ligado por tenant, competência obrigatória, e-mail pré-preenchido e editável, modal de atualização, manter ou atualizar cadastro, atualização em todas as matrículas, anti-duplicidade, nasce em EM_PROCESSAMENTO e publicação na fila na mesma transação).
- Detalhamento técnico no card: endpoint com `emailDestino` e `atualizarEmailCadastro`, transação única, trava na matrícula, status `Em processamento` no LMS.
- Fora de escopo declarado: consulta à API de nota fiscal, envio do e-mail (PGPO-3265 e PGPO-3268) e tela de detalhes (PGPO-3267).

## Vínculos diretos

| Relação | Card | Tipo | Status | Relevância |
|---|---|---|---|---|
| Épico pai | PGPO-3284 | Epic | Em Andamento | Contexto do autosserviço |
| está bloqueado por | PGPO-3263 | Enabler | Aceito | Pré-requisito: status, serviço e tabelas |

PGPO-3264 aparece como dependência entregue na descrição do card, mas não é vínculo direto do Jira.

## Subtarefas e bugs

| Card | Tipo | Status | Resumo |
|---|---|---|---|
| PGPO-3619 | Sub-task | Aceito | [Back-end] Retornar dados para o formulário da nova solicitação |
| PGPO-3620 | Sub-task | Aceito | [Back-end] Criar endpoint de solicitação com e-mail de destino e flag de atualização |
| PGPO-3621 | Sub-task | Aceito | [Back-end] Mapear o status EM_PROCESSAMENTO nos enums e conversões |
| PGPO-3622 | Sub-task | Em Andamento | [Front-end] Exibir o autosserviço e carregar competências do aluno |
| PGPO-3623 | Sub-task | Aceito | [Front-end] Implementar edição do e-mail e modal de atualização |
| PGPO-3624 | Sub-task | Aceito | [Front-end] Tratar estados de envio, sucesso e bloqueio por solicitação em andamento |
| PGPO-3625 | Sub-task | Backlog | [Teste] Cobrir cenários com e sem atualização de e-mail e subida nos ambientes |
| PGPO-3630 | Sub-teste | Aceito | [QA] Criação de cenários de teste |
| PGPO-3631 | Sub-teste | Backlog | [QA] Execução de cenários de teste |

Bugs vinculados: nenhum encontrado.

## Comentários e anexos

- Anexos: nenhum.
- Comentários: a leitura trouxe apenas notas automáticas de inclusão na sprint SP 26.4.3. A resposta foi truncada, então os demais comentários não foram conferidos.

## Confluence ligado

- Página de Protótipo Figma citada no card: "Solicitação de serviço - Nota Fiscal" e "Modal de Atualização de E-mail". Não foi acessada nesta leitura (Figma não está no escopo do MCP Atlassian).

## Hipóteses e itens indisponíveis

- PGPO-3267 (tela de detalhes) e PGPO-3268 (processamento e envio) estão fora do escopo deste card. Seus casos já existentes na pasta SP 26.4.3 não entram nesta análise.
- A massa de teste (aluno com mais de uma matrícula, tenant com serviço ligado e desligado) ainda não foi confirmada.
- O repositório `cosmos-lms-frontend` e `cosmos-lms-service` ainda não está no workspace; a análise de código depende de acesso aprovado.
