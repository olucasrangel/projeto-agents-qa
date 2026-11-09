# Contexto Confluence — PGPO-3266

## Padrões corporativos consultados

| Página | ID | Versão | Padrão aplicável |
|---|---|---|---|
| QA - Capítulo de Qualidade de Software | 2365980676 | 4 | Processos padronizados, automação em fluxos críticos e regressão, testes manuais continuam necessários para validação visual e exploratória |
| QA - Treinamento: Escrevendo Casos de Teste em BDD | 2365980783 | 1 | Given/When/And/Then; título iniciado por "Validar"; um comportamento por cenário; sem "ou" e sem "se" nos passos |
| QA - Criando Casos de Teste | 2365980959 | 1 | Nome `[Chave da História][Tipo de Aplicação][Falha/Sucesso] Descrição`; objetivo; precondições obrigatórias; status Approved; script BDD-Gherkin |
| QA - Organização das Pastas no Zephyr | 2365980901 | 2 | Ano → PI → SP → pasta com o nome completo da história conforme o Jira |
| QA - Integração Automação ↔ Zephyr Scale | 3064627241 | 4 | Programa de rastreabilidade entre Test Cases, código e execuções. Sem regra específica para este card |

## Páginas ligadas à tarefa

| Página | Aplicabilidade |
|---|---|
| Ver os 5 padrões acima | Aplicável |
| Dossiês START, Guia Executivo e outras páginas de produtos | Não aplicável: pertencem a outras histórias |

## Decisões de teste derivadas

- Nomes dos cenários seguem `[PGPO-3266][Web][Sucesso|Falha] Validar ...`.
- Cada cenário tem um único comportamento; os passos evitam "ou" e "se".
- Precondição dos casos recebe os passos Dado.
- Pasta da história segue Ano → PI → SP → nome completo do card.
- Casos criados pelo agente vão para uma pasta com "(Automação)", conforme a orientação do QA.

## Divergências entre documentação e estrutura real

1. Os 19 casos existentes na VPOS usam `TC01 - ...`, sem chave nem tipo de aplicação. Diverge do padrão de nome.
2. Os 19 casos existentes têm precondição vazia. Diverge do padrão de criação.
3. A pasta existente se chama "confirmar-editar", e o Jira diz "confirmar/editar". Diverge do padrão de nome completo.
4. O padrão Cogna e Zephyr usa `Feature/Scenario/Given/When/Then` em inglês, com títulos e passos de negócio em português. A skill `bdd-gherkin` foi alinhada a esse padrão.
5. A estrutura de pastas do Zephyr (2026 → PI 26.4 → SP 26.4.3) segue o padrão Ano → PI → SP.

## Itens não aplicáveis

- Padrões de automação de performance, segurança e DoR de testes integrados: fora do escopo deste card.
