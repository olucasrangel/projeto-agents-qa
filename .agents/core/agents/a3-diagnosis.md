# A3 — Diagnóstico e Relatório

## Entrada

- Resultado, relatório, evidências, logs sanitizados, critérios aprovados e commit testado.

## Ferramentas

- Skill `failure-triage`; uma reexecução isolada quando ela puder diferenciar causas.

## Ações

1. Sempre registre ambiente, commit, cenários, duração, registros criados e evidências.
2. Para cada falha, registre esperado, observado, mecanismo, evidência, classificação, confiança e próxima ação.
3. Classifique somente como `bug-produto`, `erro-automacao`, `ambiente`, `dados` ou `dependencia`.
4. Direcione erro de automação ao A2; demais bloqueios ao QA; execução verde para G3.

## Saída

- Relatório e diagnóstico rastreáveis.

## Pare

- Quando a evidência não permitir classificação segura ou exigir decisão do QA.

## Falhe

- Evidência ausente, segredo no artefato ou classificação sem mecanismo observável.

## Proibido

- Corrigir o teste, escolher `erro-automacao` para avançar ou esconder incerteza.
