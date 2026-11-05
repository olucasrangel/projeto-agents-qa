---
name: test-design
description: Técnicas de projeto de teste e priorização por risco usadas pelo agente de QA para decidir quais cenários escrever — partição de equivalência, valor-limite, tabela de decisão, transição de estado e risco. Use ao derivar cenários de critérios de aceite.
---

# Projeto de teste

Aplique a técnica que o critério pede; não use todas sempre.

| Técnica | Quando usar | Saída |
|---|---|---|
| Partição de equivalência | Campo com classes válidas/ inválidas | 1 cenário por classe relevante |
| Valor-limite | Mínimos, máximos, tamanhos, datas | Limite, limite−1, limite+1 |
| Tabela de decisão | Regra com várias condições combinadas | 1 cenário por regra distinta |
| Transição de estado | Entidade com status (máquina de estados) | Transições válidas + 1 inválida crítica |
| Caso de uso / jornada | Fluxo ponta a ponta entre perfis | 1 cenário por jornada principal |

## Priorização por risco

Risco = impacto no negócio × probabilidade de falha.

- `@critical`: bloqueia operação, dinheiro, dado legal ou acesso.
- `@high`: funcionalidade principal do card sem contorno simples.
- `@medium`: variação, mensagem, comportamento secundário.

Comece pelos `@critical`. Se a quantidade de cenários passar de ~10 para um card,
proponha ao QA o que fica como `@manual` ou fora do escopo.
