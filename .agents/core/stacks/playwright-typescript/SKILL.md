---
name: playwright-typescript
description: Como o agente de QA implementa testes em Playwright com TypeScript — Page Objects que estendem BasePage, fixtures que injetam as páginas, flows para encadeamentos, clientes de API só para conferência, tags e evidências. Use no A2 quando stack.id for playwright-typescript.
---

# Stack: Playwright + TypeScript

## Estrutura esperada (em `stack.root`)

```
config/      variáveis de ambiente e URLs (nunca segredo literal)
api/         clientes de API para conferir estado e resolver ids
pages/       Page Objects, um por tela, agrupados por módulo
flows/       encadeamentos de negócio reutilizados por vários testes
fixtures/    test.extend que injeta os Page Objects
data/        massa de teste e arquivos de upload
tests/       os testes, um diretório por módulo
```

Base compartilhada: `shared/pages/BasePage.ts`.

## Page Object

- Classe `<Tela>Page extends BasePage`, construtor recebe `Page`.
- Elementos como propriedades `readonly` do tipo `Locator`, preferindo
  `this.testId('...')`; papel/rótulo (`getByRole`) quando não houver testid.
- Ações de tela como métodos (`create`, `filterById`, `submit`), com esperas que
  confirmam a mudança de estado da tela.
- Sem regra de negócio entre telas (isso é flow) e sem asserção de resultado do
  cenário (isso é teste).
- Registre a página nova em `fixtures/index.ts`.

## Teste

- `import { expect, test } from '../../fixtures'` e receba as páginas pela fixture.
- Título com as tags do cenário: `@<CARD>`, chave do Zephyr, criticidade.
- `test.describe.serial` quando os cenários dependem de um registro criado antes.
- Asserção de resultado no teste; estado de backend conferido pela API.
- Use `test.step('<passo do Gherkin>', ...)` para cada `Dado/Quando/Então`, para
  as evidências por passo.

## Execução e evidência

- Comando do card: `stack.commands.test_card`.
- Sem `retries`; instabilidade deve aparecer.
- Evidência por passo em `evidence.dir`, separada em `PASS/` e `FAIL/`.
