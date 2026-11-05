import { Page } from '@playwright/test';
import { BasePage } from '../../../../../shared/pages/BasePage';

export interface DisciplineRow {
	id: string;
	order: string;
	name: string;
	workload: string;
	status: string;
	type: string;
}

/**
 * Tabela de disciplinas do PPC, usada tanto no formulário do Infoprodutor quanto
 * no modo de revisão do Coordenador.
 */
export class DisciplinesTable extends BasePage {
	readonly table = this.testId('disciplines-table');

	constructor(page: Page) {
		super(page);
	}

	/** Lê a tabela como está renderizada na tela. */
	async readRows(): Promise<DisciplineRow[]> {
		return this.page
			.locator('[data-testid^="discipline-row-"]')
			.evaluateAll((rows) =>
				rows.map((row) => {
					const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
						(cell.textContent ?? '').trim(),
					);
					return {
						id:
							row.getAttribute('data-testid')?.replace('discipline-row-', '') ??
							'',
						order: cells[0] ?? '',
						name: cells[1] ?? '',
						workload: cells[2] ?? '',
						status: cells[3] ?? '',
						type: cells[4] ?? '',
					};
				}),
			);
	}

	actionsMenu(disciplineId: string) {
		return this.testId(`actions-discipline-${disciplineId}`);
	}

	/** Item do menu da linha: `editar`, `preencher` ou `revisar`. */
	menuItem(action: 'editar' | 'preencher' | 'revisar', disciplineId: string) {
		return this.testId(`${action}-discipline-${disciplineId}`);
	}
}
