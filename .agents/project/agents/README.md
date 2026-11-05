# Agentes próprios do projeto

Coloque aqui agentes específicos da equipe (um `.md` por agente) e registre-os
em `extensions.<ponto>` do `qa-project.yaml`.

Um agente de extensão:

- acrescenta informação, perguntas, verificações ou artefatos;
- **não** pula gates, não muda o destino do push e não relaxa regras do núcleo.

Modelo:

```markdown
# <Nome do agente>

Ponto de extensão: after_discovery | before_bdd | before_automation | after_run | before_delivery
Missão: <o que ele acrescenta ao fluxo>
Entradas: <arquivos de qa/runs/<CARD>/ que lê>
Saídas: <o que escreve e onde>
Limites: <o que não pode fazer>
```
