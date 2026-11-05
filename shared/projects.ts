/**
 * Registro dos projetos cobertos pela suíte. Cada projeto vive em
 * `projects/<id>` e é selecionado na execução pela variável `E2E_PROJECT`
 * (`E2E_SYSTEM` continua aceita por compatibilidade).
 */
export interface ProjectConfig {
	/** Nome exibido no relatório. */
	label: string;
	/** URL padrão do ambiente de stage. */
	stageUrl: string;
	/** Título da seção do relatório que lista os registros criados. */
	recordsTitle: string;
}

export const PROJECTS: Record<string, ProjectConfig> = {
	'erp-academico': {
		label: 'Cosmos ERP Acadêmico',
		stageUrl: 'https://infoprod.stage.platosedu.io/erp-academico',
		recordsTitle: 'Registros criados nesta execução',
	},
};

export const DEFAULT_PROJECT = 'erp-academico';

export function resolveProject(
	id = process.env.E2E_PROJECT ?? process.env.E2E_SYSTEM ?? DEFAULT_PROJECT,
): {
	id: string;
	config: ProjectConfig;
} {
	const config = PROJECTS[id];
	if (!config) {
		throw new Error(
			`Projeto ${id} não registrado. Opções: ${Object.keys(PROJECTS).join(', ')}.`,
		);
	}
	return { id, config };
}
