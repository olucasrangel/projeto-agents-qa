# Linha de base — suíte erp-academico em stage

- Data: 06/11/2026, 17:2x (primeira execução com credenciais válidas no `.env`)
- Ambiente: https://infoprod.stage.platosedu.io/erp-academico
- Commit da suíte: 42d6903 (sem as mudanças de evidência por passo)
- Comando: `npm run test:e2e` (workers 1, retries 0, Chromium do Playwright 1.62.1)
- Relatório completo: `test-results/relatorio-erp-academico.md` (gerado localmente, não versionado)

## Resultado

| Situação | Quantidade |
|---|---|
| Passou | 14 |
| Falhou | 3 |
| Não executado | 8 |
| Total | 25 |

## Passou (14)

- Acesso externo com link inválido (3): link sem token, token inexistente e formulário sem sessão.
- Documentos do PPC (2): baixa o PPC versionado e baixa o documento completo.
- Listagem de PPCs (6): busca por identificador, busca por nome, filtro por status, ordenação, paginação e aba Concluídos.
- Banco de Questões (3): abre o banco pronto, edita o enunciado e exclui uma questão, e envia o banco para o Cosmos.

## Falhou (3)

Os três falham no mesmo passo de criação de PPC (`PpcListPage.createPPC`, linha 222):

- `fluxo-completo.spec.ts`: "Coordenador cria o PPC, copia o link e o Infoprodutor preenche e envia"
- `pausar-cancelar.spec.ts`: "Coordenador cria o PPC que será pausado e cancelado"
- `revisao-reprovada.spec.ts`: "Coordenador cria o PPC, copia o link e o Infoprodutor preenche e envia"

Erro: `locator.fill: Element is not an <input>, <textarea> or [contenteditable] element` no campo `input-area-conhecimento`.
No stage, esse campo é um `<select>` (`name="area_conhecimento"`). A automação ainda chama `fill`.

Classificação preliminar: erro da automação (seletor desatualizado). Não verifiquei se a mudança para `<select>` é intencional do produto.

## Não executado (8)

Testes seguintes nos mesmos blocos seriais dos três falhos: 2 em `fluxo-completo`, 3 em `pausar-cancelar` e 3 em `revisao-reprovada`. Dependem da criação do PPC que falhou.

## Observações

- Os 14 testes que passaram criaram registros reais em stage.
- O reporter de evidência não grava nada para esta suíte, porque nenhum teste tem tag de card (`@CARD`) e de caso (`@VPOS-Txxx`) via opção `tag`.
- Esta linha de base não corrige nada. A correção do campo de área de conhecimento deve ser feita em PR separada.
